-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create Rooms Table
create table rooms (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  type text not null, -- 'Dorm' or 'Private'
  capacity int not null,
  price_per_night decimal(10,2) not null
);

-- Create Beds Table (For Dorms)
create table beds (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  room_id uuid references rooms(id) on delete cascade not null,
  bed_number text not null, -- 'A1', '1', 'Top'
  status text default 'Active' -- 'Active', 'Maintenance'
);

-- Create Guests Table
create table guests (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  full_name text not null,
  passport_id text,
  nationality text,
  phone text,
  email text,
  notes text
);

-- Create Bookings Table
create table bookings (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  guest_id uuid references guests(id) not null,
  room_id uuid references rooms(id), -- Nullable if booking a bed
  bed_id uuid references beds(id),   -- Nullable if booking a private room
  check_in_date date not null,
  check_out_date date not null,
  status text not null default 'Confirmed', -- 'Confirmed', 'Checked-in', 'Checked-out', 'Cancelled'
  total_amount decimal(10,2) not null,
  paid_amount decimal(10,2) default 0,
  
  -- Constraint: Must have either room_id OR bed_id, but ideally not both (or logic handled in app)
  constraint check_room_or_bed check (
    (room_id is not null and bed_id is null) or 
    (room_id is null and bed_id is not null) or
    (room_id is not null and bed_id is not null) -- Allow both if we want to link bed to room explicitly in data, but app logic decides
  )
);

-- Create Transactions Table
create table transactions (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  booking_id uuid references bookings(id),
  type text not null, -- 'Income' or 'Expense'
  category text not null,
  amount decimal(10,2) not null,
  payment_method text, -- 'Cash', 'Credit Card', 'Pix'
  date date default CURRENT_DATE
);

-- Enable Row Level Security (RLS)
alter table rooms enable row level security;
alter table beds enable row level security;
alter table guests enable row level security;
alter table bookings enable row level security;
alter table transactions enable row level security;

-- Create Policies (Allow all for now, can be restricted to authenticated users later)
create policy "Enable read access for all users" on rooms for select using (true);
create policy "Enable read access for all users" on beds for select using (true);
create policy "Enable read access for all users" on guests for select using (true);
create policy "Enable read access for all users" on bookings for select using (true);
create policy "Enable read access for all users" on transactions for select using (true);

create policy "Enable insert access for all users" on rooms for insert with check (true);
create policy "Enable insert access for all users" on beds for insert with check (true);
create policy "Enable insert access for all users" on guests for insert with check (true);
create policy "Enable insert access for all users" on bookings for insert with check (true);
create policy "Enable insert access for all users" on transactions for insert with check (true);

create policy "Enable update access for all users" on rooms for update using (true);
create policy "Enable update access for all users" on beds for update using (true);
create policy "Enable update access for all users" on guests for update using (true);
create policy "Enable update access for all users" on bookings for update using (true);
create policy "Enable update access for all users" on transactions for update using (true);

create policy "Enable delete access for all users" on rooms for delete using (true);
create policy "Enable delete access for all users" on beds for delete using (true);
create policy "Enable delete access for all users" on guests for delete using (true);
create policy "Enable delete access for all users" on bookings for delete using (true);
create policy "Enable delete access for all users" on transactions for delete using (true);

-- Insert Dummy Data
insert into rooms (name, type, capacity, price_per_night) values
('Dorm 1 (Mixed)', 'Dorm', 4, 15.00),
('Private A', 'Private', 1, 45.00);

-- Insert Beds for Dorm 1
do $$
declare
  dorm_id uuid;
begin
  select id into dorm_id from rooms where name = 'Dorm 1 (Mixed)';
  insert into beds (room_id, bed_number) values 
  (dorm_id, '1'), (dorm_id, '2'), (dorm_id, '3'), (dorm_id, '4');
end $$;
