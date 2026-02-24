-- ============================================================
-- DIGITAL TAMBAYAN - COMPLETE DATABASE SCHEMA
-- Run this in Supabase SQL Editor to set up everything
-- ============================================================

-- ============================================================
-- 1. PROFILES TABLE (linked to auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Profiles are viewable by everyone." ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile." ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, email, is_admin)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'username', NEW.email, FALSE);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. ROOMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_personal BOOLEAN DEFAULT FALSE NOT NULL,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rooms
CREATE POLICY "Rooms are viewable by everyone." ON public.rooms
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create rooms." ON public.rooms
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- 3. ROOM_MEMBERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.room_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member' NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    added_by UUID REFERENCES public.profiles(id),
    UNIQUE(room_id, user_id)
);

-- Enable RLS
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for room_members
CREATE POLICY "Room members are viewable by everyone." ON public.room_members
    FOR SELECT USING (true);

CREATE POLICY "Owners and admins can add room members." ON public.room_members
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.room_members rm
            WHERE rm.room_id = room_members.room_id
            AND rm.user_id = auth.uid()
            AND rm.role IN ('owner', 'admin')
        )
        OR EXISTS (
            SELECT 1 FROM public.rooms r
            WHERE r.id = room_members.room_id
            AND r.owner_id = auth.uid()
        )
    );

CREATE POLICY "Owners and admins can remove room members." ON public.room_members
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.room_members rm
            WHERE rm.room_id = room_members.room_id
            AND rm.user_id = auth.uid()
            AND rm.role IN ('owner', 'admin')
        )
    );

-- ============================================================
-- 4. MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
    id BIGSERIAL PRIMARY KEY,
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    sender_name TEXT NOT NULL,
    content TEXT NOT NULL,
    is_bot BOOLEAN DEFAULT FALSE NOT NULL,
    is_system BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for messages
CREATE POLICY "Messages are viewable by everyone." ON public.messages
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert messages." ON public.messages
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own messages." ON public.messages
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 5. CHAT_SETTINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enable_message_deletion BOOLEAN DEFAULT TRUE NOT NULL,
    deletion_threshold_minutes INTEGER DEFAULT 10 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.chat_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_settings
CREATE POLICY "Chat settings are viewable by everyone." ON public.chat_settings
    FOR SELECT USING (true);

-- Insert default settings
INSERT INTO public.chat_settings (enable_message_deletion, deletion_threshold_minutes)
VALUES (TRUE, 10)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. DATABASE FUNCTIONS
-- ============================================================

