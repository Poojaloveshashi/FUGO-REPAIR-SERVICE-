# Fugo setup

Run Step 1 once. Then paste one prompt into each of your three apps.

## What becomes real

**Handover OTP**The code is checked inside the database and the driver app never sees it. Five wrong tries lock the order for 30 minutes. The test codes 1234 and 9999 stop working.

**Payments**Cash on delivery and UPI at the door work for real. The driver confirms the money before the order can finish. Cards, net banking and wallets stay switched off until you have a payment gateway account.

**Real jobs**One driver per job. Live location from the driver's phone. Repair, pickup, warehouse and return run by themselves, and the driver collects the repair bill at the return.

Step 1

## Database

Supabase, then SQL Editor, then New query. Paste, press Run, and confirm the warning about changes. You get one row and all_ok must say **true**. It is safe to run again.

Show the SQL (844 lines)

```
-- =====================================================================
-- Fugo shared backend v3. Run once in Supabase > SQL Editor. Safe to re-run.
-- Replaces v1 and v2 (you do not need to run those first).
--
-- 1. One public.orders table for fuel, repair and transport jobs
--    * turns id, customer_id, driver_id and status into text if they are not
--    * removes CHECK rules on status and NOT NULL on every column except id
--    * adds every column the three apps use, plus payment columns
--    No rows are deleted and every value is kept.
-- 2. Hand-offs between the apps (repair -> pickup -> warehouse -> return)
-- 3. Real delivery OTP, checked inside the database
--    * the code is kept in a private table that the apps cannot read
--    * a delivery can only be finished with fugo_complete_order (5 wrong tries lock it)
--    * no test codes work any more
-- 4. Payment tracking: cash or UPI at the door, collected by the driver.
--    "PAID" can only be set by fugo_complete_order or by your server (fugo_mark_paid).
-- 5. Access rules for the new Supabase default (new tables are closed to the API)
-- =====================================================================

begin;

-- 1. One orders table for every service ---------------------------------
create table if not exists public.orders (
  id text primary key default gen_random_uuid()::text
);

do $$
declare
  col            text;
  col_type       text;
  con            text;
  id_default     text;
  status_changed boolean := false;
begin
  -- a status CHECK would reject IN_TRANSIT, transporting, warehouse and so on
  for con in
    select conname
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.orders drop constraint %I', con);
  end loop;

  foreach col in array array['id', 'customer_id', 'driver_id', 'status'] loop
    select data_type into col_type
    from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = col;

    if col_type is not null and col_type <> 'text' then
      if col = 'id' then
        alter table public.orders alter column id drop identity if exists;
      end if;
      execute format('alter table public.orders alter column %I drop default', col);
      execute format('alter table public.orders alter column %I type text using %I::text', col, col);
      if col = 'status' then
        status_changed := true;
      end if;
    end if;
  end loop;

  for col in
    select column_name
    from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
      and is_nullable = 'NO' and column_name <> 'id'
  loop
    execute format('alter table public.orders alter column %I drop not null', col);
  end loop;

  select column_default into id_default
  from information_schema.columns
  where table_schema = 'public' and table_name = 'orders' and column_name = 'id';

  if id_default is null then
    alter table public.orders alter column id set default gen_random_uuid()::text;
  end if;

  if status_changed then
    alter table public.orders alter column status set default 'PENDING';
  end if;
end;
$$;

alter table public.orders
  add column if not exists status text default 'PENDING',
  add column if not exists service_type text,
  add column if not exists job_kind text,
  add column if not exists parent_order_id text,
  add column if not exists customer_id text,
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists driver_id text,
  add column if not exists technician_id text,
  add column if not exists outlet_id text,
  add column if not exists warehouse_id text,
  add column if not exists vehicle_id text,
  add column if not exists fuel_type text,
  add column if not exists amount numeric,
  add column if not exists litres numeric,
  add column if not exists address text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists delivery_lat double precision,
  add column if not exists delivery_lng double precision,
  add column if not exists driver_lat double precision,
  add column if not exists driver_lng double precision,
  add column if not exists driver_speed_kmh numeric,
  add column if not exists otp text,
  add column if not exists delivery_otp text,
  add column if not exists source_app text,
  add column if not exists verified_otp text,
  add column if not exists payment_method text,
  add column if not exists payment_status text default 'PENDING',
  add column if not exists total_amount numeric,
  add column if not exists delivery_fee numeric,
  add column if not exists gst_amount numeric,
  add column if not exists payment_ref text,
  add column if not exists paid_at timestamptz,
  add column if not exists collected_by text,
  add column if not exists driver_payout numeric,
  add column if not exists completed_at timestamptz,
  add column if not exists vehicle_name text,
  add column if not exists rc_number text,
  add column if not exists vehicle_plate text,
  add column if not exists description text,
  add column if not exists price numeric,
  add column if not exists parts jsonb default '[]'::jsonb,
  add column if not exists part_preference text,
  add column if not exists repair_complexity text,
  add column if not exists repair_start_time text,
  add column if not exists estimated_timing text,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists last_updated_at timestamptz default now();

-- service_type is FUEL, MAINTENANCE or TRANSPORT.
-- A row from any app that forgets to set it counts as FUEL.
alter table public.orders alter column service_type set default 'FUEL';

update public.orders
set service_type = case
      when coalesce(rc_number, vehicle_plate, vehicle_name) is not null then 'MAINTENANCE'
      else 'FUEL'
    end
where service_type is null;

-- one set of status words and one set of coordinates for old fuel and transport rows
update public.orders set status = 'IN_TRANSIT'
where service_type <> 'MAINTENANCE' and upper(status) = 'DISPATCHED';

update public.orders set status = 'COMPLETED'
where service_type <> 'MAINTENANCE' and upper(status) = 'DELIVERED';

update public.orders
set lat = coalesce(lat, delivery_lat),
    lng = coalesce(lng, delivery_lng),
    amount = coalesce(amount, litres)
where service_type <> 'MAINTENANCE';

create index if not exists orders_service_status_idx on public.orders (service_type, status);
create index if not exists orders_parent_idx on public.orders (parent_order_id);
create index if not exists orders_customer_idx on public.orders (customer_id);


-- 2. Shared people, vehicles, places and stock --------------------------
create table if not exists public.profiles (
  id           text primary key,
  role         text not null default 'customer'
               check (role in ('customer', 'driver', 'technician', 'outlet', 'support', 'admin')),
  display_name text,
  phone        text,
  status       text not null default 'offline',
  lat          double precision,
  lng          double precision,
  last_active  timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists public.vehicles (
  id              uuid primary key default gen_random_uuid(),
  owner_id        text not null,
  name            text,
  vehicle_plate   text,
  rc_number       text,
  make            text,
  model           text,
  year            text,
  fuel_type       text,
  engine_capacity text,
  created_at      timestamptz not null default now(),
  unique (owner_id, vehicle_plate)
);

-- Offline places: petrol pumps, garages, service centres
create table if not exists public.outlets (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  kind       text not null default 'GARAGE' check (kind in ('PUMP', 'GARAGE', 'SERVICE_CENTER')),
  address    text,
  lat        double precision,
  lng        double precision,
  owner_id   text,
  phone      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.warehouses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  address    text,
  lat        double precision,
  lng        double precision,
  created_at timestamptz not null default now()
);

-- Fuel (litres) and spare parts (pcs) per warehouse
create table if not exists public.inventory_items (
  id            uuid primary key default gen_random_uuid(),
  warehouse_id  uuid not null references public.warehouses (id) on delete cascade,
  kind          text not null check (kind in ('FUEL', 'PART')),
  name          text not null,
  sourcing      text not null default 'any',
  qty           numeric not null default 0 check (qty >= 0),
  unit          text not null default 'pcs',
  unit_price    numeric,
  reorder_level numeric not null default 0,
  updated_at    timestamptz not null default now(),
  unique (warehouse_id, kind, name, sourcing)
);

-- Insert a row here to receive or use stock. inventory_items.qty updates itself.
-- delta is positive for stock in, negative for stock out. reason is RECEIVE, USE or ADJUST.
create table if not exists public.stock_moves (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.inventory_items (id) on delete cascade,
  order_id   text,
  delta      numeric not null,
  reason     text not null default 'ADJUST',
  created_at timestamptz not null default now()
);

-- Status history for every order (fuel, repair and transport)
create table if not exists public.order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   text not null,
  status     text not null,
  message    text,
  photo_url  text,
  actor_id   text,
  created_at timestamptz not null default clock_timestamp()
);

alter table public.order_events alter column created_at set default clock_timestamp();

create index if not exists order_events_order_idx on public.order_events (order_id, created_at);

-- Delivery codes live here, never in the orders row, so a driver cannot read them.
-- Only the functions below can see this table.
create table if not exists public.order_otps (
  order_id     text primary key,
  otp          text not null,
  attempts     int not null default 0,
  locked_until timestamptz,
  created_at   timestamptz not null default now()
);

-- Your business details and fees. Change a value with:
--   update public.app_settings set value = 'name@bank' where key = 'merchant_vpa';
create table if not exists public.app_settings (
  key   text primary key,
  value text not null default '',
  note  text
);

insert into public.app_settings (key, value, note) values
  ('merchant_name', 'Fugo', 'Name shown on the UPI QR and on receipts'),
  ('merchant_vpa',  '',     'Your UPI ID for paying at the door, for example name@bank'),
  ('gstin',         '',     'Your GSTIN for invoices'),
  ('transport_fee', '0',    'Rupees a driver earns for one vehicle pickup or return')
on conflict (key) do nothing;


-- 3. Stock follows stock_moves ------------------------------------------
create or replace function public.fugo_apply_stock_move()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.inventory_items
  set qty = qty + new.delta, updated_at = now()
  where id = new.item_id;
  return new;
end;
$$;

drop trigger if exists fugo_stock_move_apply on public.stock_moves;
create trigger fugo_stock_move_apply
  after insert on public.stock_moves
  for each row execute function public.fugo_apply_stock_move();


-- 4. Rules every order write goes through -------------------------------
-- "App" below means a change that arrives through the API with the publishable
-- key or a signed-in user. The SQL editor and your server key are not "app".
--   * the customer app's columns and words are mapped to the driver app's
--   * an app can not mark an order PAID, finish a delivery without the OTP,
--     change an order's type, or take over another driver's order
--   * the delivery code is moved into the private order_otps table
create or replace function public.fugo_normalize_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app  boolean := coalesce(current_setting('role', true), '') in ('anon', 'authenticated');
  v_gate boolean := coalesce(current_setting('fugo.gate', true), '') = 'on';
  v_kind text;
  v_otp  text;
begin
  if tg_op = 'UPDATE' and v_app and not v_gate then
    new.service_type := old.service_type;
  end if;
  v_kind := upper(coalesce(new.service_type, 'FUEL'));

  -- Customer app writes litres + delivery_lat/lng and DISPATCHED/DELIVERED.
  -- Driver app reads amount + lat/lng and writes IN_TRANSIT/COMPLETED.
  -- Repair jobs (MAINTENANCE) keep their own lowercase words.
  -- Wrapped so that a problem here can never block an app's own write.
  begin
    new.updated_at := now();
    new.last_updated_at := now();

    if v_kind <> 'MAINTENANCE' then
      new.lat          := coalesce(new.lat, new.delivery_lat);
      new.lng          := coalesce(new.lng, new.delivery_lng);
      new.delivery_lat := coalesce(new.delivery_lat, new.lat);
      new.delivery_lng := coalesce(new.delivery_lng, new.lng);
      new.amount       := coalesce(new.amount, new.litres);
      new.litres       := coalesce(new.litres, new.amount);

      new.status := case upper(coalesce(new.status, 'PENDING'))
        when 'DISPATCHED' then 'IN_TRANSIT'
        when 'DELIVERED'  then 'COMPLETED'
        else upper(coalesce(new.status, 'PENDING'))
      end;

      -- a new order has no driver yet, so it has no driver position either
      if tg_op = 'INSERT' and new.driver_id is null then
        new.driver_lat := null;
        new.driver_lng := null;
        new.driver_speed_kmh := null;
      end if;
    end if;
  exception when others then
    raise warning 'fugo_normalize_order skipped: %', sqlerrm;
  end;

  -- rules an app can not get around
  if v_app and not v_gate then
    if tg_op = 'INSERT' then
      new.payment_status := 'PENDING';
      new.paid_at        := null;
      new.collected_by   := null;
      if v_kind <> 'MAINTENANCE' and upper(coalesce(new.status, '')) = 'COMPLETED' then
        new.status := 'PENDING';
      end if;
    else
      new.payment_status := old.payment_status;
      new.paid_at        := old.paid_at;
      new.collected_by   := old.collected_by;
      new.payment_ref    := old.payment_ref;
      if upper(coalesce(old.status, '')) in ('IN_TRANSIT', 'COMPLETED') then
        new.total_amount   := old.total_amount;
        new.delivery_fee   := old.delivery_fee;
        new.payment_method := old.payment_method;
      end if;
      if old.driver_id is not null and new.driver_id is not null
         and new.driver_id <> old.driver_id then
        new.driver_id := old.driver_id;
      end if;
      if v_kind <> 'MAINTENANCE'
         and upper(coalesce(new.status, '')) = 'COMPLETED'
         and upper(coalesce(old.status, '')) <> 'COMPLETED' then
        raise exception 'A delivery can only be finished with its OTP: call fugo_complete_order'
          using errcode = 'P0001';
      end if;
    end if;
  end if;

  -- the delivery code never stays in the readable row
  if v_kind <> 'MAINTENANCE' then
    v_otp := coalesce(nullif(btrim(new.otp), ''), nullif(btrim(new.delivery_otp), ''));
    if tg_op = 'INSERT' then
      if v_otp is null or v_otp !~ '^[0-9]{4}$' then
        v_otp := lpad((1000 + floor(random() * 9000))::int::text, 4, '0');
      end if;
      insert into public.order_otps (order_id, otp)
      values (new.id::text, v_otp)
      on conflict (order_id) do nothing;
    elsif v_otp ~ '^[0-9]{4}$' and (not v_app or v_gate) then
      insert into public.order_otps (order_id, otp)
      values (new.id::text, v_otp)
      on conflict (order_id) do update set otp = excluded.otp, attempts = 0, locked_until = null;
    end if;
    new.otp          := null;
    new.delivery_otp := null;
  end if;

  return new;
end;
$$;

drop trigger if exists fugo_orders_normalize on public.orders;
create trigger fugo_orders_normalize
  before insert or update on public.orders
  for each row execute function public.fugo_normalize_order();


-- 5. Hand-offs between the apps, done once in the database ---------------
-- Repair job card -> "transporting"          : pickup job appears in the driver app
-- Pickup job COMPLETED                        : repair job card moves to "warehouse"
-- Repair job card -> "ready" (was in warehouse): return job appears in the driver app,
--                                               with the repair bill to collect at the door
-- Return job COMPLETED                        : repair job card moves to "completed" and paid
-- Wrapped so that a problem here never blocks an app's own update.
create or replace function public.fugo_on_order_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  st    text    := lower(coalesce(new.status, ''));
  v_fee numeric := 0;
  v_due numeric := 0;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  begin
    -- what a driver earns for a pickup or return: set it in app_settings
    begin
      select nullif(btrim(value), '')::numeric into v_fee
      from public.app_settings where key = 'transport_fee';
    exception when others then
      v_fee := 0;
    end;
    v_fee := coalesce(v_fee, 0);

    insert into public.order_events (order_id, status)
    values (new.id::text, new.status);

    if tg_op = 'UPDATE' and new.service_type = 'MAINTENANCE' then
      if st = 'transporting' then
        insert into public.orders (
          id, service_type, job_kind, parent_order_id, status,
          customer_id, customer_name, customer_phone,
          vehicle_name, vehicle_plate, address, lat, lng,
          price, driver_payout, otp, description, created_at, updated_at)
        select
          'PICKUP-' || new.id::text, 'TRANSPORT', 'VEHICLE_PICKUP', new.id::text, 'PENDING',
          new.customer_id, new.customer_name, new.customer_phone,
          new.vehicle_name, new.vehicle_plate, new.address, new.lat, new.lng,
          v_fee, v_fee, lpad((1000 + floor(random() * 9000))::int::text, 4, '0'),
          'Pick up vehicle for repair ' || new.id::text, now(), now()
        where not exists (
          select 1 from public.orders o where o.id::text = 'PICKUP-' || new.id::text);

      elsif st = 'ready' and exists (
        select 1 from public.order_events e
        where e.order_id = new.id::text and lower(e.status) = 'warehouse') then
        v_due := coalesce(nullif(new.total_amount, 0), new.price, 0);
        insert into public.orders (
          id, service_type, job_kind, parent_order_id, status,
          customer_id, customer_name, customer_phone,
          vehicle_name, vehicle_plate, address, lat, lng,
          price, driver_payout, total_amount, payment_method, payment_status,
          otp, description, created_at, updated_at)
        select
          'RETURN-' || new.id::text, 'TRANSPORT', 'VEHICLE_RETURN', new.id::text, 'PENDING',
          new.customer_id, new.customer_name, new.customer_phone,
          new.vehicle_name, new.vehicle_plate, new.address, new.lat, new.lng,
          v_fee, v_fee, v_due, coalesce(new.payment_method, 'COD'),
          case when new.payment_status = 'PAID' then 'PAID' else 'PENDING' end,
          lpad((1000 + floor(random() * 9000))::int::text, 4, '0'),
          'Return repaired vehicle ' || new.id::text, now(), now()
        where not exists (
          select 1 from public.orders o where o.id::text = 'RETURN-' || new.id::text);
      end if;
    end if;

    if tg_op = 'UPDATE' and new.service_type = 'TRANSPORT'
       and new.parent_order_id is not null and upper(new.status) = 'COMPLETED' then
      if new.job_kind = 'VEHICLE_PICKUP' then
        update public.orders
        set status = 'warehouse', updated_at = now()
        where id::text = new.parent_order_id;
      elsif new.job_kind = 'VEHICLE_RETURN' then
        update public.orders
        set status         = 'completed',
            payment_status = case when new.payment_status = 'PAID' then 'PAID' else payment_status end,
            paid_at        = case when new.payment_status = 'PAID' then new.paid_at else paid_at end,
            collected_by   = case when new.payment_status = 'PAID' then new.collected_by else collected_by end,
            payment_method = case when new.payment_status = 'PAID' then new.payment_method else payment_method end,
            updated_at     = now()
        where id::text = new.parent_order_id;
      end if;
    end if;
  exception when others then
    raise warning 'fugo_on_order_change skipped: %', sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists fugo_orders_change on public.orders;
create trigger fugo_orders_change
  after insert or update of status on public.orders
  for each row execute function public.fugo_on_order_change();


-- 6. What the apps call --------------------------------------------------
-- Driver app: accept a job. Two drivers can not both get it.
--   rpc fugo_accept_order(p_order_id, p_driver_id)
create or replace function public.fugo_accept_order(p_order_id text, p_driver_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.orders;
begin
  if coalesce(btrim(p_driver_id), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'DRIVER_REQUIRED');
  end if;

  perform set_config('fugo.gate', 'on', true);
  update public.orders
  set driver_id = btrim(p_driver_id), status = 'IN_TRANSIT', updated_at = now()
  where id = p_order_id
    and coalesce(service_type, 'FUEL') <> 'MAINTENANCE'
    and upper(coalesce(status, '')) = 'PENDING'
    and driver_id is null
  returning * into r;
  perform set_config('fugo.gate', 'off', true);

  if r.id is null then
    return jsonb_build_object('ok', false, 'error', 'ALREADY_TAKEN');
  end if;
  return jsonb_build_object('ok', true, 'order', to_jsonb(r));
end;
$$;

-- Driver app: finish a delivery with the code the customer reads out.
-- If money is still due, p_collected must be true (driver confirms cash or UPI received).
--   rpc fugo_complete_order(p_order_id, p_otp, p_driver_id, p_collected)
--   answers { ok: true, order } or { ok: false, error, ... }
--   errors: WRONG_OTP (attempts_left), LOCKED (minutes_left), PAYMENT_NOT_COLLECTED (amount_due),
--           NOT_IN_TRANSIT, NOT_YOUR_ORDER, NOT_FOUND, NO_OTP_ON_FILE
create or replace function public.fugo_complete_order(
  p_order_id  text,
  p_otp       text,
  p_driver_id text    default null,
  p_collected boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r       public.orders;
  s       public.order_otps;
  v_otp   text    := btrim(coalesce(p_otp, ''));
  v_who   text    := nullif(btrim(coalesce(p_driver_id, '')), '');
  v_due   numeric;
  v_paid  boolean;
  v_tries int;
  v_max   constant int := 5;
begin
  select * into r from public.orders where id = p_order_id for update;
  if r.id is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if coalesce(r.service_type, 'FUEL') = 'MAINTENANCE' then
    return jsonb_build_object('ok', false, 'error', 'NOT_A_DELIVERY');
  end if;
  if upper(coalesce(r.status, '')) = 'COMPLETED' then
    return jsonb_build_object('ok', true, 'already', true, 'order', to_jsonb(r));
  end if;
  if upper(coalesce(r.status, '')) <> 'IN_TRANSIT' then
    return jsonb_build_object('ok', false, 'error', 'NOT_IN_TRANSIT', 'status', r.status);
  end if;
  if r.driver_id is not null and v_who is not null and r.driver_id <> v_who then
    return jsonb_build_object('ok', false, 'error', 'NOT_YOUR_ORDER');
  end if;

  select * into s from public.order_otps where order_id = r.id for update;
  if s.order_id is null then
    return jsonb_build_object('ok', false, 'error', 'NO_OTP_ON_FILE');
  end if;
  if s.locked_until is not null and s.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'LOCKED',
      'minutes_left', greatest(1, ceil(extract(epoch from (s.locked_until - now())) / 60)::int));
  end if;

  if v_otp <> s.otp then
    v_tries := s.attempts + 1;
    if v_tries >= v_max then
      update public.order_otps
      set attempts = 0, locked_until = now() + interval '30 minutes'
      where order_id = r.id;
      return jsonb_build_object('ok', false, 'error', 'LOCKED', 'minutes_left', 30);
    end if;
    update public.order_otps set attempts = v_tries where order_id = r.id;
    return jsonb_build_object('ok', false, 'error', 'WRONG_OTP', 'attempts_left', v_max - v_tries);
  end if;

  -- the code is right: now the money
  v_due  := coalesce(r.total_amount, 0);
  v_paid := coalesce(r.payment_status, 'PENDING') = 'PAID';
  if v_due > 0 and not v_paid and not coalesce(p_collected, false) then
    return jsonb_build_object('ok', false, 'error', 'PAYMENT_NOT_COLLECTED',
      'amount_due', v_due, 'method', coalesce(r.payment_method, 'COD'));
  end if;

  perform set_config('fugo.gate', 'on', true);
  update public.orders
  set status         = 'COMPLETED',
      completed_at   = now(),
      verified_otp   = v_otp,
      updated_at     = now(),
      payment_status = case when v_due > 0 and not v_paid then 'PAID' else payment_status end,
      paid_at        = case when v_due > 0 and not v_paid then now() else paid_at end,
      collected_by   = case when v_due > 0 and not v_paid then v_who else collected_by end,
      payment_method = case when v_due > 0 and not v_paid then coalesce(payment_method, 'COD') else payment_method end
  where id = r.id
  returning * into r;
  perform set_config('fugo.gate', 'off', true);

  delete from public.order_otps where order_id = r.id;
  return jsonb_build_object('ok', true, 'order', to_jsonb(r));
end;
$$;

-- Customer app: show the delivery code again after a reload (also for vehicle pickup/return).
-- Only works with the order's own customer_id. Real protection needs customer login.
--   rpc fugo_get_my_otp(p_order_id, p_customer_id)  -> the code, or null
create or replace function public.fugo_get_my_otp(p_order_id text, p_customer_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.otp
  from public.order_otps s
  join public.orders o on o.id = s.order_id
  where s.order_id = p_order_id
    and o.customer_id is not null
    and o.customer_id = p_customer_id
    and upper(coalesce(o.status, '')) not in ('COMPLETED', 'CANCELLED');
$$;

-- Your server only (payment gateway webhook): mark an order paid online.
--   rpc fugo_mark_paid(p_order_id, p_amount, p_ref, p_method)
create or replace function public.fugo_mark_paid(
  p_order_id text,
  p_amount   numeric,
  p_ref      text,
  p_method   text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.orders;
begin
  select * into r from public.orders where id = p_order_id for update;
  if r.id is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if coalesce(r.payment_status, 'PENDING') = 'PAID' then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  if r.total_amount is not null and coalesce(p_amount, 0) < r.total_amount then
    return jsonb_build_object('ok', false, 'error', 'AMOUNT_TOO_LOW',
      'expected', r.total_amount, 'received', p_amount);
  end if;

  perform set_config('fugo.gate', 'on', true);
  update public.orders
  set payment_status = 'PAID',
      paid_at        = now(),
      payment_ref    = p_ref,
      payment_method = coalesce(p_method, payment_method),
      updated_at     = now()
  where id = r.id
  returning * into r;
  perform set_config('fugo.gate', 'off', true);

  return jsonb_build_object('ok', true, 'order', to_jsonb(r));
end;
$$;

-- 7. Live updates for the apps ------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.orders;
  exception when duplicate_object or undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.order_events;
  exception when duplicate_object or undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.inventory_items;
  exception when duplicate_object or undefined_object then null;
  end;
end;
$$;


-- 8. Move delivery codes that already sit in readable rows into the private table
insert into public.order_otps (order_id, otp)
select id, coalesce(nullif(btrim(otp), ''), nullif(btrim(delivery_otp), ''))
from public.orders
where coalesce(service_type, 'FUEL') <> 'MAINTENANCE'
  and upper(coalesce(status, '')) not in ('COMPLETED', 'DELIVERED', 'CANCELLED')
  and coalesce(nullif(btrim(otp), ''), nullif(btrim(delivery_otp), '')) ~ '^[0-9]{4}$'
on conflict (order_id) do nothing;

update public.orders
set otp = null, delivery_otp = null
where coalesce(service_type, 'FUEL') <> 'MAINTENANCE'
  and (otp is not null or delivery_otp is not null);

delete from public.order_otps o
where not exists (select 1 from public.orders x where x.id = o.order_id);


-- 9. Who can do what ------------------------------------------------------
-- Since 30 Oct 2026 Supabase no longer opens new tables to the API by itself,
-- so every permission is stated here.
-- The three apps have no login yet and use the publishable key (role "anon"):
-- they may read, create and update orders, and nothing else.
-- Every other table is closed to the apps. Add policies when an app needs one.
grant usage on schema public to anon, authenticated, service_role;

revoke all on public.orders from anon, authenticated;
grant select, insert, update on public.orders to anon, authenticated;
grant all on public.orders to service_role;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'vehicles', 'outlets', 'warehouses', 'inventory_items',
    'stock_moves', 'order_events', 'order_otps', 'app_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end;
$$;

-- app_settings is readable by the apps (UPI ID, business name), never writable by them
grant select on public.app_settings to anon, authenticated;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_settings' and policyname = 'fugo_settings_read') then
    create policy fugo_settings_read on public.app_settings
      for select to anon, authenticated using (true);
  end if;
end;
$$;

-- If row level security is on for orders, the apps need an open policy
-- (they have no login yet). Replace it before launch.
do $$
begin
  if (select relrowsecurity from pg_class where oid = 'public.orders'::regclass)
     and not exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'orders' and policyname = 'fugo_prototype_open') then
    create policy fugo_prototype_open on public.orders
      for all to anon, authenticated
      using (true) with check (true);
  end if;
end;
$$;

-- Triggers and the server-only function: not callable from the apps
revoke all on function public.fugo_normalize_order()  from public, anon, authenticated;
revoke all on function public.fugo_on_order_change()  from public, anon, authenticated;
revoke all on function public.fugo_apply_stock_move() from public, anon, authenticated;
revoke all on function public.fugo_mark_paid(text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.fugo_mark_paid(text, numeric, text, text) to service_role;

-- Functions the apps call
revoke all on function public.fugo_accept_order(text, text) from public;
revoke all on function public.fugo_complete_order(text, text, text, boolean) from public;
revoke all on function public.fugo_get_my_otp(text, text) from public;
grant execute on function public.fugo_accept_order(text, text) to anon, authenticated, service_role;
grant execute on function public.fugo_complete_order(text, text, text, boolean) to anon, authenticated, service_role;
grant execute on function public.fugo_get_my_otp(text, text) to anon, authenticated, service_role;

-- Tell Supabase's API to pick up the new columns and functions now
-- (fixes "Could not find the 'x' column of 'orders' in the schema cache")
notify pgrst, 'reload schema';

commit;

-- Check: this is the one row you see after running. all_ok must be true.
select
  (select data_type from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'id') = 'text'
  and (select count(*) from pg_trigger
        where tgrelid = 'public.orders'::regclass and not tgisinternal) >= 2
  and has_table_privilege('anon', 'public.orders', 'insert')
  and has_table_privilege('anon', 'public.orders', 'update')
  and not has_table_privilege('anon', 'public.orders', 'delete')
  and not has_table_privilege('anon', 'public.order_otps', 'select')
  and has_function_privilege('anon', 'public.fugo_complete_order(text,text,text,boolean)', 'execute')
  and not has_function_privilege('anon', 'public.fugo_mark_paid(text,numeric,text,text)', 'execute')
  as all_ok,
  (select count(*) from public.orders) as order_rows,
  (select count(*) from public.order_otps) as codes_in_private_table,
  (select relrowsecurity from pg_class where oid = 'public.orders'::regclass) as orders_rls_on;
```

