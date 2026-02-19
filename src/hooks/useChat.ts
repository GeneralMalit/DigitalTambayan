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

                subscriptionRef.current = chatService.subscribeToMessages(roomId, (newMessage) => {
                    if (mounted) {
                        setMessages((prev) => {
                            // Avoid duplicates just in case
                            if (prev.some((m) => m.id === newMessage.id)) return prev
                            return [...prev, newMessage]
                        })
                    }
                })
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
        try {
            await chatService.sendMessage(roomId, userId, senderName, content)
        } catch (err: any) {
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

    return {
        messages,
        loading,
        error,
        sendMessage,
        clearHistory
    }
}
