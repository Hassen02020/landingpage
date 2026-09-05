-- PETORA Commerce OS — Phase 12: Provider Inventory Sync.
--
-- Keeps a promoted product's stock aligned with the supplier's live stock.
-- Design choice worth stating: this applies a *delta*, not an overwrite.
-- Between two syncs, PETORA's own inventory can move independently (a
-- checkout decrements it, a staffer edits it by hand) — blindly setting
-- quantity_available to "whatever the supplier says now" would clobber
-- that. Instead each staged listing remembers the supplier quantity as of
-- its last sync (catalog_staging.last_synced_stock); a new sync computes
-- how much that number moved and applies only the movement, atomically,
-- via apply_inventory_delta(). The first sync for a listing has no prior
-- reading to diff against, so it just records the baseline and adjusts
-- nothing — the quantity set at promotion time (Phase 10) stands.
--
-- apply_inventory_delta is SECURITY DEFINER (bypasses RLS) so it must do
-- its own authorization check, unlike a plain table UPDATE which relies on
-- inventory's existing RLS policy — the same reasoning as decrement_
-- inventory/increment_coupon_usage in migration 0008.
--
-- Grants: CREATE FUNCTION grants EXECUTE to PUBLIC by default, and every
-- role (anon included) inherits through PUBLIC regardless of a revoke
-- targeted at that role specifically — revoking from anon alone leaves
-- anon still able to call it via the PUBLIC grant. Must revoke from PUBLIC
-- itself. (Confirmed live via has_function_privilege() before adding the
-- PUBLIC revoke below: anon could execute despite an anon-only revoke;
-- after revoking from PUBLIC, anon could not, authenticated still could.)
-- authenticated keeps EXECUTE — that's the role tenant-staff server
-- actions call this as; the function's own is_tenant_staff() check is what
-- actually gates who it lets through.

alter table catalog_staging add column last_synced_stock int check (last_synced_stock >= 0);

create or replace function apply_inventory_delta(p_variant_id uuid, p_delta int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_count int;
begin
  if not is_tenant_staff((
    select p.tenant_id from products p
    join product_variants v on v.product_id = p.id
    where v.id = p_variant_id
  )) then
    raise exception 'not authorized to adjust inventory for this variant';
  end if;

  update inventory
  set quantity_available = greatest(0, quantity_available + p_delta), updated_at = now()
  where variant_id = p_variant_id;

  get diagnostics v_row_count = row_count;
  return v_row_count > 0;
end;
$$;

revoke execute on function apply_inventory_delta(uuid, int) from public;

-- ---------------------------------------------------------------------

create table inventory_sync_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider_id uuid not null references providers(id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  items_checked int not null default 0,
  items_adjusted int not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index idx_inventory_sync_runs_tenant on inventory_sync_runs(tenant_id, started_at desc);

alter table inventory_sync_runs enable row level security;
create policy "inventory_sync_runs_tenant_all" on inventory_sync_runs for all using (
  is_tenant_staff(tenant_id)
) with check (
  is_tenant_staff(tenant_id)
);
