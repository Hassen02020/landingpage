-- PETORA Commerce OS — Phase 8: multi-tenant foundation.
--
-- Introduces tenants as first-class rows and scopes the storefront/catalog
-- tables to a tenant_id. The existing PETORA store becomes tenant
-- '11111111-1111-1111-1111-111111111111' (slug 'petora') so nothing already
-- in production changes behavior — every pre-existing row backfills to it.
--
-- Scope: tables whose ownership genuinely differs per tenant get a tenant_id
-- column (brands, categories, products, promotions, coupons, orders, carts).
-- Tables reached only through one of those (product_variants, product_images,
-- inventory, order_items, ...) derive their tenant transitively via a join
-- and are left as-is — duplicating tenant_id onto every child table would
-- just be another column to keep in sync for no isolation benefit, since
-- their RLS already goes through the parent.
--
-- Ownership model: platform staff (is_admin(), unchanged) can act on any
-- tenant. Tenant staff (new: tenant_members) can act only within their own
-- tenant. Customer-owned rows (carts, orders, reviews, ...) keep their
-- existing customer_id-based policies unchanged — tenant_id is added there
-- for reporting/scoping (Phase 16/17 dashboards), not as a new ownership
-- check, so a customer's own order stays visible to them regardless of
-- which tenant they bought from.

-- =========================================================================
-- TENANTS
-- =========================================================================

create table tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

insert into tenants (id, slug, name, status)
values ('11111111-1111-1111-1111-111111111111', 'petora', 'PETORA', 'active');

create table tenant_members (
  tenant_id uuid not null references tenants(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, profile_id)
);

-- Seed every existing platform admin as an owner of the default tenant, so
-- today's admins keep tenant-scoped write access after this migration lands
-- (is_admin() alone still works too — this just avoids a day-one gap for
-- the tenant-scoped policies below).
insert into tenant_members (tenant_id, profile_id, role)
select '11111111-1111-1111-1111-111111111111', id, 'owner'
from profiles
where role = 'admin';

