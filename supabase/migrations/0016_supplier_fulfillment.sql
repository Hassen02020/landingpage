-- PETORA Commerce OS — Phase 14: Supplier Fulfillment.
--
-- Adds fulfillment tracking to order_routing rather than a new table —
-- it's the natural continuation of the same row (migration 0015): a
-- routing decision that resulted in a placed provider order now also
-- carries how that order is progressing at the supplier. Only meaningful
-- when status = 'placed'; not_applicable/failed rows never get these set.
--
-- This is the supplier-facing half. The customer-facing half (Phase 15)
-- reads from PETORA's own `shipments` table, which this doesn't touch —
-- carrying fulfillment data from here into a customer-visible shipment
-- record is that phase's job, not this one's.

alter table order_routing add column fulfillment_status text check (fulfillment_status in ('processing', 'shipped', 'delivered', 'cancelled'));
alter table order_routing add column carrier text;
alter table order_routing add column tracking_number text;
alter table order_routing add column tracking_url text;
alter table order_routing add column shipped_at timestamptz;
alter table order_routing add column delivered_at timestamptz;
alter table order_routing add column fulfillment_checked_at timestamptz;
