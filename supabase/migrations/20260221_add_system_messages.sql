-- Add is_system column to messages table
alter table public.messages 
add column if not exists is_system boolean default false not null;
