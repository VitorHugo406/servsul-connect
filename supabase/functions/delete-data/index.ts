 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
 };
 
 const ADMIN_EMAIL = 'adminservchat@servsul.com.br';
 
 serve(async (req) => {
   console.log('Delete-data function called');
   
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   try {
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
     const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
     const authHeader = req.headers.get('Authorization');
     
     console.log('Auth header present:', !!authHeader);
     
     if (!authHeader) {
       console.log('No auth header provided');
       return new Response(
         JSON.stringify({ error: 'Não autorizado - sem token' }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
       );
     }
 
    // Extract token from Authorization header
    const token = authHeader.replace('Bearer ', '');
    
    // Use service role client for all operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    
    // Get user from token using service role
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    
    console.log('User from token:', user?.id, user?.email, 'Error:', userError?.message);
    
    if (userError || !user) {
      console.log('Token validation failed:', userError?.message);
       return new Response(
        JSON.stringify({ error: 'Não autorizado - token inválido' }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
       );
     }
 
     // Get user profile and roles using service role
     const { data: userProfile, error: profileError } = await adminClient
       .from('profiles')
       .select('id, email, user_id')
       .eq('user_id', user.id)
       .single();
 
     console.log('User profile:', userProfile?.email, 'Error:', profileError?.message);
 
    if (profileError || !userProfile) {
      return new Response(
        JSON.stringify({ error: 'Perfil do usuário não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

     const { data: userRoles, error: rolesError } = await adminClient
       .from('user_roles')
       .select('role')
       .eq('user_id', user.id);
 
     console.log('User roles:', userRoles, 'Error:', rolesError?.message);
 
     const hasAdminRole = userRoles?.some(r => r.role === 'admin');
     const isMainAdmin = userProfile?.email === ADMIN_EMAIL;
     
     console.log('Has admin role:', hasAdminRole, 'Is main admin:', isMainAdmin);
     
     if (!hasAdminRole && !isMainAdmin) {
       console.log('User is not admin');
       return new Response(
         JSON.stringify({ error: 'Apenas administradores podem executar esta ação' }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
       );
     }
 
     const body = await req.json();
     const { type } = body;
     
     console.log('Deletion type requested:', type);
 
     // Get admin profile to exclude from deletions
     const { data: mainAdminProfile, error: mainAdminError } = await adminClient
       .from('profiles')
       .select('id, user_id')
       .eq('email', ADMIN_EMAIL)
       .single();
 
     console.log('Main admin profile:', mainAdminProfile?.id, 'Error:', mainAdminError?.message);
 
     if (!mainAdminProfile) {
       return new Response(
         JSON.stringify({ error: 'Perfil do administrador principal não encontrado' }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
       );
     }
 
     let result = { success: true, message: '' };
 
     switch (type) {
       case 'messages': {
         console.log('Deleting all messages...');
         const { error: e1 } = await adminClient.from('messages').delete().gte('created_at', '1970-01-01');
         const { error: e2 } = await adminClient.from('direct_messages').delete().gte('created_at', '1970-01-01');
         const { error: e3 } = await adminClient.from('private_group_messages').delete().gte('created_at', '1970-01-01');
         
         if (e1 || e2 || e3) {
           console.error('Message deletion errors:', e1, e2, e3);
         }
         result.message = 'Todas as mensagens foram excluídas';
         break;
       }
 
       case 'announcements': {
         console.log('Deleting all announcements...');
         const { error: e1 } = await adminClient.from('announcement_comments').delete().gte('created_at', '1970-01-01');
         const { error: e2 } = await adminClient.from('announcement_reads').delete().gte('id', '00000000-0000-0000-0000-000000000000');
         const { error: e3 } = await adminClient.from('announcements').delete().gte('created_at', '1970-01-01');
         
         if (e1 || e2 || e3) {
           console.error('Announcement deletion errors:', e1, e2, e3);
         }
         result.message = 'Todos os avisos foram excluídos';
         break;
       }
 
       case 'facial': {
         console.log('Deleting facial data (except main admin)...');
         const { error } = await adminClient
           .from('user_facial_data')
           .delete()
           .neq('user_id', mainAdminProfile.user_id);
         
         if (error) {
           console.error('Facial deletion error:', error);
         }
         result.message = 'Todos os dados faciais foram excluídos (exceto admin principal)';
         break;
       }
 
       case 'users': {
          console.log('Inactivating all users (except main admin)...');
         const { error: e1 } = await adminClient.from('user_permissions').delete().neq('user_id', mainAdminProfile.user_id);
         const { error: e2 } = await adminClient.from('user_roles').delete().neq('user_id', mainAdminProfile.user_id);
         const { error: e3 } = await adminClient.from('user_presence').delete().neq('user_id', mainAdminProfile.user_id);
         const { error: e4 } = await adminClient.from('user_facial_data').delete().neq('user_id', mainAdminProfile.user_id);
         const { error: e5 } = await adminClient.from('user_additional_sectors').delete().neq('user_id', mainAdminProfile.user_id);
         const { error: e6 } = await adminClient.from('profiles').update({ is_active: false }).neq('email', ADMIN_EMAIL);
         
         if (e1 || e2 || e3 || e4 || e5 || e6) {
           console.error('User deletion errors:', e1, e2, e3, e4, e5, e6);
         }
          result.message = 'Todos os usuários foram inativados (exceto admin principal)';
         break;
       }

        case 'delete-users': {
          console.log('Permanently deleting all users (except main admin)...');
          // Get all users except main admin
          const { data: usersToDelete, error: fetchError } = await adminClient
            .from('profiles')
            .select('user_id')
            .neq('email', ADMIN_EMAIL);
          
          if (fetchError) {
            console.error('Error fetching users to delete:', fetchError);
            return new Response(
              JSON.stringify({ error: 'Erro ao buscar usuários para exclusão' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
          }
          
          // Delete all related data first
          const { error: e1 } = await adminClient.from('user_permissions').delete().neq('user_id', mainAdminProfile.user_id);
          const { error: e2 } = await adminClient.from('user_roles').delete().neq('user_id', mainAdminProfile.user_id);
          const { error: e3 } = await adminClient.from('user_presence').delete().neq('user_id', mainAdminProfile.user_id);
          const { error: e4 } = await adminClient.from('user_facial_data').delete().neq('user_id', mainAdminProfile.user_id);
          const { error: e5 } = await adminClient.from('user_additional_sectors').delete().neq('user_id', mainAdminProfile.user_id);
          const { error: e6 } = await adminClient.from('user_notifications').delete().neq('user_id', mainAdminProfile.user_id);
          const { error: e7 } = await adminClient.from('important_announcement_reads').delete().neq('user_id', mainAdminProfile.user_id);
          
          // Delete profiles (except admin)
          const { error: e8 } = await adminClient.from('profiles').delete().neq('email', ADMIN_EMAIL);
          
          // Delete auth users using admin API
          let authDeleteErrors = 0;
          if (usersToDelete) {
            for (const user of usersToDelete) {
              if (user.user_id !== mainAdminProfile.user_id) {
                const { error: authError } = await adminClient.auth.admin.deleteUser(user.user_id);
                if (authError) {
                  console.error('Error deleting auth user:', user.user_id, authError);
                  authDeleteErrors++;
                }
              }
            }
          }
          
          if (e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8) {
            console.error('User permanent deletion errors:', e1, e2, e3, e4, e5, e6, e7, e8);
          }
          
          result.message = `Todos os usuários foram excluídos permanentemente (exceto admin principal)${authDeleteErrors > 0 ? `. ${authDeleteErrors} erros ao excluir autenticações.` : ''}`;
          break;
        }
 
       case 'tasks': {
         console.log('Deleting all task data...');
         await adminClient.from('task_comments').delete().gte('created_at', '1970-01-01');
         await adminClient.from('task_subtasks').delete().gte('created_at', '1970-01-01');
         await adminClient.from('task_label_assignments').delete().gte('created_at', '1970-01-01');
         await adminClient.from('task_labels').delete().gte('created_at', '1970-01-01');
         await adminClient.from('tasks').delete().gte('created_at', '1970-01-01');
         await adminClient.from('task_board_columns').delete().gte('created_at', '1970-01-01');
         await adminClient.from('task_board_members').delete().gte('id', '00000000-0000-0000-0000-000000000000');
         await adminClient.from('task_boards').delete().gte('created_at', '1970-01-01');
         result.message = 'Todos os dados de tarefas foram excluídos';
         break;
       }

       case 'all': {
         console.log('Deleting all data (except main admin)...');
         // Messages
         await adminClient.from('attachments').delete().gte('created_at', '1970-01-01');
         await adminClient.from('messages').delete().gte('created_at', '1970-01-01');
         await adminClient.from('direct_messages').delete().gte('created_at', '1970-01-01');
         await adminClient.from('private_group_messages').delete().gte('created_at', '1970-01-01');
         // Announcements
         await adminClient.from('announcement_comments').delete().gte('created_at', '1970-01-01');
         await adminClient.from('announcement_reads').delete().gte('id', '00000000-0000-0000-0000-000000000000');
         await adminClient.from('announcements').delete().gte('created_at', '1970-01-01');
         // Tasks
         await adminClient.from('task_comments').delete().gte('created_at', '1970-01-01');
         await adminClient.from('task_subtasks').delete().gte('created_at', '1970-01-01');
         await adminClient.from('task_label_assignments').delete().gte('created_at', '1970-01-01');
         await adminClient.from('task_labels').delete().gte('created_at', '1970-01-01');
         await adminClient.from('tasks').delete().gte('created_at', '1970-01-01');
         await adminClient.from('task_board_columns').delete().gte('created_at', '1970-01-01');
         await adminClient.from('task_board_members').delete().gte('id', '00000000-0000-0000-0000-000000000000');
         await adminClient.from('task_boards').delete().gte('created_at', '1970-01-01');
         // Notifications
         await adminClient.from('user_notifications').delete().gte('created_at', '1970-01-01');
         // Private groups
         await adminClient.from('private_group_message_reads').delete().gte('id', '00000000-0000-0000-0000-000000000000');
         await adminClient.from('private_group_members').delete().gte('id', '00000000-0000-0000-0000-000000000000');
         await adminClient.from('private_groups').delete().gte('created_at', '1970-01-01');
         // User data excluding admin
         await adminClient.from('user_permissions').delete().neq('user_id', mainAdminProfile.user_id);
         await adminClient.from('user_roles').delete().neq('user_id', mainAdminProfile.user_id);
         await adminClient.from('user_presence').delete().neq('user_id', mainAdminProfile.user_id);
         await adminClient.from('user_facial_data').delete().neq('user_id', mainAdminProfile.user_id);
         await adminClient.from('user_additional_sectors').delete().neq('user_id', mainAdminProfile.user_id);
         await adminClient.from('profiles').update({ is_active: false }).neq('email', ADMIN_EMAIL);
         
         result.message = 'Todo o banco de dados foi limpo (exceto admin principal)';
         break;
       }
 
       default:
         console.log('Invalid deletion type:', type);
         return new Response(
           JSON.stringify({ error: 'Tipo de exclusão inválido' }),
           { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
         );
     }
 
     console.log(`Data deletion completed: ${type} by user ${user.id}`);
 
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