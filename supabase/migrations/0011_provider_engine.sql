-- PETORA Commerce OS — Phase 9: Provider Connector Engine (foundation).
--
-- Platform-level registry of adapter codes (`providers`), per-tenant
-- connections to them (`provider_connections`), a log of each sync attempt
-- (`provider_sync_runs`), and the landing table normalized listings sync
-- into (`catalog_staging`) — the input side of the Phase 10 Catalog
-- Normalizer, not built yet.
--
-- Seeded providers: 'mock' (status 'available' — the only adapter actually
-- implemented, see lib/providers/mock.ts) plus 'ebay', 'amazon_sp_api',
-- 'alibaba' as 'coming_soon' placeholders. Per the architecture doc (§5),
-- none of the three named platforms are a confirmed drop-in data source —
-- they're seeded here so the UI can show real rows with an honest status
-- rather than implying a working integration that doesn't exist.

create table providers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status text not null default 'coming_soon' check (status in ('available', 'coming_soon')),
  created_at timestamptz not null default now()
);

insert into providers (code, name, status) values
  ('mock', 'Mock Supplier (demo)', 'available'),
  ('ebay', 'eBay', 'coming_soon'),
  ('amazon_sp_api', 'Amazon SP-API', 'coming_soon'),
  ('alibaba', 'Alibaba.com', 'coming_soon');

alter table providers enable row level security;
create policy "providers_public_read" on providers for select using (true);
create policy "providers_platform_admin_write" on providers for insert with check (is_admin());
create policy "providers_platform_admin_update" on providers for update using (is_admin()) with check (is_admin());
create policy "providers_platform_admin_delete" on providers for delete using (is_admin());

-- ---------------------------------------------------------------------

create table provider_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider_id uuid not null references providers(id) on delete cascade,
  status text not null default 'disconnected' check (status in ('disconnected', 'connected', 'error')),
  -- Non-secret settings only (e.g. a shop name). A real adapter's API keys
  -- belong in a secrets vault referenced from here, never stored in this
  -- table in plaintext — the mock adapter has no real credentials at all.
  config jsonb not null default '{}',
  last_error text,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, provider_id)
);

alter table provider_connections enable row level security;
create policy "provider_connections_tenant_all" on provider_connections for all using (
  is_tenant_staff(tenant_id)
) with check (
  is_tenant_staff(tenant_id)
);

-- ---------------------------------------------------------------------

create table provider_sync_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider_id uuid not null references providers(id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  items_fetched int not null default 0,
  items_staged int not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index idx_provider_sync_runs_tenant on provider_sync_runs(tenant_id, started_at desc);

alter table provider_sync_runs enable row level security;
create policy "provider_sync_runs_tenant_all" on provider_sync_runs for all using (
  is_tenant_staff(tenant_id)
) with check (
  is_tenant_staff(tenant_id)
);

-- ---------------------------------------------------------------------

create table catalog_staging (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider_id uuid not null references providers(id) on delete cascade,
  sync_run_id uuid references provider_sync_runs(id) on delete set null,
  supplier_sku text not null,
  name text not null,
  price_cents int not null check (price_cents >= 0),
  stock int not null default 0,
  shipping_cents int not null default 0,
  supplier text not null,
  raw jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'promoted', 'rejected')),
  matched_product_id uuid references products(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, provider_id, supplier_sku)
);

create index idx_catalog_staging_tenant on catalog_staging(tenant_id, provider_id);

alter table catalog_staging enable row level security;
create policy "catalog_staging_tenant_all" on catalog_staging for all using (
  is_tenant_staff(tenant_id)
) with check (
  is_tenant_staff(tenant_id)
);
