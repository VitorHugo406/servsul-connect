-- Notes: editors (shared with "edit") may change content/title/colours, but never the owner, company or creation date,
-- and only the owner may archive/unarchive. Backend maintenance (no auth user) is not restricted.
create or replace function public.notes_guard_owner_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.owner_id is distinct from old.owner_id
     or new.company_id is distinct from old.company_id
     or new.created_at is distinct from old.created_at then
    raise exception 'NOTA_PROTEGIDA: o dono e a empresa da anotação não podem ser alterados';
  end if;
  if old.owner_id <> auth.uid() and new.is_archived is distinct from old.is_archived then
    raise exception 'NOTA_PROTEGIDA: só o dono pode arquivar esta anotação';
  end if;
  return new;
end $$;

drop trigger if exists notes_guard_owner_fields on public.notes;
create trigger notes_guard_owner_fields before update on public.notes
for each row execute function public.notes_guard_owner_fields();
