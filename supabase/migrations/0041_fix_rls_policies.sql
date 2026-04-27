-- Fix RLS policies for development
-- Drop existing policies (both old and new names)
DROP POLICY IF EXISTS "Conversations can be viewed by participants" ON conversations;
DROP POLICY IF EXISTS "Conversations can be viewed by everyone" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Conversations can be updated by participants" ON conversations;
DROP POLICY IF EXISTS "Conversations can be updated by everyone" ON conversations;

-- Create more permissive policies for development
CREATE POLICY "Conversations can be viewed by everyone" 
ON conversations FOR SELECT 
USING (true);

CREATE POLICY "Users can create conversations" 
ON conversations FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Conversations can be updated by everyone" 
ON conversations FOR UPDATE 
USING (true);

-- Drop existing policies on users (both old and new names)
DROP POLICY IF EXISTS "Users can be viewed by everyone" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

-- Create more permissive policies for users
CREATE POLICY "Users can be viewed by everyone" 
ON users FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own profile" 
ON users FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own profile" 
ON users FOR UPDATE 
USING (true);

-- Drop existing policies on messages (both old and new names)
DROP POLICY IF EXISTS "Messages can be viewed by conversation participants" ON messages;
DROP POLICY IF EXISTS "Messages can be viewed by everyone" ON messages;
DROP POLICY IF EXISTS "Users can create messages in conversations they participate in" ON messages;
DROP POLICY IF EXISTS "Users can create messages" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;

-- Create more permissive policies for messages
CREATE POLICY "Messages can be viewed by everyone" 
ON messages FOR SELECT 
USING (true);

CREATE POLICY "Users can create messages" 
ON messages FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own messages" 
ON messages FOR UPDATE 
USING (true);
