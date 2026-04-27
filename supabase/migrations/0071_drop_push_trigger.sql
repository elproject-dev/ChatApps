-- Drop the pg_net trigger since push notifications are now sent directly from the client
-- This prevents duplicate notifications

DROP TRIGGER IF EXISTS on_new_message ON messages;
DROP FUNCTION IF EXISTS notify_new_message();
