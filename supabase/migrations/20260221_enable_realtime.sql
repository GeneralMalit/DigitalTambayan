-- Enable Realtime for messages table
-- This allows the chat to receive real-time updates when new messages are inserted
alter publication supabase_realtime add table public.messages;
