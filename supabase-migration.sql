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