-- True for platform staff (any tenant) and for members of the given tenant.
-- security definer + fixed search_path: same pattern as is_admin() (0002),
-- so RLS policies that call it aren't affected by the caller's search_path.
create or replace function is_tenant_staff(target_tenant uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select is_admin() or exists (
    select 1 from tenant_members
    where tenant_id = target_tenant and profile_id = auth.uid()
  );
$$;

create or replace function tenant_is_active(target_tenant uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from tenants where id = target_tenant and status = 'active');
$$;

alter table tenants enable row level security;
create policy "tenants_public_or_staff_select" on tenants for select using (
  status = 'active' or is_tenant_staff(id)
);
create policy "tenants_platform_admin_insert" on tenants for insert with check (is_admin());
create policy "tenants_staff_update" on tenants for update using (is_tenant_staff(id)) with check (is_tenant_staff(id));
create policy "tenants_platform_admin_delete" on tenants for delete using (is_admin());

alter table tenant_members enable row level security;
create policy "tenant_members_self_or_staff_select" on tenant_members for select using (
  profile_id = auth.uid() or is_tenant_staff(tenant_id)
);
create policy "tenant_members_staff_insert" on tenant_members for insert with check (is_tenant_staff(tenant_id));
create policy "tenant_members_staff_update" on tenant_members for update using (is_tenant_staff(tenant_id)) with check (is_tenant_staff(tenant_id));
create policy "tenant_members_staff_delete" on tenant_members for delete using (is_tenant_staff(tenant_id));

-- =========================================================================
-- CATALOG — add tenant_id, backfill to the default tenant, re-scope RLS
-- =========================================================================

alter table brands add column tenant_id uuid not null default '11111111-1111-1111-1111-111111111111' references tenants(id);
alter table categories add column tenant_id uuid not null default '11111111-1111-1111-1111-111111111111' references tenants(id);
alter table products add column tenant_id uuid not null default '11111111-1111-1111-1111-111111111111' references tenants(id);
create index idx_brands_tenant on brands(tenant_id);
create index idx_categories_tenant on categories(tenant_id);
create index idx_products_tenant on products(tenant_id);

drop policy "brands_public_read" on brands;
drop policy "brands_admin_write" on brands;
drop policy "brands_admin_update" on brands;
drop policy "brands_admin_delete" on brands;
create policy "brands_public_read" on brands for select using ((is_active and tenant_is_active(tenant_id)) or is_tenant_staff(tenant_id));
create policy "brands_tenant_write" on brands for insert with check (is_tenant_staff(tenant_id));
create policy "brands_tenant_update" on brands for update using (is_tenant_staff(tenant_id)) with check (is_tenant_staff(tenant_id));
create policy "brands_tenant_delete" on brands for delete using (is_tenant_staff(tenant_id));

drop policy "categories_public_read" on categories;
drop policy "categories_admin_write" on categories;
drop policy "categories_admin_update" on categories;
drop policy "categories_admin_delete" on categories;
create policy "categories_public_read" on categories for select using ((is_active and tenant_is_active(tenant_id)) or is_tenant_staff(tenant_id));
create policy "categories_tenant_write" on categories for insert with check (is_tenant_staff(tenant_id));
create policy "categories_tenant_update" on categories for update using (is_tenant_staff(tenant_id)) with check (is_tenant_staff(tenant_id));
create policy "categories_tenant_delete" on categories for delete using (is_tenant_staff(tenant_id));

drop policy "products_public_read" on products;
drop policy "products_admin_write" on products;
drop policy "products_admin_update" on products;
drop policy "products_admin_delete" on products;
create policy "products_public_read" on products for select using ((status = 'active' and tenant_is_active(tenant_id)) or is_tenant_staff(tenant_id));
create policy "products_tenant_write" on products for insert with check (is_tenant_staff(tenant_id));
create policy "products_tenant_update" on products for update using (is_tenant_staff(tenant_id)) with check (is_tenant_staff(tenant_id));
create policy "products_tenant_delete" on products for delete using (is_tenant_staff(tenant_id));

-- product_variants / product_images / inventory: no tenant_id column of
-- their own — tenant is derived through products.tenant_id. Reads stay
-- public (unchanged); writes move from platform-admin-only to tenant staff.

drop policy "variants_admin_write" on product_variants;
drop policy "variants_admin_update" on product_variants;
drop policy "variants_admin_delete" on product_variants;
create policy "variants_tenant_write" on product_variants for insert with check (
  is_tenant_staff((select tenant_id from products where products.id = product_variants.product_id))
);
create policy "variants_tenant_update" on product_variants for update using (
  is_tenant_staff((select tenant_id from products where products.id = product_variants.product_id))
);
create policy "variants_tenant_delete" on product_variants for delete using (
  is_tenant_staff((select tenant_id from products where products.id = product_variants.product_id))
);

drop policy "images_admin_write" on product_images;
drop policy "images_admin_update" on product_images;
drop policy "images_admin_delete" on product_images;
create policy "images_tenant_write" on product_images for insert with check (
  is_tenant_staff((select tenant_id from products where products.id = product_images.product_id))
);
create policy "images_tenant_update" on product_images for update using (
  is_tenant_staff((select tenant_id from products where products.id = product_images.product_id))
);
create policy "images_tenant_delete" on product_images for delete using (
  is_tenant_staff((select tenant_id from products where products.id = product_images.product_id))
);

drop policy "inventory_admin_write" on inventory;
drop policy "inventory_admin_update" on inventory;
create policy "inventory_tenant_write" on inventory for insert with check (
  is_tenant_staff((select p.tenant_id from products p join product_variants v on v.product_id = p.id where v.id = inventory.variant_id))
);
create policy "inventory_tenant_update" on inventory for update using (
  is_tenant_staff((select p.tenant_id from products p join product_variants v on v.product_id = p.id where v.id = inventory.variant_id))
);

-- =========================================================================
-- MERCHANDISING — promotions & coupons move from platform-admin-only to
-- tenant-scoped (a tenant owner manages their own promos without needing
-- the platform-wide is_admin() role)
-- =========================================================================

alter table promotions add column tenant_id uuid not null default '11111111-1111-1111-1111-111111111111' references tenants(id);
create index idx_promotions_tenant on promotions(tenant_id);

drop policy "promotions_public_read" on promotions;
drop policy "promotions_admin_write" on promotions;
drop policy "promotions_admin_update" on promotions;
drop policy "promotions_admin_delete" on promotions;
create policy "promotions_public_read" on promotions for select using ((is_active and tenant_is_active(tenant_id)) or is_tenant_staff(tenant_id));
create policy "promotions_tenant_write" on promotions for insert with check (is_tenant_staff(tenant_id));
create policy "promotions_tenant_update" on promotions for update using (is_tenant_staff(tenant_id)) with check (is_tenant_staff(tenant_id));
create policy "promotions_tenant_delete" on promotions for delete using (is_tenant_staff(tenant_id));

alter table coupons add column tenant_id uuid not null default '11111111-1111-1111-1111-111111111111' references tenants(id);
create index idx_coupons_tenant on coupons(tenant_id);

drop policy "coupons_admin_only" on coupons;
create policy "coupons_tenant_all" on coupons for all using (is_tenant_staff(tenant_id)) with check (is_tenant_staff(tenant_id));

-- =========================================================================
-- ORDERS & CARTS — tenant_id added for reporting/scoping only. Ownership
-- stays customer_id-based (unchanged); this adds an *additional* permissive
-- policy so tenant staff can see their own tenant's orders/carts without
-- needing the platform-wide is_admin() role. Existing policies already grant
-- is_admin() full visibility, so platform staff are unaffected.
-- =========================================================================

alter table carts add column tenant_id uuid not null default '11111111-1111-1111-1111-111111111111' references tenants(id);
alter table orders add column tenant_id uuid not null default '11111111-1111-1111-1111-111111111111' references tenants(id);
create index idx_carts_tenant on carts(tenant_id);
create index idx_orders_tenant on orders(tenant_id);

create policy "carts_tenant_staff_select" on carts for select using (is_tenant_staff(tenant_id));
create policy "orders_tenant_staff_select" on orders for select using (is_tenant_staff(tenant_id));