-- Function: get_user_rooms
DROP FUNCTION IF EXISTS get_user_rooms(UUID);
CREATE OR REPLACE FUNCTION get_user_rooms(
    p_user_id UUID
) RETURNS TABLE (
    id UUID,
    slug TEXT,
    name TEXT,
    is_personal BOOLEAN,
    display_name TEXT,
    role TEXT,
    last_message_at TIMESTAMPTZ,
    last_message_content TEXT,
    last_message_sender TEXT,
    unread_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH last_messages AS (
        SELECT 
            m.room_id,
            m.content,
            m.sender_name,
            m.created_at,
            ROW_NUMBER() OVER (PARTITION BY m.room_id ORDER BY m.created_at DESC) as rn
        FROM public.messages m
    )
    SELECT 
        r.id,
        r.slug,
        r.name,
        r.is_personal,
        r.display_name,
        rm.role,
        lm.created_at as last_message_at,
        lm.content as last_message_content,
        lm.sender_name as last_message_sender,
        0::BIGINT as unread_count
    FROM public.rooms r
    INNER JOIN public.room_members rm ON r.id = rm.room_id
    LEFT JOIN last_messages lm ON r.id = lm.room_id AND lm.rn = 1
    WHERE rm.user_id = p_user_id
    ORDER BY 
        CASE WHEN r.is_personal THEN 0 ELSE 1 END,
        COALESCE(lm.created_at, r.created_at) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_or_create_personal_chat
CREATE OR REPLACE FUNCTION get_or_create_personal_chat(
    p_user1_id UUID,
    p_user2_id UUID
) RETURNS UUID AS $$
DECLARE
    v_room_id UUID;
BEGIN
    -- Check if a personal chat already exists between these users
    SELECT rm1.room_id INTO v_room_id
    FROM public.room_members rm1
    INNER JOIN public.room_members rm2 ON rm1.room_id = rm2.room_id
    INNER JOIN public.rooms r ON r.id = rm1.room_id
    WHERE rm1.user_id = p_user1_id
    AND rm2.user_id = p_user2_id
    AND r.is_personal = TRUE;
    
    IF v_room_id IS NOT NULL THEN
        RETURN v_room_id;
    END IF;
    
    -- Create new personal chat room
    INSERT INTO public.rooms (slug, name, is_personal)
    VALUES (
        'personal-' || p_user1_id || '-' || p_user2_id,
        'Personal Chat',
        TRUE
    )
    RETURNING id INTO v_room_id;
    
    -- Add both users as members with equal roles
    INSERT INTO public.room_members (room_id, user_id, role)
    VALUES 
        (v_room_id, p_user1_id, 'member'),
        (v_room_id, p_user2_id, 'member');
    
    RETURN v_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: leave_room
CREATE OR REPLACE FUNCTION leave_room(
    p_room_id UUID,
    p_user_id UUID
) RETURNS TEXT AS $$
DECLARE
    v_user_role TEXT;
    v_admin_count INT;
    v_member_count INT;
    v_oldest_member_id UUID;
    v_is_personal BOOLEAN;
BEGIN
    -- Get user's role and room type
    SELECT rm.role INTO v_user_role
    FROM public.room_members rm
    WHERE rm.room_id = p_room_id AND rm.user_id = p_user_id;
    
    SELECT is_personal INTO v_is_personal
    FROM public.rooms WHERE id = p_room_id;
    
    IF v_user_role IS NULL THEN
        RETURN 'not_a_member';
    END IF;
    
    -- Count remaining admins (excluding current user)
    SELECT COUNT(*) INTO v_admin_count
    FROM public.room_members
    WHERE room_id = p_room_id 
    AND user_id != p_user_id
    AND role IN ('owner', 'admin');
    
    -- Count remaining members
    SELECT COUNT(*) INTO v_member_count
    FROM public.room_members
    WHERE room_id = p_room_id AND user_id != p_user_id;
    
    -- If last member, delete the room
    IF v_member_count = 0 THEN
        DELETE FROM public.rooms WHERE id = p_room_id;
        RETURN 'room_deleted';
    END IF;
    
    -- If last admin in a group chat, promote oldest member
    IF v_admin_count = 0 AND v_is_personal = FALSE THEN
        SELECT user_id INTO v_oldest_member_id
        FROM public.room_members
        WHERE room_id = p_room_id AND user_id != p_user_id
        ORDER BY joined_at ASC
        LIMIT 1;
        
        IF v_oldest_member_id IS NOT NULL THEN
            UPDATE public.room_members
            SET role = 'admin'
            WHERE room_id = p_room_id AND user_id = v_oldest_member_id;
        END IF;
    END IF;
    
    -- Remove the user
    DELETE FROM public.room_members
    WHERE room_id = p_room_id AND user_id = p_user_id;
    
    RETURN 'left_successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_room_display_name
CREATE OR REPLACE FUNCTION get_room_display_name(
    p_room_id UUID,
    p_current_user_id UUID
) RETURNS TEXT AS $$
DECLARE
    v_is_personal BOOLEAN;
    v_room_name TEXT;
    v_other_username TEXT;
    v_member_names TEXT;
BEGIN
    SELECT is_personal, name INTO v_is_personal, v_room_name
    FROM public.rooms WHERE id = p_room_id;
    
    IF v_is_personal THEN
        -- For personal chats, return the other user's username
        SELECT p.username INTO v_other_username
        FROM public.room_members rm
        INNER JOIN public.profiles p ON rm.user_id = p.id
        WHERE rm.room_id = p_room_id
        AND rm.user_id != p_current_user_id
        LIMIT 1;
        
        RETURN COALESCE(v_other_username, 'Unknown User');
    ELSE
        -- For group chats, return room name or member list
        IF v_room_name IS NOT NULL AND v_room_name != '' AND v_room_name != 'Unnamed Group' THEN
            RETURN v_room_name;
        ELSE
            -- Return comma-separated member names (up to 5)
            SELECT string_agg(p.username, ', ' ORDER BY rm.joined_at)
            INTO v_member_names
            FROM public.room_members rm
            INNER JOIN public.profiles p ON rm.user_id = p.id
            WHERE rm.room_id = p_room_id
            LIMIT 5;
            
            RETURN COALESCE(v_member_names, 'Unnamed Group');
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: create_group_chat
CREATE OR REPLACE FUNCTION create_group_chat(
    p_name TEXT,
    p_creator_id UUID,
    p_member_ids UUID[] DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_room_id UUID;
    v_member_id UUID;
    v_slug TEXT;
BEGIN
    -- Generate a unique slug
    v_slug := 'group-' || p_creator_id || '-' || EXTRACT(EPOCH FROM NOW())::TEXT;
    
    -- Create the room
    INSERT INTO public.rooms (slug, name, is_personal, owner_id)
    VALUES (
        v_slug,
        COALESCE(p_name, 'Unnamed Group'),
        FALSE,
        p_creator_id
    )
    RETURNING id INTO v_room_id;
    
    -- Add creator as owner/admin
    INSERT INTO public.room_members (room_id, user_id, role)
    VALUES (v_room_id, p_creator_id, 'owner');
    
    -- Add other members
    FOREACH v_member_id IN ARRAY p_member_ids
    LOOP
        IF v_member_id != p_creator_id THEN
            INSERT INTO public.room_members (room_id, user_id, role)
            VALUES (v_room_id, v_member_id, 'member');
        END IF;
    END LOOP;
    
    RETURN v_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_room_members
CREATE OR REPLACE FUNCTION get_room_members(room_id UUID)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    role TEXT,
    joined_at TIMESTAMPTZ,
    is_admin BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rm.user_id,
        p.username,
        rm.role,
        rm.joined_at,
        COALESCE(p.is_admin, FALSE)
    FROM public.room_members rm
    LEFT JOIN public.profiles p ON rm.user_id = p.id
    WHERE rm.room_id = get_room_members.room_id
    ORDER BY 
        CASE rm.role
            WHEN 'owner' THEN 1
            WHEN 'admin' THEN 2
            ELSE 3
        END,
        rm.joined_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: add_room_admin
CREATE OR REPLACE FUNCTION add_room_admin(
    p_room_id UUID,
    p_user_id UUID,
    p_requester_id UUID
) RETURNS TEXT AS $$
DECLARE
    v_requester_role TEXT;
    v_is_personal BOOLEAN;
BEGIN
    SELECT is_personal INTO v_is_personal FROM public.rooms WHERE id = p_room_id;
    IF v_is_personal THEN RETURN 'personal_chats_no_admins'; END IF;
    
    SELECT role INTO v_requester_role FROM public.room_members WHERE room_id = p_room_id AND user_id = p_requester_id;
    IF v_requester_role NOT IN ('owner', 'admin') THEN RETURN 'not_authorized'; END IF;
    
    UPDATE public.room_members SET role = 'admin' WHERE room_id = p_room_id AND user_id = p_user_id;
    IF NOT FOUND THEN RETURN 'user_not_in_room'; END IF;
    
    RETURN 'success';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: remove_room_admin
CREATE OR REPLACE FUNCTION remove_room_admin(
    p_room_id UUID,
    p_user_id UUID,
    p_requester_id UUID
) RETURNS TEXT AS $$
DECLARE
    v_requester_role TEXT;
    v_admin_count INT;
    v_is_personal BOOLEAN;
BEGIN
    SELECT is_personal INTO v_is_personal FROM public.rooms WHERE id = p_room_id;
    IF v_is_personal THEN RETURN 'personal_chats_no_admins'; END IF;
    
    SELECT role INTO v_requester_role FROM public.room_members WHERE room_id = p_room_id AND user_id = p_requester_id;
    IF v_requester_role NOT IN ('owner', 'admin') THEN RETURN 'not_authorized'; END IF;
    
    SELECT COUNT(*) INTO v_admin_count FROM public.room_members WHERE room_id = p_room_id AND role IN ('owner', 'admin');
    IF v_admin_count <= 1 THEN RETURN 'cannot_remove_last_admin'; END IF;
    
    UPDATE public.room_members SET role = 'member' WHERE room_id = p_room_id AND user_id = p_user_id AND role IN ('owner', 'admin');
    IF NOT FOUND THEN RETURN 'user_not_admin'; END IF;
    
    RETURN 'success';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: update_room_name
CREATE OR REPLACE FUNCTION update_room_name(
    p_room_id UUID,
    p_name TEXT,
    p_requester_id UUID
) RETURNS TEXT AS $$
DECLARE
    v_is_member BOOLEAN;
BEGIN
    SELECT EXISTS (SELECT 1 FROM public.room_members WHERE room_id = p_room_id AND user_id = p_requester_id) INTO v_is_member;
    IF NOT v_is_member THEN RETURN 'not_authorized'; END IF;
    
    UPDATE public.rooms SET name = p_name WHERE id = p_room_id;
    RETURN 'success';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: clear_room_messages
CREATE OR REPLACE FUNCTION clear_room_messages(
    p_room_id UUID
) RETURNS TEXT AS $$
DECLARE
    v_requester_role TEXT;
    v_requester_id UUID;
    v_is_global_admin BOOLEAN;
BEGIN
    v_requester_id := auth.uid();
    
    -- Check global admin status first
    SELECT is_admin INTO v_is_global_admin FROM public.profiles WHERE id = v_requester_id;
    
    -- If not global admin, check room role
    IF NOT COALESCE(v_is_global_admin, FALSE) THEN
        SELECT role INTO v_requester_role 
        FROM public.room_members 
        WHERE room_id = p_room_id AND user_id = v_requester_id;
        
        IF v_requester_role NOT IN ('owner', 'admin') THEN
            RETURN 'not_authorized';
        END IF;
    END IF;
    
    -- Delete all messages in the room
    DELETE FROM public.messages WHERE room_id = p_room_id;
    
    RETURN 'success';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION clear_room_messages(UUID) TO authenticated;

-- Function: add_member_to_room
CREATE OR REPLACE FUNCTION add_member_to_room(
    p_room_id UUID,
    p_user_id UUID,
    p_requester_id UUID
) RETURNS TEXT AS $$
DECLARE
    v_requester_role TEXT;
    v_is_personal BOOLEAN;
    v_already_member BOOLEAN;
BEGIN
    SELECT is_personal INTO v_is_personal FROM public.rooms WHERE id = p_room_id;
    IF v_is_personal THEN RETURN 'cannot_add_to_personal_chat'; END IF;
    
    SELECT EXISTS (SELECT 1 FROM public.room_members WHERE room_id = p_room_id AND user_id = p_user_id) INTO v_already_member;
    IF v_already_member THEN RETURN 'already_a_member'; END IF;
    
    SELECT role INTO v_requester_role FROM public.room_members WHERE room_id = p_room_id AND user_id = p_requester_id;
    IF v_requester_role NOT IN ('owner', 'admin') THEN RETURN 'not_authorized'; END IF;
    
    INSERT INTO public.room_members (room_id, user_id, role, added_by) VALUES (p_room_id, p_user_id, 'member', p_requester_id);
    RETURN 'success';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: remove_member_from_room
CREATE OR REPLACE FUNCTION remove_member_from_room(
    p_room_id UUID,
    p_user_id UUID,
    p_requester_id UUID
) RETURNS TEXT AS $$
DECLARE
    v_requester_role TEXT;
    v_target_role TEXT;
    v_is_personal BOOLEAN;
    v_admin_count INT;
BEGIN
    SELECT is_personal INTO v_is_personal FROM public.rooms WHERE id = p_room_id;
    IF v_is_personal THEN RETURN 'cannot_remove_from_personal_chat'; END IF;
    
    SELECT role INTO v_requester_role FROM public.room_members WHERE room_id = p_room_id AND user_id = p_requester_id;
    IF v_requester_role NOT IN ('owner', 'admin') THEN RETURN 'not_authorized'; END IF;
    
    SELECT role INTO v_target_role FROM public.room_members WHERE room_id = p_room_id AND user_id = p_user_id;
    IF v_target_role IS NULL THEN RETURN 'user_not_in_room'; END IF;
    
    IF v_target_role IN ('owner', 'admin') AND p_user_id != p_requester_id THEN RETURN 'cannot_remove_admin'; END IF;
    
    IF v_target_role IN ('owner', 'admin') THEN
        SELECT COUNT(*) INTO v_admin_count FROM public.room_members WHERE room_id = p_room_id AND role IN ('owner', 'admin');
        IF v_admin_count <= 1 THEN RETURN 'cannot_remove_last_admin'; END IF;
    END IF;
    
    DELETE FROM public.room_members WHERE room_id = p_room_id AND user_id = p_user_id;
    RETURN 'success';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. GRANT PERMISSIONS
-- ============================================================
GRANT EXECUTE ON FUNCTION get_user_rooms(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_personal_chat(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION leave_room(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_room_display_name(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_group_chat(TEXT, UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_room_members(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_room_admin(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_room_admin(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_room_name(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_member_to_room(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_member_from_room(UUID, UUID, UUID) TO authenticated;

-- ============================================================
-- 8. ENABLE REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_settings;

-- ============================================================
-- DONE! Your Digital Tambayan database is ready.
-- ============================================================
