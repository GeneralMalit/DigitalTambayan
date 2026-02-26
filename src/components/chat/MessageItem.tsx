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
}

export default function MessageItem({ message, isOwn, canDelete, deletionThresholdMinutes, onDelete }: MessageItemProps) {
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
            {/* Delete Button - appears on hover for own messages */}
            {canDeleteThisMessage && isHovered && (
                <div className="absolute -top-2 z-10">
                    {showDeleteConfirm ? (
                        <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1 shadow-lg">
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="p-1 text-xs text-red-400 hover:bg-red-500/20 rounded transition-colors"
                            >
                                {isDeleting ? '...' : UI_STRINGS.common.delete}
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="p-1 text-xs text-zinc-400 hover:bg-white/10 rounded transition-colors"
                            >
                                {UI_STRINGS.common.cancel}
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => {
                                if (isWithinDeletionWindow) {
                                    setShowDeleteConfirm(true)
                                } else {
                                    alert(UI_STRINGS.chat.messageTooOld)
                                }
                            }}
                            className="p-1 bg-zinc-800 rounded-full shadow-lg hover:bg-zinc-700 transition-colors"
                            title={isWithinDeletionWindow ? UI_STRINGS.chat.deleteMessage : UI_STRINGS.chat.messageTooOld}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-zinc-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </button>
                    )}
                </div>
            )}

            {/* Delete Error Message */}
            {deleteError && (
                <div className="absolute -top-6 left-0 right-0 text-center">
                    <span className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
                        {deleteError}
                    </span>
                </div>
            )}

            <div className={`flex items-baseline space-x-2 mb-1 px-1`}>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isBot ? 'text-blue-400' : 'text-zinc-500'}`}>
                    {message.sender_name} {isBot && '🤖'}
                </span>
                <span className="text-[10px] text-zinc-600 font-mono">
                    {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>

            <div className={`
                max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-lg backdrop-blur-md relative
                ${isBot
                    ? 'bg-blue-600/10 border border-blue-500/20 text-blue-100 italic'
                    : isOwn
                        ? 'bg-blue-600 border border-blue-500 text-white rounded-tr-none'
                        : 'bg-white/5 border border-white/10 text-zinc-200 rounded-tl-none'}
            `}>
                {message.content}
            </div>
        </div>
    )
}
