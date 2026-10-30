alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = case when role in ('adm_geral','administrador','admin') then 'admin' when role in ('operador','editor') then 'editor' else 'visualizador' end;
alter table public.profiles alter column role set default 'visualizador';
alter table public.profiles add constraint profiles_role_check check (role in ('admin','editor','visualizador'));
create or replace function public.is_logiflow_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and active=true); $$;
create or replace function public.can_edit_logiflow() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','editor') and active=true); $$;
alter table public.profiles enable row level security;
drop policy if exists "Profiles read own" on public.profiles; drop policy if exists "Profiles insert own" on public.profiles; drop policy if exists "Profiles update by general admin" on public.profiles; drop policy if exists "profiles_read_self_or_admin" on public.profiles; drop policy if exists "profiles_update_admin_only" on public.profiles;
create policy "profiles_read_self_or_admin" on public.profiles for select to authenticated using (id=auth.uid() or public.is_logiflow_admin());
create policy "profiles_update_admin_only" on public.profiles for update to authenticated using (public.is_logiflow_admin()) with check (public.is_logiflow_admin());
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public,auth as $$
declare v_login_code text; v_display_name text;
begin v_login_code:=nullif(trim(coalesce(new.raw_user_meta_data->>'login_code',split_part(new.email,'@',1))),''); v_display_name:=nullif(trim(coalesce(new.raw_user_meta_data->>'display_name','')),'');
insert into public.profiles(id,login_code,display_name,auth_email,role,active) values(new.id,v_login_code,coalesce(v_display_name,v_login_code,'Novo usuário'),new.email,'visualizador',true)
on conflict(id) do update set login_code=excluded.login_code,display_name=excluded.display_name,auth_email=excluded.auth_email,updated_at=now(); return new; exception when others then return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users; create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
drop policy if exists "Public insert shared state" on public.shared_state; drop policy if exists "Public read shared state" on public.shared_state; drop policy if exists "Public update shared state" on public.shared_state; drop policy if exists "logiflow_authenticated_read" on public.shared_state; drop policy if exists "logiflow_editor_insert" on public.shared_state; drop policy if exists "logiflow_editor_update" on public.shared_state;
create policy "logiflow_authenticated_read" on public.shared_state for select to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true));
create policy "logiflow_editor_insert" on public.shared_state for insert to authenticated with check (public.can_edit_logiflow());
create policy "logiflow_editor_update" on public.shared_state for update to authenticated using (public.can_edit_logiflow()) with check (public.can_edit_logiflow());
revoke all on function public.get_login_email(text) from anon; grant execute on function public.get_login_email(text) to authenticated;