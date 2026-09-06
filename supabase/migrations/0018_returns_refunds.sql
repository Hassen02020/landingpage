-- PETORA Commerce OS — Phase 16: Returns & Refunds.
--
-- Scope: a customer-initiated RMA against PETORA's own Stripe charge —
-- request a return on specific order items, admin reviews (approve/
-- reject), marks it received (restocks inventory via Phase 12's
-- apply_inventory_delta, reused as-is), then initiates the Stripe refund.
-- "Claims" (damage/loss claims against a carrier) is NOT built — that
-- would need its own carrier-claim adapter method and policy modeling
-- neither of which exist yet; naming it here rather than quietly
-- pretending returns and claims are the same thing.
--
-- Refund confirmation is NOT written here. app/api/webhooks/stripe/route.ts
-- already has handleChargeRefunded(), which inserts into `refunds` when
-- Stripe's charge.refunded webhook fires — refundReturnAction only ever
-- *initiates* the Stripe refund and records the attempt's outcome on the
-- return row itself (refund_initiated / refund_failed), so there is one
-- writer of the `refunds` table, not two racing to insert the same event.

create table returns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  customer_id uuid references profiles(id) on delete set null,
  status text not null default 'requested' check (
    status in ('requested', 'approved', 'rejected', 'received', 'refund_initiated', 'refunded', 'refund_failed')
  ),
  reason text,
  refund_amount_cents int check (refund_amount_cents >= 0),
  refund_error text,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id) on delete set null
);

create index idx_returns_order on returns(order_id);
create index idx_returns_tenant on returns(tenant_id, requested_at desc);

alter table returns enable row level security;
create policy "returns_owner_or_staff_select" on returns for select using (
  customer_id = auth.uid() or is_tenant_staff(tenant_id)
);
create policy "returns_owner_insert" on returns for insert with check (
  customer_id = auth.uid()
  and exists (select 1 from orders where orders.id = order_id and orders.customer_id = auth.uid())
);
-- No owner-update policy at all: a customer can request a return but only
-- tenant staff can move it through approved/received/refunded — otherwise
-- a customer could self-approve their own refund via PostgREST.
create policy "returns_tenant_staff_update" on returns for update using (
  is_tenant_staff(tenant_id)
) with check (
  is_tenant_staff(tenant_id)
);

-- ---------------------------------------------------------------------

create table return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references returns(id) on delete cascade,
  order_item_id uuid not null references order_items(id) on delete cascade,
  quantity int not null check (quantity > 0),
  reason text,
  unique (return_id, order_item_id)
);

create index idx_return_items_return on return_items(return_id);

alter table return_items enable row level security;
create policy "return_items_owner_or_staff_select" on return_items for select using (
  exists (
    select 1 from returns
    where returns.id = return_items.return_id
    and (returns.customer_id = auth.uid() or is_tenant_staff(returns.tenant_id))
  )
);
create policy "return_items_owner_insert" on return_items for insert with check (
  exists (
    select 1 from returns
    where returns.id = return_items.return_id
    and returns.customer_id = auth.uid()
    and returns.status = 'requested'
  )
);
