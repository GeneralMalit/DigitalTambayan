-- Security hardening for Digital Tambayan
-- 1. Remove public email exposure from profiles
-- 2. Protect is_admin from self-escalation
-- 3. Enforce membership-scoped access for rooms, members, and messages

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;

CREATE TABLE IF NOT EXISTS private.user_login_emails (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

REVOKE ALL ON private.user_login_emails FROM PUBLIC;
REVOKE ALL ON private.user_login_emails FROM anon;
REVOKE ALL ON private.user_login_emails FROM authenticated;

INSERT INTO private.user_login_emails (user_id, username, email)
SELECT id, username, email
FROM public.profiles
WHERE email IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
SET
    username = EXCLUDED.username,
    email = EXCLUDED.email,
    updated_at = TIMEZONE('utc', NOW());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, is_admin)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'username', FALSE);

    INSERT INTO private.user_login_emails (user_id, username, email)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'username', NEW.email)
    ON CONFLICT (user_id) DO UPDATE
    SET
        username = EXCLUDED.username,
        email = EXCLUDED.email,
        updated_at = TIMEZONE('utc', NOW());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION private.sync_login_identity_from_profile()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE private.user_login_emails
    SET
        username = NEW.username,
        updated_at = TIMEZONE('utc', NOW())
    WHERE user_id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS profiles_sync_login_identity ON public.profiles;
CREATE TRIGGER profiles_sync_login_identity
    AFTER UPDATE OF username ON public.profiles
    FOR EACH ROW
    WHEN (OLD.username IS DISTINCT FROM NEW.username)
    EXECUTE FUNCTION private.sync_login_identity_from_profile();

CREATE OR REPLACE FUNCTION public.prevent_profile_admin_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin AND auth.uid() = OLD.id THEN
        RAISE EXCEPTION 'is_admin cannot be changed by the account owner';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_profile_admin_self_escalation ON public.profiles;
CREATE TRIGGER prevent_profile_admin_self_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_profile_admin_self_escalation();

ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

CREATE OR REPLACE FUNCTION public.is_global_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = p_user_id
          AND is_admin = TRUE
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

DROP POLICY IF EXISTS "Profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
CREATE POLICY "Authenticated users can view profiles." ON public.profiles
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update their own profile." ON public.profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Rooms are viewable by everyone." ON public.rooms;
DROP POLICY IF EXISTS "Authenticated users can create rooms." ON public.rooms;
CREATE POLICY "Room members and admins can view rooms." ON public.rooms
    FOR SELECT USING (
        public.is_global_admin(auth.uid())
        OR EXISTS (
            SELECT 1
            FROM public.room_members rm
            WHERE rm.room_id = rooms.id
              AND rm.user_id = auth.uid()
        )
    );
CREATE POLICY "Global admins can create rooms." ON public.rooms
    FOR INSERT WITH CHECK (public.is_global_admin(auth.uid()));
CREATE POLICY "Owners and global admins can delete rooms." ON public.rooms
    FOR DELETE USING (
        public.is_global_admin(auth.uid())
        OR EXISTS (
            SELECT 1
            FROM public.room_members rm
            WHERE rm.room_id = rooms.id
              AND rm.user_id = auth.uid()
              AND rm.role = 'owner'
        )
    );

DROP POLICY IF EXISTS "Room members are viewable by everyone." ON public.room_members;
DROP POLICY IF EXISTS "Owners and admins can add room members." ON public.room_members;
DROP POLICY IF EXISTS "Owners and admins can remove room members." ON public.room_members;
CREATE POLICY "Room members and admins can view memberships." ON public.room_members
    FOR SELECT USING (
        public.is_global_admin(auth.uid())
        OR EXISTS (
            SELECT 1
            FROM public.room_members rm
            WHERE rm.room_id = room_members.room_id
              AND rm.user_id = auth.uid()
        )
    );
CREATE POLICY "Owners admins and global admins can add room members." ON public.room_members
    FOR INSERT WITH CHECK (
        public.is_global_admin(auth.uid())
        OR EXISTS (
            SELECT 1
            FROM public.room_members rm
            WHERE rm.room_id = room_members.room_id
              AND rm.user_id = auth.uid()
              AND rm.role IN ('owner', 'admin')
        )
    );
CREATE POLICY "Owners admins and global admins can remove room members." ON public.room_members
    FOR DELETE USING (
        public.is_global_admin(auth.uid())
        OR EXISTS (
            SELECT 1
            FROM public.room_members rm
            WHERE rm.room_id = room_members.room_id
              AND rm.user_id = auth.uid()
              AND rm.role IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS "Messages are viewable by everyone." ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can insert messages." ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own messages." ON public.messages;
CREATE POLICY "Room members and admins can view messages." ON public.messages
    FOR SELECT USING (
        public.is_global_admin(auth.uid())
        OR EXISTS (
            SELECT 1
            FROM public.room_members rm
            WHERE rm.room_id = messages.room_id
              AND rm.user_id = auth.uid()
        )
    );
CREATE POLICY "Room members and admins can insert messages." ON public.messages
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
        AND (
            public.is_global_admin(auth.uid())
            OR EXISTS (
                SELECT 1
                FROM public.room_members rm
                WHERE rm.room_id = messages.room_id
                  AND rm.user_id = auth.uid()
            )
        )
    );
CREATE POLICY "Users and admins can delete messages." ON public.messages
    FOR DELETE USING (
        public.is_global_admin(auth.uid())
        OR auth.uid() = user_id
    );

DROP POLICY IF EXISTS "Chat settings are viewable by everyone." ON public.chat_settings;
CREATE POLICY "Authenticated users can view chat settings." ON public.chat_settings
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Global admins can insert chat settings." ON public.chat_settings
    FOR INSERT WITH CHECK (public.is_global_admin(auth.uid()));
CREATE POLICY "Global admins can update chat settings." ON public.chat_settings
    FOR UPDATE USING (public.is_global_admin(auth.uid()))
    WITH CHECK (public.is_global_admin(auth.uid()));

CREATE OR REPLACE FUNCTION get_room_members(room_id UUID)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    avatar_url TEXT,
    role TEXT,
    joined_at TIMESTAMPTZ,
    is_admin BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        rm.user_id,
        p.username,
        p.avatar_url,
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

GRANT EXECUTE ON FUNCTION public.is_global_admin(UUID) TO authenticated;
