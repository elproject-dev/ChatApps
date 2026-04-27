-- Enable pg_net extension for making HTTP requests from Postgres
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Function to call push notification edge function when a new message is inserted
-- Uses pg_net to make async HTTP call to the edge function
-- Errors are caught so message insert is NEVER blocked
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://gpcduahypyynjlcgodnl.supabase.co/functions/v1/push-notification',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := json_build_object('record', NEW)::text
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't block the message insert
    RAISE WARNING 'Push notification failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on messages table
DROP TRIGGER IF EXISTS on_new_message ON messages;
CREATE TRIGGER on_new_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();
