-- PETORA Commerce OS — Phase 15: Tracking (customer-facing).
--
-- Phase 14 tracks fulfillment on order_routing (supplier-facing). This
-- phase carries that into PETORA's own `shipments` table — the one
-- customers actually see on their order page — once there's real
-- carrier/tracking info to show. order_routing_id links a shipment back
-- to the routing decision that produced it; unique so a re-check
-- (Phase 14's "Check fulfillment") upserts the same row instead of
-- creating a duplicate shipment every time it's run. A multi-supplier
-- order naturally gets multiple shipment rows — one per supplier that
-- shipped its part — which the table already supported (no unique
-- constraint on order_id alone).
--
-- shipments had no tenant-scoped write policy at all before this — every
-- write happened via the service-role key. The new fulfillment sync runs
-- as the tenant-staff caller's own session, same as every other Phase
-- 9-14 admin action, so it needs one; derived through orders (shipments
-- has no tenant_id column of its own), same pattern as order_items/
-- payments/refunds already use for their owner-based read policies.

-- Plain (non-partial) unique constraint, not a `where order_routing_id is
-- not null` partial index — Postgres's ON CONFLICT target inference only
-- matches a non-partial unique constraint/index (confirmed live: the
-- upsert in checkFulfillmentAction failed with 42P10 against a partial
-- index). This is still safe for manually-created shipments that leave
-- order_routing_id null: unique constraints never treat NULL as equal to
-- another NULL, so any number of null rows coexist fine.
alter table shipments add column order_routing_id uuid references order_routing(id) on delete cascade;
alter table shipments add constraint shipments_order_routing_id_key unique (order_routing_id);

create policy "shipments_tenant_staff_select" on shipments for select using (
  exists (select 1 from orders where orders.id = shipments.order_id and is_tenant_staff(orders.tenant_id))
);
create policy "shipments_tenant_staff_insert" on shipments for insert with check (
  exists (select 1 from orders where orders.id = shipments.order_id and is_tenant_staff(orders.tenant_id))
);
create policy "shipments_tenant_staff_update" on shipments for update using (
  exists (select 1 from orders where orders.id = shipments.order_id and is_tenant_staff(orders.tenant_id))
);
