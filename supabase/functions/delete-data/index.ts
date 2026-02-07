import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ADMIN_EMAIL = 'adminservchat@servsul.com.br';

// Helper to delete all rows from a table with proper filter
async function deleteAll(client: any, table: string, filter?: { column: string; op: string; value: any }) {
  let query = client.from(table).delete();
  if (filter) {
    if (filter.op === 'neq') {
      query = query.neq(filter.column, filter.value);
    } else {
      query = query.gte(filter.column, filter.value);
    }
  } else {
    // Use a filter that matches all rows
    query = query.gte('id', '00000000-0000-0000-0000-000000000000');
  }
  const { error } = await query;
  if (error) {
    console.error(`Error deleting from ${table}:`, error.message);
  }
  return error;
}

serve(async (req) => {
  console.log('Delete-data function called');
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado - sem token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado - token inválido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { data: userRoles } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const { data: userProfile } = await adminClient
      .from('profiles')
      .select('id, email, user_id')
      .eq('user_id', user.id)
      .single();

    if (!userProfile) {
      return new Response(
        JSON.stringify({ error: 'Perfil não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const hasAdminRole = userRoles?.some(r => r.role === 'admin');
    const isMainAdmin = userProfile.email === ADMIN_EMAIL;
    
    if (!hasAdminRole && !isMainAdmin) {
      return new Response(
        JSON.stringify({ error: 'Apenas administradores podem executar esta ação' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const body = await req.json();
    const { type } = body;
    console.log('Deletion type:', type);

    const { data: mainAdminProfile } = await adminClient
      .from('profiles')
      .select('id, user_id')
      .eq('email', ADMIN_EMAIL)
      .single();

    if (!mainAdminProfile) {
      return new Response(
        JSON.stringify({ error: 'Perfil do administrador principal não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const adminUserId = mainAdminProfile.user_id;
    const adminProfileId = mainAdminProfile.id;
    let result = { success: true, message: '' };

    switch (type) {
      case 'messages': {
        console.log('Deleting all messages...');
        // Delete attachments linked to messages first (FK constraint)
        await deleteAll(adminClient, 'attachments');
        // Then delete messages
        await deleteAll(adminClient, 'private_group_messages');
        await deleteAll(adminClient, 'direct_messages');
        await deleteAll(adminClient, 'messages');
        result.message = 'Todas as mensagens foram excluídas';
        break;
      }

      case 'announcements': {
        console.log('Deleting all announcements...');
        // Delete attachments linked to announcements first
        await deleteAll(adminClient, 'attachments');
        await deleteAll(adminClient, 'announcement_comments');
        await deleteAll(adminClient, 'announcement_reads');
        await deleteAll(adminClient, 'important_announcement_reads');
        await deleteAll(adminClient, 'important_announcements');
        await deleteAll(adminClient, 'announcements');
        result.message = 'Todos os avisos foram excluídos';
        break;
      }

      case 'facial': {
        console.log('Deleting facial data (except main admin)...');
        await deleteAll(adminClient, 'user_facial_data', { column: 'user_id', op: 'neq', value: adminUserId });
        result.message = 'Todos os dados faciais foram excluídos (exceto admin principal)';
        break;
      }

      case 'tasks': {
        console.log('Deleting all task data...');
        await deleteAll(adminClient, 'task_comments');
        await deleteAll(adminClient, 'task_subtasks');
        await deleteAll(adminClient, 'task_label_assignments');
        await deleteAll(adminClient, 'task_labels');
        await deleteAll(adminClient, 'tasks');
        await deleteAll(adminClient, 'task_board_columns');
        await deleteAll(adminClient, 'task_board_members');
        await deleteAll(adminClient, 'task_boards');
        result.message = 'Todos os dados de tarefas foram excluídos';
        break;
      }

      case 'users': {
        console.log('Inactivating all users (except main admin)...');
        // Delete dependent data first
        await deleteAll(adminClient, 'supervisor_team_members', { column: 'supervisor_id', op: 'neq', value: adminUserId });
        await deleteAll(adminClient, 'user_permissions', { column: 'user_id', op: 'neq', value: adminUserId });
        await deleteAll(adminClient, 'user_roles', { column: 'user_id', op: 'neq', value: adminUserId });
        await deleteAll(adminClient, 'user_presence', { column: 'user_id', op: 'neq', value: adminUserId });
        await deleteAll(adminClient, 'user_facial_data', { column: 'user_id', op: 'neq', value: adminUserId });
        await deleteAll(adminClient, 'user_additional_sectors', { column: 'user_id', op: 'neq', value: adminUserId });
        // Inactivate profiles
        const { error } = await adminClient.from('profiles').update({ is_active: false }).neq('email', ADMIN_EMAIL);
        if (error) console.error('Error inactivating profiles:', error.message);
        result.message = 'Todos os usuários foram inativados (exceto admin principal)';
        break;
      }

      case 'delete-users': {
        console.log('Permanently deleting all users (except main admin)...');
        const { data: usersToDelete } = await adminClient
          .from('profiles')
          .select('user_id')
          .neq('email', ADMIN_EMAIL);

        // Delete ALL dependent data first (order matters for FK constraints)
        await deleteAll(adminClient, 'attachments');
        await deleteAll(adminClient, 'private_group_messages');
        await deleteAll(adminClient, 'private_group_message_reads');
        await deleteAll(adminClient, 'private_group_members');
        await deleteAll(adminClient, 'direct_messages');
        await deleteAll(adminClient, 'messages');
        await deleteAll(adminClient, 'announcement_comments');
        await deleteAll(adminClient, 'announcement_reads');
        await deleteAll(adminClient, 'task_comments');
        await deleteAll(adminClient, 'task_subtasks');
        await deleteAll(adminClient, 'task_label_assignments');
        await deleteAll(adminClient, 'task_board_members');
        await deleteAll(adminClient, 'tasks');
        await deleteAll(adminClient, 'supervisor_team_members', { column: 'supervisor_id', op: 'neq', value: adminUserId });
        await deleteAll(adminClient, 'user_notifications', { column: 'user_id', op: 'neq', value: adminUserId });
        await deleteAll(adminClient, 'important_announcement_reads', { column: 'user_id', op: 'neq', value: adminUserId });
        await deleteAll(adminClient, 'user_permissions', { column: 'user_id', op: 'neq', value: adminUserId });
        await deleteAll(adminClient, 'user_roles', { column: 'user_id', op: 'neq', value: adminUserId });
        await deleteAll(adminClient, 'user_presence', { column: 'user_id', op: 'neq', value: adminUserId });
        await deleteAll(adminClient, 'user_facial_data', { column: 'user_id', op: 'neq', value: adminUserId });
        await deleteAll(adminClient, 'user_additional_sectors', { column: 'user_id', op: 'neq', value: adminUserId });
        // Delete profiles
        await deleteAll(adminClient, 'profiles', { column: 'email', op: 'neq', value: ADMIN_EMAIL });
        
        // Delete auth users
        let authDeleteErrors = 0;
        if (usersToDelete) {
          for (const u of usersToDelete) {
            if (u.user_id !== adminUserId) {
              const { error } = await adminClient.auth.admin.deleteUser(u.user_id);
              if (error) {
                console.error('Error deleting auth user:', u.user_id, error.message);
                authDeleteErrors++;
              }
            }
          }
        }
        result.message = `Todos os usuários foram excluídos permanentemente${authDeleteErrors > 0 ? `. ${authDeleteErrors} erros ao excluir autenticações.` : ''}`;
        break;
      }

      case 'all': {
        console.log('Deleting all data (except main admin)...');
        // Attachments first (references messages, announcements)
        await deleteAll(adminClient, 'attachments');
        // Messages
        await deleteAll(adminClient, 'private_group_messages');
        await deleteAll(adminClient, 'private_group_message_reads');
        await deleteAll(adminClient, 'private_group_members');
        await deleteAll(adminClient, 'private_groups');
        await deleteAll(adminClient, 'direct_messages');
        await deleteAll(adminClient, 'messages');
        // Announcements
        await deleteAll(adminClient, 'announcement_comments');
        await deleteAll(adminClient, 'announcement_reads');
        await deleteAll(adminClient, 'important_announcement_reads');
        await deleteAll(adminClient, 'important_announcements');
        await deleteAll(adminClient, 'announcements');
        // Tasks
        await deleteAll(adminClient, 'task_comments');
        await deleteAll(adminClient, 'task_subtasks');
        await deleteAll(adminClient, 'task_label_assignments');
        await deleteAll(adminClient, 'task_labels');
        await deleteAll(adminClient, 'tasks');
        await deleteAll(adminClient, 'task_board_columns');
        await deleteAll(adminClient, 'task_board_members');
        await deleteAll(adminClient, 'task_boards');
        // Notifications
        await deleteAll(adminClient, 'user_notifications');
        // User data (except admin)
        await deleteAll(adminClient, 'supervisor_team_members', { column: 'supervisor_id', op: 'neq', value: adminUserId });
        await deleteAll(adminClient, 'user_permissions', { column: 'user_id', op: 'neq', value: adminUserId });
        await deleteAll(adminClient, 'user_roles', { column: 'user_id', op: 'neq', value: adminUserId });
        await deleteAll(adminClient, 'user_presence', { column: 'user_id', op: 'neq', value: adminUserId });
        await deleteAll(adminClient, 'user_facial_data', { column: 'user_id', op: 'neq', value: adminUserId });
        await deleteAll(adminClient, 'user_additional_sectors', { column: 'user_id', op: 'neq', value: adminUserId });
        // Inactivate remaining profiles
        await adminClient.from('profiles').update({ is_active: false }).neq('email', ADMIN_EMAIL);
        
        result.message = 'Todo o banco de dados foi limpo (exceto admin principal)';
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Tipo de exclusão inválido' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }

    console.log(`Deletion completed: ${type} by user ${user.id}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error in delete-data:', error.message, error.stack);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});