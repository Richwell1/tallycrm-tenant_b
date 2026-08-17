-- Prymage marketplace control plane.
-- This schema is isolated from the host project's application tables.

create extension if not exists pgcrypto;
create schema if not exists control_plane;

revoke all on schema control_plane from public;
grant usage on schema control_plane to service_role, anon;

create table if not exists control_plane.tenants (
  name text primary key,
  display_name text not null,
  repo text not null,
  supabase_project_ref text not null,
  app_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists control_plane.catalogue (
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

create table if not exists control_plane.tenant_features (
  id uuid primary key default gen_random_uuid(),
  tenant_name text not null references control_plane.tenants(name),
  feature_key text not null references control_plane.catalogue(feature_key),
  version text not null,
  status text not null check (status in ('requested', 'installing', 'live', 'failed')),
  requested_by text not null,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  error text,
  unique (tenant_name, feature_key)
);

create or replace function control_plane.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = control_plane
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function control_plane.set_updated_at() from public;
grant execute on function control_plane.set_updated_at() to service_role;

drop trigger if exists tenants_set_updated_at on control_plane.tenants;
create trigger tenants_set_updated_at
before update on control_plane.tenants
for each row execute function control_plane.set_updated_at();

drop trigger if exists catalogue_set_updated_at on control_plane.catalogue;
create trigger catalogue_set_updated_at
before update on control_plane.catalogue
for each row execute function control_plane.set_updated_at();

drop trigger if exists tenant_features_set_updated_at on control_plane.tenant_features;
create trigger tenant_features_set_updated_at
before update on control_plane.tenant_features
for each row execute function control_plane.set_updated_at();

create or replace view control_plane.tenant_available_features
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
from control_plane.tenants
cross join control_plane.catalogue
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
    from control_plane.tenant_features
    where tenant_features.tenant_name = tenants.name
      and tenant_features.feature_key = catalogue.feature_key
      and tenant_features.status = 'live'
  );

alter view control_plane.tenant_available_features set (security_invoker = true);

alter table control_plane.tenants enable row level security;
alter table control_plane.catalogue enable row level security;
alter table control_plane.tenant_features enable row level security;

drop policy if exists "Service role manages tenants" on control_plane.tenants;
create policy "Service role manages tenants"
on control_plane.tenants
for all
to service_role
using (true)
with check (true);

drop policy if exists "Anon reads tenant names for availability" on control_plane.tenants;
create policy "Anon reads tenant names for availability"
on control_plane.tenants
for select
to anon
using (true);

drop policy if exists "Service role manages catalogue" on control_plane.catalogue;
create policy "Service role manages catalogue"
on control_plane.catalogue
for all
to service_role
using (true)
with check (true);

drop policy if exists "Anon reads catalogue" on control_plane.catalogue;
create policy "Anon reads catalogue"
on control_plane.catalogue
for select
to anon
using (true);

drop policy if exists "Service role manages tenant features" on control_plane.tenant_features;
create policy "Service role manages tenant features"
on control_plane.tenant_features
for all
to service_role
using (true)
with check (true);

drop policy if exists "Anon reads install status for availability" on control_plane.tenant_features;
create policy "Anon reads install status for availability"
on control_plane.tenant_features
for select
to anon
using (true);

revoke all on table control_plane.tenants from anon, authenticated;
revoke all on table control_plane.catalogue from anon, authenticated;
revoke all on table control_plane.tenant_features from anon, authenticated;
revoke all on table control_plane.tenant_available_features from anon, authenticated;

grant all on table control_plane.tenants to service_role;
grant all on table control_plane.catalogue to service_role;
grant all on table control_plane.tenant_features to service_role;
grant select on table control_plane.tenant_available_features to service_role;
grant select (name) on table control_plane.tenants to anon;
grant select on table control_plane.catalogue to anon;
grant select (tenant_name, feature_key, status) on table control_plane.tenant_features to anon;
grant select on table control_plane.tenant_available_features to anon;

create or replace function public.publish_catalogue_entry(
  feature_key text,
  name text,
  description text,
  version text,
  scope text,
  audience text[],
  has_migration boolean,
  source_branch text
)
returns void
language plpgsql
security definer
set search_path = control_plane, public
as $$
begin
  insert into control_plane.catalogue (
    feature_key,
    name,
    description,
    version,
    scope,
    audience,
    has_migration,
    source_branch,
    published_at,
    updated_at
  )
  values ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
  on conflict on constraint catalogue_pkey
  do update set
    name = excluded.name,
    description = excluded.description,
    version = excluded.version,
    scope = excluded.scope,
    audience = excluded.audience,
    has_migration = excluded.has_migration,
    source_branch = excluded.source_branch,
    published_at = now(),
    updated_at = now();
end;
$$;

revoke all on function public.publish_catalogue_entry(text, text, text, text, text, text[], boolean, text) from public;
revoke execute on function public.publish_catalogue_entry(text, text, text, text, text, text[], boolean, text) from anon;
grant execute on function public.publish_catalogue_entry(text, text, text, text, text, text[], boolean, text) to service_role;

create or replace function public.list_catalogue()
returns table (
  feature_key text,
  name text,
  description text,
  version text,
  scope text,
  audience text[],
  has_migration boolean,
  source_branch text,
  published_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = control_plane, public
as $$
  select
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
  from control_plane.catalogue
  order by catalogue.name, catalogue.feature_key;
$$;

revoke all on function public.list_catalogue() from public;
revoke execute on function public.list_catalogue() from anon, service_role;
grant execute on function public.list_catalogue() to service_role, anon;

create or replace function public.request_feature_install(
  p_tenant_name text,
  p_feature_key text,
  p_requested_by text
)
returns setof control_plane.tenant_features
language plpgsql
security definer
set search_path = control_plane, public
as $$
declare
  catalogue_version text;
begin
  select catalogue.version
  into catalogue_version
  from control_plane.catalogue
  join control_plane.tenants
    on tenants.name = p_tenant_name
  where catalogue.feature_key = p_feature_key
    and (
      catalogue.scope = 'all'
      or (
        catalogue.scope = 'named'
        and p_tenant_name = any(catalogue.audience)
      )
    );

  if catalogue_version is null then
    raise exception 'Tenant % is not entitled to feature %', p_tenant_name, p_feature_key
      using errcode = '42501';
  end if;

  return query
  insert into control_plane.tenant_features (
    tenant_name,
    feature_key,
    version,
    status,
    requested_by,
    requested_at,
    updated_at,
    error
  )
  values (
    p_tenant_name,
    p_feature_key,
    catalogue_version,
    'requested',
    p_requested_by,
    now(),
    now(),
    null
  )
  on conflict (tenant_name, feature_key)
  do update set
    version = excluded.version,
    status = 'requested',
    requested_by = excluded.requested_by,
    requested_at = now(),
    updated_at = now(),
    error = null
  where tenant_features.status not in ('live', 'installing')
  returning tenant_features.*;

  if not found then
    raise exception 'Feature % is already live or installing for tenant %',
      p_feature_key,
      p_tenant_name
      using errcode = '55000';
  end if;
end;
$$;

revoke all on function public.request_feature_install(text, text, text) from public;
revoke execute on function public.request_feature_install(text, text, text) from anon, service_role;
grant execute on function public.request_feature_install(text, text, text) to service_role;

create or replace function public.list_tenant_features(p_tenant_name text)
returns setof control_plane.tenant_features
language sql
stable
security definer
set search_path = control_plane, public
as $$
  select tenant_features.*
  from control_plane.tenant_features
  where tenant_features.tenant_name = p_tenant_name
  order by tenant_features.requested_at desc, tenant_features.feature_key;
$$;

revoke all on function public.list_tenant_features(text) from public;
grant execute on function public.list_tenant_features(text) to anon, service_role;

create or replace function public.claim_pending_installs()
returns setof control_plane.tenant_features
language sql
volatile
security definer
set search_path = control_plane, public
as $$
  with pending as (
    select tenant_features.id
    from control_plane.tenant_features
    where tenant_features.status = 'requested'
    order by tenant_features.requested_at, tenant_features.id
    for update skip locked
  )
  update control_plane.tenant_features
  set
    status = 'installing',
    updated_at = now(),
    error = null
  from pending
  where tenant_features.id = pending.id
  returning tenant_features.*;
$$;

revoke all on function public.claim_pending_installs() from public;
grant execute on function public.claim_pending_installs() to service_role;

create or replace function public.set_install_status(
  p_tenant_name text,
  p_feature_key text,
  p_status text,
  p_error text
)
returns setof control_plane.tenant_features
language plpgsql
security definer
set search_path = control_plane, public
as $$
begin
  if p_status not in ('requested', 'installing', 'live', 'failed') then
    raise exception 'Invalid install status: %', p_status using errcode = '22023';
  end if;

  return query
  update control_plane.tenant_features
  set
    status = p_status,
    error = p_error,
    updated_at = now()
  where tenant_features.tenant_name = p_tenant_name
    and tenant_features.feature_key = p_feature_key
  returning tenant_features.*;

  if not found then
    raise exception 'No install exists for tenant % and feature %',
      p_tenant_name,
      p_feature_key
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.set_install_status(text, text, text, text) from public;
grant execute on function public.set_install_status(text, text, text, text) to service_role;

insert into control_plane.tenants (
  name,
  display_name,
  repo,
  supabase_project_ref
)
values
  ('tenant_a', 'Tenant A', 'damartey/tallycrm-tenant_a', 'hqtzdoeuifgeszpkkfmh'),
  ('tenant_b', 'Tenant B', 'Richwell1/tallycrm-tenant_b', 'ntvptytysrrzoourgxjl')
on conflict do nothing;
