-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participants TEXT[] NOT NULL,
  participant_names JSONB,
  last_message TEXT,
  last_message_time TIMESTAMP WITH TIME ZONE,
  last_message_sender TEXT,
  is_group BOOLEAN DEFAULT false,
  group_name TEXT,
  group_avatar TEXT,
  unread_count JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on participants for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations USING GIN(participants);

-- Create index on last_message_time for sorting
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_time ON conversations(last_message_time DESC);

-- Enable Row Level Security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Create policy for reading conversations
CREATE POLICY "Conversations can be viewed by participants" 
ON conversations FOR SELECT 
USING (participants && ARRAY[auth.jwt() ->> 'email']);

-- Create policy for inserting conversations
CREATE POLICY "Users can create conversations" 
ON conversations FOR INSERT 
WITH CHECK (true);

-- Create policy for updating conversations
CREATE POLICY "Conversations can be updated by participants" 
ON conversations FOR UPDATE 
USING (participants && ARRAY[auth.jwt() ->> 'email']);

-- Create trigger for updated_at
CREATE TRIGGER update_conversations_updated_at 
BEFORE UPDATE ON conversations 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();
