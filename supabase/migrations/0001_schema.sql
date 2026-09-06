-- PETORA core schema
-- Money is stored as integer cents (currency column alongside) to avoid float rounding.

create extension if not exists "pgcrypto";

-- =========================================================================
-- IDENTITY
-- =========================================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table admin_users (
  id uuid primary key references profiles(id) on delete cascade,
  permissions text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table pets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  species text not null check (species in ('dog', 'cat')),
  breed text,
  birth_date date,
  weight_lbs numeric(6,2),
  activity_level text check (activity_level in ('low', 'moderate', 'high')),
  life_stage text check (life_stage in ('puppy_kitten', 'adult', 'senior')),
  allergies text[] not null default '{}',
  preferences text[] not null default '{}',
  budget text check (budget in ('value', 'standard', 'premium')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================================
-- CATALOG
-- =========================================================================

create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  description text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references categories(id) on delete set null,
  pet_type text not null default 'both' check (pet_type in ('dog', 'cat', 'both')),
  image_url text,
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  short_description text,
  description text,
  ingredients text,
  feeding_instructions text,
  pet_type text not null default 'both' check (pet_type in ('dog', 'cat', 'both')),
  life_stage text check (life_stage in ('puppy_kitten', 'adult', 'senior', 'all')),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  is_subscribable boolean not null default false,
  seo_title text,
  seo_description text,
  avg_rating numeric(2,1) not null default 0,
  review_count int not null default 0,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_products_category on products(category_id);
create index idx_products_brand on products(brand_id);
create index idx_products_status on products(status);
create index idx_products_tags on products using gin(tags);

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  sku text not null unique,
  size text,
  flavor text,
  price_cents int not null check (price_cents >= 0),
  compare_at_price_cents int check (compare_at_price_cents >= 0),
  currency text not null default 'USD',
  weight_oz numeric(8,2),
  is_default boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_variants_product on product_variants(product_id);

create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete cascade,
  url text not null,
  alt text,
  sort_order int not null default 0
);

create index idx_images_product on product_images(product_id);

create table inventory (
  variant_id uuid primary key references product_variants(id) on delete cascade,
  quantity_available int not null default 0,
  quantity_reserved int not null default 0,
  low_stock_threshold int not null default 5,
  updated_at timestamptz not null default now()
);

-- =========================================================================
-- CART
-- =========================================================================

create table carts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references profiles(id) on delete cascade,
  session_id text,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_carts_customer on carts(customer_id);
create index idx_carts_session on carts(session_id);

create table cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  quantity int not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

-- =========================================================================
-- ORDERS
-- =========================================================================

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references profiles(id) on delete set null,
  email text not null,
  status text not null default 'pending' check (status in
    ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  subtotal_cents int not null default 0,
  discount_cents int not null default 0,
  shipping_cents int not null default 0,
  tax_cents int not null default 0,
  total_cents int not null default 0,
  currency text not null default 'USD',
  coupon_id uuid,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_orders_customer on orders(customer_id);
create index idx_orders_status on orders(status);
create unique index idx_orders_stripe_pi on orders(stripe_payment_intent_id) where stripe_payment_intent_id is not null;

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete set null,
  product_name text not null,
  variant_label text,
  sku text not null,
  quantity int not null check (quantity > 0),
  unit_price_cents int not null,
  total_cents int not null
);

create index idx_order_items_order on order_items(order_id);

create table order_addresses (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  type text not null check (type in ('shipping', 'billing')),
  full_name text not null,
  line1 text not null,
  line2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  country text not null default 'US',
  phone text
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  stripe_payment_intent_id text,
  amount_cents int not null,
  currency text not null default 'USD',
  status text not null check (status in ('requires_action', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded')),
  method text,
  created_at timestamptz not null default now()
);

create table refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  amount_cents int not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  stripe_refund_id text,
  created_at timestamptz not null default now()
);

create table shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  carrier text,
  tracking_number text,
  tracking_url text,
  status text not null default 'pending' check (status in ('pending', 'shipped', 'in_transit', 'delivered', 'exception')),
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- AUTOSHIP (SUBSCRIPTIONS)
-- =========================================================================

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  pet_id uuid references pets(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  frequency_weeks int not null default 4 check (frequency_weeks in (2, 4, 6, 8)),
  next_order_date date not null,
  shipping_address jsonb not null,
  stripe_subscription_id text,
  stripe_customer_id text,
  discount_percent numeric(4,2) not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_subscriptions_customer on subscriptions(customer_id);

create table subscription_items (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  quantity int not null default 1 check (quantity > 0)
);

-- =========================================================================
-- MARKETING / MERCHANDISING
-- =========================================================================

create table coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('percentage', 'fixed', 'free_shipping')),
  value numeric(10,2) not null default 0,
  min_order_cents int not null default 0,
  usage_limit int,
  usage_count int not null default 0,
  first_order_only boolean not null default false,
  category_id uuid references categories(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table orders add constraint orders_coupon_fk foreign key (coupon_id) references coupons(id) on delete set null;

create table promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  cta_label text,
  cta_href text,
  badge_text text,
  placement text not null default 'homepage_banner',
  sort_order int not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  customer_id uuid references profiles(id) on delete set null,
  order_id uuid references orders(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  title text,
  body text,
  photos text[] not null default '{}',
  is_verified_purchase boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index idx_reviews_product on reviews(product_id);

create table wishlists (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table wishlist_items (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references wishlists(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (wishlist_id, product_id)
);

create table abandoned_carts (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id) on delete cascade,
  email text,
  recovered boolean not null default false,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create table marketing_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  customer_id uuid references profiles(id) on delete set null,
  session_id text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  changes jsonb,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- updated_at triggers
-- =========================================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated_at before update on profiles for each row execute function set_updated_at();
create trigger trg_pets_updated_at before update on pets for each row execute function set_updated_at();
create trigger trg_products_updated_at before update on products for each row execute function set_updated_at();
create trigger trg_carts_updated_at before update on carts for each row execute function set_updated_at();
create trigger trg_orders_updated_at before update on orders for each row execute function set_updated_at();
create trigger trg_subscriptions_updated_at before update on subscriptions for each row execute function set_updated_at();
