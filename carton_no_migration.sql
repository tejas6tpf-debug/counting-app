-- Add nn_carton_no column to scans table
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS nn_carton_no TEXT;
