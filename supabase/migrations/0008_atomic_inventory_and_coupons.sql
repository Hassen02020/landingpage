-- Atomic inventory decrement and coupon usage increment.
--
-- Both previously did a SELECT then an UPDATE from application code, which
-- is a classic check-then-act race: two concurrent webhook deliveries could
-- both read the same starting quantity_available / usage_count, both pass
-- their check, and both write, oversellling stock or exceeding a coupon's
-- usage_limit. A single UPDATE with the guard condition in its WHERE clause
-- is atomic under Postgres row-level locking -- the second concurrent
-- transaction blocks on the row lock until the first commits, then
-- re-evaluates the WHERE clause against the now-updated row, so the guard
-- can never be bypassed.
--
-- Both functions are SECURITY DEFINER (bypassing RLS, matching how the
-- Stripe webhook already writes these tables via the service-role client)
-- but EXECUTE is revoked from anon/authenticated so they can't be invoked
-- directly through PostgREST by a browser client -- only the service role
-- (or an explicit future admin action) can call them.

create or replace function decrement_inventory(p_variant_id uuid, p_quantity int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update inventory
  set quantity_available = quantity_available - p_quantity,
      updated_at = now()
  where variant_id = p_variant_id
    and quantity_available >= p_quantity;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function decrement_inventory(uuid, int) from public;
grant execute on function decrement_inventory(uuid, int) to service_role;

create or replace function increment_coupon_usage(p_coupon_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update coupons
  set usage_count = usage_count + 1
  where id = p_coupon_id
    and (usage_limit is null or usage_count < usage_limit);

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function increment_coupon_usage(uuid) from public;
grant execute on function increment_coupon_usage(uuid) to service_role;
