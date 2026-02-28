-- ============================================================
-- DIGITAL TAMBAYAN - NICKNAME SYSTEM MIGRATION
-- Adds per-room nickname functionality
-- ============================================================

-- ============================================================
-- 1. ROOM_MEMBER_NICKNAMES TABLE
-- ============================================================
-- This table stores nicknames that users set for other members in rooms.
-- Each user can set their own private nicknames for other room members.
-- The nicknames are scoped per-room and only visible to the setter.

CREATE TABLE IF NOT EXISTS public.room_member_nicknames (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
    target_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    setter_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    nickname TEXT NOT NULL CHECK (length(nickname) <= 50),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    UNIQUE(room_id, target_user_id, setter_user_id)
);

-- Enable RLS
ALTER TABLE public.room_member_nicknames ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only view nicknames they set themselves
CREATE POLICY "Users can view their own nicknames" ON public.room_member_nicknames
    FOR SELECT USING (setter_user_id = auth.uid());

-- Users can only insert their own nicknames
CREATE POLICY "Users can insert their own nicknames" ON public.room_member_nicknames
    FOR INSERT WITH CHECK (setter_user_id = auth.uid());

-- Users can only update their own nicknames
CREATE POLICY "Users can update their own nicknames" ON public.room_member_nicknames
    FOR UPDATE USING (setter_user_id = auth.uid());

-- Users can only delete their own nicknames
CREATE POLICY "Users can delete their own nicknames" ON public.room_member_nicknames
    FOR DELETE USING (setter_user_id = auth.uid());

-- ============================================================
-- 2. DATABASE FUNCTIONS
-- ============================================================

-- Function: get_member_nicknames
-- Returns all nicknames set by a specific user in a specific room
CREATE OR REPLACE FUNCTION get_member_nicknames(
    p_room_id UUID,
    p_setter_user_id UUID
) RETURNS TABLE (
    target_user_id UUID,
    nickname TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rmn.target_user_id,
        rmn.nickname
    FROM public.room_member_nicknames rmn
    WHERE rmn.room_id = p_room_id
    AND rmn.setter_user_id = p_setter_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: set_member_nickname
-- Sets or updates a nickname for a room member
-- Returns status: 'success', 'not_a_member', 'target_not_in_room', 'empty_nickname', 'nickname_too_long'
CREATE OR REPLACE FUNCTION set_member_nickname(
    p_room_id UUID,
    p_target_user_id UUID,
    p_nickname TEXT,
    p_setter_user_id UUID
) RETURNS TEXT AS $$
DECLARE
    v_is_member BOOLEAN;
    v_trimmed_nickname TEXT;
BEGIN
    v_trimmed_nickname := trim(p_nickname);
    
    -- Validate nickname is not empty after trimming
    IF length(v_trimmed_nickname) = 0 THEN
        RETURN 'empty_nickname';
    END IF;
    
    IF length(v_trimmed_nickname) > 50 THEN
        RETURN 'nickname_too_long';
    END IF;

    -- Verify setter is a member of the room
    SELECT EXISTS (
        SELECT 1 FROM public.room_members 
        WHERE room_id = p_room_id AND user_id = p_setter_user_id
    ) INTO v_is_member;
    
    IF NOT v_is_member THEN
        RETURN 'not_a_member';
    END IF;
    
    -- Verify target is also a member
    SELECT EXISTS (
        SELECT 1 FROM public.room_members 
        WHERE room_id = p_room_id AND user_id = p_target_user_id
    ) INTO v_is_member;
    
    IF NOT v_is_member THEN
        RETURN 'target_not_in_room';
    END IF;
    
    -- Insert or update (upsert)
    INSERT INTO public.room_member_nicknames (
        room_id, 
        target_user_id, 
        setter_user_id, 
        nickname
    ) VALUES (
        p_room_id, 
        p_target_user_id, 
        p_setter_user_id, 
        v_trimmed_nickname
    )
    ON CONFLICT (room_id, target_user_id, setter_user_id)
    DO UPDATE SET 
        nickname = v_trimmed_nickname, 
        updated_at = TIMEZONE('utc', NOW());
    
    RETURN 'success';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: delete_member_nickname
-- Removes a nickname for a room member
-- Returns status: 'success', 'nickname_not_found'
CREATE OR REPLACE FUNCTION delete_member_nickname(
    p_room_id UUID,
    p_target_user_id UUID,
    p_setter_user_id UUID
) RETURNS TEXT AS $$
BEGIN
    DELETE FROM public.room_member_nicknames
    WHERE room_id = p_room_id
    AND target_user_id = p_target_user_id
    AND setter_user_id = p_setter_user_id;
    
    IF NOT FOUND THEN
        RETURN 'nickname_not_found';
    END IF;
    
    RETURN 'success';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_room_members_with_nicknames
-- Enhanced version of get_room_members that includes nicknames from the perspective of a user
CREATE OR REPLACE FUNCTION get_room_members_with_nicknames(
    p_room_id UUID,
    p_current_user_id UUID
) RETURNS TABLE (
    user_id UUID,
    username TEXT,
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

-- ============================================================
-- 3. TRIGGER FOR UPDATED_AT
-- ============================================================
CREATE OR REPLACE FUNCTION update_room_member_nicknames_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_room_member_nicknames_updated_at 
    ON public.room_member_nicknames;
    
CREATE TRIGGER update_room_member_nicknames_updated_at
    BEFORE UPDATE ON public.room_member_nicknames
    FOR EACH ROW EXECUTE FUNCTION update_room_member_nicknames_updated_at();

-- ============================================================
-- 4. GRANT PERMISSIONS
-- ============================================================
GRANT EXECUTE ON FUNCTION get_member_nicknames(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_member_nickname(UUID, UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_member_nickname(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_room_members_with_nicknames(UUID, UUID) TO authenticated;

-- ============================================================
-- 5. REALTIME ENABLEMENT
-- ============================================================
-- Enable realtime for nickname changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_member_nicknames;
