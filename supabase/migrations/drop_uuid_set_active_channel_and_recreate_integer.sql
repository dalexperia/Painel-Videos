/*
  # Drop UUID set_active_channel Function and Recreate Integer Version

  This migration addresses the ambiguity issue where two `set_active_channel` functions existed (one for `uuid` and one for `integer`).

  1. Dropped Function
    - `set_active_channel(channel_id uuid)`: This function signature is explicitly dropped to remove the conflict.

  2. Recreated Function
    - `set_active_channel(channel_id integer)`: The function is then recreated to ensure it is the only one available and correctly defined to accept an integer ID.
      - It first sets `is_active` to `false` for the currently active channel.
      - Then, it sets `is_active` to `true` for the channel matching the provided `channel_id`.

  3. Rationale
    - This ensures that only the `set_active_channel` function expecting an `integer` parameter exists, resolving the "could not choose the best candidate function" error.
    - The frontend, which passes integer IDs, will now correctly call this function.

  4. Permissions
    - Grants `EXECUTE` permission to `anon` and `authenticated` roles for the `set_active_channel(integer)` function.
*/

-- Drop the function that accepts a UUID parameter, if it exists, to resolve ambiguity.
DROP FUNCTION IF EXISTS set_active_channel(uuid);

-- Recreate the function to ensure it accepts an integer ID and is the only one available.
CREATE OR REPLACE FUNCTION set_active_channel(channel_id integer)
RETURNS void AS $$
BEGIN
  -- Deactivate the currently active channel.
  UPDATE shorts_settings
  SET is_active = false
  WHERE is_active = true;

  -- Activate the specified channel.
  UPDATE shorts_settings
  SET is_active = true
  WHERE id = channel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution rights to the anon and authenticated roles for the integer function signature
GRANT EXECUTE ON FUNCTION set_active_channel(integer) TO anon, authenticated;
