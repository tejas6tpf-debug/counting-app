-- Create a dedicated table for Average Counts
CREATE TABLE IF NOT EXISTS public.average_counts (
    part_number TEXT PRIMARY KEY,
    average_count NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and add policy
ALTER TABLE public.average_counts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable access for all" ON public.average_counts;
CREATE POLICY "Enable access for all" ON public.average_counts FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON public.average_counts TO anon, authenticated;

-- Optional: Cleanup base_part_master (uncomment if you want to remove the redundant column)
-- ALTER TABLE public.base_part_master DROP COLUMN IF EXISTS average_count;
