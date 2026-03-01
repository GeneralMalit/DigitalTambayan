import { Message } from '@/types/database'
import MessageItem from './MessageItem'
import { useEffect, useRef, useLayoutEffect } from 'react'
import { chatService } from '@/lib/chatService'
import { UI_STRINGS } from '@/config/uiStrings'

interface ChatBoxProps {
    messages: Message[]
    currentUserId: string | undefined
    roomId: string | undefined
    enableMessageDeletion: boolean
    deletionThresholdMinutes: number
    onMessageDeleted?: (messageId: number | string) => void
    nicknames?: Record<string, string>
    avatars?: Record<string, string>
}

export default function ChatBox({ messages, currentUserId, roomId, enableMessageDeletion, deletionThresholdMinutes, onMessageDeleted, nicknames, avatars }: ChatBoxProps) {
    const scrollRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom - use useLayoutEffect for synchronous execution
    useLayoutEffect(() => {
        // Use requestAnimationFrame to ensure DOM has been painted
        const scrollToBottom = () => {
            if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight
            }
        }

        // First attempt - synchronous after layout
        scrollToBottom()

        // Second attempt - after next paint (handles most cases)
        requestAnimationFrame(scrollToBottom)

        // Third attempt - after CSS animations complete (handles system messages with slide-in)
        setTimeout(scrollToBottom, 350)
    }, [messages])

    const handleSendTestSystemMessage = async () => {
        if (!roomId) {
            console.error('Room ID is undefined')
            return
        }

        const testMessage = await chatService.sendTestSystemMessage(roomId)
        if (!testMessage) {
            console.error('Failed to send test system message')
        }
    }

    return (
        <div
            ref={scrollRef}
            className="h-full w-full overflow-y-auto space-y-4 pr-2 custom-scrollbar"
        >
            {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-2 opacity-50">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.023c.09-.457.133-.915.13-1.371C3.515 16.29 2 14.282 2 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                    </svg>
                    <p className="text-sm">{UI_STRINGS.chat.noMessages}</p>
                    <p className="text-xs">{UI_STRINGS.chat.startConversation}</p>
                </div>
            ) : (
                messages.map((msg) => (
                    <MessageItem
                        key={msg.id}
                        message={msg}
                        isOwn={msg.user_id === currentUserId}
                        canDelete={enableMessageDeletion}
                        deletionThresholdMinutes={deletionThresholdMinutes}
                        onDelete={onMessageDeleted}
                        nicknames={nicknames}
                        avatarUrl={msg.user_id ? avatars?.[msg.user_id] : undefined}
                    />
                ))
            )}
        </div>
    )
}
