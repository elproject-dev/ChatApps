-- Calls table for WebRTC signaling
CREATE TABLE IF NOT EXISTS calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  caller_email TEXT NOT NULL,
  callee_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ringing', -- ringing, answered, ended, missed, rejected
  offer_sdp TEXT,  -- WebRTC offer SDP
  answer_sdp TEXT, -- WebRTC answer SDP
  ice_candidates_caller JSONB DEFAULT '[]'::jsonb, -- ICE candidates from caller
  ice_candidates_callee JSONB DEFAULT '[]'::jsonb, -- ICE candidates from callee
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- RLS policies
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- Users can see calls where they are caller or callee
DROP POLICY IF EXISTS "Users can view their own calls" ON calls;
CREATE POLICY "Users can view their own calls"
  ON calls FOR SELECT
  USING (caller_email = auth.jwt() ->> 'email' OR callee_email = auth.jwt() ->> 'email');

-- Users can insert calls as caller
DROP POLICY IF EXISTS "Users can create calls" ON calls;
CREATE POLICY "Users can create calls"
  ON calls FOR INSERT
  WITH CHECK (caller_email = auth.jwt() ->> 'email');

-- Users can update calls where they are caller or callee
DROP POLICY IF EXISTS "Users can update their own calls" ON calls;
CREATE POLICY "Users can update their own calls"
  ON calls FOR UPDATE
  USING (caller_email = auth.jwt() ->> 'email' OR callee_email = auth.jwt() ->> 'email');

-- Enable Realtime for calls table (for signaling)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE calls;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
