'use client'

import { useState, useEffect } from 'react'
import { adminService } from '@/lib/adminService'
import { Profile } from '@/types/database'

interface UserManagerProps {
    currentUserId?: string
    onRefresh?: () => void
}

export default function UserManager({ currentUserId, onRefresh }: UserManagerProps) {
    const [users, setUsers] = useState<Profile[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [deleting, setDeleting] = useState<string | null>(null)

    useEffect(() => {
        loadUsers()
    }, [])

    const loadUsers = async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await adminService.getAllUsers()
            setUsers(data)
        } catch (err: any) {
            setError(err.message || 'Failed to load users')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteUser = async (user: Profile) => {
        if (!confirm(`Are you sure you want to delete user "${user.username}"? This will remove both their profile AND auth account. This action cannot be undone.`)) {
            return
        }

        // Double confirmation for extra safety
        if (!confirm(`Really delete "${user.username}"? This is permanent!`)) {
            return
        }

        setDeleting(user.id)
        setError(null)
        try {
            await adminService.deleteUser(user.id)
            await loadUsers()
            onRefresh?.()
        } catch (err: any) {
            setError(err.message || 'Failed to delete user')
        } finally {
            setDeleting(null)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="text-zinc-500 animate-pulse">Loading users...</div>
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

            {/* User List */}
            <div className="space-y-3">
                <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                    All Users ({users.length})
                </h4>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {users.length === 0 ? (
                        <div className="text-zinc-500 text-sm text-center py-4">No users found</div>
                    ) : (
                        users.map((user) => (
                            <div
                                key={user.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5"
                            >
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="text-white font-medium">{user.username}</span>
                                        {user.is_admin && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-semibold uppercase tracking-wider">
                                                Admin
                                            </span>
                                        )}
                                        {user.id === currentUserId && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-semibold uppercase tracking-wider">
                                                You
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-zinc-500 text-xs">{user.id}</span>
                                </div>
                                <button
                                    onClick={() => handleDeleteUser(user)}
                                    disabled={deleting === user.id || user.id === currentUserId}
                                    className="text-xs px-3 py-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    title={user.id === currentUserId ? "Cannot delete yourself" : "Delete user"}
                                >
                                    {deleting === user.id ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
