'use client'

import { authService } from '@/lib/authService'
import { chatService } from '@/lib/chatService'
import { adminService } from '@/lib/adminService'
import { Profile, Room, ChatSettings } from '@/types/database'
import { useEffect, useState, useCallback } from 'react'
import { useChat } from '@/hooks/useChat'
import { useTypingIndicator } from '@/hooks/useTypingIndicator'
import ChatBox from './chat/ChatBox'
import ChatInput from './chat/ChatInput'
import TypingIndicator from './chat/TypingIndicator'
import MembersList from './chat/MembersList'
import RoomSidebar from './chat/RoomSidebar'
import { AdminDashboard } from './admin'

export default function Dashboard() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
    const [loading, setLoading] = useState(true)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [settingsTab, setSettingsTab] = useState<'admin' | 'password'>('password')

    // Members panel state
    const [isMembersOpen, setIsMembersOpen] = useState(false)

    // Chat settings state
    const [chatSettings, setChatSettings] = useState<ChatSettings | null>(null)

    // Room display name
    const [roomDisplayName, setRoomDisplayName] = useState<string>('')

    // Subscribe to chat settings changes for reactivity
    useEffect(() => {
        const unsubscribe = adminService.subscribeToChatSettings((settings) => {
            setChatSettings(settings)
        })

        return () => {
            unsubscribe()
        }
    }, [])

    // Chat state
    const { messages, sendMessage, clearHistory, refreshMessages, loading: chatLoading } = useChat(currentRoom?.id)

    // Typing indicator state
    const { startTyping, stopTyping, getTypingDisplayText } = useTypingIndicator(
        currentRoom?.id,
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

    // Initialization error state (separate from password errors)
    const [initError, setInitError] = useState<string | null>(null)

    useEffect(() => {
        async function initDashboard() {
            try {
                const [profileData, settingsData] = await Promise.all([
                    authService.getCurrentProfile(),
                    adminService.getChatSettings()
                ])
                setProfile(profileData as Profile)
                setChatSettings(settingsData)

                // Load the user's rooms and select the first one (or last used)
                if (profileData) {
                    const rooms = await chatService.getUserRooms(profileData.id)
                    if (rooms.length > 0) {
                        const room = await chatService.getRoomById(rooms[0].id)
                        if (room) {
                            setCurrentRoom(room)
                        }
                    }
                }
            } catch (err: any) {
                console.error('Failed to initialize dashboard:', err)
                setInitError(err.message || 'Initialization error')
            } finally {
                setLoading(false)
            }
        }
        initDashboard()
    }, [])

    // Update room display name when room changes
    useEffect(() => {
        async function updateDisplayName() {
            if (currentRoom && profile) {
                const name = await chatService.getRoomDisplayName(currentRoom.id, profile.id)
                setRoomDisplayName(name)
            }
        }
        updateDisplayName()
    }, [currentRoom, profile])

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

    // Handle message deletion
    const handleMessageDeleted = useCallback((messageId: number | string) => {
        refreshMessages()
    }, [refreshMessages])

    // Handle room selection
    const handleRoomSelect = useCallback(async (roomId: string) => {
        const room = await chatService.getRoomById(roomId)
        if (room) {
            setCurrentRoom(room)
        }
    }, [])

    // Handle room left
    const handleRoomLeft = useCallback(async () => {
        if (!profile) return

        // Refresh rooms and select another one
        const rooms = await chatService.getUserRooms(profile.id)
        if (rooms.length > 0) {
            const room = await chatService.getRoomById(rooms[0].id)
            if (room) {
                setCurrentRoom(room)
            }
        } else {
            setCurrentRoom(null)
        }
    }, [profile])

    // Handle member change
    const handleMemberChange = useCallback(() => {
        // Refresh room display name in case it changed
        if (currentRoom && profile) {
            chatService.getRoomDisplayName(currentRoom.id, profile.id).then(setRoomDisplayName)
        }
    }, [currentRoom, profile])

    // Handle room name change - refresh current room and display name
    const handleRoomNameChange = useCallback(async () => {
        if (currentRoom && profile) {
            // Refresh the room data
            const updatedRoom = await chatService.getRoomById(currentRoom.id)
            if (updatedRoom) {
                setCurrentRoom(updatedRoom)
            }
            // Refresh the display name
            const displayName = await chatService.getRoomDisplayName(currentRoom.id, profile.id)
            setRoomDisplayName(displayName)
        }
    }, [currentRoom, profile])

    if (loading) {
        return <div className="text-white">Loading your tambayan...</div>
    }

    // Show initialization error if present
    if (initError) {
        return (
            <div className="w-full h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-4">⚠️</div>
                    <h2 className="text-xl font-semibold text-white mb-2">Something went wrong</h2>
                    <p className="text-zinc-500 mb-4">{initError}</p>
                    <div className="flex items-center justify-center gap-4">
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                        >
                            Retry
                        </button>
                        <button
                            onClick={handleSignOut}
                            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full h-screen flex flex-col">
            {/* Top Bar */}
            <div className="w-full px-4 py-3 flex items-center justify-between border-b border-white/10 bg-zinc-900/50">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-white">Digital Tambayan</h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-sm font-medium text-blue-400">{profile?.username}</span>
                    </div>
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                        title="Settings"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                    <button
                        onClick={handleSignOut}
                        className="text-sm font-medium text-zinc-500 hover:text-white transition-colors"
                    >
                        Sign Out
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Room Sidebar */}
                {profile && (
                    <RoomSidebar
                        currentUserId={profile.id}
                        currentRoomId={currentRoom?.id || null}
                        onRoomSelect={handleRoomSelect}
                        onUserProfileClick={() => { }}
                    />
                )}

                {/* Chat Area */}
                <div className="flex-1 flex flex-col bg-white/5">
                    {currentRoom ? (
                        <>
                            {/* Chat Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-zinc-900/30">
                                <div className="flex items-center space-x-3">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <h2
                                        className="text-lg font-bold text-white tracking-tight cursor-pointer hover:text-blue-400 transition-colors"
                                        onClick={() => setIsMembersOpen(true)}
                                    >
                                        {currentRoom.is_personal ? (
                                            <>
                                                <span className="text-zinc-500 mr-1">💬</span>
                                                {roomDisplayName}
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-zinc-500 mr-1">#</span>
                                                {roomDisplayName}
                                            </>
                                        )}
                                    </h2>
                                    <button
                                        onClick={() => setIsMembersOpen(true)}
                                        className="text-xs text-zinc-500 hover:text-white transition-colors"
                                        title="View members"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-hidden p-6">
                                {chatLoading ? (
                                    <div className="flex items-center justify-center text-zinc-500 animate-pulse h-full">
                                        Warming up the tambayan...
                                    </div>
                                ) : (
                                    <ChatBox
                                        messages={messages}
                                        currentUserId={profile?.id}
                                        roomId={currentRoom?.id}
                                        enableMessageDeletion={chatSettings?.enable_message_deletion ?? true}
                                        deletionThresholdMinutes={chatSettings?.deletion_threshold_minutes ?? 10}
                                        onMessageDeleted={handleMessageDeleted}
                                    />
                                )}
                            </div>

                            {/* Input */}
                            <div className="px-6 pb-6">
                                <ChatInput
                                    onSend={(content) => sendMessage(profile?.id || null, profile?.username || 'Guest', content)}
                                    disabled={chatLoading}
                                    onTypingStart={startTyping}
                                    onTypingStop={stopTyping}
                                />
                                <TypingIndicator text={getTypingDisplayText()} />
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <div className="text-6xl mb-4">💬</div>
                                <h2 className="text-xl font-semibold text-white mb-2">No conversation selected</h2>
                                <p className="text-zinc-500">Select a chat from the sidebar or create a new group</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

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

                        {/* Tab Navigation */}
                        <div className="flex border-b border-white/10">
                            {profile?.is_admin && (
                                <button
                                    onClick={() => setSettingsTab('admin')}
                                    className={`flex-1 py-3 text-sm font-medium transition-colors relative ${settingsTab === 'admin'
                                        ? 'text-blue-400'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                        }`}
                                >
                                    Admin Dashboard
                                    {settingsTab === 'admin' && (
                                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                                    )}
                                </button>
                            )}
                            <button
                                onClick={() => setSettingsTab('password')}
                                className={`flex-1 py-3 text-sm font-medium transition-colors relative ${settingsTab === 'password'
                                    ? 'text-blue-400'
                                    : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                            >
                                Change Password
                                {settingsTab === 'password' && (
                                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                                )}
                            </button>
                        </div>

                        {/* Tab Content */}
                        {settingsTab === 'admin' && profile?.is_admin ? (
                            <AdminDashboard
                                currentUserId={profile.id}
                                onRefresh={() => {
                                    // Optionally trigger a refresh
                                }}
                                onMessagesCleared={() => {
                                    refreshMessages()
                                }}
                            />
                        ) : (
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
                        )}
                    </div>
                </div>
            )}

            {/* Members List Panel */}
            {profile && (
                <MembersList
                    room={currentRoom}
                    currentUserId={profile.id}
                    isOpen={isMembersOpen}
                    onClose={() => setIsMembersOpen(false)}
                    onRoomLeft={handleRoomLeft}
                    onMemberChange={handleMemberChange}
                    onRoomNameChange={handleRoomNameChange}
                />
            )}
        </div>
    )
}
