-- Add DELETE policies for conversations and messages

-- Delete policy for conversations: users can delete conversations they participate in
DROP POLICY IF EXISTS "Users can delete conversations" ON conversations;
CREATE POLICY "Users can delete conversations" 
ON conversations FOR DELETE 
USING (
  auth.uid() IN (
    SELECT id FROM users WHERE email = ANY(participants)
  )
);

-- Delete policy for messages: users can delete their own messages or messages in conversations they participate in
DROP POLICY IF EXISTS "Users can delete messages" ON messages;
CREATE POLICY "Users can delete messages" 
ON messages FOR DELETE 
USING (
  sender_email = auth.jwt()->>'email' OR
  conversation_id IN (
    SELECT id FROM conversations WHERE auth.jwt()->>'email' = ANY(participants)
  )
);
