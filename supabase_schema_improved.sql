-- ============================================
-- HOSTEL MANAGEMENT SYSTEM - IMPROVED SCHEMA
-- Version: 2.0 (Production-Ready)
-- ============================================
-- This schema includes:
-- ✅ ENUMs for type safety
-- ✅ Validation constraints
-- ✅ Indexes for performance
-- ✅ Soft delete support
-- ✅ Audit trails (updated_at)
-- ✅ Proper RLS policies
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- CREATE ENUMS FOR TYPE SAFETY
-- ============================================

create type room_type as enum ('Dorm', 'Private');
create type bed_status as enum ('Active', 'Maintenance', 'Out of Service');
create type booking_status as enum ('Confirmed', 'Checked-in', 'Checked-out', 'Cancelled', 'No-show');
create type transaction_type as enum ('Income', 'Expense', 'Refund');
create type payment_method as enum ('Cash', 'Credit Card', 'Debit Card', 'Pix', 'Bank Transfer');

-- ============================================
-- CREATE TABLES
-- ============================================

-- Rooms Table
create table rooms (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  type room_type not null,
  capacity int not null check (capacity > 0 and capacity <= 20),
  price_per_night decimal(10,2) not null check (price_per_night > 0),
  description text,
  is_active boolean default true not null,
  deleted_at timestamp with time zone
);

-- Beds Table (For Dorms)
create table beds (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  room_id uuid references rooms(id) on delete cascade not null,
  bed_number text not null,
  status bed_status default 'Active' not null,
  deleted_at timestamp with time zone,
  
  constraint unique_bed_per_room unique (room_id, bed_number)
);

-- Guests Table
create table guests (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  full_name text not null,
  passport_id text,
  nationality text,
  phone text,
  email text check (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  date_of_birth date,
  notes text,
  deleted_at timestamp with time zone,
  
  constraint unique_passport unique (passport_id),
  constraint unique_email unique (email)
);

-- Bookings Table
create table bookings (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  guest_id uuid references guests(id) not null,
  room_id uuid references rooms(id),
  bed_id uuid references beds(id),
  check_in_date date not null,
  check_out_date date not null,
  status booking_status not null default 'Confirmed',
  total_amount decimal(10,2) not null check (total_amount >= 0),
  paid_amount decimal(10,2) default 0 check (paid_amount >= 0),
  notes text,
  deleted_at timestamp with time zone,
  
  constraint check_room_or_bed check (
    (room_id is not null and bed_id is null) or 
    (room_id is null and bed_id is not null) or
    (room_id is not null and bed_id is not null)
  ),
  constraint valid_date_range check (check_out_date > check_in_date),
  constraint valid_payment check (paid_amount <= total_amount)
);

-- Transactions Table
create table transactions (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  booking_id uuid references bookings(id) on delete set null,
  type transaction_type not null,
  category text not null,
  amount decimal(10,2) not null check (amount != 0),
  payment_method payment_method,
  date date default CURRENT_DATE not null,
  description text,
  deleted_at timestamp with time zone
);

-- ============================================
-- CREATE TRIGGERS FOR UPDATED_AT
-- ============================================

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

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
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Bookings indexes (most queried table)
create index idx_bookings_guest_id on bookings(guest_id);
create index idx_bookings_room_id on bookings(room_id);
create index idx_bookings_bed_id on bookings(bed_id);
create index idx_bookings_dates on bookings(check_in_date, check_out_date);
create index idx_bookings_status on bookings(status) where deleted_at is null;

-- Beds indexes
create index idx_beds_room_id on beds(room_id);

-- Transactions indexes
create index idx_transactions_booking_id on transactions(booking_id);
create index idx_transactions_date on transactions(date);
create index idx_transactions_type on transactions(type);

-- Guests indexes
create index idx_guests_email on guests(email) where deleted_at is null;
create index idx_guests_passport on guests(passport_id) where deleted_at is null;

-- ============================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================

alter table rooms enable row level security;
alter table beds enable row level security;
alter table guests enable row level security;
alter table bookings enable row level security;
alter table transactions enable row level security;

-- ============================================
-- CREATE RLS POLICIES
-- ============================================
-- NOTE: Change these policies based on your security requirements
-- Current: Authenticated users only (recommended for production)
-- For development: You can use "using (true)" to allow all access

-- SELECT Policies
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

-- INSERT Policies
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

-- UPDATE Policies
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

-- DELETE Policies
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

-- ============================================
-- INSERT SAMPLE DATA
-- ============================================

insert into rooms (name, type, capacity, price_per_night, description) values
('Dorm 1 (Mixed)', 'Dorm', 4, 15.00, '4-bed mixed dormitory with shared bathroom'),
('Dorm 2 (Female)', 'Dorm', 6, 15.00, '6-bed female-only dormitory'),
('Private A', 'Private', 2, 45.00, 'Private room with double bed and ensuite bathroom'),
('Private B', 'Private', 1, 35.00, 'Single private room with shared bathroom');

-- Insert Beds for Dorms
do $$
declare
  dorm1_id uuid;
  dorm2_id uuid;
begin
  select id into dorm1_id from rooms where name = 'Dorm 1 (Mixed)';
  select id into dorm2_id from rooms where name = 'Dorm 2 (Female)';
  
  insert into beds (room_id, bed_number, status) values 
    (dorm1_id, '1', 'Active'),
    (dorm1_id, '2', 'Active'),
    (dorm1_id, '3', 'Active'),
    (dorm1_id, '4', 'Active'),
    (dorm2_id, '1', 'Active'),
    (dorm2_id, '2', 'Active'),
    (dorm2_id, '3', 'Active'),
    (dorm2_id, '4', 'Active'),
    (dorm2_id, '5', 'Active'),
    (dorm2_id, '6', 'Active');
end $$;

-- ============================================
-- SCHEMA COMPLETE
-- ============================================
-- Next steps:
-- 1. Review the RLS policies and adjust if needed
-- 2. Test with your application
-- 3. Add more sample data if needed
-- 4. Monitor query performance and add indexes as needed
-- ============================================
