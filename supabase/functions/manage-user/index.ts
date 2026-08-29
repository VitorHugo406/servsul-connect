import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
};
const ADMIN_EMAIL='adminservchat@servsul.com.br';
const MANAGEMENT_AUTONOMY=['supervisor','gerente','diretoria','gestor','admin'];

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
 try{
  const url=Deno.env.get('SUPABASE_URL')!; const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; const auth=req.headers.get('Authorization');
  if(!auth) return new Response(JSON.stringify({error:'Não autorizado'}),{status:401,headers:{...corsHeaders,'Content-Type':'application/json'}});
  const client=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}}); const token=auth.replace('Bearer ','');
  const {data:{user},error:authError}=await client.auth.getUser(token); if(authError||!user) return new Response(JSON.stringify({error:'Token inválido'}),{status:401,headers:{...corsHeaders,'Content-Type':'application/json'}});
  const body=await req.json(); const type=body.type; const targetUserId=body.userId;
  const [{data:roles},{data:profile},{data:permission}]=await Promise.all([
   client.from('user_roles').select('role').eq('user_id',user.id),
   client.from('profiles').select('email,autonomy_level').eq('user_id',user.id).maybeSingle(),
   client.from('user_permissions').select('can_access_management,can_access_password_change').eq('user_id',user.id).maybeSingle(),
  ]);
  const isAdmin=profile?.email===ADMIN_EMAIL||(roles||[]).some(r=>r.role==='admin');
  const canManage=isAdmin||MANAGEMENT_AUTONOMY.includes(profile?.autonomy_level||'')||permission?.can_access_management===true;
  const canChangePassword=canManage||permission?.can_access_password_change===true;
  if(type==='change-password'&&!canChangePassword) throw Object.assign(new Error('Você não tem permissão para alterar senhas'),{status:403});
  if(type==='delete-single-user'&&!canManage) throw Object.assign(new Error('Você não tem permissão para excluir usuários'),{status:403});
  if(!targetUserId) throw Object.assign(new Error('userId é obrigatório'),{status:400});
  const {data:target}=await client.from('profiles').select('id,user_id,email,name').eq('user_id',targetUserId).maybeSingle();
  if(!target) throw Object.assign(new Error('Usuário não encontrado'),{status:404});
  if(target.email===ADMIN_EMAIL) throw Object.assign(new Error('Não é possível alterar ou excluir o administrador principal'),{status:403});

  if(type==='change-password'){
   const newPassword=String(body.newPassword||'');
   if(!/^\d{6}$/.test(newPassword)) throw Object.assign(new Error('A senha deve conter exatamente 6 dígitos numéricos'),{status:400});
   const {error}=await client.auth.admin.updateUserById(targetUserId,{password:newPassword}); if(error) throw error;
   return new Response(JSON.stringify({success:true,message:'Senha alterada com sucesso'}),{headers:{...corsHeaders,'Content-Type':'application/json'}});
  }

  if(type==='delete-single-user'){
   const pid=target.id;
   await client.from('task_board_columns').update({auto_assign_to:null}).eq('auto_assign_to',pid);
   await client.from('tasks').update({assigned_to:null}).eq('assigned_to',pid);
   await client.from('tasks').update({created_by:null}).eq('created_by',pid);
   await client.from('task_boards').update({owner_id:null}).eq('owner_id',pid);
   const cleanups:[string,string,unknown][]=[['user_permissions','user_id',targetUserId],['user_roles','user_id',targetUserId],['user_presence','user_id',targetUserId],['user_facial_data','user_id',targetUserId],['user_additional_sectors','user_id',targetUserId],['user_notifications','user_id',targetUserId],['private_group_members','profile_id',pid],['task_board_members','profile_id',pid],['supervisor_team_members','member_profile_id',pid],['supervisor_team_members','supervisor_id',targetUserId],['message_reactions','profile_id',pid],['announcement_comments','author_id',pid],['task_comments','author_id',pid],['task_activities','actor_id',pid],['task_assignees','profile_id',pid],['meeting_participants','profile_id',pid],['attachments','uploaded_by',pid],['direct_messages','sender_id',pid],['direct_messages','receiver_id',pid],['messages','author_id',pid],['announcements','author_id',pid]];
   for(const [table,column,value] of cleanups) await client.from(table).delete().eq(column as any,value as any);
   const {error:profileError}=await client.from('profiles').delete().eq('user_id',targetUserId); if(profileError) throw profileError;
   const {error:authDelete}=await client.auth.admin.deleteUser(targetUserId); if(authDelete) throw authDelete;
   return new Response(JSON.stringify({success:true,message:`Usuário ${target.name||''} excluído com sucesso`}),{headers:{...corsHeaders,'Content-Type':'application/json'}});
  }
  throw Object.assign(new Error('Operação inválida'),{status:400});
 }catch(error){const status=(error as any)?.status||500;return new Response(JSON.stringify({error:error instanceof Error?error.message:'Erro interno'}),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});}
});
