-- Create contacts table for managing contact relationships
CREATE TABLE IF NOT EXISTS contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_email, contact_email)
);

-- Enable RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Users can read their own contacts
DO $$ BEGIN
  CREATE POLICY "Users can read own contacts" ON contacts
    FOR SELECT USING (user_email = auth.jwt()->>'email');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Users can insert contacts for themselves or as someone's contact (for bidirectional add)
DO $$ BEGIN
  CREATE POLICY "Users can add own contacts" ON contacts
    FOR INSERT WITH CHECK (user_email = auth.jwt()->>'email' OR contact_email = auth.jwt()->>'email');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Users can delete their own contacts or remove themselves from someone's contacts
DO $$ BEGIN
  CREATE POLICY "Users can delete own contacts" ON contacts
    FOR DELETE USING (user_email = auth.jwt()->>'email' OR contact_email = auth.jwt()->>'email');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contacts_user_email ON contacts(user_email);
CREATE INDEX IF NOT EXISTS idx_contacts_contact_email ON contacts(contact_email);

-- Enable Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE contacts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
