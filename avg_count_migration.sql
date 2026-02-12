-- Add average_count column to base_part_master if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'base_part_master'
        AND column_name = 'average_count'
    ) THEN
        ALTER TABLE public.base_part_master ADD COLUMN average_count NUMERIC DEFAULT 0;
    END IF;
END $$;
