-- Run this once in Supabase: SQL Editor
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  login_code text unique not null,
  display_name text not null,
  auth_email text unique,
  role text not null default 'consulta' check (role in ('adm_geral', 'administrador', 'operador', 'consulta')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_general_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'adm_geral' and active = true
  );
$$;

drop policy if exists "Profiles read own" on public.profiles;
create policy "Profiles read own" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_general_admin());

drop policy if exists "Profiles insert own" on public.profiles;
create policy "Profiles insert own" on public.profiles
  for insert to authenticated with check (id = auth.uid() or public.is_general_admin());

drop policy if exists "Profiles update by general admin" on public.profiles;
create policy "Profiles update by general admin" on public.profiles
  for update to authenticated using (public.is_general_admin()) with check (public.is_general_admin());

alter table public.profiles add column if not exists auth_email text;
create unique index if not exists profiles_auth_email_key on public.profiles(auth_email) where auth_email is not null;

update public.profiles p
set auth_email = u.email
from auth.users u
where p.id = u.id and p.auth_email is null;

create or replace function public.get_login_email(p_login_code text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select auth_email
  from public.profiles
  where active = true
    and lower(trim(login_code)) = lower(trim(p_login_code))
  limit 1;
$$;

revoke all on function public.get_login_email(text) from public;
grant execute on function public.get_login_email(text) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_login_code text;
  v_display_name text;
  v_role text;
begin
  v_login_code := nullif(trim(coalesce(new.raw_user_meta_data->>'login_code', split_part(new.email, '@', 1))), '');
  v_display_name := nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), '');
  v_role := nullif(trim(coalesce(new.raw_user_meta_data->>'role', 'consulta')), '');
  if v_role not in ('adm_geral', 'administrador', 'operador', 'consulta') then
    v_role := 'consulta';
  end if;
  insert into public.profiles (id, login_code, display_name, auth_email, role, active)
  values (new.id, v_login_code, coalesce(v_display_name, v_login_code, 'Novo usuário'), new.email, v_role, true)
  on conflict (id) do update set
    login_code = excluded.login_code,
    display_name = excluded.display_name,
    auth_email = excluded.auth_email,
    role = excluded.role,
    active = true,
    updated_at = now();
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
