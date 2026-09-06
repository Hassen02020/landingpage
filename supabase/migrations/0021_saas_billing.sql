-- PETORA Commerce OS — Phase 19: SaaS Billing / Plans / Quotas.
--
-- Tenant-level billing: what a *tenant* (a merchant running a storefront on
-- Commerce OS) pays PETORA for the platform itself. Distinct from the
-- existing `subscriptions` table (Phase "Autoship"), which is what a
-- shopper pays for recurring pet food deliveries — two different billing
-- relationships that happen to both use the word "subscription".
--
-- Same Stripe-unconfigured constraint as every other phase that touches
-- Stripe (STRIPE_SECRET_KEY is blank in this environment — getStripe()
-- throws cleanly, lib/stripe.ts): a paid-plan upgrade needs a real Stripe
-- Checkout session, so that path fails honestly rather than being faked.
-- The free-tier assignment path needs no Stripe call at all, so it's fully
-- live-verifiable end to end — see change_tenant_plan() below, which is
-- deliberately built so a paid plan can ONLY be applied by the
-- service-role caller (i.e. after a webhook has confirmed payment), never
-- by a tenant-staff session directly, free downgrades excepted.

create table billing_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('starter', 'growth', 'scale')),
  name text not null,
  price_cents int not null default 0,
  stripe_price_id text,
  max_products int,         -- null = unlimited
  max_providers int,        -- null = unlimited
  max_orders_per_month int, -- null = unlimited
  created_at timestamptz not null default now()
);

-- Public-readable pricing — a plan comparison page needs this without a
-- session, same reasoning as products/categories being publicly browsable.
alter table billing_plans enable row level security;
create policy "billing_plans_public_read" on billing_plans for select using (true);

insert into billing_plans (code, name, price_cents, max_products, max_providers, max_orders_per_month) values
  ('starter', 'Starter', 0, 25, 1, 100),
  ('growth', 'Growth', 4900, 250, 3, 2000),
  ('scale', 'Scale', 19900, null, null, null);

-- ---------------------------------------------------------------------

create table tenant_billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references tenants(id) on delete cascade,
  plan_id uuid not null references billing_plans(id),
  status text not null default 'active' check (status in ('trialing', 'active', 'past_due', 'canceled')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_tenant_billing_subscriptions_updated_at before update on tenant_billing_subscriptions
  for each row execute function set_updated_at();

alter table tenant_billing_subscriptions enable row level security;
-- Select only — every write, free downgrade included, goes through
-- change_tenant_plan() below so the paid-plan guard can't be bypassed by
-- calling PostgREST directly with an update.
create policy "tenant_billing_subscriptions_staff_select" on tenant_billing_subscriptions for select using (
  is_tenant_staff(tenant_id)
);

insert into tenant_billing_subscriptions (tenant_id, plan_id, status)
select '11111111-1111-1111-1111-111111111111', id, 'active' from billing_plans where code = 'growth';

-- ---------------------------------------------------------------------

-- SECURITY DEFINER (bypasses RLS) so it does its own authorization check,
-- same reasoning as apply_inventory_delta (migration 0014/0020): a
-- signed-in tenant staffer calls this via the authenticated role (no
-- auth.uid() session for a webhook, hence the service_role branch).
--
-- The business rule that actually matters here: a paid plan (price_cents
-- > 0) can only be applied by the service-role caller — i.e. once a
-- Stripe webhook has confirmed the subscription is really paid for.
-- Tenant staff can self-serve down to a $0 plan (no payment needed to
-- *reduce* what you owe) but cannot grant themselves a paid tier by
-- calling this RPC directly.
create or replace function change_tenant_plan(target_tenant uuid, new_plan_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan billing_plans%rowtype;
begin
  if not (auth.role() = 'service_role' or is_tenant_staff(target_tenant)) then
    raise exception 'not authorized to change this tenant''s plan';
  end if;

  select * into v_plan from billing_plans where code = new_plan_code;
  if not found then
    raise exception 'unknown plan: %', new_plan_code;
  end if;

  if v_plan.price_cents > 0 and auth.role() <> 'service_role' then
    raise exception 'paid plans require checkout — use the billing portal';
  end if;

  update tenant_billing_subscriptions
  set plan_id = v_plan.id, status = 'active'
  where tenant_id = target_tenant;
end;
$$;

-- Grants — a sharper version of the apply_inventory_delta lesson
-- (0014/0020): revoking from PUBLIC was enough there because that
-- function had already lost its anon grant in an earlier migration and
-- CREATE OR REPLACE doesn't reset existing grants. change_tenant_plan is
-- brand new, and Supabase's default privileges grant EXECUTE on new
-- public-schema functions to anon separately from the PUBLIC
-- pseudo-role — confirmed live via has_function_privilege('anon', ...)
-- returning true after a public-only revoke. anon must be revoked
-- explicitly. authenticated keeps EXECUTE — that's the role the admin
-- action calls this as; the function's own checks above are what
-- actually gate who it lets through.
revoke execute on function change_tenant_plan(uuid, text) from public, anon;

-- ---------------------------------------------------------------------

-- Defense-in-depth for the product quota: lib/actions/admin/products.ts
-- already checks this before inserting, but that's an app-layer check a
-- direct PostgREST insert would bypass entirely. SECURITY DEFINER so it
-- can read tenant_billing_subscriptions (staff-select-only RLS) regardless
-- of who's inserting the product, same reasoning as every other
-- SECURITY DEFINER function in this schema.
create or replace function enforce_product_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int;
  v_count int;
begin
  select bp.max_products into v_limit
  from tenant_billing_subscriptions tbs
  join billing_plans bp on bp.id = tbs.plan_id
  where tbs.tenant_id = new.tenant_id;

  -- No limit (Scale, or a tenant with no billing row yet) — nothing to enforce.
  if v_limit is null then
    return new;
  end if;

  select count(*) into v_count from products where tenant_id = new.tenant_id and status <> 'archived';

  if v_count >= v_limit then
    raise exception 'Plan limit reached: % products allowed on your current plan. Upgrade in Billing to add more.', v_limit;
  end if;

  return new;
end;
$$;

create trigger trg_enforce_product_quota before insert on products
  for each row execute function enforce_product_quota();

-- This is trigger-only — never meant to be called directly. Without this,
-- the security advisor flags it as reachable via /rest/v1/rpc/
-- enforce_product_quota for anon and authenticated alike (confirmed live:
-- has_function_privilege returned true for both before this revoke, same
-- default-privilege-grants-EXECUTE-to-new-functions behavior as
-- change_tenant_plan above). A direct RPC call would error immediately —
-- NEW isn't defined outside trigger context — but there's no reason to
-- leave the surface exposed. Trigger invocation itself is a separate
-- Postgres mechanism from an EXECUTE-gated RPC call, so this doesn't
-- touch the trigger firing on insert — reverified live after this revoke.
revoke execute on function enforce_product_quota() from public, anon, authenticated;
