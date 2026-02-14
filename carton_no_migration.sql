-- Add nn_carton_no column to scans table
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS nn_carton_no TEXT;

-- Remove Foreign Key Constraint from Daily Part Master
-- This allows uploading 'Daily' parts that might not yet exist in 'Base' master
ALTER TABLE public.daily_part_master DROP CONSTRAINT IF EXISTS daily_part_master_part_number_fkey;
