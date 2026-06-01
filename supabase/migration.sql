-- Run these in your Supabase SQL editor

-- Add bucket column (from previous migration)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS bucket text DEFAULT 'utility';
UPDATE expenses SET bucket = 'utility' WHERE bucket IS NULL;

-- Add currency column
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';
UPDATE expenses SET currency = 'USD' WHERE currency IS NULL;

-- Add couple column to isolate data between couples
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS couple text DEFAULT 'union';
UPDATE expenses SET couple = 'union' WHERE couple IS NULL;

ALTER TABLE income ADD COLUMN IF NOT EXISTS couple text DEFAULT 'union';
UPDATE income SET couple = 'union' WHERE couple IS NULL;

ALTER TABLE budgets ADD COLUMN IF NOT EXISTS couple text DEFAULT 'union';
UPDATE budgets SET couple = 'union' WHERE couple IS NULL;

-- Add events table for calendar/anniversary tracking
CREATE TABLE IF NOT EXISTS events (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  date       date not null,
  start_time text default '',
  end_time   text default '',
  owner      text not null default 'both',
  couple     text not null default 'union',
  created_at timestamptz default now()
);
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated full access" ON events;
CREATE POLICY "authenticated full access" ON events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix budgets unique constraint to be per-couple, not global
-- Old constraint: unique(category, owner, month, year) caused conflicts between couples
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_category_owner_month_year_key;
ALTER TABLE budgets ADD CONSTRAINT budgets_category_couple_month_year_key
  UNIQUE (category, couple, month, year);
