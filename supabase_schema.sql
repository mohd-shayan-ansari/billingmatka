-- ==========================================================
-- Lucky Desk POS Database Schema for Supabase
-- Paste this script directly into your Supabase SQL Editor
-- ==========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CITIES TABLE
CREATE TABLE IF NOT EXISTS public.cities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. SETTINGS TABLE (Single row configuration)
CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY DEFAULT 'primary',
  start_time TEXT NOT NULL DEFAULT '09:00',
  end_time TEXT NOT NULL DEFAULT '19:00',
  interval_mins INT NOT NULL DEFAULT 40,
  lock_mins INT NOT NULL DEFAULT 1,
  counter_count INT NOT NULL DEFAULT 3,
  manual_lock BOOLEAN NOT NULL DEFAULT false,
  price_two_digit NUMERIC NOT NULL DEFAULT 10,
  price_one_digit NUMERIC NOT NULL DEFAULT 10,
  admin_pin TEXT NOT NULL DEFAULT '2468',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. COUNTERS TABLE
CREATE TABLE IF NOT EXISTS public.counters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. BILLS TABLE
CREATE TABLE IF NOT EXISTS public.bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt TEXT NOT NULL UNIQUE,
  date TEXT NOT NULL, -- YYYY-MM-DD
  slot TEXT NOT NULL,
  time_label TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  counter TEXT NOT NULL,
  customer TEXT,
  city_id TEXT NOT NULL,
  type INT NOT NULL, -- 1 or 2
  number TEXT NOT NULL,
  units INT NOT NULL,
  units_total INT NOT NULL,
  amount NUMERIC NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. RESULTS TABLE
CREATE TABLE IF NOT EXISTS public.results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date TEXT NOT NULL, -- YYYY-MM-DD
  slot TEXT NOT NULL,
  city_id TEXT NOT NULL,
  city_name TEXT,
  type INT NOT NULL, -- 1 or 2
  number TEXT NOT NULL,
  prize_per_unit NUMERIC NOT NULL DEFAULT 0,
  total_prize NUMERIC NOT NULL DEFAULT 0,
  winners JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, slot, city_id, type)
);

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_bills_date ON public.bills(date);
CREATE INDEX IF NOT EXISTS idx_bills_slot ON public.bills(slot);
CREATE INDEX IF NOT EXISTS idx_bills_counter ON public.bills(counter);
CREATE INDEX IF NOT EXISTS idx_results_date ON public.results(date);

-- ROW LEVEL SECURITY (RLS) POLICIES
-- For POS counters and Admin, allow public read/write or authenticated access
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

-- Allow anon public access with project anon key (for rapid POS deployment)
CREATE POLICY "Public read cities" ON public.cities FOR SELECT USING (true);
CREATE POLICY "Public write cities" ON public.cities FOR ALL USING (true);

CREATE POLICY "Public read settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Public write settings" ON public.settings FOR ALL USING (true);

CREATE POLICY "Public read counters" ON public.counters FOR SELECT USING (true);
CREATE POLICY "Public write counters" ON public.counters FOR ALL USING (true);

CREATE POLICY "Public read bills" ON public.bills FOR SELECT USING (true);
CREATE POLICY "Public insert bills" ON public.bills FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read results" ON public.results FOR SELECT USING (true);
CREATE POLICY "Public write results" ON public.results FOR ALL USING (true);

-- ENABLE REALTIME ON KEY TABLES
ALTER PUBLICATION supabase_realtime ADD TABLE public.bills;
ALTER PUBLICATION supabase_realtime ADD TABLE public.results;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cities;

-- INITIAL SEED DATA
INSERT INTO public.cities (id, name, enabled, sort_order)
VALUES
  ('c0', 'Hyderabad', true, 1),
  ('c1', 'Delhi', true, 2),
  ('c2', 'Mumbai', true, 3),
  ('c3', 'Kolkata', true, 4),
  ('c4', 'Chennai', true, 5),
  ('c5', 'Bengaluru', true, 6)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.settings (id, start_time, end_time, interval_mins, lock_mins, counter_count, manual_lock, price_two_digit, price_one_digit, admin_pin)
VALUES ('primary', '09:00', '19:00', 40, 1, 3, false, 10, 10, '2468')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.counters (id, name, email, password, enabled)
VALUES
  ('ctr1', 'Counter 1', 'counter1@luckydesk.com', '123456', true),
  ('ctr2', 'Counter 2', 'counter2@luckydesk.com', '123456', true),
  ('ctr3', 'Counter 3', 'counter3@luckydesk.com', '123456', true)
ON CONFLICT (id) DO NOTHING;