Step 2

## Your payment details

Fill these in, copy the result, and run it in the same SQL Editor. Leave the UPI ID empty to offer cash on delivery only.

Your UPI ID Customers pay this ID when they choose UPI at the door.

Business name

GSTIN (optional)

Driver pay for one vehicle pickup or return (₹)

Step 3

## App prompts

Open each app in AI Studio, paste its prompt into the chat, and wait until it finishes. The apps keep their current Supabase key.

### Customer app

Show prompt

```
Update this app to match the new Supabase backend. Change only what is listed. Keep the existing Supabase URL and key exactly as they are. Never use a secret key (sb_secret_ or service_role) in this app.

1. Placing an order (placeSupabaseOrder in src/services/supabase.ts): keep the current fields and also send payment_method ("COD" or "UPI"), total_amount (the exact total shown at checkout), delivery_fee and gst_amount. Never send payment_status, paid_at or collected_by. Keep sending otp from generateDeliveryOtp() once, when the order is created. The server keeps it private, so the order row always comes back with otp null. Keep the code in the local order and show it on the tracking screen. If the local copy is missing, call supabase.rpc('fugo_get_my_otp', { p_order_id: order.id, p_customer_id: <this customer's customer_id> }) and show the result.

2. Payment options (src/services/payment.ts and the Checkout screen): only two methods work now: Cash on delivery and UPI at the door. Show every other method (cards, net banking, wallets, Fugo wallet, fleet card, pay later) greyed out with the label "Coming soon". Delete the fake payment success: the setTimeout simulation, the fake RRN and auth codes, the 3D Secure OTP modal, the default 5000 wallet balance and the card number and CVV form. After the order is placed the receipt says "Pay on delivery: ₹<total>", never "Paid".

3. Business details: remove the hard-coded FUGO_MERCHANT_VPA, FUGO_MERCHANT_NAME and FUGO_GSTIN. Read them from the Supabase table app_settings (columns key and value; keys merchant_vpa, merchant_name, gstin). If merchant_vpa is empty, hide "UPI at the door" and offer only Cash on delivery.

4. Tracking: delete the GPS simulator in subscribeToOrderStream, every call to updateDriverLocation, and the "Simulate arrived" button (handleSimulateArrived in Tracking.tsx). This app only reads status, driver_lat and driver_lng. A customer can never mark an order delivered: delivered means status COMPLETED, set by the driver.

5. Orders list: fetch only this customer's orders (filter on customer_id), newest first. For service_type TRANSPORT (job_kind VEHICLE_PICKUP or VEHICLE_RETURN) show the delivery code (fugo_get_my_otp) and, for a return, the amount to pay (total_amount).
```

