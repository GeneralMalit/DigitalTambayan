'use client'

import { Profile } from '@/types/database'
import { adminService } from '@/lib/adminService'
import { chatService } from '@/lib/chatService'
import { useEffect, useState } from 'react'

interface CreateGroupModalProps {
    currentUserId: string
    onClose: () => void
    onGroupCreated: (roomId: string) => void
}

export default function CreateGroupModal({
    currentUserId,
    onClose,
    onGroupCreated
}: CreateGroupModalProps) {
    const [groupName, setGroupName] = useState('')
    const [users, setUsers] = useState<Profile[]>([])
    const [selectedUsers, setSelectedUsers] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        loadUsers()
    }, [])

    const loadUsers = async () => {
        try {
            const allUsers = await adminService.getAllUsersForSearch()
            // Filter out current user
            setUsers(allUsers.filter(u => u.id !== currentUserId))
        } catch (err) {
            console.error('Failed to load users:', err)
        }
    }

    const toggleUserSelection = (userId: string) => {
        setSelectedUsers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        )
    }

    const handleCreate = async () => {
        if (selectedUsers.length === 0) {
            setError('Please select at least one member')
            return
        }

        setLoading(true)
        setError(null)

        try {
            const room = await chatService.createGroupChat(
                groupName.trim() || null,
                selectedUsers,
                currentUserId
            )

            onGroupCreated(room.id)
        } catch (err: any) {
            console.error('Failed to create group:', err)
            setError(err.message || 'Failed to create group')
        } finally {
            setLoading(false)
        }
    }

    // Filter users based on search query
    const filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h3 className="text-lg font-semibold text-white">Create Group Chat</h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-zinc-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Group Name Input */}
                    <div>
                        <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                            Group Name (optional)
                        </label>
                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Enter group name..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-4 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Member Selection */}
                    <div>
                        <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                            Select Members
                        </label>

                        {/* Search */}
                        <div className="relative mb-3">
                            <input
                                type="text"
                                placeholder="Search users..."
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

                        {/* User List */}
                        <div className="max-h-48 overflow-y-auto border border-white/10 rounded-lg">
                            {filteredUsers.length === 0 ? (
                                <div className="p-4 text-center text-zinc-500 text-sm">
                                    No users found
                                </div>
                            ) : (
                                filteredUsers.map((user) => (
                                    <button
                                        key={user.id}
                                        onClick={() => toggleUserSelection(user.id)}
                                        className={`w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors ${selectedUsers.includes(user.id) ? 'bg-blue-500/10' : ''
                                            }`}
                                    >
                                        {/* Checkbox */}
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedUsers.includes(user.id)
                                                ? 'bg-blue-600 border-blue-600'
                                                : 'border-zinc-600'
                                            }`}>
                                            {selectedUsers.includes(user.id) && (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </div>

                                        {/* Avatar */}
                                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                                            {user.username.charAt(0).toUpperCase()}
                                        </div>

                                        {/* Username */}
                                        <span className="text-sm text-white">{user.username}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Selected Count */}
                    {selectedUsers.length > 0 && (
                        <p className="text-sm text-zinc-400">
                            {selectedUsers.length} member{selectedUsers.length !== 1 ? 's' : ''} selected
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-4 border-t border-white/10">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={loading || selectedUsers.length === 0}
                        className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Creating...' : 'Create Group'}
                    </button>
                </div>
            </div>
        </div>
    )
}