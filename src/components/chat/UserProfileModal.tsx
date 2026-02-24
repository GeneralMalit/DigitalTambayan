'use client'

import { Profile } from '@/types/database'
import { chatService } from '@/lib/chatService'
import { useState } from 'react'

interface UserProfileModalProps {
    user: Profile
    currentUserId: string
    onClose: () => void
    onChatCreated: (roomId: string) => void
}

export default function UserProfileModal({
    user,
    currentUserId,
    onClose,
    onChatCreated
}: UserProfileModalProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleStartChat = async () => {
        setLoading(true)
        setError(null)

        try {
            const room = await chatService.getOrCreatePersonalChat(currentUserId, user.id)
            onChatCreated(room.id)
            onClose()
        } catch (err: any) {
            console.error('Failed to start chat:', err)
            setError(err.message || 'Failed to start chat')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl">
                {/* Close Button */}
                <div className="flex justify-end p-4">
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-zinc-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>

                {/* Profile Content */}
                <div className="flex flex-col items-center px-6 pb-6">
                    {/* Avatar */}
                    <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-3xl font-bold mb-4">
                        {user.username.charAt(0).toUpperCase()}
                    </div>

                    {/* Username */}
                    <h3 className="text-xl font-semibold text-white mb-1">{user.username}</h3>

                    {/* Status Badge */}
                    {user.is_admin && (
                        <span className="px-2 py-1 text-xs font-medium bg-purple-500/20 text-purple-400 rounded-full mb-4">
                            Admin
                        </span>
                    )}

                    {error && (
                        <div className="w-full p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm mb-4">
                            {error}
                        </div>
                    )}

                    {/* Action Button */}
                    <button
                        onClick={handleStartChat}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                        </svg>
                        {loading ? 'Starting...' : 'Send Message'}
                    </button>
                </div>
            </div>
        </div>
    )
}