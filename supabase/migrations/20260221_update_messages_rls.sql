-- Update RLS policy to allow inserting system messages
-- System messages can be inserted without authentication when is_system = true and user_id is null
drop policy if exists "Users can insert their own messages." on public.messages;

create policy "Users can insert their own messages." on public.messages
  for insert with check (
    (
      auth.role() = 'authenticated' AND 
      (auth.uid() = user_id OR is_bot = true)
    ) OR 
    (is_system = true AND user_id is null)
  );
