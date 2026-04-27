-- Add connected_at timestamp to calls table for synchronized call duration
ALTER TABLE calls ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ;
