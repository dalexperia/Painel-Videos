/*
      # Force Admin Profile Creation

      1. Changes
        - Inserts missing profiles for admin emails directly from auth.users
        - Updates existing profiles to 'admin' if they already exist
        - Ensures the user_profiles table is in sync with auth.users for these specific accounts
    */

    INSERT INTO public.user_profiles (id, email, role)
    SELECT id, email, 'admin'
    FROM auth.users
    WHERE email IN ('dalexperia@gmail.com', 'machobigalfa@gmail.com', 'dalex2307@gmail.com')
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin';
