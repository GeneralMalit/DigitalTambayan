'use client'

import { useState, useEffect } from 'react'
import { adminService } from '@/lib/adminService'
import { Room } from '@/types/database'
import { UI_STRINGS } from '@/config/uiStrings'

interface RoomManagerProps {
    currentUserId?: string
    onRefresh?: () => void
    onMessagesCleared?: () => void
}

export default function RoomManager({ currentUserId, onRefresh, onMessagesCleared }: RoomManagerProps) {
    const [rooms, setRooms] = useState<Room[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [newRoomSlug, setNewRoomSlug] = useState('')
    const [newRoomName, setNewRoomName] = useState('')
    const [creating, setCreating] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [deletingGroup, setDeletingGroup] = useState<string | null>(null)

    useEffect(() => {
        loadRooms()
    }, [])

    const loadRooms = async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await adminService.getAllRooms()
            setRooms(data)
        } catch (err: any) {
            setError(err.message || 'Failed to load rooms')
        } finally {
            setLoading(false)
        }
    }

    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newRoomSlug.trim() || !newRoomName.trim()) return

        setCreating(true)
        setError(null)
        try {
            await adminService.createRoom(newRoomSlug, newRoomName, currentUserId || '')
            setNewRoomSlug('')
            setNewRoomName('')
            await loadRooms()
            onRefresh?.()
        } catch (err: any) {
            setError(err.message || 'Failed to create room')
        } finally {
            setCreating(false)
        }
    }

    const handleDeleteMessages = async (room: Room) => {
        if (!confirm(UI_STRINGS.admin.deleteRoomConfirm(room.name))) return

        setDeleting(room.id)
        setError(null)
        try {
            await adminService.deleteAllMessages(room.id)
            await loadRooms()
            onMessagesCleared?.()
        } catch (err: any) {
            setError(err.message || 'Failed to delete messages')
        } finally {
            setDeleting(null)
        }
    }

    const handleDeleteGroup = async (room: Room) => {
        if (!confirm(UI_STRINGS.admin.deleteGroupConfirm(room.name))) return

        setDeletingGroup(room.id)
        setError(null)
        try {
            await adminService.deleteGroupChatAsAdmin(room.id)
            await loadRooms()
            onRefresh?.()
        } catch (err: any) {
            setError(err.message || 'Failed to delete group')
        } finally {
            setDeletingGroup(null)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="text-stone-500 animate-pulse">Loading rooms...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Error Display */}
            {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                    {error}
                </div>
            )}

            {/* Create Room Form */}
            <form onSubmit={handleCreateRoom} className="space-y-3">
                <h4 className="text-sm font-semibold text-stone-600 uppercase tracking-wider">
                    {UI_STRINGS.admin.addNewRoom}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                    <input
                        type="text"
                        value={newRoomSlug}
                        onChange={(e) => setNewRoomSlug(e.target.value)}
                        placeholder="Room slug (e.g., random)"
                        className="rounded-lg bg-white border border-stone-200 py-2 px-3 text-stone-950 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder-stone-400 disabled:bg-stone-50 disabled:text-stone-400"
                        disabled={creating}
                    />
                    <input
                        type="text"
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        placeholder="Room name (e.g., Random)"
                        className="rounded-lg bg-white border border-stone-200 py-2 px-3 text-stone-950 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder-stone-400 disabled:bg-stone-50 disabled:text-stone-400"
                        disabled={creating}
                    />
                </div>
                <button
                    type="submit"
                    disabled={creating || !newRoomSlug.trim() || !newRoomName.trim()}
                    className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {creating ? UI_STRINGS.admin.creating : UI_STRINGS.admin.createRoom}
                </button>
            </form>

            {/* Room List */}
            <div className="space-y-3">
                <h4 className="text-sm font-semibold text-stone-600 uppercase tracking-wider">
                    {UI_STRINGS.admin.allRooms(rooms.length)}
                </h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {rooms.length === 0 ? (
                        <div className="text-stone-500 text-sm text-center py-4">{UI_STRINGS.admin.noRooms}</div>
                    ) : (
                        rooms.map((room) => (
                            <div
                                key={room.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-white border border-stone-200"
                            >
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="text-stone-950 font-medium">{room.name || (room.is_personal ? UI_STRINGS.admin.personalChatLabel : UI_STRINGS.sidebar.unnamedGroup)}</span>
                                        {room.is_personal && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-100">
                                                {UI_STRINGS.admin.personalChatLabel}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-stone-500 text-xs">/{room.slug || 'dm'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleDeleteMessages(room)}
                                        disabled={deleting === room.id || deletingGroup === room.id}
                                        className="text-xs px-3 py-1.5 rounded bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
                                    >
                                        {deleting === room.id ? UI_STRINGS.admin.deleting : UI_STRINGS.admin.clearMessages}
                                    </button>
                                    {!room.slug && !room.is_personal && (
                                        <button
                                            onClick={() => handleDeleteGroup(room)}
                                            disabled={deleting === room.id || deletingGroup === room.id}
                                            className="text-xs px-3 py-1.5 rounded bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors disabled:opacity-50"
                                        >
                                            {deletingGroup === room.id ? UI_STRINGS.admin.deleting : UI_STRINGS.admin.deleteGroup}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
