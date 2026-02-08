import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ADMIN_EMAIL = 'adminservchat@servsul.com.br';

async function deleteAll(client: any, table: string, filter?: { column: string; op: string; value: any }) {
  try {
    let query = client.from(table).delete();
    if (filter) {
      if (filter.op === 'neq') {
        query = query.neq(filter.column, filter.value);
      } else {
        query = query.gte(filter.column, filter.value);
      }
    } else {
      // Use neq with empty string on id to match all rows - more reliable than gte
      query = query.neq('id', '00000000-0000-0000-0000-000000000000');
    }
    const { error } = await query;
    if (error) {
      console.error(`Error deleting from ${table}:`, error.code, error.message, error.details);
      // If the first approach fails, try alternative
      if (error.code === '22P02' || error.message?.includes('invalid input')) {
        console.log(`Retrying ${table} with text-based filter...`);
        const { error: retryError } = await client.from(table).delete().gt('created_at', '1970-01-01');
        if (retryError) {
          console.error(`Retry failed for ${table}:`, retryError.message);
          return retryError;
        }
        return null;
      }
    }
    return error;
  } catch (e) {
    console.error(`Exception deleting from ${table}:`, e);
    return e;
  }
}

// Nullify FK references to profiles in tables we want to keep
async function nullifyProfileReferences(client: any, adminProfileId: string) {
  // Nullify auto_assign_to in task_board_columns (FK to profiles)
  const { error: colErr } = await client
    .from('task_board_columns')
    .update({ auto_assign_to: null })
    .neq('auto_assign_to', adminProfileId);
  if (colErr) console.error('Error nullifying task_board_columns.auto_assign_to:', colErr.message);

  // Nullify assigned_to in tasks (FK to profiles)
  const { error: taskErr } = await client
    .from('tasks')
    .update({ assigned_to: null })
    .neq('assigned_to', adminProfileId);
  if (taskErr) console.error('Error nullifying tasks.assigned_to:', taskErr.message);
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
    const errors: string[] = [];

    const safeDelete = async (table: string, filter?: { column: string; op: string; value: any }) => {
      const err = await deleteAll(adminClient, table, filter);
      if (err) errors.push(`${table}: ${err.message}`);
    };

    switch (type) {
      case 'messages': {
        console.log('Deleting all messages...');
        await safeDelete('attachments');
        await safeDelete('private_group_messages');
        await safeDelete('private_group_message_reads');
        await safeDelete('direct_messages');
        await safeDelete('messages');
        result.message = 'Todas as mensagens foram excluídas';
        break;
      }

      case 'announcements': {
        console.log('Deleting all announcements...');
        await safeDelete('attachments');
        await safeDelete('announcement_comments');
        await safeDelete('announcement_reads');
        await safeDelete('announcements');
        await safeDelete('important_announcement_reads');
        await safeDelete('important_announcements');
        result.message = 'Todos os avisos foram excluídos';
        break;
      }

      case 'facial': {
        console.log('Deleting facial data (except main admin)...');
        await safeDelete('user_facial_data', { column: 'user_id', op: 'neq', value: adminUserId });
        result.message = 'Todos os dados faciais foram excluídos (exceto admin principal)';
        break;
      }

      case 'tasks': {
        console.log('Deleting all task data...');
        await safeDelete('task_comments');
        await safeDelete('task_subtasks');
        await safeDelete('task_label_assignments');
        await safeDelete('tasks');
        await safeDelete('task_labels');
        await safeDelete('task_board_columns');
        await safeDelete('task_board_members');
        await safeDelete('task_boards');
        result.message = 'Todos os dados de tarefas foram excluídos';
        break;
      }

      case 'users': {
        console.log('Inactivating all users (except main admin)...');
        // Nullify FK references to profiles in tables we keep
        await nullifyProfileReferences(adminClient, adminProfileId);
        // Delete dependent data
        await safeDelete('supervisor_team_members', { column: 'supervisor_id', op: 'neq', value: adminUserId });
        await safeDelete('user_permissions', { column: 'user_id', op: 'neq', value: adminUserId });
        await safeDelete('user_roles', { column: 'user_id', op: 'neq', value: adminUserId });
        await safeDelete('user_presence', { column: 'user_id', op: 'neq', value: adminUserId });
        await safeDelete('user_facial_data', { column: 'user_id', op: 'neq', value: adminUserId });
        await safeDelete('user_additional_sectors', { column: 'user_id', op: 'neq', value: adminUserId });
        // Inactivate profiles
        const { error } = await adminClient.from('profiles').update({ is_active: false }).neq('email', ADMIN_EMAIL);
        if (error) errors.push(`profiles update: ${error.message}`);
        result.message = 'Todos os usuários foram inativados (exceto admin principal)';
        break;
      }

      case 'delete-users': {
        console.log('Permanently deleting all users (except main admin)...');
        const { data: usersToDelete } = await adminClient
          .from('profiles')
          .select('user_id')
          .neq('email', ADMIN_EMAIL);

        // 1. Delete ALL content data first (no user filter needed - deleting everything)
        await safeDelete('attachments');
        // Messages
        await safeDelete('private_group_messages');
        await safeDelete('private_group_message_reads');
        await safeDelete('private_group_members');
        await safeDelete('private_groups');
        await safeDelete('direct_messages');
        await safeDelete('messages');
        // Announcements - MUST delete before profiles (author_id FK)
        await safeDelete('announcement_comments');
        await safeDelete('announcement_reads');
        await safeDelete('announcements');
        await safeDelete('important_announcement_reads');
        await safeDelete('important_announcements');
        // Tasks - MUST delete before profiles (assigned_to, author_id FKs)
        await safeDelete('task_comments');
        await safeDelete('task_subtasks');
        await safeDelete('task_label_assignments');
        await safeDelete('tasks');
        await safeDelete('task_labels');
        await safeDelete('task_board_columns');
        await safeDelete('task_board_members');
        await safeDelete('task_boards');
        // Notifications
        await safeDelete('user_notifications', { column: 'user_id', op: 'neq', value: adminUserId });
        // User-specific data
        await safeDelete('supervisor_team_members', { column: 'supervisor_id', op: 'neq', value: adminUserId });
        await safeDelete('user_permissions', { column: 'user_id', op: 'neq', value: adminUserId });
        await safeDelete('user_roles', { column: 'user_id', op: 'neq', value: adminUserId });
        await safeDelete('user_presence', { column: 'user_id', op: 'neq', value: adminUserId });
        await safeDelete('user_facial_data', { column: 'user_id', op: 'neq', value: adminUserId });
        await safeDelete('user_additional_sectors', { column: 'user_id', op: 'neq', value: adminUserId });
        // NOW safe to delete profiles
        await safeDelete('profiles', { column: 'email', op: 'neq', value: ADMIN_EMAIL });

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
        // Attachments first
        await safeDelete('attachments');
        // Messages
        await safeDelete('private_group_messages');
        await safeDelete('private_group_message_reads');
        await safeDelete('private_group_members');
        await safeDelete('private_groups');
        await safeDelete('direct_messages');
        await safeDelete('messages');
        // Announcements
        await safeDelete('announcement_comments');
        await safeDelete('announcement_reads');
        await safeDelete('announcements');
        await safeDelete('important_announcement_reads');
        await safeDelete('important_announcements');
        // Tasks
        await safeDelete('task_comments');
        await safeDelete('task_subtasks');
        await safeDelete('task_label_assignments');
        await safeDelete('tasks');
        await safeDelete('task_labels');
        await safeDelete('task_board_columns');
        await safeDelete('task_board_members');
        await safeDelete('task_boards');
        // Notifications
        await safeDelete('user_notifications');
        // User data (except admin)
        await nullifyProfileReferences(adminClient, adminProfileId);
        await safeDelete('supervisor_team_members', { column: 'supervisor_id', op: 'neq', value: adminUserId });
        await safeDelete('user_permissions', { column: 'user_id', op: 'neq', value: adminUserId });
        await safeDelete('user_roles', { column: 'user_id', op: 'neq', value: adminUserId });
        await safeDelete('user_presence', { column: 'user_id', op: 'neq', value: adminUserId });
        await safeDelete('user_facial_data', { column: 'user_id', op: 'neq', value: adminUserId });
        await safeDelete('user_additional_sectors', { column: 'user_id', op: 'neq', value: adminUserId });
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

    if (errors.length > 0) {
      console.warn(`Deletion completed with ${errors.length} errors:`, errors);
      result.message += ` (${errors.length} avisos durante execução)`;
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
