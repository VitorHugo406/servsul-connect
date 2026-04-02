import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const brasiliaOffset = -3;
    const brasiliaTime = new Date(now.getTime() + brasiliaOffset * 60 * 60 * 1000);
    const currentHour = String(brasiliaTime.getUTCHours()).padStart(2, '0');
    const currentMinute = String(brasiliaTime.getUTCMinutes()).padStart(2, '0');
    const currentTime = `${currentHour}:${currentMinute}`;
    const currentWeekday = brasiliaTime.getUTCDay();
    const currentMonthDay = brasiliaTime.getUTCDate();

    // Fetch active summaries that match current time
    const { data: summaries, error } = await admin
      .from('scheduled_summaries')
      .select('*')
      .eq('is_active', true)
      .eq('send_time', currentTime);

    if (error) throw error;

    let sent = 0;

    for (const summary of (summaries || [])) {
      // Check frequency match
      if (summary.frequency === 'weekly' && summary.weekday !== currentWeekday) continue;
      if (summary.frequency === 'monthly' && summary.month_day !== currentMonthDay) continue;

      // Get the admin profile (sender)
      const { data: adminProfile } = await admin
        .from('profiles')
        .select('id, name, display_name')
        .eq('user_id', summary.created_by)
        .single();

      if (!adminProfile) continue;

      // Get member profile IDs based on target type
      let memberProfileIds: string[] = [];

      if (summary.target_type === 'group') {
        const { data: members } = await admin
          .from('private_group_members')
          .select('profile_id')
          .eq('group_id', summary.target_id);
        memberProfileIds = (members || []).map(m => m.profile_id);
      } else if (summary.target_type === 'sector') {
        const { data: profiles } = await admin
          .from('profiles')
          .select('id')
          .eq('sector_id', summary.target_id)
          .eq('is_active', true);
        
        // Also get users with this as additional sector
        const { data: additionalUsers } = await admin
          .from('user_additional_sectors')
          .select('user_id')
          .eq('sector_id', summary.target_id);
        
        const additionalProfileIds: string[] = [];
        if (additionalUsers && additionalUsers.length > 0) {
          const { data: addProfiles } = await admin
            .from('profiles')
            .select('id')
            .in('user_id', additionalUsers.map(u => u.user_id));
          if (addProfiles) additionalProfileIds.push(...addProfiles.map(p => p.id));
        }

        memberProfileIds = [
          ...(profiles || []).map(p => p.id),
          ...additionalProfileIds,
        ];
        memberProfileIds = [...new Set(memberProfileIds)];
      }

      if (memberProfileIds.length === 0) continue;

      // Get member profiles
      const { data: memberProfiles } = await admin
        .from('profiles')
        .select('id, name, display_name')
        .in('id', memberProfileIds);

      if (!memberProfiles || memberProfiles.length === 0) continue;

      const metrics: string[] = Array.isArray(summary.metrics) ? summary.metrics : [];

      // Gather data per member
      const memberStats: {
        name: string;
        completedOnTime: number;
        completedLate: number;
        pendingTasks: number;
        overdueTasks: number;
        totalMessages: number;
      }[] = [];

      for (const mp of memberProfiles) {
        const stats = {
          name: mp.display_name || mp.name,
          completedOnTime: 0,
          completedLate: 0,
          pendingTasks: 0,
          overdueTasks: 0,
          totalMessages: 0,
        };

        // Calculate date range based on frequency
        // For monthly: use previous month's data only
        // For weekly: use previous week's data
        // For daily: use previous day's data
        let periodStart: Date | null = null;
        let periodEnd: Date | null = null;
        
        if (summary.frequency === 'monthly') {
          const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          periodStart = prevMonth;
          periodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        } else if (summary.frequency === 'weekly') {
          periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          periodEnd = now;
        } else {
          periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          periodEnd = now;
        }

        if (metrics.includes('completed_on_time') || metrics.includes('completed_late')) {
          let query = admin
            .from('tasks')
            .select('id, completed_at, completed_late, status, due_date')
            .eq('assigned_to', mp.id)
            .eq('is_archived', false)
            .not('completed_at', 'is', null);

          if (periodStart) query = query.gte('completed_at', periodStart.toISOString());
          if (periodEnd) query = query.lte('completed_at', periodEnd.toISOString());

          const { data: tasks } = await query;

          if (tasks) {
            stats.completedOnTime = tasks.filter(t => !t.completed_late).length;
            stats.completedLate = tasks.filter(t => t.completed_late).length;
          }
        }

        if (metrics.includes('pending_tasks') || metrics.includes('overdue_tasks')) {
          const { data: pendingTasks } = await admin
            .from('tasks')
            .select('id, due_date, completed_at')
            .eq('assigned_to', mp.id)
            .eq('is_archived', false)
            .is('completed_at', null);

          if (pendingTasks) {
            stats.pendingTasks = pendingTasks.length;
            stats.overdueTasks = pendingTasks.filter(t => t.due_date && new Date(t.due_date) < now).length;
          }
        }

        if (metrics.includes('total_messages')) {
          let msgQ = admin
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('author_id', mp.id);
          if (periodStart) msgQ = msgQ.gte('created_at', periodStart.toISOString());
          if (periodEnd) msgQ = msgQ.lte('created_at', periodEnd.toISOString());

          let dmQ = admin
            .from('direct_messages')
            .select('id', { count: 'exact', head: true })
            .eq('sender_id', mp.id);
          if (periodStart) dmQ = dmQ.gte('created_at', periodStart.toISOString());
          if (periodEnd) dmQ = dmQ.lte('created_at', periodEnd.toISOString());

          const { count: msgCount } = await msgQ;
          const { count: dmCount } = await dmQ;

          stats.totalMessages = (msgCount || 0) + (dmCount || 0);
        }

        memberStats.push(stats);
      }

      // Build message content
      const isVisual = summary.format === 'visual';
      let messageContent = '';

      const frequencyLabel = summary.frequency === 'daily' ? 'Diário' : summary.frequency === 'weekly' ? 'Semanal' : 'Mensal';
      
      // Build period label
      let periodLabel = '';
      if (summary.frequency === 'monthly') {
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        periodLabel = `Período: ${monthNames[prevMonth.getMonth()]}/${prevMonth.getFullYear()}`;
      } else if (summary.frequency === 'weekly') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        periodLabel = `Período: ${weekAgo.toLocaleDateString('pt-BR')} a ${now.toLocaleDateString('pt-BR')}`;
      } else {
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        periodLabel = `Período: ${yesterday.toLocaleDateString('pt-BR')}`;
      }
      const totals = {
        completedOnTime: memberStats.reduce((s, m) => s + m.completedOnTime, 0),
        completedLate: memberStats.reduce((s, m) => s + m.completedLate, 0),
        pendingTasks: memberStats.reduce((s, m) => s + m.pendingTasks, 0),
        overdueTasks: memberStats.reduce((s, m) => s + m.overdueTasks, 0),
        totalMessages: memberStats.reduce((s, m) => s + m.totalMessages, 0),
      };

      if (isVisual) {
        messageContent = `📊 *Resumo ${frequencyLabel} da Equipe*\n`;
        messageContent += `📅 ${periodLabel}\n`;
        messageContent += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

        for (const ms of memberStats) {
          messageContent += `👤 *${ms.name}*\n`;
          const lines: string[] = [];
          if (metrics.includes('completed_on_time')) lines.push(`  ✅ No prazo: *${ms.completedOnTime}*`);
          if (metrics.includes('completed_late')) lines.push(`  ⚠️ Com atraso: *${ms.completedLate}*`);
          if (metrics.includes('pending_tasks')) lines.push(`  📋 Pendentes: *${ms.pendingTasks}*`);
          if (metrics.includes('overdue_tasks')) lines.push(`  🔴 Atrasadas: *${ms.overdueTasks}*`);
          if (metrics.includes('total_messages')) lines.push(`  💬 Mensagens: *${ms.totalMessages}*`);
          messageContent += lines.join('\n') + '\n\n';
        }

        messageContent += `━━━━━━━━━━━━━━━━━━━━━\n`;
        messageContent += `📈 *Resumo Geral*\n`;
        const totalLines: string[] = [];
        if (metrics.includes('completed_on_time')) totalLines.push(`  ✅ Total no prazo: *${totals.completedOnTime}*`);
        if (metrics.includes('completed_late')) totalLines.push(`  ⚠️ Total com atraso: *${totals.completedLate}*`);
        if (metrics.includes('pending_tasks')) totalLines.push(`  📋 Total pendentes: *${totals.pendingTasks}*`);
        if (metrics.includes('overdue_tasks')) totalLines.push(`  🔴 Total atrasadas: *${totals.overdueTasks}*`);
        if (metrics.includes('total_messages')) totalLines.push(`  💬 Total mensagens: *${totals.totalMessages}*`);
        messageContent += totalLines.join('\n') + '\n\n';
        messageContent += `━━━━━━━━━━━━━━━━━━━━━\n`;
        messageContent += `🤖 _Resumo automático gerado pelo sistema_`;
      } else {
        messageContent = `📊 Resumo ${frequencyLabel} da Equipe\n\n`;

        for (const ms of memberStats) {
          messageContent += `• ${ms.name}: `;
          const parts: string[] = [];
          if (metrics.includes('completed_on_time')) parts.push(`${ms.completedOnTime} no prazo`);
          if (metrics.includes('completed_late')) parts.push(`${ms.completedLate} com atraso`);
          if (metrics.includes('pending_tasks')) parts.push(`${ms.pendingTasks} pendentes`);
          if (metrics.includes('overdue_tasks')) parts.push(`${ms.overdueTasks} atrasadas`);
          if (metrics.includes('total_messages')) parts.push(`${ms.totalMessages} msgs`);
          messageContent += parts.join(' | ') + '\n';
        }

        messageContent += `\n📈 Resumo Geral: `;
        const totalParts: string[] = [];
        if (metrics.includes('completed_on_time')) totalParts.push(`${totals.completedOnTime} no prazo`);
        if (metrics.includes('completed_late')) totalParts.push(`${totals.completedLate} com atraso`);
        if (metrics.includes('pending_tasks')) totalParts.push(`${totals.pendingTasks} pendentes`);
        if (metrics.includes('overdue_tasks')) totalParts.push(`${totals.overdueTasks} atrasadas`);
        if (metrics.includes('total_messages')) totalParts.push(`${totals.totalMessages} msgs`);
        messageContent += totalParts.join(' | ') + '\n';

        messageContent += `\n🤖 Resumo automático gerado pelo sistema`;
      }

      // Send message to the target
      if (summary.target_type === 'group') {
        await admin.from('private_group_messages').insert({
          group_id: summary.target_id,
          sender_id: adminProfile.id,
          content: messageContent,
        });
        sent++;
      } else if (summary.target_type === 'sector') {
        await admin.from('messages').insert({
          sector_id: summary.target_id,
          author_id: adminProfile.id,
          content: messageContent,
        });
        sent++;
      }
    }

    return new Response(
      JSON.stringify({ sent, checked: (summaries || []).length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending scheduled summaries:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
