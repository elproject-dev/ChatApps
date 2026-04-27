-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_email TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file')),
  file_url TEXT,
  is_read BOOLEAN DEFAULT false,
  read_by TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on conversation_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

-- Create index on sender_email for filtering
CREATE INDEX IF NOT EXISTS idx_messages_sender_email ON messages(sender_email);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policy for reading messages
CREATE POLICY "Messages can be viewed by conversation participants" 
ON messages FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = messages.conversation_id 
    AND conversations.participants && ARRAY[auth.jwt() ->> 'email']
  )
);

-- Create policy for inserting messages
CREATE POLICY "Users can create messages in conversations they participate in" 
ON messages FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = messages.conversation_id 
    AND conversations.participants && ARRAY[auth.jwt() ->> 'email']
  )
);

-- Create policy for updating messages
CREATE POLICY "Users can update their own messages" 
ON messages FOR UPDATE 
USING (sender_email = auth.jwt() ->> 'email');

-- Create trigger for updated_at
CREATE TRIGGER update_messages_updated_at 
BEFORE UPDATE ON messages 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();
