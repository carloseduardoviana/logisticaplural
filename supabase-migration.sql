-- Run this once in Supabase: SQL Editor
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  login_code text unique not null,
  display_name text not null,
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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, login_code, display_name, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'login_code', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'consulta'),
    true
  )
  on conflict (id) do update set
    login_code = excluded.login_code,
    display_name = excluded.display_name,
    role = excluded.role,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
