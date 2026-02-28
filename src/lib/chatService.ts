import { createClient } from '@/utils/supabase/client'
import { BOT_CONFIG } from '@/config/botManifest'
import { Message, Room, RoomWithMeta } from '@/types/database'
import { aiService } from '@/lib/aiService'
const supabase = createClient()

// Get random response from placeholder responses array
const getRandomResponse = () => {
    const randomIndex = Math.floor(Math.random() * BOT_CONFIG.placeholderResponses.length)
    return BOT_CONFIG.placeholderResponses[randomIndex]
}

export const chatService = {
    /**
     * Inserts a message into the database.
     * If the message mentions Berto, schedules a bot response.
     */
    async sendMessage(roomId: string, userId: string | null, senderName: string, content: string) {
        const { data, error } = await supabase
            .from('messages')
            .insert({
                room_id: roomId,
                user_id: userId,
                sender_name: senderName,
                content: content,
                is_bot: false
            })
            .select()
            .single()

        if (error) throw error

        // Add is_system property to the returned message for UI rendering
        const messageWithSystemFlag = {
            ...data,
            is_system: false
        }

        // Berto Logic: Check for mention trigger
        if (content.toLowerCase().includes(BOT_CONFIG.mentionTrigger.toLowerCase())) {
            this.triggerBotResponse(roomId, userId)
        }

        return messageWithSystemFlag
    },

    /**
     * Handles the delayed bot response using the Gemini API.
     * Enforces session-based rate limits and provides recent chat context.
     * @param roomId - The room ID where the bot was triggered
     * @param triggerUserId - The ID of the user who triggered the bot (for nickname perspective)
     */
    async triggerBotResponse(roomId: string, triggerUserId: string | null = null) {
        // Enforce session-based cooldown
        if (typeof window !== 'undefined') {
            const lastCallStr = sessionStorage.getItem('lastBotCallTime')
            const now = Date.now()

            if (lastCallStr) {
                const lastCall = parseInt(lastCallStr, 10)
                if (now - lastCall < BOT_CONFIG.cooldownSeconds * 1000) {
                    console.log(`Bot on cooldown. Remaining: ${Math.ceil((BOT_CONFIG.cooldownSeconds * 1000 - (now - lastCall)) / 1000)}s`)
                    // Rate limited: Send placeholder message
                    await this.sendTestSystemMessage(roomId, getRandomResponse())
                    return
                }
            }

            // Set cooldown immediately to prevent concurrent bypasses
            sessionStorage.setItem('lastBotCallTime', now.toString())
        }

        setTimeout(async () => {
            try {
                // Fetch recent messages for context
                const messages = await this.getMessages(roomId, BOT_CONFIG.contextLength)

                // Fetch nicknames set by the triggerer in this room
                let nicknamesMap: Record<string, string> = {}
                if (triggerUserId) {
                    const { data: nicknamesData, error: nickError } = await supabase.rpc('get_member_nicknames', {
                        p_room_id: roomId,
                        p_setter_user_id: triggerUserId
                    })

                    if (!nickError && nicknamesData) {
                        nicknamesMap = (nicknamesData as any[]).reduce((acc: Record<string, string>, item: { target_user_id: string, nickname: string }) => {
                            acc[item.target_user_id] = item.nickname
                            return acc
                        }, {})
                    }
                }

                // Construct formatted context text
                const formattedContext = messages
                    .filter(m => {
                        // Ignore system messages
                        if (m.is_system) return false;
                        // Ignore bot messages if configured
                        if (BOT_CONFIG.ignoreBotMessages && m.is_bot) return false;
                        return true;
                    })
                    .map(m => {
                        // Use nickname if available for the user who sent the message
                        const displayName = (m.user_id && nicknamesMap[m.user_id]) ? nicknamesMap[m.user_id] : m.sender_name
                        return `${displayName}: ${m.content}`
                    })
                    .join('\n')

                // Call the AI Service
                const response = await aiService.generateResponse(formattedContext)

                // Insert the real AI response
                const { data, error: dbError } = await supabase
                    .from('messages')
                    .insert({
                        room_id: roomId,
                        user_id: null, // Set to null to avoid FK constraint issues with profiles table
                        sender_name: BOT_CONFIG.name,
                        content: response,
                        is_bot: true,
                        is_system: false
                    })
                    .select()
                    .single()

                if (dbError) {
                    console.error('Database error inserting AI response:', dbError)
                    throw new Error(`Database error: ${dbError.message}`)
                }

                console.log('AI response sent successfully')
            } catch (error: any) {
                console.error('Final AI Trigger catch block error:', error.message || error)
                if (error.stack) console.error('Stack trace:', error.stack)
                // Fallback: Try sending as test system message
                await this.sendTestSystemMessage(roomId, `AI error: ${error.message || 'Unknown error'}`)
            }
        }, 500)
    },

    /**
     * Sends a system message to the database.
     * For development purposes only.
     * @param roomId - The room ID to send the message to
     * @param customMessage - Optional custom message content. If not provided, uses default test message
     */
    async sendTestSystemMessage(roomId: string, customMessage?: string) {
        try {
            const messageContent = customMessage || 'This is a test system message'
            const { data, error } = await supabase
                .from('messages')
                .insert({
                    room_id: roomId,
                    user_id: null,
                    sender_name: 'System',
                    content: messageContent,
                    is_bot: false,
                    is_system: true
                })
                .select()
                .single()

            if (error) {
                console.error('Failed to send test system message:', error)
                return null
            }

            console.log('Test system message sent:', data)
            return data
        } catch (error) {
            console.error('Failed to send test system message:', error)
            return null
        }
    },

    /**
     * Subscribes to real-time message changes (INSERT and DELETE) in a specific room.
     */
    subscribeToMessages(roomId: string, onInsert: (message: Message) => void, onDelete?: (messageId: number) => void) {
        const channel = supabase
            .channel(`room:${roomId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `room_id=eq.${roomId}`
                },
                (payload) => {
                    onInsert(payload.new as Message)
                }
            )

        // Add DELETE listener if callback provided
        if (onDelete) {
            channel.on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'messages',
                    filter: `room_id=eq.${roomId}`
                },
                (payload) => {
                    onDelete(payload.old.id)
                }
            )
        }

        return channel.subscribe()
    },

    /**
     * Fetches the last N messages for a room.
     */
    async getMessages(roomId: string, limit = 50) {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('room_id', roomId)
            .order('created_at', { ascending: false }) // Fetch the MOST RECENT messages first
            .limit(limit)

        if (error) throw error

        // Sort them chronologically (ascending) for the UI and AI context
        const sortedData = [...data].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )

        // Use actual is_system value from database
        return sortedData.map(msg => ({
            ...msg,
            is_system: msg.is_system ?? false
        })) as Message[]
    },

    /**
     * Gets the default Lobby room.
     */
    async getLobbyRoom() {
        const { data, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('slug', 'general')
            .single()

        if (error) throw error
        return data
    },

    /**
     * Deletes all messages for a specific room.
     */
    async clearChat(roomId: string) {
        const { data, error } = await supabase.rpc('clear_room_messages', {
            p_room_id: roomId
        })

        if (error) throw error
        if (data !== 'success') throw new Error(data)
        return data
    },

    /**
     * Deletes a specific message by ID.
     * @param messageId - The ID of the message to delete
     */
    async deleteMessage(messageId: number | string): Promise<void> {
        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('id', messageId)

        if (error) throw error
    },

    /**
     * Gets all rooms for a user.
     * @param userId - The ID of the user
     */
    async getUserRooms(userId: string): Promise<RoomWithMeta[]> {
        const { data, error } = await supabase.rpc('get_user_rooms', {
            p_user_id: userId
        })

        if (error) {
            console.error('Failed to get user rooms:', error)
            return []
        }

        return data || []
    },

    /**
     * Gets or creates a personal chat between two users.
     * @param currentUserId - The ID of the current user
     * @param otherUserId - The ID of the other user
     */
    async getOrCreatePersonalChat(currentUserId: string, otherUserId: string): Promise<Room> {
        const { data, error } = await supabase.rpc('get_or_create_personal_chat', {
            p_user1_id: currentUserId,
            p_user2_id: otherUserId
        })

        if (error) throw error

        // Fetch the room details
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', data)
            .single()

        if (roomError) throw roomError
        return room
    },

    /**
     * Creates a group chat.
     * @param name - The name of the group (optional)
     * @param memberIds - Array of user IDs to add as members
     * @param creatorId - The ID of the user creating the group
     */
    async createGroupChat(name: string | null, memberIds: string[], creatorId: string): Promise<Room> {
        const { data, error } = await supabase.rpc('create_group_chat', {
            p_name: name,
            p_creator_id: creatorId,
            p_member_ids: memberIds
        })

        if (error) throw error

        // Fetch the room details
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', data)
            .single()

        if (roomError) throw roomError
        return room
    },

    /**
     * Leaves a room.
     * @param roomId - The ID of the room
     * @param userId - The ID of the user leaving
     * @returns Result string indicating what happened
     */
    async leaveRoom(roomId: string, userId: string): Promise<string> {
        const { data, error } = await supabase.rpc('leave_room', {
            p_room_id: roomId,
            p_user_id: userId
        })

        if (error) throw error
        return data
    },

    /**
     * Gets the display name for a room.
     * @param roomId - The ID of the room
     * @param currentUserId - The ID of the current user
     */
    async getRoomDisplayName(roomId: string, currentUserId: string): Promise<string> {
        const { data, error } = await supabase.rpc('get_room_display_name', {
            p_room_id: roomId,
            p_current_user_id: currentUserId
        })

        if (error) {
            console.error('Failed to get room display name:', error)
            return 'Unknown Room'
        }

        return data || 'Unknown Room'
    },

    /**
     * Gets a room by ID.
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
     * Sends a system message to a room.
     * @param roomId - The ID of the room
     * @param content - The content of the system message
     */
    async sendSystemMessage(roomId: string, content: string): Promise<Message> {
        const { data, error } = await supabase
            .from('messages')
            .insert({
                room_id: roomId,
                user_id: null,
                sender_name: 'System',
                content: content,
                is_bot: false,
                is_system: true
            })
            .select()
            .single()

        if (error) throw error
        return data
    },

    /**
     * Subscribes to room list changes for a user.
     * @param userId - The ID of the user
     * @param onRoomChange - Callback when rooms change
     * @returns unsubscribe function
     */
    subscribeToUserRooms(userId: string, onRoomChange: () => void) {
        const channel = supabase
            .channel(`user_rooms:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'room_members',
                    filter: `user_id=eq.${userId}`
                },
                () => {
                    onRoomChange()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    },

    /**
     * Subscribes to message changes for multiple rooms.
     * This is used by the sidebar to update last message info in real-time.
     * @param roomIds - Array of room IDs to subscribe to
     * @param onMessage - Callback when a new message arrives
     * @returns unsubscribe function
     */
    subscribeToMessagesForRooms(roomIds: string[], onMessage: () => void) {
        if (roomIds.length === 0) {
            return () => { }
        }

        // Create a channel that listens to messages for all user's rooms
        const channel = supabase
            .channel(`user_messages:${roomIds.join(',')}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages'
                },
                (payload) => {
                    const messageRoomId = payload.new.room_id
                    // Only trigger if the message is for one of our rooms
                    if (roomIds.includes(messageRoomId)) {
                        onMessage()
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    },

    /**
     * Subscribes to message deletions for multiple rooms.
     * This is used by the sidebar to update when messages are cleared.
     * @param roomIds - Array of room IDs to subscribe to
     * @param onDelete - Callback when messages are deleted
     * @returns unsubscribe function
     */
    subscribeToMessageDeletionsForRooms(roomIds: string[], onDelete: () => void) {
        if (roomIds.length === 0) {
            return () => { }
        }

        // Create a channel that listens to message deletions for all user's rooms
        const channel = supabase
            .channel(`user_messages_delete:${roomIds.join(',')}`)
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'messages'
                },
                (payload) => {
                    // For DELETE events, payload.old contains the deleted row
                    // Try to get room_id from payload.old, but also trigger for all deletions
                    // since we can't reliably filter in the subscription for deletions
                    const messageRoomId = payload.old?.room_id

                    // Always trigger the callback - the loadRooms will fetch fresh data
                    // This ensures we update even if room_id is not in payload.old
                    onDelete()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    },

    /**
     * Subscribes to room member changes for a specific room.
     * This is used by the MembersList to update in real-time when members are added/removed/roles changed.
     * @param roomId - The room ID to subscribe to
     * @param onMemberChange - Callback when members change
     * @returns unsubscribe function
     */
    subscribeToRoomMembers(roomId: string, onMemberChange: () => void) {
        const channel = supabase
            .channel(`room_members:${roomId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'room_members',
                    filter: `room_id=eq.${roomId}`
                },
                () => {
                    onMemberChange()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    },

    /**
     * Subscribes to room deletions for the current user.
     * This is used by the sidebar to update when a room is deleted.
     * @param userId - The current user's ID
     * @param onRoomDeleted - Callback when a room is deleted
     * @returns unsubscribe function
     */
    subscribeToRoomDeletions(userId: string, onRoomDeleted: () => void) {
        const channel = supabase
            .channel(`user_room_deletions:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'rooms'
                },
                () => {
                    onRoomDeleted()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    },

    /**
     * Subscribes to room membership changes (join/leave) for the current user.
     * This is used by the sidebar to update when user joins or leaves rooms.
     * @param userId - The current user's ID
     * @param onMembershipChange - Callback when membership changes
     * @returns unsubscribe function
     */
    subscribeToRoomMemberships(userId: string, onMembershipChange: () => void) {
        const channel = supabase
            .channel(`user_room_memberships:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'room_members',
                    filter: `user_id=eq.${userId}`
                },
                () => {
                    onMembershipChange()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    },

    /**
     * Subscribes to nickname changes for a specific room.
     * This is used by the MembersList to update in real-time when nicknames are changed.
     * @param roomId - The room ID to subscribe to
     * @param setterUserId - The ID of the user who set the nicknames (for filtering)
     * @param onNicknameChange - Callback when nicknames change
     * @returns unsubscribe function
     */
    subscribeToNicknames(roomId: string, setterUserId: string, onNicknameChange: () => void) {
        const channel = supabase
            .channel(`room_nicknames:${roomId}:${setterUserId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'room_member_nicknames',
                    filter: `room_id=eq.${roomId}`
                },
                () => {
                    onNicknameChange()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }
}
