-- Track which Stripe invoice produced which order, for idempotent Autoship renewal processing.
alter table orders add column stripe_invoice_id text;
create unique index idx_orders_stripe_invoice on orders(stripe_invoice_id) where stripe_invoice_id is not null;
