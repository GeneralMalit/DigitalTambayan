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

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="text-zinc-500 animate-pulse">Loading rooms...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Error Display */}
            {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                    {error}
                </div>
            )}

            {/* Create Room Form */}
            <form onSubmit={handleCreateRoom} className="space-y-3">
                <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                    {UI_STRINGS.admin.addNewRoom}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                    <input
                        type="text"
                        value={newRoomSlug}
                        onChange={(e) => setNewRoomSlug(e.target.value)}
                        placeholder="Room slug (e.g., random)"
                        className="rounded-lg bg-white/5 border-white/10 py-2 px-3 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none placeholder-zinc-600"
                        disabled={creating}
                    />
                    <input
                        type="text"
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        placeholder="Room name (e.g., Random)"
                        className="rounded-lg bg-white/5 border-white/10 py-2 px-3 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none placeholder-zinc-600"
                        disabled={creating}
                    />
                </div>
                <button
                    type="submit"
                    disabled={creating || !newRoomSlug.trim() || !newRoomName.trim()}
                    className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {creating ? UI_STRINGS.admin.creating : UI_STRINGS.admin.createRoom}
                </button>
            </form>

            {/* Room List */}
            <div className="space-y-3">
                <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                    {UI_STRINGS.admin.allRooms(rooms.length)}
                </h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {rooms.length === 0 ? (
                        <div className="text-zinc-500 text-sm text-center py-4">{UI_STRINGS.admin.noRooms}</div>
                    ) : (
                        rooms.map((room) => (
                            <div
                                key={room.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5"
                            >
                                <div className="flex flex-col">
                                    <span className="text-white font-medium">{room.name}</span>
                                    <span className="text-zinc-500 text-xs">/{room.slug}</span>
                                </div>
                                <button
                                    onClick={() => handleDeleteMessages(room)}
                                    disabled={deleting === room.id}
                                    className="text-xs px-3 py-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 transition-colors disabled:opacity-50"
                                >
                                    {deleting === room.id ? UI_STRINGS.admin.deleting : UI_STRINGS.admin.clearMessages}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
