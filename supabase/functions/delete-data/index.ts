 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 };
 
 const ADMIN_EMAIL = 'adminservchat@servsul.com.br';
 
 serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   try {
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
     const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
     const authHeader = req.headers.get('Authorization');
     
     if (!authHeader) {
       return new Response(
         JSON.stringify({ error: 'Não autorizado' }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
       );
     }
 
     // Verify the user is an admin
     const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
       global: { headers: { Authorization: authHeader } }
     });
     
     const { data: { user }, error: authError } = await userClient.auth.getUser();
     if (authError || !user) {
       return new Response(
         JSON.stringify({ error: 'Não autorizado' }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
       );
     }
 
     // Check if user is admin
     const adminClient = createClient(supabaseUrl, serviceRoleKey);
     const { data: isAdminData } = await adminClient.rpc('is_admin');
     
     const { data: userProfile } = await adminClient
       .from('profiles')
       .select('email')
       .eq('user_id', user.id)
       .single();
 
     const { data: userRoles } = await adminClient
       .from('user_roles')
       .select('role')
       .eq('user_id', user.id);
 
     const hasAdminRole = userRoles?.some(r => r.role === 'admin');
     
     if (!hasAdminRole && userProfile?.email !== ADMIN_EMAIL) {
       return new Response(
         JSON.stringify({ error: 'Apenas administradores podem executar esta ação' }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
       );
     }
 
     const { type } = await req.json();
 
     // Get admin profile to exclude
     const { data: adminProfile } = await adminClient
       .from('profiles')
       .select('id, user_id')
       .eq('email', ADMIN_EMAIL)
       .single();
 
     if (!adminProfile) {
       return new Response(
         JSON.stringify({ error: 'Perfil do administrador não encontrado' }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
       );
     }
 
     let result = { success: true, message: '' };
 
     switch (type) {
       case 'messages':
         // Delete sector messages
         await adminClient.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
         // Delete direct messages
         await adminClient.from('direct_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
         // Delete private group messages
         await adminClient.from('private_group_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
         result.message = 'Todas as mensagens foram excluídas';
         break;
 
       case 'announcements':
         // Delete comments first
         await adminClient.from('announcement_comments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
         // Delete reads
         await adminClient.from('announcement_reads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
         // Delete announcements
         await adminClient.from('announcements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
         result.message = 'Todos os avisos foram excluídos';
         break;
 
       case 'users':
         // Delete user-related data excluding admin
         await adminClient.from('user_permissions').delete().neq('user_id', adminProfile.user_id);
         await adminClient.from('user_roles').delete().neq('user_id', adminProfile.user_id);
         await adminClient.from('user_presence').delete().neq('user_id', adminProfile.user_id);
         await adminClient.from('user_facial_data').delete().neq('user_id', adminProfile.user_id);
         await adminClient.from('user_additional_sectors').delete().neq('user_id', adminProfile.user_id);
         // Deactivate profiles
         await adminClient.from('profiles').update({ is_active: false }).neq('email', ADMIN_EMAIL);
         result.message = 'Todos os usuários foram desativados (exceto admin principal)';
         break;
 
       case 'facial':
         await adminClient.from('user_facial_data').delete().neq('user_id', adminProfile.user_id);
         result.message = 'Todos os dados faciais foram excluídos (exceto admin principal)';
         break;
 
       case 'all':
         // Delete in order respecting foreign keys
         // Messages
         await adminClient.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
         await adminClient.from('direct_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
         await adminClient.from('private_group_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
         // Announcements
         await adminClient.from('announcement_comments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
         await adminClient.from('announcement_reads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
         await adminClient.from('announcements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
         // Attachments
         await adminClient.from('attachments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
         // Notifications
         await adminClient.from('user_notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
         // Private groups
         await adminClient.from('private_group_message_reads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
         await adminClient.from('private_group_members').delete().neq('id', '00000000-0000-0000-0000-000000000000');
         await adminClient.from('private_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
         // User data excluding admin
         await adminClient.from('user_permissions').delete().neq('user_id', adminProfile.user_id);
         await adminClient.from('user_roles').delete().neq('user_id', adminProfile.user_id);
         await adminClient.from('user_presence').delete().neq('user_id', adminProfile.user_id);
         await adminClient.from('user_facial_data').delete().neq('user_id', adminProfile.user_id);
         await adminClient.from('user_additional_sectors').delete().neq('user_id', adminProfile.user_id);
         await adminClient.from('profiles').update({ is_active: false }).neq('email', ADMIN_EMAIL);
         result.message = 'Todo o banco de dados foi limpo (exceto admin principal)';
         break;
 
       default:
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
     console.error('Error in delete-data:', error);
     return new Response(
       JSON.stringify({ error: error.message }),
       { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
     );
   }
 });