/*
  # Create Function to Set Active Channel

  This migration creates a PostgreSQL function `set_active_channel` to manage the active status of channels in the `shorts_settings` table.

  1. New Function
    - `set_active_channel(channel_id uuid)`: This function ensures that only one channel can be active at a time.
      - It first sets `is_active` to `false` for the currently active channel.
      - Then, it sets `is_active` to `true` for the channel matching the provided `channel_id`.

  2. Rationale
    - Using a database function guarantees atomicity for the operation. This prevents race conditions or inconsistent states where multiple channels could be marked as active simultaneously.
    - It simplifies the client-side code, as the complex logic is encapsulated on the database side.
    - `SECURITY DEFINER` is used to ensure the function has the necessary permissions to update the table, even when called by a user with restricted access (like via the anon key).
  
  3. Permissions
    - Grants `EXECUTE` permission to `anon` and `authenticated` roles, allowing them to call this function from the client-side API.
*/

CREATE OR REPLACE FUNCTION set_active_channel(channel_id uuid)
RETURNS void AS $$
BEGIN
  -- Deactivate the currently active channel. This is more efficient than updating all rows.
  UPDATE shorts_settings
  SET is_active = false
  WHERE is_active = true;

  -- Activate the specified channel.
  UPDATE shorts_settings
  SET is_active = true
  WHERE id = channel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution rights to the anon and authenticated roles
GRANT EXECUTE ON FUNCTION set_active_channel(uuid) TO anon, authenticated;