-- SAFE DATABASE UPDATE (Idempotent)
-- This script adds the damage_qty column only if it doesn't exist
-- It does NOT touch your existing data

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='scans' AND column_name='damage_qty'
    ) THEN
        ALTER TABLE public.scans ADD COLUMN damage_qty NUMERIC DEFAULT 0;
    END IF;
END $$;

-- Optional: Ensure scanned_by is correctly indexed for fast duplicate checking
CREATE INDEX IF NOT EXISTS idx_scans_part_number ON public.scans(part_number);
CREATE INDEX IF NOT EXISTS idx_scans_scanned_by ON public.scans(scanned_by);

-- Success message
COMMENT ON COLUMN public.scans.damage_qty IS 'Dedicated column for tracking quantity of damaged parts';
