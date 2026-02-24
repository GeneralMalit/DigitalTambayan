import { useState, useRef, useEffect } from 'react'

interface ChatInputProps {
    onSend: (content: string) => Promise<void>
    disabled?: boolean
    onTypingStart?: () => void
    onTypingStop?: () => void
}

export default function ChatInput({ onSend, disabled, onTypingStart, onTypingStop }: ChatInputProps) {
    const [content, setContent] = useState('')
    const [isSending, setIsSending] = useState(false)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!content.trim() || isSending || disabled) return

        // Stop typing indicator when sending
        onTypingStop?.()

        setIsSending(true)
        try {
            await onSend(content.trim())
            setContent('')
            // Immediate focus after clearing - use requestAnimationFrame for instant refocus
            requestAnimationFrame(() => {
                inputRef.current?.focus()
            })
        } catch (err) {
            console.error('Failed to send message:', err)
        } finally {
            setIsSending(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
        }
    }

    // Handle typing indicator
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContent(e.target.value)

        // Start typing indicator
        if (e.target.value.trim()) {
            onTypingStart?.()

            // Clear existing timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current)
            }

            // Stop typing after 3 seconds of inactivity
            typingTimeoutRef.current = setTimeout(() => {
                onTypingStop?.()
            }, 3000)
        } else {
            // Stop typing if input is empty
            onTypingStop?.()
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current)
            }
        }
    }

    // Auto-resize textarea
    useEffect(() => {
        const textarea = inputRef.current
        if (textarea) {
            textarea.style.height = 'auto'
            textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
        }
    }, [content])

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current)
            }
        }
    }, [])

    return (
        <form onSubmit={handleSubmit} className="relative mt-auto z-10">
            <textarea
                ref={inputRef}
                rows={1}
                value={content}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Aa"
                disabled={disabled || isSending}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-4 pr-12 text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all disabled:opacity-50 min-h-[48px] scrollbar-hidden hover:chat-input-scrollbar focus:chat-input-scrollbar"
            />
            <button
                type="submit"
                disabled={!content.trim() || isSending || disabled}
                className="absolute right-2 bottom-1.5 p-2 text-blue-500 hover:text-blue-400 disabled:text-zinc-600 transition-colors"
                aria-label="Send message"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                    <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                </svg>
            </button>
        </form>
    )
}