### Delivery app

Show prompt

```
Update this app to match the new Supabase backend. Change only what is listed. Keep the existing Supabase URL and key exactly as they are. Never use a secret key (sb_secret_ or service_role) in this app.

1. Accepting a job (acceptSupabaseOrderToInTransit in src/lib/supabase.ts): replace the direct update with supabase.rpc('fugo_accept_order', { p_order_id, p_driver_id }). It returns { ok, error, order }. If error is ALREADY_TAKEN, show "Another driver took this job" and refresh the list.

2. Finishing a delivery (completeSupabaseOrderWithOtp and OtpVerificationModal): delete the 1234 and 9999 test codes, the '1234' default in normalizeSupabaseOrder, and every hint of the expected code. The code is no longer in the order. Call supabase.rpc('fugo_complete_order', { p_order_id, p_otp: <digits typed>, p_driver_id, p_collected: <true only after the driver confirmed cash or UPI received> }). It returns { ok, error, attempts_left, minutes_left, amount_due, method }. Show: WRONG_OTP -> "Wrong code, N tries left"; LOCKED -> "Too many wrong codes. Try again in N minutes"; PAYMENT_NOT_COLLECTED -> go to the payment step; NOT_YOUR_ORDER or NOT_IN_TRANSIT -> show the message. Never finish an order any other way.

3. Payment step: show total_amount and payment_method (COD if empty). If payment_status is PAID, show "Already paid online. Do not collect cash". Otherwise show "Cash received" and "UPI received" buttons. For UPI, show a QR for the amount using merchant_vpa and merchant_name from the Supabase table app_settings (columns key and value). Only after one of the two buttons is tapped may the OTP step run with p_collected true.

4. Real location: while a job is IN_TRANSIT, use navigator.geolocation.watchPosition and every 5 seconds update driver_lat, driver_lng and driver_speed_kmh on that order. Delete any simulated driver movement.

5. Remove the "simulate customer order" button from the Dashboard so test orders never reach the shared database. Leave login as it is for now.

6. Earnings: add up driver_payout (use price if it is empty) of this driver's COMPLETED jobs.
```

