import { useState, useEffect, useRef } from 'react'
import { chatService } from '@/lib/chatService'
import { Message } from '@/types/database'

export function useChat(roomId: string | undefined) {
    const [messages, setMessages] = useState<Message[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const subscriptionRef = useRef<any>(null)

    useEffect(() => {
        if (!roomId) return

        let mounted = true

        const setupChat = async () => {
            setLoading(true)
            setError(null)
            try {
                // 1. Fetch historical messages
                const history = await chatService.getMessages(roomId)
                if (mounted) {
                    setMessages(history)
                    setLoading(false)
                }

                // 2. Subscribe to real-time updates
                if (subscriptionRef.current) {
                    subscriptionRef.current.unsubscribe()
                }

                subscriptionRef.current = chatService.subscribeToMessages(
                    roomId,
                    // INSERT callback
                    (newMessage) => {
                        if (mounted) {
                            setMessages((prev) => {
                                // Check if message already exists (either as temp or real)
                                const exists = prev.some(msg => {
                                    // Check if temp message with same content and sender exists
                                    if (typeof msg.id === 'string' && msg.id.startsWith('temp-')) {
                                        return msg.content === newMessage.content &&
                                            msg.sender_name === newMessage.sender_name &&
                                            Math.abs(new Date(msg.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 5000
                                    }
                                    // Check if real message with same id exists
                                    return msg.id === newMessage.id
                                })

                                if (exists) return prev

                                // Use actual is_system value from database
                                const messageToAdd = {
                                    ...newMessage,
                                    is_system: newMessage.is_system ?? false
                                }

                                return [...prev, messageToAdd]
                            })
                        }
                    },
                    // DELETE callback
                    (deletedId) => {
                        if (mounted) {
                            setMessages((prev) => prev.filter(msg => msg.id !== deletedId))
                        }
                    }
                )
            } catch (err: any) {
                if (mounted) {
                    setError(err.message || 'Failed to initialize chat')
                    setLoading(false)
                }
            }
        }

        setupChat()

        return () => {
            mounted = false
            if (subscriptionRef.current) {
                subscriptionRef.current.unsubscribe()
            }
        }
    }, [roomId])

    const sendMessage = async (userId: string | null, senderName: string, content: string) => {
        if (!roomId) return

        // Create a temporary message to show immediately
        const tempMessage: Message = {
            id: `temp-${Date.now()}`,
            room_id: roomId,
            user_id: userId,
            sender_name: senderName,
            content: content,
            is_bot: false,
            is_system: false,
            created_at: new Date().toISOString()
        }

        // Immediately add to UI for instant feedback
        setMessages(prev => [...prev, tempMessage])

        try {
            // Send message to server
            const actualMessage = await chatService.sendMessage(roomId, userId, senderName, content)

            // Replace temporary message with actual message from server
            setMessages(prev => prev.map(msg =>
                msg.id === tempMessage.id ? actualMessage : msg
            ))
        } catch (err: any) {
            // Remove temporary message if there's an error
            setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id))
            setError(err.message || 'Failed to send message')
            throw err
        }
    }

    const clearHistory = async () => {
        if (!roomId) return
        try {
            await chatService.clearChat(roomId)
            setMessages([])
        } catch (err: any) {
            setError(err.message || 'Failed to clear chat')
            throw err
        }
    }

    // Refresh messages from server
    const refreshMessages = async () => {
        if (!roomId) return
        try {
            const history = await chatService.getMessages(roomId)
            setMessages(history)
        } catch (err: any) {
            console.error('Failed to refresh messages:', err)
        }
    }

    return {
        messages,
        loading,
        error,
        sendMessage,
        clearHistory,
        refreshMessages
    }
}
