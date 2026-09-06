-- PETORA Commerce OS — Phase 18: Automation / Webhooks / Cron.
--
-- Automates what Phases 9/12/14 built as manual admin actions (provider
-- catalog sync, inventory sync, fulfillment check) via a Vercel Cron job
-- hitting app/api/cron/automation, plus two opt-in rules: pause a product
-- on stockout, and log a sync failure for the admin console (there's no
-- email/SMS integration anywhere in this project — checked, same finding
-- as Phase 17 — so "alert" means "visible in /admin/automation", not an
-- external notification).
--
-- apply_inventory_delta (0014) needs a real fix here, not a workaround:
-- its authorization check is is_tenant_staff(), which reads auth.uid() —
-- correct for a signed-in admin's session, but the cron job has no user
-- session at all, it calls through the service-role client. Under a
-- service-role connection auth.uid() is null and is_tenant_staff() is
-- correctly false, so the unmodified function would reject every cron
-- call. The standard, narrow fix: also allow auth.role() = 'service_role'
-- (Supabase's own signal for "this is the service-role key, not a user"),
-- which is exactly as trusted as the existing webhook handler that already
-- uses createServiceRoleClient() for the same class of operation.

create or replace function apply_inventory_delta(p_variant_id uuid, p_delta int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_count int;
begin
  if not (
    auth.role() = 'service_role'
    or is_tenant_staff((
      select p.tenant_id from products p
      join product_variants v on v.product_id = p.id
      where v.id = p_variant_id
    ))
  ) then
    raise exception 'not authorized to adjust inventory for this variant';
  end if;

  update inventory
  set quantity_available = greatest(0, quantity_available + p_delta), updated_at = now()
  where variant_id = p_variant_id;

  get diagnostics v_row_count = row_count;
  return v_row_count > 0;
end;
$$;

-- ---------------------------------------------------------------------

create table automation_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  type text not null check (type in ('pause_on_stockout', 'alert_on_sync_failure')),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, type)
);

alter table automation_rules enable row level security;
create policy "automation_rules_tenant_all" on automation_rules for all using (
  is_tenant_staff(tenant_id)
) with check (
  is_tenant_staff(tenant_id)
);

-- Both rules start disabled — automation is opt-in per tenant, never a
-- silent default a merchant didn't ask for.
insert into automation_rules (tenant_id, type, enabled) values
  ('11111111-1111-1111-1111-111111111111', 'pause_on_stockout', false),
  ('11111111-1111-1111-1111-111111111111', 'alert_on_sync_failure', false);

-- ---------------------------------------------------------------------

create table automation_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  rule_type text not null,
  triggered_by text not null check (triggered_by in ('cron', 'manual')),
  summary jsonb not null default '{}',
  items_affected int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_automation_runs_tenant on automation_runs(tenant_id, created_at desc);

alter table automation_runs enable row level security;
-- Append-only, same reasoning as catalog_mappings/price_history: a log
-- that can be edited after the fact isn't a log.
create policy "automation_runs_tenant_select" on automation_runs for select using (is_tenant_staff(tenant_id));
create policy "automation_runs_tenant_insert" on automation_runs for insert with check (
  is_tenant_staff(tenant_id) or auth.role() = 'service_role'
);
