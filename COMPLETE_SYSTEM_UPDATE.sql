-- ========================================================
-- PEGASUS SPARE - SYSTEM RECOVERY (v24) - FORCE FIX
-- Resolves: "duplicate key value violates unique constraint"
-- Resolves: 500 "Database error querying schema"
-- ========================================================

-- 1. EXTENSIONS & PERMISSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA extensions;

GRANT USAGE ON SCHEMA public, auth, extensions TO anon, authenticated, authenticator, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public, auth, information_schema, pg_catalog TO anon, authenticated, authenticator, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- 2. SEARCH PATH HARD-RESET
ALTER ROLE authenticator SET search_path TO public, auth, extensions;
ALTER ROLE authenticated SET search_path TO public, auth, extensions;
ALTER DATABASE postgres SET search_path TO public, auth, extensions;

-- 3. THE "ROCK-SOLID" USER RPC (v24)
-- This function uses UPSERT logic to repair users if they already exist
DROP FUNCTION IF EXISTS public.create_system_user(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_system_user(
    uname TEXT,
    pwd TEXT,
    target_role TEXT DEFAULT 'USER'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    target_email TEXT := uname || '@pegasus.spare';
    existing_user_id UUID;
    new_identity_id UUID := gen_random_uuid();
BEGIN
    -- 1. Check if user already exists in auth.users
    SELECT id INTO existing_user_id FROM auth.users WHERE email = target_email;

    IF existing_user_id IS NOT NULL THEN
        -- REPAIR PATH: User exists, so we update password and ensure links
        UPDATE auth.users 
        SET encrypted_password = crypt(pwd, gen_salt('bf')),
            updated_at = now(),
            email_confirmed_at = COALESCE(email_confirmed_at, now())
        WHERE id = existing_user_id;
    ELSE
        -- CREATE PATH: New user
        existing_user_id := gen_random_uuid();
        INSERT INTO auth.users (
            id, instance_id, email, encrypted_password, email_confirmed_at, 
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
            role, aud, confirmation_token, recovery_token, 
            email_change_token_new, email_change
        )
        VALUES (
            existing_user_id,
            '00000000-0000-0000-0000-000000000000',
            target_email,
            crypt(pwd, gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}',
            '{}',
            now(),
            now(),
            'authenticated',
            'authenticated',
            '', '', '', ''
        );
    END IF;

    -- 2. Link/Repair Identity (MANDATORY for login)
    -- We delete and re-insert to ensure the link is 100% fresh and correct
    DELETE FROM auth.identities WHERE user_id = existing_user_id;
    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    )
    VALUES (
        new_identity_id,
        existing_user_id,
        jsonb_build_object('sub', existing_user_id, 'email', target_email),
        'email',
        target_email,
        now(),
        now(),
        now()
    );

    -- 3. Link/Repair Profile
    INSERT INTO public.profiles (id, username, role)
    VALUES (existing_user_id, uname, target_role)
    ON CONFLICT (id) DO UPDATE SET 
        role = EXCLUDED.role,
        username = EXCLUDED.username;

    RETURN jsonb_build_object('success', true, 'user_id', existing_user_id);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 4. GRANT EXECUTION
GRANT EXECUTE ON FUNCTION public.create_system_user(TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 5. DEEP CLEANUP (Optional but recommended for "Fresh Start")
-- Deletes old damaged data but KEPS your working pegasus.spare admin
DO $$ 
BEGIN
    -- Delete profiles that are NOT pegasus.spare
    DELETE FROM public.profiles WHERE username != 'pegasus.spare' AND username NOT IN (SELECT split_part(email, '@', 1) FROM auth.users);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Cleanup skipped';
END $$;

-- 6. CACHE RELOAD
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
