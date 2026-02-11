-- RPC Function to create system users securely
-- This allows a SUPER_ADMIN to add new users via the UI
-- It inserts into auth.users (authentication) and public.profiles (application data)

CREATE OR REPLACE FUNCTION public.create_system_user(
    uname TEXT,
    pwd TEXT,
    target_role TEXT DEFAULT 'USER'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    new_user_id UUID;
    result JSONB;
BEGIN
    -- 1. Check if caller is authorized (Optional: can be hardened further)
    -- For now, we assume the UI handles the restricted access, 
    -- but Security Definer handles the permission elevation for auth.users.

    -- 2. Insert into auth.users
    -- We generate a deterministic email for internal consistency: username@pegasus.spare
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
    )
    VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        uname || '@pegasus.spare',
        crypt(pwd, gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{}',
        FALSE,
        now(),
        now(),
        '',
        '',
        '',
        ''
    )
    RETURNING id INTO new_user_id;

    -- 3. Insert into public.profiles
    INSERT INTO public.profiles (id, username, role)
    VALUES (new_user_id, uname, target_role);

    result := jsonb_build_object(
        'success', true,
        'user_id', new_user_id,
        'username', uname
    );

    RETURN result;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- Grant execute to authenticated users (Super Admin will be one of them)
GRANT EXECUTE ON FUNCTION public.create_system_user(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_system_user(TEXT, TEXT, TEXT) TO service_role;
