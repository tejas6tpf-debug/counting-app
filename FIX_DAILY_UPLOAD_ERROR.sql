-- FIX DAILY UPLOAD ERROR
-- This command removes the restriction that forces Daily parts to exist in Base Master.
ALTER TABLE public.daily_part_master DROP CONSTRAINT IF EXISTS daily_part_master_part_number_fkey;
