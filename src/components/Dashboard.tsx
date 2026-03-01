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
import ImageCropModal from './chat/ImageCropModal'
import { storageService } from '@/lib/storageService'

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

    // Nicknames for current room members
    const [nicknames, setNicknames] = useState<Record<string, string>>({})

    // Avatar URLs for current room members (user_id -> avatar_url)
    const [roomAvatars, setRoomAvatars] = useState<Record<string, string>>({})

    // Photo upload state
    const [isCropModalOpen, setIsCropModalOpen] = useState(false)
    const [pendingImage, setPendingImage] = useState<File | null>(null)

    // Track last read message ID for each room (for unread highlighting)
    // Using localStorage to persist across page refreshes
    const [lastReadMessageId, setLastReadMessageId] = useState<Record<string, number>>(() => {
        if (typeof window === 'undefined') return {}
        try {
            const saved = localStorage.getItem('chat_last_read')
            return saved ? JSON.parse(saved) : {}
        } catch {
            return {}
        }
    })

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

    // Mark current room as read when new messages arrive
    useEffect(() => {
        if (currentRoom?.id && messages.length > 0) {
            const lastMsg = messages[messages.length - 1]
            const msgTime = new Date(lastMsg.created_at).getTime()

            const lastRead = lastReadMessageId[currentRoom.id] || 0

            if (msgTime > lastRead) {
                const newState = {
                    ...lastReadMessageId,
                    [currentRoom.id]: msgTime
                }
                setLastReadMessageId(newState)
                if (typeof window !== 'undefined') {
                    localStorage.setItem('chat_last_read', JSON.stringify(newState))
                }
            }
        }
    }, [messages, currentRoom?.id])

    // Wrapper to send message and mark as read
    const handleSendMessage = async (userId: string | null, username: string, content: string) => {
        await sendMessage(userId, username, content)
        // Mark room as read when user sends a message
        if (currentRoom?.id) {
            const now = Date.now()
            const newState = {
                ...lastReadMessageId,
                [currentRoom.id]: now
            }
            setLastReadMessageId(newState)
            if (typeof window !== 'undefined') {
                localStorage.setItem('chat_last_read', JSON.stringify(newState))
            }
        }
    }

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

    // Handle message deletion - the real-time subscription in useChat.ts handles
    // optimistic removal, so we don't need to do a full refresh here
    const handleMessageDeleted = useCallback((_messageId: number | string) => {
        // No-op: realtime subscription handles removal
    }, [])

    // Handle room selection
    const handleRoomSelect = useCallback(async (roomId: string) => {
        const room = await chatService.getRoomById(roomId)
        if (room) {
            setCurrentRoom(room)
        }
    }, [])

    // Handle room selection - also mark messages as read
    const handleRoomSelectWithRead = useCallback(async (roomId: string, lastMessageId?: number) => {
        const room = await chatService.getRoomById(roomId)
        if (room) {
            setCurrentRoom(room)
            // Mark messages as read by storing the last message ID
            if (lastMessageId) {
                const newState = {
                    ...lastReadMessageId,
                    [roomId]: lastMessageId
                }
                setLastReadMessageId(newState)
                // Persist to localStorage
                if (typeof window !== 'undefined') {
                    localStorage.setItem('chat_last_read', JSON.stringify(newState))
                }
            }
        }
    }, [lastReadMessageId])

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

    // Handle member change - refresh room display name AND room data
    const handleMemberChange = useCallback(async () => {
        if (currentRoom && profile) {
            // Refresh the room data (for photo changes)
            const updatedRoom = await chatService.getRoomById(currentRoom.id)
            if (updatedRoom) {
                setCurrentRoom(updatedRoom)
            }
            // Refresh room display name in case it changed
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

    // Load nicknames for current room
    const loadNicknames = useCallback(async () => {
        if (!currentRoom?.id || !profile?.id) return

        try {
            const data = await adminService.getMemberNicknames(currentRoom.id, profile.id)
            const nicknameMap: Record<string, string> = {}
            data.forEach((n) => {
                nicknameMap[n.target_user_id] = n.nickname
            })
            setNicknames(nicknameMap)
        } catch (err: any) {
            console.error('Failed to load nicknames:', err)
        }
    }, [currentRoom?.id, profile?.id])

    // Load avatar URLs for current room members
    const loadMemberAvatars = useCallback(async () => {
        if (!currentRoom?.id) return

        try {
            const members = await adminService.getRoomMembers(currentRoom.id)
            const avatarMap: Record<string, string> = {}
            members.forEach((m) => {
                if (m.avatar_url) {
                    avatarMap[m.user_id] = m.avatar_url
                }
            })
            setRoomAvatars(avatarMap)
        } catch (err: any) {
            console.error('Failed to load member avatars:', err)
        }
    }, [currentRoom?.id])

    // Handle nickname change - refresh nicknames and room display name (for personal chats)
    const handleNicknameChange = useCallback(async () => {
        if (currentRoom && profile) {
            // Reload nicknames
            await loadNicknames()
            // Refresh room display name (important for personal chats)
            const displayName = await chatService.getRoomDisplayName(currentRoom.id, profile.id)
            setRoomDisplayName(displayName)
        }
    }, [currentRoom, profile, loadNicknames])

    // Load nicknames and avatars when room changes
    useEffect(() => {
        loadNicknames()
        loadMemberAvatars()
    }, [loadNicknames, loadMemberAvatars])

    // Subscribe to nickname changes
    useEffect(() => {
        if (!currentRoom?.id || !profile?.id) return

        const unsubscribe = chatService.subscribeToNicknames(currentRoom.id, profile.id, loadNicknames)

        return () => {
            unsubscribe()
        }
    }, [currentRoom?.id, profile?.id, loadNicknames])

    // Subscribe to current room updates (for photo changes)
    useEffect(() => {
        if (!currentRoom?.id) return

        const unsubscribe = chatService.subscribeToRoomUpdates([currentRoom.id], async () => {
            if (currentRoom?.id) {
                const updatedRoom = await chatService.getRoomById(currentRoom.id)
                if (updatedRoom) {
                    setCurrentRoom(updatedRoom)
                }
            }
        })

        return () => {
            unsubscribe()
        }
    }, [currentRoom?.id])

    // Subscribe to all room member profile updates (for avatar changes)
    useEffect(() => {
        if (!currentRoom?.id) return

        // We subscribe to all profile changes for now as it's simpler and
        // the list of room members might change. chatService.subscribeToProfileChanges
        // can handle a batch of IDs, but since we want real-time updates for anyone
        // who might send a message, we'll listen for any profile update and refresh our map.
        const unsubscribe = chatService.subscribeToProfileChanges([], async () => {
            await loadMemberAvatars()
            // Also refresh own profile if it changed
            const updatedProfile = await authService.getCurrentProfile()
            if (updatedProfile) {
                setProfile(updatedProfile as Profile)
            }
        })

        return () => {
            unsubscribe()
        }
    }, [currentRoom?.id, loadMemberAvatars])

    const handleProfilePhotoClick = () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (file) {
                setPendingImage(file)
                setIsCropModalOpen(true)
            }
        }
        input.click()
    }

    const handlePhotoCropped = async (blob: Blob) => {
        if (!profile?.id) return

        try {
            await storageService.uploadProfilePhoto(profile.id, blob)
            setIsCropModalOpen(false)
            setPendingImage(null)
            // Profile will update via realtime subscription
        } catch (err: any) {
            console.error('Failed to upload profile photo:', err)
            alert('Failed to upload photo: ' + err.message)
        }
    }

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
        <div className="w-full h-full flex flex-col">
            {/* Top Bar */}
            <div className="w-full px-8 py-6 flex items-center justify-between bg-black/20 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-semibold tracking-tight text-white font-heading">Digital <span className="text-zinc-500">Tambayan</span></h1>
                </div>
                <div className="flex items-center gap-4">
                    <div
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 cursor-pointer hover:bg-white/10 transition-colors group"
                        onClick={handleProfilePhotoClick}
                        title="Change profile photo"
                    >
                        {profile?.avatar_url ? (
                            <img
                                src={profile.avatar_url}
                                alt={profile.username}
                                className="w-5 h-5 rounded-full object-cover ring-1 ring-blue-500/50"
                            />
                        ) : (
                            <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] text-white font-bold ring-1 ring-blue-500/50">
                                {profile?.username?.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <span className="text-sm font-medium text-blue-400 group-hover:text-blue-300 transition-colors">{profile?.username}</span>
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
                        lastReadMessageId={lastReadMessageId}
                        onMarkAsRead={handleRoomSelectWithRead}
                        currentUsername={profile.username}
                    />
                )}

                {/* Chat Area */}
                <div className="flex-1 flex flex-col bg-white/[0.01]">
                    {currentRoom ? (
                        <>
                            {/* Chat Header */}
                            <div className="flex items-center justify-between px-8 py-6">
                                <div className="flex items-center space-x-4">
                                    {(() => {
                                        // For personal chats, try to show the partner's avatar
                                        const headerAvatarUrl = currentRoom.photo_url
                                            || (currentRoom.is_personal
                                                ? Object.entries(roomAvatars).find(([uid]) => uid !== profile?.id)?.[1]
                                                : undefined);

                                        return headerAvatarUrl ? (
                                            <img
                                                src={headerAvatarUrl}
                                                alt={roomDisplayName}
                                                className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10"
                                            />
                                        ) : (
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ring-2 ring-white/10 ${currentRoom.is_personal ? 'bg-blue-600' : 'bg-purple-600'}`}>
                                                {roomDisplayName.charAt(0).toUpperCase()}
                                            </div>
                                        );
                                    })()}
                                    <h2
                                        className="text-xl font-medium text-white tracking-tight cursor-pointer hover:text-zinc-400 transition-colors font-heading"
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
                            <div className="flex-1 overflow-hidden p-6 min-h-0">
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
                                        nicknames={nicknames}
                                        avatars={roomAvatars}
                                    />
                                )}
                            </div>

                            {/* Input */}
                            <div className="px-6 pb-6">
                                <ChatInput
                                    onSend={(content) => handleSendMessage(profile?.id || null, profile?.username || 'Guest', content)}
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
            {
                isSettingsOpen && (
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
                )
            }

            {/* Members List Panel */}
            {
                profile && (
                    <MembersList
                        room={currentRoom}
                        currentUserId={profile.id}
                        isOpen={isMembersOpen}
                        onClose={() => setIsMembersOpen(false)}
                        onRoomLeft={handleRoomLeft}
                        onMemberChange={handleMemberChange}
                        onRoomNameChange={handleRoomNameChange}
                        onNicknameChange={handleNicknameChange}
                    />
                )
            }
            {/* Image Crop Modal */}
            {
                isCropModalOpen && pendingImage && (
                    <ImageCropModal
                        imageFile={pendingImage}
                        onCrop={handlePhotoCropped}
                        onClose={() => {
                            setIsCropModalOpen(false)
                            setPendingImage(null)
                        }}
                    />
                )
            }
        </div >
    )
}

