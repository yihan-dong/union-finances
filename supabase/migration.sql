-- Run these in your Supabase SQL editor

-- Add bucket column (from previous migration)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS bucket text DEFAULT 'utility';
UPDATE expenses SET bucket = 'utility' WHERE bucket IS NULL;

-- Add currency column
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';
UPDATE expenses SET currency = 'USD' WHERE currency IS NULL;
