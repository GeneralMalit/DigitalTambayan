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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/45 backdrop-blur-sm transition-all duration-300">
            <div className="w-full max-w-md rounded-lg bg-white shadow-lg overflow-hidden ring-1 ring-stone-200">
                {/* Header */}
                <div className="flex items-center justify-between p-8">
                    <h3 className="text-xl font-medium text-stone-950 font-heading">Create group chat</h3>
                    <button
                        onClick={onClose}
                        className="p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {error && (
                        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Group Name Input */}
                    <div className="px-8 space-y-2">
                        <label className="block text-[10px] font-medium text-stone-500 uppercase tracking-widest">
                            Group name (optional)
                        </label>
                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Enter group name..."
                            className="w-full bg-stone-50 border border-stone-200 rounded-md py-2.5 px-4 text-xs text-stone-950 placeholder-stone-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        />
                    </div>

                    {/* Member Selection */}
                    <div className="px-8 pb-8 space-y-6">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-medium text-stone-500 uppercase tracking-widest">
                                Select members
                            </label>

                            {/* Search */}
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search users..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-stone-50 border border-stone-200 rounded-md py-2.5 px-4 pl-10 text-xs text-stone-950 placeholder-stone-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                />
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                        </div>

                        {/* User List */}
                        <div className="max-h-48 overflow-y-auto bg-stone-50 rounded-md border border-stone-200 custom-scrollbar">
                            {filteredUsers.length === 0 ? (
                                <div className="p-4 text-center text-stone-500 text-sm">
                                    No users found
                                </div>
                            ) : (
                                filteredUsers.map((user) => (
                                    <button
                                        key={user.id}
                                        onClick={() => toggleUserSelection(user.id)}
                                        className={`w-full flex items-center gap-3 p-3 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset transition-colors ${selectedUsers.includes(user.id) ? 'bg-blue-50' : ''
                                            }`}
                                    >
                                        {/* Checkbox */}
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedUsers.includes(user.id)
                                            ? 'bg-blue-600 border-blue-600'
                                            : 'border-stone-300 bg-white'
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
                                        <span className="text-sm text-stone-800">{user.username}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Selected Count */}
                    {selectedUsers.length > 0 && (
                        <p className="px-8 text-sm text-stone-500">
                            {selectedUsers.length} member{selectedUsers.length !== 1 ? 's' : ''} selected
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-8 pt-4">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-md bg-white hover:bg-stone-50 text-stone-700 font-medium text-sm border border-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={loading || selectedUsers.length === 0}
                        className="flex-1 py-3 rounded-md bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300"
                    >
                        {loading ? 'Creating...' : 'Create group'}
                    </button>
                </div>
            </div>
        </div>
    )
}
