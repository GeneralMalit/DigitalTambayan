import { supabase } from '@/utils/supabase/client'
import { Profile, Room, ChatSettings, RoomMember, RoomMemberWithUsername, RoomWithMeta, RoomMemberNickname } from '@/types/database'

export const adminService = {
    /**
     * Fetches all chat rooms from the database.
     */
    async getAllRooms(): Promise<Room[]> {
        const { data, error } = await supabase
            .from('rooms')
            .select('*')
            .order('created_at', { ascending: true })

        if (error) throw error
        return data
    },

    /**
     * Creates a new chat room.
     * @param slug - The URL-friendly slug for the room
     * @param name - The display name for the room
     * @param ownerId - The ID of the user creating the room (will be set as owner)
     */
    async createRoom(slug: string, name: string, ownerId: string): Promise<Room> {
        const { data, error } = await supabase
            .from('rooms')
            .insert({
                slug: slug.toLowerCase().replace(/\s+/g, '-'),
                name: name.trim(),
                owner_id: ownerId
            })
            .select()
            .single()

        if (error) throw error
        return data
    },

    /**
     * Deletes all messages in a specific room.
     * @param roomId - The ID of the room to clear messages from
     */
    async deleteAllMessages(roomId: string): Promise<void> {
        const { data, error } = await supabase.rpc('clear_room_messages', {
            p_room_id: roomId
        })

        if (error) throw error
        if (data !== 'success') throw new Error(data)
    },

    /**
     * Deletes a room and all its messages and members.
     * @param roomId - The ID of the room to delete
     * @param userId - The ID of the user attempting to delete (for authorization)
     */
    async deleteRoom(roomId: string, userId: string): Promise<void> {
        if (!userId) {
            throw new Error('User ID is required')
        }

        // Verify user is the room owner
        const { data: membership, error: membershipError } = await supabase
            .from('room_members')
            .select('role')
            .eq('room_id', roomId)
            .eq('user_id', userId)
            .single()

        if (membershipError || !membership || membership.role !== 'owner') {
            throw new Error('Unauthorized: Only room owners can delete rooms')
        }

        // Delete all messages in the room first
        await this.deleteAllMessages(roomId)

        // Delete all room members (this will cascade due to foreign key constraints)
        const { error: memberError } = await supabase
            .from('room_members')
            .delete()
            .eq('room_id', roomId)

        if (memberError) {
            console.error('Failed to delete room members:', memberError)
            throw new Error('Failed to delete room members')
        }

        // Delete the room
        const { error: roomError } = await supabase
            .from('rooms')
            .delete()
            .eq('id', roomId)

        if (roomError) {
            console.error('Failed to delete room:', roomError)
            throw new Error('Failed to delete room')
        }
    },

    /**
     * Deletes a group chat as an admin (no owner check, clears messages first).
     */
    async deleteGroupChatAsAdmin(roomId: string): Promise<void> {
        // Clear all messages first
        await this.deleteAllMessages(roomId)

        // Delete members
        await supabase.from('room_members').delete().eq('room_id', roomId)

        // Delete the room
        const { error } = await supabase.from('rooms').delete().eq('id', roomId)
        if (error) throw error
    },


    /**
     * Fetches all user profiles from the database.
     */
    async getAllUsers(): Promise<Profile[]> {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('updated_at', { ascending: true })

        if (error) throw error
        return data
    },

    /**
     * Deletes a user profile and their auth account.
     * Note: This requires the service role key or admin privileges.
     * Order: Delete profile first, then auth account (to avoid orphaned profiles if auth fails)
     * @param userId - The ID of the user to delete
     */
    async deleteUser(userId: string): Promise<void> {
        // First, delete the profile from the profiles table
        // We do this first because if auth deletion fails, we can retry
        // If we delete auth first and profile fails, we'd have orphaned profile data
        const { error: profileError } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId)

        if (profileError) {
            console.error('Failed to delete profile:', profileError)
            throw new Error('Failed to delete profile: ' + profileError.message)
        }

        // Then, delete the auth user using admin API
        // Note: This requires RLS to be bypassed or service role key
        const { error: authError } = await supabase.auth.admin.deleteUser(userId)

        if (authError) {
            console.error('Failed to delete auth user:', authError)
            // Profile is already deleted, log warning but don't throw
            // The profile is gone which is the main goal; auth cleanup can be done manually if needed
            console.warn('Profile deleted but auth cleanup failed. User may need manual cleanup.')
            throw new Error('Profile deleted but auth cleanup failed: ' + authError.message)
        }
    },

    /**
     * Gets room by ID.
     * @param roomId - The ID of the room
     */
    async getRoomById(roomId: string): Promise<Room | null> {
        const { data, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', roomId)
            .single()

        if (error) return null
        return data
    },

    /**
     * Gets chat settings.
     */
    async getChatSettings(): Promise<ChatSettings | null> {
        const { data, error } = await supabase
            .from('chat_settings')
            .select('*')
            .limit(1)
            .single()

        if (error || !data) {
            // Create default settings if none exist
            return this.createDefaultSettings()
        }

        return data
    },

    /**
     * Subscribes to real-time changes in chat settings.
     * @param callback - Function to call when settings change
     * @returns unsubscribe function
     */
    subscribeToChatSettings(callback: (settings: ChatSettings) => void) {
        const channel = supabase
            .channel('chat_settings_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chat_settings'
                },
                (payload: any) => {
                    if (payload.new) {
                        callback(payload.new as ChatSettings)
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    },

    /**
     * Creates default chat settings.
     */
    async createDefaultSettings(): Promise<ChatSettings> {
        const { data, error } = await supabase
            .from('chat_settings')
            .insert({
                enable_message_deletion: true,
                deletion_threshold_minutes: 10
            })
            .select()
            .single()

        if (error) {
            console.error('Failed to create default settings:', error)
            // Return default values even if insert fails
            return {
                id: '',
                enable_message_deletion: true,
                deletion_threshold_minutes: 10,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }
        }

        return data
    },

    /**
     * Updates chat settings.
     * @param settings - The settings to update
     */
    async updateChatSettings(settings: Partial<ChatSettings>): Promise<ChatSettings> {
        // First get the current settings (or create if doesn't exist)
        let currentSettings = await this.getChatSettings()

        if (!currentSettings || !currentSettings.id) {
            // Create settings if they don't exist
            currentSettings = await this.createDefaultSettings()
        }

        const { data, error } = await supabase
            .from('chat_settings')
            .update({
                ...settings,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentSettings.id)
            .select()
            .single()

        if (error) throw error
        return data
    },

    /**
     * Gets room members from the room_members table.
     * @param roomId - The ID of the room
     */
    async getRoomMembers(roomId: string): Promise<RoomMemberWithUsername[]> {
        const { data, error } = await supabase.rpc('get_room_members', { room_id: roomId })

        if (error) {
            console.error('Failed to get room members:', error)
            return []
        }

        return data || []
    },

    /**
     * Adds a member to a room.
     * @param roomId - The ID of the room
     * @param userId - The ID of the user to add
     * @param role - The role to assign ('owner', 'admin', 'member')
     */
    async addRoomMember(roomId: string, userId: string, role: string = 'member'): Promise<void> {
        const { error } = await supabase.rpc('add_room_member', {
            p_room_id: roomId,
            p_user_id: userId,
            p_role: role,
            p_added_by: null
        })

        if (error) throw error
    },

    /**
     * Removes a member from a room.
     * @param roomId - The ID of the room
     * @param userId - The ID of the user to remove
     */
    async removeRoomMember(roomId: string, userId: string): Promise<void> {
        const { error } = await supabase.rpc('remove_room_member', {
            p_room_id: roomId,
            p_user_id: userId
        })

        if (error) throw error
    },

    /**
     * Checks if a user is a member of a room.
     * @param roomId - The ID of the room
     * @param userId - The ID of the user to check
     */
    async isRoomMember(roomId: string, userId: string): Promise<boolean> {
        const { data, error } = await supabase.rpc('is_room_member', {
            p_room_id: roomId,
            p_user_id: userId
        })

        if (error) {
            console.error('Failed to check room membership:', error)
            return false
        }

        return data || false
    },

    /**
     * Gets a user's role in a room.
     * @param roomId - The ID of the room
     * @param userId - The ID of the user
     */
    async getUserRoomRole(roomId: string, userId: string): Promise<string | null> {
        const { data, error } = await supabase.rpc('get_user_room_role', {
            p_room_id: roomId,
            p_user_id: userId
        })

        if (error) {
            console.error('Failed to get user room role:', error)
            return null
        }

        return data
    },

    /**
     * Gets all available users that can be added to a room.
     * Returns users who are not already members of the room.
     * @param roomId - The ID of the room
     */
    async getAvailableUsersForRoom(roomId: string): Promise<Profile[]> {
        // First get current members
        const members = await this.getRoomMembers(roomId)
        const memberUserIds = members.map(m => m.user_id)

        // If no members, return all users
        if (memberUserIds.length === 0) {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('username', { ascending: true })

            if (error) throw error
            return data || []
        }

        // Get all users excluding members using proper array syntax
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .not('id', 'in', `(${memberUserIds.join(',')})`)
            .order('username', { ascending: true })

        if (error) throw error
        return data || []
    },

    // ==========================================
    // Permission-based methods for room management
    // ==========================================

    /**
     * Checks if a user can manage members in a room.
     * For group chats: Admins only
     * For personal chats: Not applicable
     * @param roomId - The ID of the room
     * @param userId - The ID of the user
     */
    async canManageMembers(roomId: string, userId: string): Promise<boolean> {
        const room = await this.getRoomById(roomId)
        if (!room) return false

        // Personal chats don't have member management
        if (room.is_personal) return false

        const role = await this.getUserRoomRole(roomId, userId)
        return role === 'owner' || role === 'admin'
    },

    /**
     * Checks if a user can manage admins in a room.
     * For group chats: Admins only
     * For personal chats: Not applicable
     * @param roomId - The ID of the room
     * @param userId - The ID of the user
     */
    async canManageAdmins(roomId: string, userId: string): Promise<boolean> {
        const room = await this.getRoomById(roomId)
        if (!room) return false

        // Personal chats don't have admin management
        if (room.is_personal) return false

        const role = await this.getUserRoomRole(roomId, userId)
        return role === 'owner' || role === 'admin'
    },

    /**
     * Checks if a user can change the room name.
     * For group chats: All members
     * For personal chats: Both participants
     * @param roomId - The ID of the room
     * @param userId - The ID of the user
     */
    async canChangeRoomName(roomId: string, userId: string): Promise<boolean> {
        return this.isRoomMember(roomId, userId)
    },

    /**
     * Adds an admin to a room (admin only).
     * @param roomId - The ID of the room
     * @param userId - The ID of the user to promote
     * @param requesterId - The ID of the user making the request
     */
    async addRoomAdmin(roomId: string, userId: string, requesterId: string): Promise<string> {
        const { data, error } = await supabase.rpc('add_room_admin', {
            p_room_id: roomId,
            p_user_id: userId,
            p_requester_id: requesterId
        })

        if (error) throw error
        return data
    },

    /**
     * Removes an admin from a room (admin only, cannot remove last admin).
     * @param roomId - The ID of the room
     * @param userId - The ID of the user to demote
     * @param requesterId - The ID of the user making the request
     */
    async removeRoomAdmin(roomId: string, userId: string, requesterId: string): Promise<string> {
        const { data, error } = await supabase.rpc('remove_room_admin', {
            p_room_id: roomId,
            p_user_id: userId,
            p_requester_id: requesterId
        })

        if (error) throw error
        return data
    },

    /**
     * Updates the room name.
     * @param roomId - The ID of the room
     * @param name - The new name
     * @param requesterId - The ID of the user making the request
     */
    async updateRoomName(roomId: string, name: string, requesterId: string): Promise<string> {
        const { data, error } = await supabase.rpc('update_room_name', {
            p_room_id: roomId,
            p_name: name,
            p_requester_id: requesterId
        })

        if (error) throw error
        return data
    },

    /**
     * Adds a member to a room (admin only for group chats).
     * @param roomId - The ID of the room
     * @param userId - The ID of the user to add
     * @param requesterId - The ID of the user making the request
     */
    async addMemberToRoom(roomId: string, userId: string, requesterId: string): Promise<string> {
        const { data, error } = await supabase.rpc('add_member_to_room', {
            p_room_id: roomId,
            p_user_id: userId,
            p_requester_id: requesterId
        })

        if (error) throw error
        return data
    },

    /**
     * Removes a member from a room (admin only for group chats).
     * @param roomId - The ID of the room
     * @param userId - The ID of the user to remove
     * @param requesterId - The ID of the user making the request
     */
    async removeMemberFromRoom(roomId: string, userId: string, requesterId: string): Promise<string> {
        const { data, error } = await supabase.rpc('remove_member_from_room', {
            p_room_id: roomId,
            p_user_id: userId,
            p_requester_id: requesterId
        })

        if (error) throw error
        return data
    },

    /**
     * Gets all users (for user search/selection).
     */
    async getAllUsersForSearch(): Promise<Profile[]> {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('username', { ascending: true })

        if (error) throw error
        return data || []
    },

    /**
     * Gets all nicknames set by a user in a specific room.
     * @param roomId - The ID of the room
     * @param setterUserId - The ID of the user who set the nicknames
     */
    async getMemberNicknames(roomId: string, setterUserId: string): Promise<RoomMemberNickname[]> {
        const { data, error } = await supabase.rpc('get_member_nicknames', {
            p_room_id: roomId,
            p_setter_user_id: setterUserId
        })

        if (error) {
            console.error('Failed to get member nicknames:', error)
            return []
        }

        return data || []
    },

    /**
     * Sets or updates a nickname for a room member.
     * @param roomId - The ID of the room
     * @param targetUserId - The ID of the user being nicknamed
     * @param nickname - The nickname to set
     * @param setterUserId - The ID of the user setting the nickname
     * @returns Status string: 'success', 'not_a_member', 'target_not_in_room', 'empty_nickname', 'nickname_too_long'
     */
    async setMemberNickname(
        roomId: string,
        targetUserId: string,
        nickname: string,
        setterUserId: string
    ): Promise<string> {
        const { data, error } = await supabase.rpc('set_member_nickname', {
            p_room_id: roomId,
            p_target_user_id: targetUserId,
            p_nickname: nickname,
            p_setter_user_id: setterUserId
        })

        if (error) throw error
        return data
    },

    /**
     * Deletes a nickname for a room member.
     * @param roomId - The ID of the room
     * @param targetUserId - The ID of the user whose nickname is being removed
     * @param setterUserId - The ID of the user who set the nickname
     * @returns Status string: 'success', 'nickname_not_found'
     */
    async deleteMemberNickname(
        roomId: string,
        targetUserId: string,
        setterUserId: string
    ): Promise<string> {
        const { data, error } = await supabase.rpc('delete_member_nickname', {
            p_room_id: roomId,
            p_target_user_id: targetUserId,
            p_setter_user_id: setterUserId
        })

        if (error) throw error
        return data
    }
}
