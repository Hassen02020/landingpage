-- PETORA Commerce OS — Phase 11: Pricing Engine.
--
-- Phase 10's promotion flow set product_variants.price_cents directly to
-- the supplier's cost — i.e. zero margin, sold at cost. That was never
-- correct; this phase is what was missing. Two things:
--
-- 1. product_variants.cost_cents — the supplier's cost, kept separate from
--    price_cents (the customer-facing price) so a later re-sync (Phase 12)
--    can update cost and recompute price without losing which is which.
--    Null for variants that were never provider-sourced (an admin-created
--    product has no "cost" in this system, only a price).
--
-- 2. pricing_rules (per-tenant markup config) + price_history (append-only
--    record of every computed price, tied to the rule that produced it).
--    Only one rule may be `is_default` per tenant at a time — that's the
--    rule promotion applies automatically. Per the architecture doc's own
--    risk note (§7): a markup percentage alone isn't a safeguard against
--    selling below cost if a sync lags, hence min_margin_cents as a hard
--    floor, not just a suggested margin.

alter table product_variants add column cost_cents int check (cost_cents >= 0);

create table pricing_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  markup_type text not null check (markup_type in ('percentage', 'fixed_amount')),
  markup_value numeric(10,2) not null check (markup_value >= 0),
  min_margin_cents int not null default 0 check (min_margin_cents >= 0),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- At most one default rule per tenant — the row promotion looks up.
create unique index idx_pricing_rules_one_default_per_tenant on pricing_rules(tenant_id) where is_default;
create index idx_pricing_rules_tenant on pricing_rules(tenant_id);

insert into pricing_rules (tenant_id, name, markup_type, markup_value, min_margin_cents, is_default)
values ('11111111-1111-1111-1111-111111111111', 'Standard markup', 'percentage', 40, 500, true);

alter table pricing_rules enable row level security;
create policy "pricing_rules_tenant_all" on pricing_rules for all using (
  is_tenant_staff(tenant_id)
) with check (
  is_tenant_staff(tenant_id)
);

-- ---------------------------------------------------------------------

create table price_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  pricing_rule_id uuid references pricing_rules(id) on delete set null,
  cost_cents int not null check (cost_cents >= 0),
  price_cents int not null check (price_cents >= 0),
  floor_applied boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_price_history_variant on price_history(variant_id, created_at desc);

alter table price_history enable row level security;
-- Append-only, same reasoning as catalog_mappings (migration 0012): a
-- price history that can be edited after the fact isn't a history.
create policy "price_history_tenant_select" on price_history for select using (is_tenant_staff(tenant_id));
create policy "price_history_tenant_insert" on price_history for insert with check (is_tenant_staff(tenant_id));
