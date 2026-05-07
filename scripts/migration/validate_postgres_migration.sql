select 'profiles' as tabela, count(*) as total from public.profiles
union all select 'notes', count(*) from public.notes
union all select 'tasks', count(*) from public.tasks
union all select 'messages', count(*) from public.messages
union all select 'attachments', count(*) from public.attachments
union all select 'calendar_events', count(*) from public.calendar_events
union all select 'user_roles', count(*) from public.user_roles
union all select 'storage.objects', count(*) from storage.objects
order by tabela;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
