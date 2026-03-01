-- Final SQL Migration for Photo Syncing
-- This adds the necessary columns to the RPCs and includes mapping for DM avatars.

-- 1. Update get_user_rooms to include photo_url and handle DM avatars
CREATE OR REPLACE FUNCTION get_user_rooms(
    p_user_id UUID
) RETURNS TABLE (
    id UUID,
    slug TEXT,
    name TEXT,
    is_personal BOOLEAN,
    photo_url TEXT,
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
    ),
    dm_avatars AS (
        SELECT 
            rm.room_id,
            p.avatar_url
        FROM public.room_members rm
        JOIN public.profiles p ON rm.user_id = p.id
        WHERE rm.user_id != p_user_id
    )
    SELECT 
        r.id,
        r.slug,
        r.name,
        r.is_personal,
        CASE 
            WHEN r.is_personal THEN (SELECT avatar_url FROM dm_avatars WHERE room_id = r.id LIMIT 1)
            ELSE r.photo_url 
        END as photo_url,
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

-- 2. Update get_room_members_with_nicknames to include avatar_url
CREATE OR REPLACE FUNCTION get_room_members_with_nicknames(
    p_room_id UUID,
    p_current_user_id UUID
) RETURNS TABLE (
    user_id UUID,
    username TEXT,
    avatar_url TEXT,
    role TEXT,
    joined_at TIMESTAMPTZ,
    is_admin BOOLEAN,
    nickname TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rm.user_id,
        p.username,
        p.avatar_url,
        rm.role,
        rm.joined_at,
        COALESCE(p.is_admin, FALSE),
        rmn.nickname
    FROM public.room_members rm
    LEFT JOIN public.profiles p ON rm.user_id = p.id
    LEFT JOIN public.room_member_nicknames rmn 
        ON rmn.room_id = rm.room_id 
        AND rmn.target_user_id = rm.user_id
        AND rmn.setter_user_id = p_current_user_id
    WHERE rm.room_id = p_room_id
    ORDER BY 
        CASE rm.role
            WHEN 'owner' THEN 1
            WHEN 'admin' THEN 2
            ELSE 3
        END,
        rm.joined_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
