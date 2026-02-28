-- Chat Room Improvements Migration
-- Restored from plans/chat-room-improvements.md

-- 1. Schema Changes
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS is_personal BOOLEAN DEFAULT FALSE;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 2. Database Functions

-- Get or Create Personal Chat
CREATE OR REPLACE FUNCTION get_or_create_personal_chat(
    p_user1_id UUID,
    p_user2_id UUID
) RETURNS UUID AS $
DECLARE
    v_room_id UUID;
    v_slug TEXT;
BEGIN
    -- Generate the slug (use consistent ordering of user IDs)
    v_slug := 'personal-' || LEAST(p_user1_id, p_user2_id) || '-' || GREATEST(p_user1_id, p_user2_id);
    
    -- First check if a room with this slug already exists
    SELECT r.id INTO v_room_id
    FROM public.rooms r
    WHERE r.slug = v_slug;
    
    IF v_room_id IS NOT NULL THEN
        -- Room exists, check if both users are members
        IF EXISTS (
            SELECT 1 FROM public.room_members rm
            WHERE rm.room_id = v_room_id AND rm.user_id = p_user1_id
        ) AND EXISTS (
            SELECT 1 FROM public.room_members rm
            WHERE rm.room_id = v_room_id AND rm.user_id = p_user2_id
        ) THEN
            -- Both users are members, return the room
            RETURN v_room_id;
        ELSE
            -- Room exists but one or both users are not members
            -- Add missing members
            IF NOT EXISTS (
                SELECT 1 FROM public.room_members rm
                WHERE rm.room_id = v_room_id AND rm.user_id = p_user1_id
            ) THEN
                INSERT INTO public.room_members (room_id, user_id, role)
                VALUES (v_room_id, p_user1_id, 'member');
            END IF;
            
            IF NOT EXISTS (
                SELECT 1 FROM public.room_members rm
                WHERE rm.room_id = v_room_id AND rm.user_id = p_user2_id
            ) THEN
                INSERT INTO public.room_members (room_id, user_id, role)
                VALUES (v_room_id, p_user2_id, 'member');
            END IF;
            
            RETURN v_room_id;
        END IF;
    END IF;
    
    -- Create new personal chat room
    INSERT INTO public.rooms (slug, name, is_personal)
    VALUES (
        v_slug,
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
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Leave Room with Auto-Promotion and Cleanup
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
    
    -- If last admin, promote oldest member
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

-- Get User's Rooms
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
        get_room_display_name(r.id, p_user_id) as display_name,
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

-- Get Room Display Name
CREATE OR REPLACE FUNCTION get_room_display_name(
    p_room_id UUID,
    p_current_user_id UUID
) RETURNS TEXT AS $
DECLARE
    v_is_personal BOOLEAN;
    v_room_name TEXT;
    v_other_username TEXT;
    v_nickname TEXT;
    v_other_user_id UUID;
BEGIN
    SELECT is_personal, name INTO v_is_personal, v_room_name
    FROM public.rooms WHERE id = p_room_id;
    
    IF v_is_personal THEN
        -- First, find the other user's ID in this personal chat
        SELECT rm.user_id INTO v_other_user_id
        FROM public.room_members rm
        WHERE rm.room_id = p_room_id
        AND rm.user_id != p_current_user_id
        LIMIT 1;
        
        -- If we found another user, check if current user has set a nickname for them
        IF v_other_user_id IS NOT NULL THEN
            SELECT rmn.nickname INTO v_nickname
            FROM public.room_member_nicknames rmn
            WHERE rmn.room_id = p_room_id
            AND rmn.setter_user_id = p_current_user_id
            AND rmn.target_user_id = v_other_user_id;
            
            -- If nickname exists and is not empty, use it
            IF v_nickname IS NOT NULL AND v_nickname != '' THEN
                RETURN v_nickname;
            END IF;
        END IF;
        
        -- No nickname set, fall back to the other user's username
        SELECT p.username INTO v_other_username
        FROM public.room_members rm
        INNER JOIN public.profiles p ON rm.user_id = p.id
        WHERE rm.room_id = p_room_id
        AND rm.user_id != p_current_user_id
        LIMIT 1;
        
        RETURN COALESCE(v_other_username, 'Unknown User');
    ELSE
        -- For group chats, return room name or member list
        IF v_room_name IS NOT NULL AND v_room_name != '' THEN
            RETURN v_room_name;
        ELSE
            -- Return comma-separated member names
            SELECT string_agg(p.username, ', ')
            INTO v_other_username
            FROM public.room_members rm
            INNER JOIN public.profiles p ON rm.user_id = p.id
            WHERE rm.room_id = p_room_id
            LIMIT 5;
            
            RETURN COALESCE(v_other_username, 'Unnamed Group');
        END IF;
    END IF;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get User Room Role
CREATE OR REPLACE FUNCTION get_user_room_role(
    p_room_id UUID,
    p_user_id UUID
) RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role
    FROM public.room_members
    WHERE room_id = p_room_id AND user_id = p_user_id;
    
    RETURN v_role;
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

-- Check if User is Room Member
CREATE OR REPLACE FUNCTION is_room_member(
    p_room_id UUID,
    p_user_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.room_members
        WHERE room_id = p_room_id AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grants
GRANT EXECUTE ON FUNCTION get_user_room_role(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_room_member(UUID, UUID) TO authenticated;
