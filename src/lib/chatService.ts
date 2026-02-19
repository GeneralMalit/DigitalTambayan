import { createClient } from '@/utils/supabase/client'
import { BOT_CONFIG } from '@/config/botManifest'
import { Message } from '@/types/database'

const supabase = createClient()

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

        // Berto Logic: Check for mention trigger
        if (content.toLowerCase().includes(BOT_CONFIG.mentionTrigger.toLowerCase())) {
            this.triggerBotResponse(roomId)
        }

        return data
    },

    /**
     * Handles the delayed bot response.
     */
    async triggerBotResponse(roomId: string) {
        setTimeout(async () => {
            const { error } = await supabase
                .from('messages')
                .insert({
                    room_id: roomId,
                    user_id: BOT_CONFIG.botUserId,
                    sender_name: BOT_CONFIG.name,
                    content: BOT_CONFIG.placeholderResponse,
                    is_bot: true
                })

            if (error) console.error('Bot response error:', error)
        }, 1500)
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
        return data as Message[]
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
