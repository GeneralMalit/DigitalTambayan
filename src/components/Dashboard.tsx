'use client'

import { authService } from '@/lib/authService'
import { chatService } from '@/lib/chatService'
import { Profile, Room } from '@/types/database'
import { useEffect, useState } from 'react'
import { useChat } from '@/hooks/useChat'
import { useTypingIndicator } from '@/hooks/useTypingIndicator'
import ChatBox from './chat/ChatBox'
import ChatInput from './chat/ChatInput'
import TypingIndicator from './chat/TypingIndicator'

export default function Dashboard() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [lobby, setLobby] = useState<Room | null>(null)
    const [loading, setLoading] = useState(true)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)

    // Chat state
    const { messages, sendMessage, clearHistory, loading: chatLoading } = useChat(lobby?.id)

    // Typing indicator state
    const { startTyping, stopTyping, getTypingDisplayText } = useTypingIndicator(
        lobby?.id,
        profile?.id,
        profile?.username || 'Guest'
    )

    // Password change state
    const [oldPassword, setOldPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [passLoading, setPassLoading] = useState(false)
    const [passError, setPassError] = useState<string | null>(null)
    const [passSuccess, setPassSuccess] = useState<string | null>(null)

    useEffect(() => {
        async function initDashboard() {
            try {
                const [profileData, lobbyData] = await Promise.all([
                    authService.getCurrentProfile(),
                    chatService.getLobbyRoom()
                ])
                setProfile(profileData as Profile)
                setLobby(lobbyData)
            } catch (err: any) {
                console.error('Failed to initialize dashboard:', err)
                setPassError(err.message || 'Initialization error')
            } finally {
                setLoading(false)
            }
        }
        initDashboard()
    }, [])

    const handleSignOut = async () => {
        await authService.signOut()
    }

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault()
        setPassError(null)
        setPassSuccess(null)

        if (newPassword !== confirmPassword) {
            setPassError('New passwords do not match')
            return
        }

        setPassLoading(true)
        try {
            await authService.updatePassword(oldPassword, newPassword)
            setPassSuccess('Password updated successfully!')
            setOldPassword('')
            setNewPassword('')
            setConfirmPassword('')
            setTimeout(() => setIsSettingsOpen(false), 2000)
        } catch (err: any) {
            setPassError(err.message || 'Failed to update password')
        } finally {
            setPassLoading(false)
        }
    }

    if (loading) {
        return <div className="text-white">Loading your tambayan...</div>
    }

    return (
        <div className="relative w-full max-w-2xl px-4 py-8 flex flex-col items-center">
            {/* User Profile Summary */}
            <div className="w-full max-w-md mb-8 flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-tighter text-zinc-500 font-bold">Profile</span>
                    <span className="text-blue-400 font-bold">{profile?.username}</span>
                </div>
                <button
                    onClick={handleSignOut}
                    className="text-xs font-medium text-zinc-500 hover:text-white transition-colors"
                >
                    Sign Out
                </button>
            </div>

            {/* Chat Container */}
            <div className="w-full bg-white/5 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col p-6 h-[600px] relative overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4 shrink-0">
                    <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <h2 className="text-lg font-bold text-white tracking-tight">#{lobby?.name || 'Lobby'}</h2>
                    </div>

                    {/* Admin Actions */}
                    {profile?.is_admin && (
                        <button
                            onClick={() => {
                                if (confirm('Clear all messages in this room?')) clearHistory()
                            }}
                            className="text-[10px] uppercase font-bold tracking-widest text-red-500/50 hover:text-red-500 transition-colors border border-red-500/20 px-2 py-1 rounded"
                        >
                            Clear History
                        </button>
                    )}
                </div>

                {/* Flex wrapper: message area + input bar */}
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Message list - scrollable, fills remaining space */}
                    <div className="flex-1 min-h-0 overflow-hidden">
                        {chatLoading ? (
                            <div className="flex items-center justify-center text-zinc-500 animate-pulse">
                                Warming up the tambayan...
                            </div>
                        ) : (
                            <ChatBox
                                messages={messages}
                                currentUserId={profile?.id}
                                roomId={lobby?.id}
                            />
                        )}
                    </div>

                    {/* Input bar - fixed at bottom with z-index */}
                    <div className="shrink-0 relative z-10 pt-2">
                        <ChatInput
                            onSend={(content) => sendMessage(profile?.id || null, profile?.username || 'Guest', content)}
                            disabled={chatLoading}
                            onTypingStart={startTyping}
                            onTypingStop={stopTyping}
                        />

                        {/* Typing Indicator */}
                        <TypingIndicator text={getTypingDisplayText()} />
                    </div>
                </div>
            </div>

            {/* Settings Cog Wheel */}
            <button
                onClick={() => setIsSettingsOpen(true)}
                className="fixed bottom-8 right-8 p-3 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-all shadow-xl backdrop-blur-md z-40"
                aria-label="Settings"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 animate-spin-slow">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
            </button>

            {/* Settings Modal */}
            {isSettingsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
                    <div className="w-full max-w-md space-y-6 rounded-2xl border border-white/10 bg-zinc-900 p-8 shadow-2xl relative">
                        <button
                            onClick={() => setIsSettingsOpen(false)}
                            className="absolute top-4 right-4 text-zinc-500 hover:text-white"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <div className="text-center">
                            <h3 className="text-xl font-bold text-white">Security Settings</h3>
                            <p className="text-sm text-zinc-400 mt-1">Manage your account security</p>
                        </div>

                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            {passError && (
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm italic">
                                    {passError}
                                </div>
                            )}
                            {passSuccess && (
                                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm">
                                    {passSuccess}
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Retype Old Password</label>
                                <input
                                    type="password"
                                    required
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                    className="w-full rounded-lg bg-white/5 border-white/10 py-2.5 px-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="••••••••"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Type New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full rounded-lg bg-white/5 border-white/10 py-2.5 px-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="••••••••"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Retype New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full rounded-lg bg-white/5 border-white/10 py-2.5 px-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="••••••••"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={passLoading}
                                className="w-full mt-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20"
                            >
                                {passLoading ? 'Updating...' : 'Update Password'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
