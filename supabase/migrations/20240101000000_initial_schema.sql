-- ==========================================
-- PEGASUS SPARE - ABSOLUTE FINAL "NO-FAIL" SQL
-- ==========================================

-- 1. SETUP EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. FULL SCRUB (Clean everything)
DROP TABLE IF EXISTS public.scans CASCADE;
DROP TABLE IF EXISTS public.daily_part_master CASCADE;
DROP TABLE IF EXISTS public.base_part_master CASCADE;
DROP TABLE IF EXISTS public.location_history CASCADE;
DROP TABLE IF EXISTS public.locations CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- !!! CRITICAL: REMOVE ALL TRIGGERS !!!
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 3. CREATE TABLES
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'USER',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.base_part_master (
    part_number TEXT PRIMARY KEY,
    description TEXT,
    category TEXT,
    default_bin TEXT,
    purchase_price NUMERIC DEFAULT 0,
    base_stock NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.daily_part_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_date DATE NOT NULL DEFAULT CURRENT_DATE,
    part_number TEXT REFERENCES public.base_part_master(part_number) ON DELETE CASCADE,
    latest_bin TEXT,
    latest_stock NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_number TEXT NOT NULL,
    scan_code TEXT,
    description TEXT,
    category TEXT,
    system_stock NUMERIC DEFAULT 0,
    physical_qty NUMERIC DEFAULT 0,
    difference NUMERIC DEFAULT 0,
    actual_bin TEXT,
    new_bin_location TEXT,
    remark_type TEXT, -- Damage, Interchange, Manual
    remark_detail TEXT, -- Remark 2
    damage_qty NUMERIC DEFAULT 0,
    scanned_by TEXT NOT NULL, 
    scan_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    pc_name TEXT,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. AUTOMATED USER SEEDING (Bypasses Dashboard entirely)
DO $$
DECLARE
    u_id UUID := 'd996e38b-d731-409b-a918-6c84b9676646'; -- Constant ID
BEGIN
    -- Delete everything related to this user to avoid "Duplicate Key" errors
    DELETE FROM public.profiles WHERE id = u_id;
    DELETE FROM auth.users WHERE id = u_id OR email = 'pegasus.spare@pegasus.spare';
    
    -- Insert into auth.users (Standard Columns Only)
    INSERT INTO auth.users (
        id, 
        instance_id, 
        email, 
        encrypted_password, 
        email_confirmed_at, 
        raw_app_meta_data, 
        raw_user_meta_data, 
        created_at, 
        updated_at, 
        role, 
        aud,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
    )
    VALUES (
        u_id,
        '00000000-0000-0000-0000-000000000000',
        'pegasus.spare@pegasus.spare',
        crypt('spare321', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{}',
        now(),
        now(),
        'authenticated',
        'authenticated',
        '',
        '',
        '',
        ''
    );

    -- Create Profile linked to the User
    INSERT INTO public.profiles (id, username, role)
    VALUES (u_id, 'pegasus.spare', 'SUPER_ADMIN');

END $$;

-- 5. PERMISSIONS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_part_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_part_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable access for all" ON public.profiles FOR ALL USING (true);
CREATE POLICY "Enable access for all" ON public.locations FOR ALL USING (true);
CREATE POLICY "Enable access for all" ON public.base_part_master FOR ALL USING (true);
CREATE POLICY "Enable access for all" ON public.daily_part_master FOR ALL USING (true);
CREATE POLICY "Enable access for all" ON public.scans FOR ALL USING (true);

-- Explicitly allow the API to use these tables
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
