-- Row Level Security for PETORA
-- Convention: customers can only see/manage their own rows; catalog/merchandising
-- tables are publicly readable when active; all writes to catalog & order-status
-- data are admin-only via the service-role key from server routes (never from
-- the browser), enforced here by simply granting no anon/authenticated write policy.

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- profiles / pets / admin_users
-- ---------------------------------------------------------------------

alter table profiles enable row level security;
create policy "profiles_select_own" on profiles for select using (id = auth.uid() or is_admin());
create policy "profiles_update_own" on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_insert_own" on profiles for insert with check (id = auth.uid());

-- profiles_update_own only restricts *which row* a customer can touch, not
-- which columns — without this, a customer could PATCH their own row's
-- `role` to 'admin' directly via PostgREST using nothing but their own
-- session token, since `id = auth.uid()` is satisfied either way.
create or replace function prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

create trigger trg_profiles_prevent_role_escalation
  before update on profiles
  for each row execute function prevent_role_self_escalation();

alter table admin_users enable row level security;
create policy "admin_users_admin_only" on admin_users for all using (is_admin()) with check (is_admin());

alter table pets enable row level security;
create policy "pets_owner_select" on pets for select using (profile_id = auth.uid() or is_admin());
create policy "pets_owner_insert" on pets for insert with check (profile_id = auth.uid());
create policy "pets_owner_update" on pets for update using (profile_id = auth.uid() or is_admin());
create policy "pets_owner_delete" on pets for delete using (profile_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------
-- catalog: public read of active rows, admin-only writes
-- ---------------------------------------------------------------------

alter table brands enable row level security;
create policy "brands_public_read" on brands for select using (is_active or is_admin());
create policy "brands_admin_write" on brands for insert with check (is_admin());
create policy "brands_admin_update" on brands for update using (is_admin());
create policy "brands_admin_delete" on brands for delete using (is_admin());

alter table categories enable row level security;
create policy "categories_public_read" on categories for select using (is_active or is_admin());
create policy "categories_admin_write" on categories for insert with check (is_admin());
create policy "categories_admin_update" on categories for update using (is_admin());
create policy "categories_admin_delete" on categories for delete using (is_admin());

alter table products enable row level security;
create policy "products_public_read" on products for select using (status = 'active' or is_admin());
create policy "products_admin_write" on products for insert with check (is_admin());
create policy "products_admin_update" on products for update using (is_admin());
create policy "products_admin_delete" on products for delete using (is_admin());

alter table product_variants enable row level security;
create policy "variants_public_read" on product_variants for select using (true);
create policy "variants_admin_write" on product_variants for insert with check (is_admin());
create policy "variants_admin_update" on product_variants for update using (is_admin());
create policy "variants_admin_delete" on product_variants for delete using (is_admin());

alter table product_images enable row level security;
create policy "images_public_read" on product_images for select using (true);
create policy "images_admin_write" on product_images for insert with check (is_admin());
create policy "images_admin_update" on product_images for update using (is_admin());
create policy "images_admin_delete" on product_images for delete using (is_admin());

alter table inventory enable row level security;
create policy "inventory_public_read" on inventory for select using (true);
create policy "inventory_admin_write" on inventory for insert with check (is_admin());
create policy "inventory_admin_update" on inventory for update using (is_admin());

-- ---------------------------------------------------------------------
-- cart: owner (customer_id) or anonymous session owns it; no public read of others
-- ---------------------------------------------------------------------

alter table carts enable row level security;
create policy "carts_owner_select" on carts for select using (customer_id = auth.uid() or is_admin());
create policy "carts_owner_insert" on carts for insert with check (customer_id = auth.uid() or customer_id is null);
create policy "carts_owner_update" on carts for update using (customer_id = auth.uid() or is_admin());
create policy "carts_owner_delete" on carts for delete using (customer_id = auth.uid() or is_admin());

alter table cart_items enable row level security;
create policy "cart_items_owner_select" on cart_items for select using (
  exists (select 1 from carts where carts.id = cart_items.cart_id and (carts.customer_id = auth.uid() or is_admin()))
);
create policy "cart_items_owner_write" on cart_items for insert with check (
  exists (select 1 from carts where carts.id = cart_items.cart_id and (carts.customer_id = auth.uid() or carts.customer_id is null))
);
create policy "cart_items_owner_update" on cart_items for update using (
  exists (select 1 from carts where carts.id = cart_items.cart_id and (carts.customer_id = auth.uid() or is_admin()))
);
create policy "cart_items_owner_delete" on cart_items for delete using (
  exists (select 1 from carts where carts.id = cart_items.cart_id and (carts.customer_id = auth.uid() or is_admin()))
);

-- ---------------------------------------------------------------------
-- orders & related: customer reads own; all writes happen server-side
-- with the service-role key (checkout, webhooks, fulfillment), so no
-- insert/update policies are granted to authenticated/anon here.
-- ---------------------------------------------------------------------

alter table orders enable row level security;
create policy "orders_owner_select" on orders for select using (customer_id = auth.uid() or is_admin());
create policy "orders_admin_write" on orders for update using (is_admin());

alter table order_items enable row level security;
create policy "order_items_owner_select" on order_items for select using (
  exists (select 1 from orders where orders.id = order_items.order_id and (orders.customer_id = auth.uid() or is_admin()))
);

alter table order_addresses enable row level security;
create policy "order_addresses_owner_select" on order_addresses for select using (
  exists (select 1 from orders where orders.id = order_addresses.order_id and (orders.customer_id = auth.uid() or is_admin()))
);

alter table payments enable row level security;
create policy "payments_owner_select" on payments for select using (
  exists (select 1 from orders where orders.id = payments.order_id and (orders.customer_id = auth.uid() or is_admin()))
);

alter table refunds enable row level security;
create policy "refunds_owner_select" on refunds for select using (
  exists (select 1 from orders where orders.id = refunds.order_id and (orders.customer_id = auth.uid() or is_admin()))
);

alter table shipments enable row level security;
create policy "shipments_owner_select" on shipments for select using (
  exists (select 1 from orders where orders.id = shipments.order_id and (orders.customer_id = auth.uid() or is_admin()))
);

-- ---------------------------------------------------------------------
-- subscriptions (autoship)
-- ---------------------------------------------------------------------

alter table subscriptions enable row level security;
create policy "subscriptions_owner_select" on subscriptions for select using (customer_id = auth.uid() or is_admin());
create policy "subscriptions_owner_insert" on subscriptions for insert with check (customer_id = auth.uid());
create policy "subscriptions_owner_update" on subscriptions for update using (customer_id = auth.uid() or is_admin());

alter table subscription_items enable row level security;
create policy "subscription_items_owner_select" on subscription_items for select using (
  exists (select 1 from subscriptions where subscriptions.id = subscription_items.subscription_id and (subscriptions.customer_id = auth.uid() or is_admin()))
);
create policy "subscription_items_owner_write" on subscription_items for insert with check (
  exists (select 1 from subscriptions where subscriptions.id = subscription_items.subscription_id and subscriptions.customer_id = auth.uid())
);
create policy "subscription_items_owner_update" on subscription_items for update using (
  exists (select 1 from subscriptions where subscriptions.id = subscription_items.subscription_id and (subscriptions.customer_id = auth.uid() or is_admin()))
);
create policy "subscription_items_owner_delete" on subscription_items for delete using (
  exists (select 1 from subscriptions where subscriptions.id = subscription_items.subscription_id and (subscriptions.customer_id = auth.uid() or is_admin()))
);

-- ---------------------------------------------------------------------
-- marketing / merchandising
-- ---------------------------------------------------------------------

alter table coupons enable row level security;
create policy "coupons_admin_only" on coupons for all using (is_admin()) with check (is_admin());

alter table promotions enable row level security;
create policy "promotions_public_read" on promotions for select using (is_active or is_admin());
create policy "promotions_admin_write" on promotions for insert with check (is_admin());
create policy "promotions_admin_update" on promotions for update using (is_admin());
create policy "promotions_admin_delete" on promotions for delete using (is_admin());

alter table reviews enable row level security;
create policy "reviews_public_read" on reviews for select using (status = 'approved' or customer_id = auth.uid() or is_admin());
create policy "reviews_owner_insert" on reviews for insert with check (customer_id = auth.uid());
create policy "reviews_admin_update" on reviews for update using (is_admin() or customer_id = auth.uid());
create policy "reviews_admin_delete" on reviews for delete using (is_admin());

-- The insert/update policies above only check row ownership, not which
-- values land in `status` / `is_verified_purchase` — without this trigger a
-- customer could insert or edit their own review with status='approved'
-- directly via PostgREST, skipping admin moderation entirely (and forging
-- a "Verified Purchase" badge they didn't earn).
create or replace function guard_review_moderation_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.is_verified_purchase := exists (
      select 1
      from order_items
      join orders on orders.id = order_items.order_id
      join product_variants on product_variants.id = order_items.variant_id
      where orders.customer_id = new.customer_id
        and product_variants.product_id = new.product_id
    );
  else
    new.status := old.status;
    new.is_verified_purchase := old.is_verified_purchase;
  end if;

  return new;
end;
$$;

create trigger trg_reviews_guard_moderation_fields
  before insert or update on reviews
  for each row execute function guard_review_moderation_fields();

alter table wishlists enable row level security;
create policy "wishlists_owner_all" on wishlists for all using (customer_id = auth.uid() or is_admin()) with check (customer_id = auth.uid());

alter table wishlist_items enable row level security;
create policy "wishlist_items_owner_all" on wishlist_items for all using (
  exists (select 1 from wishlists where wishlists.id = wishlist_items.wishlist_id and (wishlists.customer_id = auth.uid() or is_admin()))
) with check (
  exists (select 1 from wishlists where wishlists.id = wishlist_items.wishlist_id and wishlists.customer_id = auth.uid())
);

alter table abandoned_carts enable row level security;
create policy "abandoned_carts_admin_only" on abandoned_carts for all using (is_admin()) with check (is_admin());

alter table newsletter_subscribers enable row level security;
create policy "newsletter_public_insert" on newsletter_subscribers for insert with check (true);
create policy "newsletter_admin_select" on newsletter_subscribers for select using (is_admin());

alter table marketing_events enable row level security;
create policy "marketing_events_public_insert" on marketing_events for insert with check (true);
create policy "marketing_events_admin_select" on marketing_events for select using (is_admin());

alter table audit_logs enable row level security;
create policy "audit_logs_admin_only" on audit_logs for select using (is_admin());
