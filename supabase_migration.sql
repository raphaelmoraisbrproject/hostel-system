-- ============================================
-- HOSTEL MANAGEMENT SYSTEM - MIGRATION SCRIPT
-- Version: 1.0 to 2.0
-- ============================================
-- This script migrates the existing schema to the improved version
-- WITHOUT dropping tables (preserves existing data)
-- ============================================

-- ============================================
-- STEP 1: CREATE ENUMS (if they don't exist)
-- ============================================

-- Check and create ENUMs
do $$ 
begin
  if not exists (select 1 from pg_type where typname = 'room_type') then
    create type room_type as enum ('Dorm', 'Private');
  end if;
  
  if not exists (select 1 from pg_type where typname = 'bed_status') then
    create type bed_status as enum ('Active', 'Maintenance', 'Out of Service');
  end if;
  
  if not exists (select 1 from pg_type where typname = 'booking_status') then
    create type booking_status as enum ('Confirmed', 'Checked-in', 'Checked-out', 'Cancelled', 'No-show');
  end if;
  
  if not exists (select 1 from pg_type where typname = 'transaction_type') then
    create type transaction_type as enum ('Income', 'Expense', 'Refund');
  end if;
  
  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type payment_method as enum ('Cash', 'Credit Card', 'Debit Card', 'Pix', 'Bank Transfer');
  end if;
end $$;

-- ============================================
-- STEP 2: ADD NEW COLUMNS
-- ============================================

-- Add updated_at to all tables
alter table rooms add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now()) not null;
alter table beds add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now()) not null;
alter table guests add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now()) not null;
alter table bookings add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now()) not null;
alter table transactions add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now()) not null;

-- Add deleted_at for soft delete
alter table rooms add column if not exists deleted_at timestamp with time zone;
alter table beds add column if not exists deleted_at timestamp with time zone;
alter table guests add column if not exists deleted_at timestamp with time zone;
alter table bookings add column if not exists deleted_at timestamp with time zone;
alter table transactions add column if not exists deleted_at timestamp with time zone;

-- Add new fields to rooms
alter table rooms add column if not exists description text;
alter table rooms add column if not exists is_active boolean default true not null;

-- Add new fields to guests
alter table guests add column if not exists date_of_birth date;

-- Add new fields to bookings
alter table bookings add column if not exists notes text;

-- Add new fields to transactions
alter table transactions add column if not exists description text;

-- ============================================
-- STEP 3: CONVERT TEXT COLUMNS TO ENUMS
-- ============================================
-- WARNING: This will fail if there are invalid values in the database
-- Make sure all existing data uses the correct enum values

-- Convert rooms.type to enum
alter table rooms alter column type type room_type using type::room_type;

-- Convert beds.status to enum
alter table beds alter column status type bed_status using status::bed_status;

-- Convert bookings.status to enum
alter table bookings alter column status type booking_status using status::booking_status;

-- Convert transactions.type to enum
alter table transactions alter column type type transaction_type using type::transaction_type;

-- Convert transactions.payment_method to enum
alter table transactions alter column payment_method type payment_method using payment_method::payment_method;

-- ============================================
-- STEP 4: ADD CONSTRAINTS
-- ============================================

-- Rooms constraints
alter table rooms add constraint if not exists check_capacity check (capacity > 0 and capacity <= 20);
alter table rooms add constraint if not exists check_price check (price_per_night > 0);

