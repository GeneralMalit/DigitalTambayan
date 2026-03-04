-- Follow-up fixes for security hardening
-- 1. Avoid recursive RLS evaluation by using security definer helpers
-- 2. Expose a server-only username lookup RPC for the sign-in route

CREATE OR REPLACE FUNCTION public.user_is_room_member(
    p_room_id UUID,
    p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        p_user_id IS NOT NULL AND EXISTS (
            SELECT 1
            FROM public.room_members
            WHERE room_id = p_room_id
              AND user_id = p_user_id
        ),
        FALSE
    );
$$;

CREATE OR REPLACE FUNCTION public.user_has_room_role(
    p_room_id UUID,
    p_user_id UUID,
    p_roles TEXT[]
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        p_user_id IS NOT NULL AND EXISTS (
            SELECT 1
            FROM public.room_members
            WHERE room_id = p_room_id
              AND user_id = p_user_id
              AND role = ANY (p_roles)
        ),
        FALSE
    );
$$;

CREATE OR REPLACE FUNCTION public.lookup_email_for_username(
    p_username TEXT
) RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT email
    FROM private.user_login_emails
    WHERE username = p_username
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_email_for_username(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lookup_email_for_username(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.lookup_email_for_username(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_email_for_username(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_is_room_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_room_role(UUID, UUID, TEXT[]) TO authenticated;

DROP POLICY IF EXISTS "Room members and admins can view rooms." ON public.rooms;
DROP POLICY IF EXISTS "Owners and global admins can delete rooms." ON public.rooms;
DROP POLICY IF EXISTS "Room members can update room details." ON public.rooms;
CREATE POLICY "Room members and admins can view rooms." ON public.rooms
    FOR SELECT USING (
        public.is_global_admin(auth.uid())
        OR public.user_is_room_member(id, auth.uid())
    );
CREATE POLICY "Owners and global admins can delete rooms." ON public.rooms
    FOR DELETE USING (
        public.is_global_admin(auth.uid())
        OR public.user_has_room_role(id, auth.uid(), ARRAY['owner'])
    );
CREATE POLICY "Room members can update room details." ON public.rooms
    FOR UPDATE USING (
        public.user_is_room_member(id, auth.uid())
    )
    WITH CHECK (
        public.user_is_room_member(id, auth.uid())
    );

DROP POLICY IF EXISTS "Room members and admins can view memberships." ON public.room_members;
DROP POLICY IF EXISTS "Owners admins and global admins can add room members." ON public.room_members;
DROP POLICY IF EXISTS "Owners admins and global admins can remove room members." ON public.room_members;
CREATE POLICY "Room members and admins can view memberships." ON public.room_members
    FOR SELECT USING (
        public.is_global_admin(auth.uid())
        OR public.user_is_room_member(room_id, auth.uid())
    );
CREATE POLICY "Owners admins and global admins can add room members." ON public.room_members
    FOR INSERT WITH CHECK (
        public.is_global_admin(auth.uid())
        OR public.user_has_room_role(room_id, auth.uid(), ARRAY['owner', 'admin'])
    );
CREATE POLICY "Owners admins and global admins can remove room members." ON public.room_members
    FOR DELETE USING (
        public.is_global_admin(auth.uid())
        OR public.user_has_room_role(room_id, auth.uid(), ARRAY['owner', 'admin'])
    );

DROP POLICY IF EXISTS "Room members and admins can view messages." ON public.messages;
DROP POLICY IF EXISTS "Room members and admins can insert messages." ON public.messages;
CREATE POLICY "Room members and admins can view messages." ON public.messages
    FOR SELECT USING (
        public.is_global_admin(auth.uid())
        OR public.user_is_room_member(room_id, auth.uid())
    );
CREATE POLICY "Room members and admins can insert messages." ON public.messages
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
        AND (
            public.is_global_admin(auth.uid())
            OR public.user_is_room_member(room_id, auth.uid())
        )
    );
