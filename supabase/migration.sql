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
