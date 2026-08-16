-- Prymage marketplace control plane.
-- This schema belongs in its own Supabase project, never in a tenant database.

create extension if not exists pgcrypto;

create table if not exists public.tenants (
  name text primary key,
  display_name text not null,
  repo text not null,
  supabase_project_ref text not null,
  app_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalogue (
  feature_key text primary key,
  name text not null,
  description text not null,
  version text not null,
  scope text not null check (scope in ('all', 'named')),
  audience text[] not null default '{}',
  has_migration boolean not null default false,
  source_branch text not null,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_features (
  id uuid primary key default gen_random_uuid(),
  tenant_name text not null references public.tenants(name),
  feature_key text not null references public.catalogue(feature_key),
  version text not null,
  status text not null check (status in ('requested', 'installing', 'live', 'failed')),
  requested_by text not null,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  error text,
  unique (tenant_name, feature_key)
);

create or replace function public.control_plane_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.control_plane_set_updated_at() from public;
grant execute on function public.control_plane_set_updated_at() to service_role;

drop trigger if exists tenants_set_updated_at on public.tenants;
create trigger tenants_set_updated_at
before update on public.tenants
for each row execute function public.control_plane_set_updated_at();

drop trigger if exists catalogue_set_updated_at on public.catalogue;
create trigger catalogue_set_updated_at
before update on public.catalogue
for each row execute function public.control_plane_set_updated_at();

drop trigger if exists tenant_features_set_updated_at on public.tenant_features;
create trigger tenant_features_set_updated_at
before update on public.tenant_features
for each row execute function public.control_plane_set_updated_at();

create or replace view public.tenant_available_features
with (security_barrier = true)
as
select
  tenants.name as tenant_name,
  catalogue.feature_key,
  catalogue.name,
  catalogue.description,
  catalogue.version,
  catalogue.scope,
  catalogue.audience,
  catalogue.has_migration,
  catalogue.source_branch,
  catalogue.published_at,
  catalogue.updated_at
from public.tenants
cross join public.catalogue
where
  (
    catalogue.scope = 'all'
    or (
      catalogue.scope = 'named'
      and tenants.name = any(catalogue.audience)
    )
  )
  and not exists (
    select 1
    from public.tenant_features
    where tenant_features.tenant_name = tenants.name
      and tenant_features.feature_key = catalogue.feature_key
      and tenant_features.status = 'live'
  );

alter table public.tenants enable row level security;
alter table public.catalogue enable row level security;
alter table public.tenant_features enable row level security;

drop policy if exists "Service role manages tenants" on public.tenants;
create policy "Service role manages tenants"
on public.tenants
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role manages catalogue" on public.catalogue;
create policy "Service role manages catalogue"
on public.catalogue
for all
to service_role
using (true)
with check (true);

drop policy if exists "Anon reads catalogue" on public.catalogue;
create policy "Anon reads catalogue"
on public.catalogue
for select
to anon
using (true);

drop policy if exists "Service role manages tenant features" on public.tenant_features;
create policy "Service role manages tenant features"
on public.tenant_features
for all
to service_role
using (true)
with check (true);

revoke all on table public.tenants from anon, authenticated;
revoke all on table public.catalogue from anon, authenticated;
revoke all on table public.tenant_features from anon, authenticated;
revoke all on table public.tenant_available_features from anon, authenticated;

grant all on table public.tenants to service_role;
grant all on table public.catalogue to service_role;
grant all on table public.tenant_features to service_role;
grant select on table public.tenant_available_features to service_role;
grant select on table public.catalogue to anon;
grant select on table public.tenant_available_features to anon;

insert into public.tenants (
  name,
  display_name,
  repo,
  supabase_project_ref
)
values
  ('tenant_a', 'Tenant A', 'damartey/tallycrm-tenant_a', 'hqtzdoeuifgeszpkkfmh'),
  ('tenant_b', 'Tenant B', 'Richwell1/tallycrm-tenant_b', 'ntvptytysrrzoourgxjl')
on conflict do nothing;
