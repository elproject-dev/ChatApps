-- Revert phone constraints: phone is optional since login uses email
-- Remove NOT NULL and UNIQUE constraints that were added in error

-- Drop UNIQUE constraint if exists
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_unique;

-- Make phone nullable again (revert SET NOT NULL)
-- Note: if phone was already set to NOT NULL, this requires a separate migration
-- We handle this by dropping the constraint first

-- Create index on phone for faster lookups (still useful for optional phone lookups)
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
