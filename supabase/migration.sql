-- Run this in your Supabase SQL editor to add the bucket column
-- This adds utility/status tagging to expenses

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS bucket text DEFAULT 'utility';

-- Backfill existing rows to 'utility'
UPDATE expenses SET bucket = 'utility' WHERE bucket IS NULL;
