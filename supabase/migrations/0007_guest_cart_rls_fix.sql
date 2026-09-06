-- Fix guest cart RLS: guest carts (customer_id IS NULL) could only be INSERTed into,
-- never SELECTed, UPDATEd, or DELETEd, because those policies required
-- customer_id = auth.uid() and auth.uid() is NULL for unauthenticated requests.
-- Guest cart ownership is established by possession of the unguessable carts.id,
-- held in an httpOnly session cookie (see lib/actions/cart.ts CART_COOKIE) -- the
-- same trust model the existing insert policies already granted.

alter policy "carts_owner_select" on carts
  using (customer_id = auth.uid() or customer_id is null or is_admin());

alter policy "carts_owner_update" on carts
  using (customer_id = auth.uid() or customer_id is null or is_admin());

alter policy "carts_owner_delete" on carts
  using (customer_id = auth.uid() or customer_id is null or is_admin());

alter policy "cart_items_owner_select" on cart_items
  using (
    exists (select 1 from carts where carts.id = cart_items.cart_id and (carts.customer_id = auth.uid() or carts.customer_id is null or is_admin()))
  );

alter policy "cart_items_owner_update" on cart_items
  using (
    exists (select 1 from carts where carts.id = cart_items.cart_id and (carts.customer_id = auth.uid() or carts.customer_id is null or is_admin()))
  );

alter policy "cart_items_owner_delete" on cart_items
  using (
    exists (select 1 from carts where carts.id = cart_items.cart_id and (carts.customer_id = auth.uid() or carts.customer_id is null or is_admin()))
  );
