-- Customer saved address book for /account/addresses and checkout autofill.
create table addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  label text,
  full_name text not null,
  line1 text not null,
  line2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  country text not null default 'US',
  phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_addresses_profile on addresses(profile_id);

alter table addresses enable row level security;
create policy "addresses_owner_all" on addresses for all
  using (profile_id = auth.uid() or is_admin())
  with check (profile_id = auth.uid());
