-- PETORA Commerce OS — Phase 10: Catalog Normalizer & Promotion.
--
-- Two things:
--
-- 1. A real bug left over from Phase 8: brands/categories/products.slug are
--    still globally unique, not per-tenant. Under multi-tenancy that's a
--    cross-tenant leak — tenant B can be blocked from a slug tenant A
--    happens to use, and it's the first constraint Phase 10 promotion
--    would hit (an imported product's slug colliding with another
--    tenant's). Fix it now: scope uniqueness to (tenant_id, slug).
--
-- 2. catalog_mappings — an append-only audit trail of promotions: which
--    staging row became which product/variant, and who promoted it.
--    catalog_staging.status/matched_product_id already carries the current
--    state; this is the history, kept even if a product is later deleted
--    (hence no FK cascade back onto catalog_staging beyond delete-cascade
--    from the staging row itself, and set-null is not used — a promotion
--    record for a still-existing product should never dangle silently).

alter table brands drop constraint brands_slug_key;
alter table brands add constraint brands_tenant_slug_key unique (tenant_id, slug);

alter table categories drop constraint categories_slug_key;
alter table categories add constraint categories_tenant_slug_key unique (tenant_id, slug);

alter table products drop constraint products_slug_key;
alter table products add constraint products_tenant_slug_key unique (tenant_id, slug);

-- ---------------------------------------------------------------------

create table catalog_mappings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  staging_id uuid not null references catalog_staging(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  promoted_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_catalog_mappings_tenant on catalog_mappings(tenant_id, created_at desc);

alter table catalog_mappings enable row level security;
-- Append-only: select + insert only, no update/delete policy granted at
-- all (not even for tenant staff) — an audit trail that can be edited
-- after the fact isn't an audit trail.
create policy "catalog_mappings_tenant_select" on catalog_mappings for select using (is_tenant_staff(tenant_id));
create policy "catalog_mappings_tenant_insert" on catalog_mappings for insert with check (is_tenant_staff(tenant_id));
