-- Auto-create a profile row whenever a new auth user signs up.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Order numbers like PETORA-100234.
create sequence if not exists order_number_seq start 100001;

create or replace function generate_order_number()
returns text
language sql
as $$
  select 'PETORA-' || nextval('order_number_seq')::text;
$$;
