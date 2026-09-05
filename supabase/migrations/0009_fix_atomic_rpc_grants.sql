-- 0008 revoked EXECUTE from PUBLIC on decrement_inventory/increment_coupon_usage, but
-- Supabase grants EXECUTE on new public-schema functions to anon/authenticated via
-- per-role default privileges (separate from the PUBLIC pseudo-role), so that revoke
-- did not actually block calls through PostgREST's /rest/v1/rpc/ endpoint. Without this,
-- any signed-in (or anonymous) client could call these directly and grief inventory /
-- burn through a coupon's usage_limit outside the checkout flow. Revoke explicitly.

revoke execute on function decrement_inventory(uuid, int) from anon, authenticated;
revoke execute on function increment_coupon_usage(uuid) from anon, authenticated;
