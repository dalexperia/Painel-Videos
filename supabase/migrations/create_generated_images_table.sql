/*
  # Create generated_images table
  1. New Tables: generated_images
     - id (uuid, primary key)
     - created_at (timestamp)
     - prompt (text)
     - image_url (text)
     - status (text): pending, processing, completed, failed
     - channel (text)
     - format (text): SQUARE, PORTRAIT, STORY
     - description (text)
     - title (text)
  2. Security: Enable RLS and add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS generated_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  prompt text NOT NULL,
  image_url text,
  status text DEFAULT 'pending',
  channel text,
  format text DEFAULT 'SQUARE',
  description text,
  title text
);

ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all images (dashboard access)
CREATE POLICY "Enable read access for authenticated users"
  ON generated_images FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert new generation requests
CREATE POLICY "Enable insert access for authenticated users"
  ON generated_images FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users (and service role via API) to update
CREATE POLICY "Enable update access for authenticated users"
  ON generated_images FOR UPDATE
  TO authenticated
  USING (true);