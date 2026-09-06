-- PETORA Commerce OS — Phase 17: Recall / Compliance / Lots.
--
-- Scope, stated plainly because it's easy to overclaim here: this system
-- has no per-unit allocation at checkout — decrement_inventory (0008)
-- moves a quantity counter, it doesn't record which lot a sale drew from.
-- Building real lot-to-order allocation would mean changing that
-- payment-critical webhook path, which this phase does not do. So:
--
-- - inventory_lots is a genuine receiving ledger (which lots came in, how
--   much, when) that also restocks inventory via Phase 12's
--   apply_inventory_delta, reused as-is.
-- - recalls are scoped to a variant (optionally noting a specific lot for
--   context), not to a lot precisely — "affected orders" is therefore
--   computed as every order containing the recalled variant, which is the
--   conservative, correct behavior when lot-level attribution isn't
--   available (over-notify rather than silently under-notify).
-- - There is no recall_notifications table and no "send" action: this
--   project has no email-sending integration configured anywhere (grepped
--   for one — none exists), so a "Notify customers" button would either
--   have to fake success or immediately fail every time. Neither is
--   built; the admin UI instead surfaces the affected-customer list
--   directly for manual outreach, which is the actually-honest version of
--   this feature given what's really wired up.
--
-- recalls gets a public read policy (status = 'active' only) — a recall
-- is a disclosure obligation, not internal bookkeeping; the storefront
-- product page uses it to show an active-recall banner.

create table inventory_lots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  lot_number text not null,
  quantity_received int not null check (quantity_received > 0),
  received_at timestamptz not null default now(),
  expiry_date date,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  unique (variant_id, lot_number)
);

create index idx_inventory_lots_variant on inventory_lots(variant_id);
create index idx_inventory_lots_tenant on inventory_lots(tenant_id, received_at desc);

alter table inventory_lots enable row level security;
create policy "inventory_lots_tenant_all" on inventory_lots for all using (
  is_tenant_staff(tenant_id)
) with check (
  is_tenant_staff(tenant_id)
);

-- ---------------------------------------------------------------------

create table recalls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  lot_id uuid references inventory_lots(id) on delete set null,
  reason text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'active' check (status in ('active', 'resolved')),
  initiated_by uuid references profiles(id) on delete set null,
  initiated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index idx_recalls_tenant on recalls(tenant_id, initiated_at desc);
create index idx_recalls_variant on recalls(variant_id) where status = 'active';

alter table recalls enable row level security;
create policy "recalls_tenant_all" on recalls for all using (
  is_tenant_staff(tenant_id)
) with check (
  is_tenant_staff(tenant_id)
);
-- Additive: an active recall is public regardless of who's asking — a
-- disclosure, not tenant-internal data. Resolved recalls fall back to the
-- tenant-staff policy above once this one no longer matches.
create policy "recalls_public_read_active" on recalls for select using (status = 'active');