### Repair app

Show prompt

```
Update this app to match the new Supabase backend. Change only what is listed. Keep the existing Supabase URL and key exactly as they are. Never use a secret key (sb_secret_ or service_role) in this app.

1. When the technician moves a job to Ready, ask for a required "Final bill (₹)" and save it to both price and total_amount on the order. The driver collects this amount when the vehicle is returned.

2. On every job card show payment_status read-only: "Unpaid" for PENDING, or "Paid ₹<total_amount> via <payment_method>" for PAID. Never write payment_status, paid_at or collected_by.
```

Step 4

## Test it

1. Customer app: order fuel with Cash on delivery.
2. Delivery app: accept it. On a second phone the same job must say another driver took it.
3. Type a wrong code. It must say how many tries are left. 1234 must fail too.
4. Tap Cash received, type the customer's real code. The order completes and the customer app shows delivered.
5. Repair app: move a job to Transporting. A pickup job appears in the delivery app and the customer app shows the pickup code.
6. Finish the pickup. The repair card moves to Warehouse. Mark it Ready with a final bill. A return job appears with the amount to collect.

## Still needs you

- **Online payments** (cards, net banking, UPI apps, wallets) need a Razorpay account with business KYC. Test keys are instant. Once you have them, ask me for the server functions.
- **Login by SMS code** needs an SMS provider registered for India, such as MSG91 or Twilio Verify. Until then both apps open without a real login, so give them only to drivers you trust.
- **UPI at the door** has no bank confirmation. You see the money in your bank statement, so match it against the orders marked paid.