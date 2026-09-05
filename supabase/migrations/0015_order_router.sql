-- PETORA Commerce OS — Phase 13: Order Router.
--
-- One row per order_item recording how it was fulfilled: routed to a
-- provider (with the resulting provider_order_id) or 'not_applicable'
-- (owned inventory — never went through the catalog_mappings pipeline).
-- The roadmap doc sketched this as two tables (order_routing +
-- provider_orders); one is enough here — a provider order reference is a
-- single field on the routing decision, not a separate lifecycle worth
-- its own table, and duplicating tenant_id-style bookkeeping across two
-- tables for one row each would just be more to keep in sync.
--
-- Routing is manual (an admin action), not wired into the Stripe webhook
-- — Automation/Cron (a later phase) is what would trigger this
-- automatically on payment; wiring it into the webhook now would be
-- silently changing a payment-critical path for a foundation phase that
-- hasn't earned that trust yet. A routing attempt is also one-shot per
-- item: once a row exists (placed OR failed), routeOrderAction skips it —
-- retrying a failed placement is a gap this phase doesn't attempt to
-- close, kept honest via the item staying visibly 'failed' rather than
-- silently retried into a duplicate supplier order.

create table order_routing (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  order_item_id uuid not null references order_items(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete set null,
  provider_id uuid references providers(id) on delete set null,
  status text not null default 'pending' check (status in ('not_applicable', 'pending', 'placed', 'failed')),
  provider_order_id text,
  error text,
  created_at timestamptz not null default now(),
  unique (order_item_id)
);

create index idx_order_routing_order on order_routing(order_id);

alter table order_routing enable row level security;
-- Internal fulfillment bookkeeping, not customer-facing (a customer's own
-- order visibility is unaffected — this table only adds tenant-staff
-- access, same additive pattern as orders_tenant_staff_select in 0010).
create policy "order_routing_tenant_all" on order_routing for all using (
  is_tenant_staff(tenant_id)
) with check (
  is_tenant_staff(tenant_id)
);
