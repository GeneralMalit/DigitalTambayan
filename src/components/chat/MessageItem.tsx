import { Message } from '@/types/database'
import { chatService } from '@/lib/chatService'
import { useState } from 'react'
import { UI_STRINGS } from '@/config/uiStrings'

interface MessageItemProps {
    message: Message
    isOwn: boolean
    canDelete: boolean
    deletionThresholdMinutes: number
    onDelete?: (messageId: number | string) => void
    nicknames?: Record<string, string>
    avatarUrl?: string
}

export default function MessageItem({ message, isOwn, canDelete, deletionThresholdMinutes, onDelete, nicknames, avatarUrl }: MessageItemProps) {
    const [isHovered, setIsHovered] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState<string | null>(null)

    const isBot = message.is_bot
    const isSystem = message.is_system

    // Check if message can be deleted based on time threshold
    const canDeleteThisMessage = canDelete && isOwn && !isSystem && !isBot
    const messageAgeMinutes = (Date.now() - new Date(message.created_at).getTime()) / (1000 * 60)
    const isWithinDeletionWindow = messageAgeMinutes <= deletionThresholdMinutes
    const canActuallyDelete = canDeleteThisMessage && isWithinDeletionWindow

    const handleDelete = async () => {
        if (!canActuallyDelete) return

        setIsDeleting(true)
        setDeleteError(null)
        try {
            await chatService.deleteMessage(message.id)
            onDelete?.(message.id)
            setShowDeleteConfirm(false)
        } catch (err: any) {
            console.error('Failed to delete message:', err)
            setDeleteError(err.message || UI_STRINGS.chat.failedToDelete)
        } finally {
            setIsDeleting(false)
        }
    }

    if (isSystem) {
        return (
            <div className="flex justify-center w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="text-center px-4 py-2 max-w-[80%]">
                    <span className="text-xs text-zinc-500 italic">
                        {message.content}
                    </span>
                </div>
            </div>
        )
    }

    return (
        <div
            className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300 relative group`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => { setIsHovered(false); setShowDeleteConfirm(false); setDeleteError(null) }}
        >
            <div className={`flex items-start gap-2 w-full ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                {!isSystem && (
                    <div className="shrink-0 mt-1">
                        {isBot ? (
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 ring-1 ring-blue-500/20">
                                🤖
                            </div>
                        ) : avatarUrl ? (
                            <img
                                src={avatarUrl}
                                alt={message.sender_name}
                                className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10"
                            />
                        ) : (
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ring-1 ring-white/10 ${isOwn ? 'bg-zinc-700' : 'bg-blue-600'}`}>
                                {message.sender_name.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                )}

                <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[85%]`}>
                    <div className={`flex items-baseline space-x-2 mb-1 px-1`}>
                        <span className={`text-[10px] font-medium tracking-wider font-heading ${isBot ? 'text-blue-400' : 'text-zinc-500'}`}>
                            {nicknames?.[message.user_id || ''] || message.sender_name}
                        </span>
                        <span className="text-[10px] text-zinc-600 font-mono">
                            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>

                    <div className={`
                        rounded-md px-4 py-3 text-sm relative transition-all duration-300
                        ${isBot
                            ? 'bg-blue-500/[0.05] text-blue-200'
                            : isOwn
                                ? 'bg-white text-black font-medium'
                                : 'bg-white/[0.03] text-zinc-300'}
                    `}>
                        {message.content}

                        {/* Delete Button - appears on hover for own messages */}
                        {canActuallyDelete && isHovered && (
                            <div className={`absolute -top-3 ${isOwn ? '-left-3' : '-right-3'} z-10`}>
                                {showDeleteConfirm ? (
                                    <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1 shadow-lg ring-1 ring-white/10">
                                        <button
                                            onClick={handleDelete}
                                            disabled={isDeleting}
                                            className="px-2 py-1 text-[10px] text-red-400 hover:bg-red-500/20 rounded transition-colors"
                                        >
                                            {isDeleting ? '...' : UI_STRINGS.common.delete}
                                        </button>
                                        <button
                                            onClick={() => setShowDeleteConfirm(false)}
                                            className="px-2 py-1 text-[10px] text-zinc-400 hover:bg-white/10 rounded transition-colors"
                                        >
                                            {UI_STRINGS.common.cancel}
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="p-1.5 bg-zinc-800 rounded-full shadow-lg hover:bg-zinc-700 transition-colors ring-1 ring-white/10"
                                        title={UI_STRINGS.chat.deleteMessage}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-zinc-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Delete Error Message */}
                        {deleteError && (
                            <div className="absolute -bottom-6 left-0 right-0 text-center z-20">
                                <span className="text-[10px] text-red-400 bg-black/80 backdrop-blur-sm px-2 py-0.5 rounded border border-red-500/20">
                                    {deleteError}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
