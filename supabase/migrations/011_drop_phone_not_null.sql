-- Drop NOT NULL constraint on phone column (phone is optional with email-based login)
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
