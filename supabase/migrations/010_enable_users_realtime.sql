-- Enable Realtime for users table (for online/offline status updates)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE users;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
