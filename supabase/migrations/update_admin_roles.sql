/*
      # Update Admin Roles

      1. Changes
        - Updates the role to 'admin' for specific email addresses in the `user_profiles` table.
        - Ensures the main administrative accounts have full access.
    */

    UPDATE user_profiles
    SET role = 'admin'
    WHERE email IN ('dalexperia@gmail.com', 'machobigalfa@gmail.com', 'dalex2307@gmail.com');
