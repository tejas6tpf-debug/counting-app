-- Add metadata columns to daily_part_master
-- This allows parts missing from Base Master to still have their details visible.
ALTER TABLE public.daily_part_master ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.daily_part_master ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.daily_part_master ADD COLUMN IF NOT EXISTS purchase_price NUMERIC DEFAULT 0;

-- Optional: If you want to move existing scanned metadata to daily master (for consistency)
-- This is just a safety measure.
