'use client'

import { RoomWithMeta, Profile } from '@/types/database'
import { chatService } from '@/lib/chatService'
import { adminService } from '@/lib/adminService'
import { supabase } from '@/utils/supabase/client'
import { useEffect, useState, useCallback } from 'react'
import CreateGroupModal from './CreateGroupModal'
import { UI_STRINGS } from '@/config/uiStrings'

interface RoomSidebarProps {
    currentUserId: string
    currentRoomId: string | null
    onRoomSelect: (roomId: string) => void
    onUserProfileClick: (user: Profile) => void
    lastReadMessageId?: Record<string, number>
    onMarkAsRead?: (roomId: string, lastMessageId: number) => void
    currentUsername?: string
}

export default function RoomSidebar({
    currentUserId,
    currentRoomId,
    onRoomSelect,
    onUserProfileClick,
    lastReadMessageId = {},
    onMarkAsRead,
    currentUsername
}: RoomSidebarProps) {
    const [rooms, setRooms] = useState<RoomWithMeta[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false)
    const [displayNames, setDisplayNames] = useState<Record<string, string>>({})
    const [users, setUsers] = useState<Profile[]>([])
    const [loadingUsers, setLoadingUsers] = useState(false)
    const [personalChatUserIds, setPersonalChatUserIds] = useState<Set<string>>(new Set())

    // Check if a room has unread messages
    // Unread if: has last message AND last message timestamp > last read timestamp
    const isRoomUnread = (room: RoomWithMeta): boolean => {
        if (!room.last_message_at) return false

        // Don't show unread for our own messages
        if (room.last_message_sender === currentUsername) {
            return false
        }

        const lastRead = lastReadMessageId[room.id]
        if (!lastRead) {
            // Never visited - show as unread if there's any message
            return true
        }

        // Compare timestamps
        const messageTime = new Date(room.last_message_at).getTime()
        // If message is newer than last read (give 1s buffer for precision)
        return messageTime > (lastRead + 1000)
    }

    // Handle room click - select and mark as read
    const handleRoomClick = (room: RoomWithMeta) => {
        // Call the original onRoomSelect
        onRoomSelect(room.id)
        // Mark as read if there's a last message
        if (onMarkAsRead && room.last_message_at) {
            const messageTime = new Date(room.last_message_at).getTime()
            onMarkAsRead(room.id, messageTime)
        }
    }

    const loadRooms = useCallback(async () => {
        try {
            const userRooms = await chatService.getUserRooms(currentUserId)
            setRooms(userRooms)

            // Display names are now pre-calculated by the database function get_user_rooms
            const names: Record<string, string> = {}
            userRooms.forEach(room => {
                names[room.id] = room.display_name || room.name || UI_STRINGS.sidebar.unnamedGroup
            })
            setDisplayNames(names)

            // Get the other user IDs from personal chats for search filtering
            const personalChats = userRooms.filter(r => r.is_personal)
            const otherUserIds = new Set<string>()

            // Find all users to map usernames to IDs for filtering search results
            const allUsers = await adminService.getAllUsersForSearch()
            const usernameToId: Record<string, string> = {}
            allUsers.forEach(u => {
                usernameToId[u.username.toLowerCase()] = u.id
            })

            for (const chat of personalChats) {
                // Since displayNames[chat.id] is now the other user's name (or nickname)
                // in personal chats, we use it to exclude them from the search results
                const otherUserName = names[chat.id]?.toLowerCase()
                if (otherUserName && usernameToId[otherUserName]) {
                    otherUserIds.add(usernameToId[otherUserName])
                }
            }
            setPersonalChatUserIds(otherUserIds)
        } catch (err) {
            console.error('Failed to load rooms:', err)
        } finally {
            setLoading(false)
        }
    }, [currentUserId])

    // Load users for search
    const loadUsers = useCallback(async () => {
        if (!currentUserId) return
        setLoadingUsers(true)
        try {
            const allUsers = await adminService.getAllUsersForSearch()
            // Filter out current user
            setUsers(allUsers.filter(u => u.id !== currentUserId))
        } catch (err) {
            console.error('Failed to load users:', err)
        } finally {
            setLoadingUsers(false)
        }
    }, [currentUserId])

    // Handle user selection to create/open direct message
    const handleUserSelect = async (user: Profile) => {
        try {
            const room = await chatService.getOrCreatePersonalChat(currentUserId, user.id)
            loadRooms() // Refresh rooms to show the new personal chat
            onRoomSelect(room.id)
            setSearchQuery('') // Clear search after selection
        } catch (err) {
            console.error('Failed to create personal chat:', err)
        }
    }

    useEffect(() => {
        loadRooms()
        loadUsers()

        // Subscribe to room changes
        const unsubscribeRooms = chatService.subscribeToUserRooms(currentUserId, loadRooms)
        const unsubscribeRoomDeletions = chatService.subscribeToRoomDeletions(currentUserId, loadRooms)
        const unsubscribeMemberships = chatService.subscribeToRoomMemberships(currentUserId, loadRooms)

        return () => {
            unsubscribeRooms()
            unsubscribeRoomDeletions()
            unsubscribeMemberships()
        }
    }, [currentUserId, loadRooms, loadUsers])

    // Subscribe to room updates (for group photo changes) and profile updates (for DM avatars)
    useEffect(() => {
        if (rooms.length === 0) return

        const roomIds = rooms.map(r => r.id)

        // Use sidebar-specific channel names to avoid collision with Dashboard subscriptions
        const roomHash = roomIds.length > 3 ? `sidebar_batch:${roomIds.length}` : `sidebar_${roomIds.join('-')}`
        const roomChannel = supabase
            .channel(`sidebar_room_updates:${roomHash}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'rooms',
                },
                (payload: any) => {
                    if (roomIds.includes(payload.new.id)) {
                        loadRooms()
                    }
                }
            )
            .subscribe()

        // Subscribe to ALL profile updates so that when a DM partner changes their avatar,
        // the sidebar reloads and shows the new photo (via the get_user_rooms RPC)
        const hasPersonalChats = rooms.some(r => r.is_personal)
        let profileChannel: any = null
        if (hasPersonalChats) {
            profileChannel = supabase
                .channel(`sidebar_profile_updates:${currentUserId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'profiles',
                    },
                    () => {
                        loadRooms()
                    }
                )
                .subscribe()
        }

        return () => {
            supabase.removeChannel(roomChannel)
            if (profileChannel) supabase.removeChannel(profileChannel)
        }
    }, [rooms.length, loadRooms, currentUserId])

    // Subscribe to messages for all rooms to update last message info
    useEffect(() => {
        if (rooms.length === 0) return

        const roomIds = rooms.map(room => room.id)
        const unsubscribeMessages = chatService.subscribeToMessagesForRooms(roomIds, loadRooms)
        const unsubscribeDeletes = chatService.subscribeToMessageDeletionsForRooms(roomIds, loadRooms)

        return () => {
            unsubscribeMessages()
            unsubscribeDeletes()
        }
    }, [rooms, loadRooms])

    // Filter rooms based on search query
    const filteredRooms = rooms.filter(room => {
        const displayName = displayNames[room.id] || room.name || UI_STRINGS.sidebar.unnamedGroup
        return displayName.toLowerCase().includes(searchQuery.toLowerCase())
    })

    // Filter users based on search query - exclude users we already have personal chats with
    const filteredUsers = searchQuery.trim()
        ? users.filter(user =>
            user.username.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !personalChatUserIds.has(user.id)
        )
        : []

    // Separate personal and group chats
    const personalChats = filteredRooms.filter(r => r.is_personal)
    const groupChats = filteredRooms.filter(r => !r.is_personal)

    // Check if we're in search mode
    const isSearching = searchQuery.trim().length > 0

    const handleGroupCreated = (roomId: string) => {
        setIsCreateGroupOpen(false)
        loadRooms()
        onRoomSelect(roomId)
    }

    const formatLastMessage = (date: string | null) => {
        if (!date) return ''

        const messageDate = new Date(date)
        const now = new Date()
        const diffMs = now.getTime() - messageDate.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMins / 60)
        const diffDays = Math.floor(diffHours / 24)

        if (diffMins < 1) return 'now'
        if (diffMins < 60) return `${diffMins}m`
        if (diffHours < 24) return `${diffHours}h`
        if (diffDays < 7) return `${diffDays}d`

        return messageDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    return (
        <>
            <div className="w-72 h-full bg-black/10 flex flex-col transition-all duration-300">
                {/* Header */}
                <div className="px-8 py-8 space-y-6">
                    <h2 className="text-2xl font-semibold tracking-tight text-white font-heading">{UI_STRINGS.sidebar.messages}</h2>

                    {/* Search */}
                    <div className="relative group">
                        <input
                            type="text"
                            placeholder={UI_STRINGS.sidebar.searchPlaceholder}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={loadUsers} // Load users when user starts searching
                            className="w-full bg-white/[0.03] border-none rounded-md py-2.5 px-4 pl-10 text-xs text-white placeholder-zinc-600 focus:bg-white/[0.06] focus:ring-1 focus:ring-zinc-800 outline-none transition-all"
                        />
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 text-zinc-700 absolute left-3 top-1/2 -translate-y-1/2"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {/* Room List */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                        </div>
                    ) : (
                        <>
                            {/* Search Results - Users */}
                            {isSearching && filteredUsers.length > 0 && (
                                <div className="mb-2">
                                    <div className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                        {UI_STRINGS.sidebar.users}
                                    </div>
                                    {filteredUsers.map((user) => (
                                        <button
                                            key={user.id}
                                            onClick={() => handleUserSelect(user)}
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                                        >
                                            {/* Avatar */}
                                            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium shrink-0">
                                                {user.username.charAt(0).toUpperCase()}
                                            </div>

                                            {/* User Info */}
                                            <div className="flex-1 min-w-0 text-left">
                                                <p className="text-sm font-medium text-white truncate">
                                                    {user.username}
                                                </p>
                                                <p className="text-xs text-blue-500 truncate mt-0.5">
                                                    {UI_STRINGS.sidebar.startConversation}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Personal Chats Section */}
                            {(!isSearching || personalChats.length > 0) && (
                                <div className="mb-2">
                                    <div className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                        {UI_STRINGS.sidebar.directMessages}
                                    </div>
                                    {personalChats.map((room) => {
                                        const isUnread = isRoomUnread(room);
                                        return (
                                            <button
                                                key={room.id}
                                                onClick={() => handleRoomClick(room)}
                                                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors ${currentRoomId === room.id ? 'bg-white/10' : ''
                                                    }`}
                                            >
                                                {/* Avatar */}
                                                <div className="relative">
                                                    {room.photo_url ? (
                                                        <img
                                                            src={room.photo_url}
                                                            alt={displayNames[room.id] || room.name || ''}
                                                            className="w-10 h-10 rounded-full object-cover ring-2 ring-white/5"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium shrink-0 ring-2 ring-white/5">
                                                            {(displayNames[room.id] || '?').charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    {isUnread && (
                                                        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-zinc-950" />
                                                    )}
                                                </div>

                                                {/* Room Info */}
                                                <div className="flex-1 min-w-0 text-left">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className={`text-sm font-medium text-white truncate ${isUnread ? 'font-bold' : ''}`}>
                                                            {displayNames[room.id] || UI_STRINGS.common.loading}
                                                        </p>
                                                        <div className="flex items-center gap-1">
                                                            {room.last_message_at && (
                                                                <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                                                                    {formatLastMessage(room.last_message_at)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <p className={`text-xs text-zinc-500 truncate mt-0.5 ${isUnread ? 'font-bold text-zinc-300' : ''}`}>
                                                        {room.last_message_content ? (
                                                            <>
                                                                <span className="text-zinc-400">{room.last_message_sender}: </span>
                                                                {room.last_message_content}
                                                            </>
                                                        ) : (
                                                            UI_STRINGS.sidebar.noMessagesPreview
                                                        )}
                                                    </p>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Group Chats Section */}
                            {(!isSearching || groupChats.length > 0) && (
                                <div className="mb-2">
                                    <div className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                        {UI_STRINGS.sidebar.groupChats}
                                    </div>
                                    {groupChats.map((room) => {
                                        const isUnread = isRoomUnread(room);
                                        return (
                                            <button
                                                key={room.id}
                                                onClick={() => handleRoomClick(room)}
                                                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors ${currentRoomId === room.id ? 'bg-white/10' : ''
                                                    }`}
                                            >
                                                {/* Avatar */}
                                                <div className="relative">
                                                    {room.photo_url ? (
                                                        <img
                                                            src={room.photo_url}
                                                            alt={room.name}
                                                            className="w-10 h-10 rounded-lg object-cover ring-2 ring-white/5"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center text-white font-medium shrink-0 ring-2 ring-white/5">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3.005 3.005 0 013.75-2.906z" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                    {isUnread && (
                                                        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-zinc-950" />
                                                    )}
                                                </div>

                                                {/* Room Info */}
                                                <div className="flex-1 min-w-0 text-left">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className={`text-sm font-medium text-white truncate ${isUnread ? 'font-bold' : ''}`}>
                                                            {displayNames[room.id] || room.name || UI_STRINGS.sidebar.unnamedGroup}
                                                        </p>
                                                        <div className="flex items-center gap-1">
                                                            {room.last_message_at && (
                                                                <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                                                                    {formatLastMessage(room.last_message_at)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <p className={`text-xs text-zinc-500 truncate mt-0.5 ${isUnread ? 'font-bold text-zinc-300' : ''}`}>
                                                        {room.last_message_content ? (
                                                            <>
                                                                <span className="text-zinc-400">{room.last_message_sender}: </span>
                                                                {room.last_message_content}
                                                            </>
                                                        ) : (
                                                            UI_STRINGS.sidebar.noMessagesPreview
                                                        )}
                                                    </p>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Empty State */}
                            {!isSearching && personalChats.length === 0 && groupChats.length === 0 && (
                                <div className="text-center py-8 px-4">
                                    <p className="text-sm text-zinc-500">{UI_STRINGS.sidebar.noConversations}</p>
                                    <p className="text-xs text-zinc-600 mt-1">{UI_STRINGS.sidebar.noConversationsHint}</p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Create Group Button */}
                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={() => setIsCreateGroupOpen(true)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        {UI_STRINGS.sidebar.createGroup}
                    </button>
                </div>
            </div>

            {/* Create Group Modal */}
            {isCreateGroupOpen && (
                <CreateGroupModal
                    currentUserId={currentUserId}
                    onClose={() => setIsCreateGroupOpen(false)}
                    onGroupCreated={handleGroupCreated}
                />
            )}
        </>
    )
}
