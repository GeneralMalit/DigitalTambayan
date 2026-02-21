import { createClient } from '@/utils/supabase/client'
import { BOT_CONFIG } from '@/config/botManifest'
import { Message } from '@/types/database'

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
            this.triggerBotResponse(roomId)
        }

        return messageWithSystemFlag
    },

    /**
     * Handles the delayed bot response.
     * This is a STUB implementation that will be replaced with real Berto AI functionality in the future.
     * Currently, it just adds a placeholder system message when Berto is mentioned.
     */
    async triggerBotResponse(roomId: string) {
        setTimeout(async () => {
            try {
                console.error('Berto AI is unimplemented - this is a STUB implementation')

                // Try to send placeholder system message to database first
                const response = getRandomResponse()
                const { data, error } = await supabase
                    .from('messages')
                    .insert({
                        room_id: roomId,
                        user_id: null,
                        sender_name: BOT_CONFIG.name,
                        content: response,
                        is_bot: false,
                        is_system: true
                    })
                    .select()
                    .single()

                if (error) {
                    console.error('Failed to send Berto placeholder message to database:', error)
                    // Fallback: Try sending as test system message
                    await this.sendTestSystemMessage(roomId, response)
                    return
                }

                console.log('Berto AI placeholder message sent:', data)
            } catch (error) {
                console.error('Berto AI error occurred:', error)
                // Fallback: Try sending as test system message
                await this.sendTestSystemMessage(roomId, getRandomResponse())
            }
        }, 1500)
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
     * Subscribes to real-time messages in a specific room.
     */
    subscribeToMessages(roomId: string, callback: (message: Message) => void) {
        return supabase
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
                    callback(payload.new as Message)
                }
            )
            .subscribe()
    },

    /**
     * Fetches the last N messages for a room.
     */
    async getMessages(roomId: string, limit = 50) {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('room_id', roomId)
            .order('created_at', { ascending: true })
            .limit(limit)

        if (error) throw error

        // Add is_system property to Berto's messages
        return data.map(msg => ({
            ...msg,
            is_system: msg.sender_name === 'Berto'
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
        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('room_id', roomId)

        if (error) throw error
    }
}
