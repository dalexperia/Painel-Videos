/*
  # Alter Function to Set Active Channel for Integer IDs

  This migration redefines the `set_active_channel` PostgreSQL function to accept an `integer` type for `channel_id` instead of `uuid`.

  1. Modified Function
    - `set_active_channel(channel_id integer)`: The function now expects an integer ID for the channel to be activated.
      - It first sets `is_active` to `false` for the currently active channel.
      - Then, it sets `is_active` to `true` for the channel matching the provided `channel_id`.

  2. Rationale
    - This change aligns the function's parameter type with the actual `id` type of the `shorts_settings` table, resolving the "invalid input syntax for type uuid" error.
    - The atomicity and security definer aspects remain the same, ensuring safe and consistent updates.

  3. Permissions
    - Grants `EXECUTE` permission to `anon` and `authenticated` roles for the updated function signature.
*/

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

-- Grant execution rights to the anon and authenticated roles for the new function signature
GRANT EXECUTE ON FUNCTION set_active_channel(integer) TO anon, authenticated;
