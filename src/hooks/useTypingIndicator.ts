import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface TypingUser {
    userId: string
    username: string
    timestamp: number
}

const TYPING_TIMEOUT = 3000 // 3 seconds

export function useTypingIndicator(
    roomId: string | undefined,
    currentUserId: string | undefined,
    currentUsername: string
) {
    const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])
    const channelRef = useRef<RealtimeChannel | null>(null)
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const isTypingRef = useRef(false)

    // Subscribe to typing events
    useEffect(() => {
        if (!roomId) return

        const supabase = createClient()
        const channel = supabase.channel(`typing:${roomId}`, {
            config: {
                broadcast: { self: false } // Don't receive own events
            }
        })

        channel
            .on('broadcast', { event: 'typing_start' }, ({ payload }) => {
                setTypingUsers(prev => {
                    // Don't add if already in list
                    if (prev.some(u => u.userId === payload.userId)) {
                        return prev.map(u =>
                            u.userId === payload.userId
                                ? { ...u, timestamp: Date.now() }
                                : u
                        )
                    }
                    return [...prev, {
                        userId: payload.userId,
                        username: payload.username,
                        timestamp: Date.now()
                    }]
                })
            })
            .on('broadcast', { event: 'typing_stop' }, ({ payload }) => {
                setTypingUsers(prev => prev.filter(u => u.userId !== payload.userId))
            })
            .subscribe((status) => {
                console.log('Typing indicator subscription status:', status)
            })

        channelRef.current = channel

        // Cleanup old typing users periodically
        const cleanupInterval = setInterval(() => {
            const now = Date.now()
            setTypingUsers(prev => prev.filter(u => now - u.timestamp < TYPING_TIMEOUT))
        }, 1000)

        return () => {
            channel.unsubscribe()
            clearInterval(cleanupInterval)
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current)
            }
        }
    }, [roomId])

    // Start typing indicator
    const startTyping = useCallback(() => {
        if (!channelRef.current || !currentUserId || isTypingRef.current) return

        isTypingRef.current = true
        channelRef.current.send({
            type: 'broadcast',
            event: 'typing_start',
            payload: {
                userId: currentUserId,
                username: currentUsername
            }
        })

        // Auto-stop after timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
        }
        typingTimeoutRef.current = setTimeout(() => {
            stopTyping()
        }, TYPING_TIMEOUT)
    }, [currentUserId, currentUsername])

    // Stop typing indicator
    const stopTyping = useCallback(() => {
        if (!channelRef.current || !currentUserId || !isTypingRef.current) return

        isTypingRef.current = false
        channelRef.current.send({
            type: 'broadcast',
            event: 'typing_stop',
            payload: {
                userId: currentUserId
            }
        })

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
            typingTimeoutRef.current = null
        }
    }, [currentUserId])

    // Get display text for typing indicator
    const getTypingDisplayText = useCallback(() => {
        if (typingUsers.length === 0) return null
        if (typingUsers.length === 1) {
            return `${typingUsers[0].username} is typing...`
        }
        if (typingUsers.length === 2) {
            return `${typingUsers[0].username} and ${typingUsers[1].username} are typing...`
        }
        return `${typingUsers[0].username} and ${typingUsers.length - 1} others are typing...`
    }, [typingUsers])

    return {
        typingUsers,
        startTyping,
        stopTyping,
        getTypingDisplayText
    }
}
