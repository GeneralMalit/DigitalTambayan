'use client'

import { RoomWithMeta, Profile } from '@/types/database'
import { chatService } from '@/lib/chatService'
import { adminService } from '@/lib/adminService'
import { useEffect, useState, useCallback } from 'react'
import CreateGroupModal from './CreateGroupModal'
import { UI_STRINGS } from '@/config/uiStrings'

interface RoomSidebarProps {
    currentUserId: string
    currentRoomId: string | null
    onRoomSelect: (roomId: string) => void
    onUserProfileClick: (user: Profile) => void
}

export default function RoomSidebar({
    currentUserId,
    currentRoomId,
    onRoomSelect,
    onUserProfileClick
}: RoomSidebarProps) {
    const [rooms, setRooms] = useState<RoomWithMeta[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false)
    const [displayNames, setDisplayNames] = useState<Record<string, string>>({})

    const loadRooms = useCallback(async () => {
        try {
            const userRooms = await chatService.getUserRooms(currentUserId)
            setRooms(userRooms)

            // Load display names for all rooms in parallel using Promise.all
            const namePromises = userRooms.map(room =>
                chatService.getRoomDisplayName(room.id, currentUserId)
                    .then(name => ({ id: room.id, name }))
                    .catch(() => ({ id: room.id, name: room.name || UI_STRINGS.sidebar.unnamedGroup }))
            )
            const nameResults = await Promise.all(namePromises)
            const names: Record<string, string> = {}
            for (const result of nameResults) {
                names[result.id] = result.name
            }
            setDisplayNames(names)
        } catch (err) {
            console.error('Failed to load rooms:', err)
        } finally {
            setLoading(false)
        }
    }, [currentUserId])

    useEffect(() => {
        loadRooms()

        // Subscribe to room changes
        const unsubscribeRooms = chatService.subscribeToUserRooms(currentUserId, loadRooms)

        return () => {
            unsubscribeRooms()
        }
    }, [currentUserId, loadRooms])

    // Subscribe to messages for all rooms to update last message info
    useEffect(() => {
        if (rooms.length === 0) return

        const roomIds = rooms.map(room => room.id)
        const unsubscribeMessages = chatService.subscribeToMessagesForRooms(roomIds, loadRooms)

        return () => {
            unsubscribeMessages()
        }
    }, [rooms, loadRooms])

    // Filter rooms based on search query
    const filteredRooms = rooms.filter(room => {
        const displayName = displayNames[room.id] || room.name || UI_STRINGS.sidebar.unnamedGroup
        return displayName.toLowerCase().includes(searchQuery.toLowerCase())
    })

    // Separate personal and group chats
    const personalChats = filteredRooms.filter(r => r.is_personal)
    const groupChats = filteredRooms.filter(r => !r.is_personal)

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
            <div className="w-64 h-full bg-zinc-900 border-r border-white/10 flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-white/10">
                    <h2 className="text-lg font-semibold text-white mb-3">{UI_STRINGS.sidebar.messages}</h2>

                    {/* Search */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder={UI_STRINGS.sidebar.searchPlaceholder}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 pl-9 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2"
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
                            {/* Personal Chats Section */}
                            {personalChats.length > 0 && (
                                <div className="mb-2">
                                    <div className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                        {UI_STRINGS.sidebar.directMessages}
                                    </div>
                                    {personalChats.map((room) => (
                                        <button
                                            key={room.id}
                                            onClick={() => onRoomSelect(room.id)}
                                            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors ${currentRoomId === room.id ? 'bg-white/10' : ''
                                                }`}
                                        >
                                            {/* Avatar */}
                                            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium shrink-0">
                                                {(displayNames[room.id] || '?').charAt(0).toUpperCase()}
                                            </div>

                                            {/* Room Info */}
                                            <div className="flex-1 min-w-0 text-left">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-sm font-medium text-white truncate">
                                                        {displayNames[room.id] || UI_STRINGS.common.loading}
                                                    </p>
                                                    {room.last_message_at && (
                                                        <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                                                            {formatLastMessage(room.last_message_at)}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-zinc-500 truncate mt-0.5">
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
                                    ))}
                                </div>
                            )}

                            {/* Group Chats Section */}
                            {groupChats.length > 0 && (
                                <div className="mb-2">
                                    <div className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                        {UI_STRINGS.sidebar.groupChats}
                                    </div>
                                    {groupChats.map((room) => (
                                        <button
                                            key={room.id}
                                            onClick={() => onRoomSelect(room.id)}
                                            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors ${currentRoomId === room.id ? 'bg-white/10' : ''
                                                }`}
                                        >
                                            {/* Avatar */}
                                            <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center text-white font-medium shrink-0">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                                </svg>
                                            </div>

                                            {/* Room Info */}
                                            <div className="flex-1 min-w-0 text-left">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-sm font-medium text-white truncate">
                                                        {displayNames[room.id] || room.name || UI_STRINGS.sidebar.unnamedGroup}
                                                    </p>
                                                    {room.last_message_at && (
                                                        <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                                                            {formatLastMessage(room.last_message_at)}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-zinc-500 truncate mt-0.5">
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
                                    ))}
                                </div>
                            )}

                            {/* Empty State */}
                            {personalChats.length === 0 && groupChats.length === 0 && (
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