-- Guests constraints
alter table guests add constraint if not exists check_email check (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
alter table guests add constraint if not exists unique_passport unique (passport_id);
alter table guests add constraint if not exists unique_email unique (email);

-- Beds constraints
alter table beds add constraint if not exists unique_bed_per_room unique (room_id, bed_number);

-- Bookings constraints
alter table bookings add constraint if not exists valid_date_range check (check_out_date > check_in_date);
alter table bookings add constraint if not exists valid_payment check (paid_amount <= total_amount);
alter table bookings add constraint if not exists check_total_amount check (total_amount >= 0);
alter table bookings add constraint if not exists check_paid_amount check (paid_amount >= 0);

-- Transactions constraints
alter table transactions add constraint if not exists check_amount check (amount != 0);

-- ============================================
-- STEP 5: CREATE TRIGGERS FOR UPDATED_AT
-- ============================================

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Drop existing triggers if they exist
drop trigger if exists update_rooms_updated_at on rooms;
drop trigger if exists update_beds_updated_at on beds;
drop trigger if exists update_guests_updated_at on guests;
drop trigger if exists update_bookings_updated_at on bookings;
drop trigger if exists update_transactions_updated_at on transactions;

-- Create new triggers
create trigger update_rooms_updated_at before update on rooms
  for each row execute function update_updated_at_column();

create trigger update_beds_updated_at before update on beds
  for each row execute function update_updated_at_column();

create trigger update_guests_updated_at before update on guests
  for each row execute function update_updated_at_column();

create trigger update_bookings_updated_at before update on bookings
  for each row execute function update_updated_at_column();

create trigger update_transactions_updated_at before update on transactions
  for each row execute function update_updated_at_column();

-- ============================================
-- STEP 6: CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Drop existing indexes if they exist (to avoid errors)
drop index if exists idx_bookings_guest_id;
drop index if exists idx_bookings_room_id;
drop index if exists idx_bookings_bed_id;
drop index if exists idx_bookings_dates;
drop index if exists idx_bookings_status;
drop index if exists idx_beds_room_id;
drop index if exists idx_transactions_booking_id;
drop index if exists idx_transactions_date;
drop index if exists idx_transactions_type;
drop index if exists idx_guests_email;
drop index if exists idx_guests_passport;

-- Create new indexes
create index idx_bookings_guest_id on bookings(guest_id);
create index idx_bookings_room_id on bookings(room_id);
create index idx_bookings_bed_id on bookings(bed_id);
create index idx_bookings_dates on bookings(check_in_date, check_out_date);
create index idx_bookings_status on bookings(status) where deleted_at is null;
create index idx_beds_room_id on beds(room_id);
create index idx_transactions_booking_id on transactions(booking_id);
create index idx_transactions_date on transactions(date);
create index idx_transactions_type on transactions(type);
create index idx_guests_email on guests(email) where deleted_at is null;
create index idx_guests_passport on guests(passport_id) where deleted_at is null;

-- ============================================
-- STEP 7: UPDATE RLS POLICIES (OPTIONAL)
-- ============================================
-- NOTE: Uncomment this section if you want to update RLS policies
-- WARNING: This will replace your current policies

/*
-- Drop all existing policies
drop policy if exists "Enable read access for all users" on rooms;
drop policy if exists "Enable insert access for all users" on rooms;
drop policy if exists "Enable update access for all users" on rooms;
drop policy if exists "Enable delete access for all users" on rooms;

drop policy if exists "Enable read access for all users" on beds;
drop policy if exists "Enable insert access for all users" on beds;
drop policy if exists "Enable update access for all users" on beds;
drop policy if exists "Enable delete access for all users" on beds;

drop policy if exists "Enable read access for all users" on guests;
drop policy if exists "Enable insert access for all users" on guests;
drop policy if exists "Enable update access for all users" on guests;
drop policy if exists "Enable delete access for all users" on guests;

drop policy if exists "Enable read access for all users" on bookings;
drop policy if exists "Enable insert access for all users" on bookings;
drop policy if exists "Enable update access for all users" on bookings;
drop policy if exists "Enable delete access for all users" on bookings;

drop policy if exists "Enable read access for all users" on transactions;
drop policy if exists "Enable insert access for all users" on transactions;
drop policy if exists "Enable update access for all users" on transactions;
drop policy if exists "Enable delete access for all users" on transactions;

-- Create new policies (authenticated users only)
create policy "Enable read for authenticated users" on rooms 
  for select using (auth.role() = 'authenticated' and deleted_at is null);

create policy "Enable read for authenticated users" on beds 
  for select using (auth.role() = 'authenticated' and deleted_at is null);

create policy "Enable read for authenticated users" on guests 
  for select using (auth.role() = 'authenticated' and deleted_at is null);

create policy "Enable read for authenticated users" on bookings 
  for select using (auth.role() = 'authenticated' and deleted_at is null);

create policy "Enable read for authenticated users" on transactions 
  for select using (auth.role() = 'authenticated' and deleted_at is null);

create policy "Enable insert for authenticated users" on rooms 
  for insert with check (auth.role() = 'authenticated');

create policy "Enable insert for authenticated users" on beds 
  for insert with check (auth.role() = 'authenticated');

create policy "Enable insert for authenticated users" on guests 
  for insert with check (auth.role() = 'authenticated');

create policy "Enable insert for authenticated users" on bookings 
  for insert with check (auth.role() = 'authenticated');

create policy "Enable insert for authenticated users" on transactions 
  for insert with check (auth.role() = 'authenticated');

create policy "Enable update for authenticated users" on rooms 
  for update using (auth.role() = 'authenticated');

create policy "Enable update for authenticated users" on beds 
  for update using (auth.role() = 'authenticated');

create policy "Enable update for authenticated users" on guests 
  for update using (auth.role() = 'authenticated');

create policy "Enable update for authenticated users" on bookings 
  for update using (auth.role() = 'authenticated');

create policy "Enable update for authenticated users" on transactions 
  for update using (auth.role() = 'authenticated');

create policy "Enable delete for authenticated users" on rooms 
  for delete using (auth.role() = 'authenticated');

create policy "Enable delete for authenticated users" on beds 
  for delete using (auth.role() = 'authenticated');

create policy "Enable delete for authenticated users" on guests 
  for delete using (auth.role() = 'authenticated');

create policy "Enable delete for authenticated users" on bookings 
  for delete using (auth.role() = 'authenticated');

create policy "Enable delete for authenticated users" on transactions 
  for delete using (auth.role() = 'authenticated');
*/

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Your database has been migrated to version 2.0!
-- All existing data has been preserved.
-- 
-- What was added:
-- ✅ ENUMs for type safety
-- ✅ updated_at columns with auto-update triggers
-- ✅ deleted_at columns for soft delete
-- ✅ New fields (description, is_active, date_of_birth, notes)
-- ✅ Validation constraints
-- ✅ UNIQUE constraints
-- ✅ Performance indexes
-- 
-- Next steps:
-- 1. Test your application to ensure everything works
-- 2. If needed, uncomment STEP 7 to update RLS policies
-- 3. Monitor query performance
-- ============================================
