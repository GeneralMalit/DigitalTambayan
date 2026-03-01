'use client'

import { RoomMemberWithUsername, Profile, Room, RoomMemberNickname } from '@/types/database'
import { adminService } from '@/lib/adminService'
import { chatService } from '@/lib/chatService'
import { UI_STRINGS } from '@/config/uiStrings'
import ImageCropModal from './ImageCropModal'
import { storageService } from '@/lib/storageService'
import { useEffect, useState, useCallback } from 'react'
import UserProfileModal from './UserProfileModal'

interface MembersListProps {
    room: Room | null
    currentUserId: string
    isOpen: boolean
    onClose: () => void
    onRoomLeft: () => void
    onMemberChange: () => void
    onRoomNameChange?: () => void
    onNicknameChange?: () => void
}

export default function MembersList({
    room,
    currentUserId,
    isOpen,
    onClose,
    onRoomLeft,
    onMemberChange,
    onRoomNameChange,
    onNicknameChange
}: MembersListProps) {
    const [members, setMembers] = useState<RoomMemberWithUsername[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
    const [availableUsers, setAvailableUsers] = useState<Profile[]>([])

    // Photo upload state
    const [isCropModalOpen, setIsCropModalOpen] = useState(false)
    const [pendingImage, setPendingImage] = useState<File | null>(null)
    const [uploadingPhoto, setUploadingPhoto] = useState(false)
    const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
    const [actionLoading, setActionLoading] = useState(false)

    // Room name editing state
    const [isEditingName, setIsEditingName] = useState(false)
    const [newRoomName, setNewRoomName] = useState('')
    const [nameEditLoading, setNameEditLoading] = useState(false)

    // Nickname editing state
    const [nicknames, setNicknames] = useState<Record<string, string>>({})
    const [isEditingNicknames, setIsEditingNicknames] = useState(false)
    const [editingNicknameFor, setEditingNicknameFor] = useState<string | null>(null)
    const [nicknameInput, setNicknameInput] = useState('')
    const [nicknameLoading, setNicknameLoading] = useState(false)

    const isPersonalChat = room?.is_personal ?? false
    const isAdmin = currentUserRole === 'owner' || currentUserRole === 'admin'

    useEffect(() => {
        if (isOpen && room) {
            loadMembers()
        }
    }, [isOpen, room])

    const loadMembers = useCallback(async () => {
        if (!room) return

        setLoading(true)
        setError(null)
        try {
            const [membersData, role] = await Promise.all([
                adminService.getRoomMembers(room.id),
                adminService.getUserRoomRole(room.id, currentUserId)
            ])
            setMembers(membersData)
            setCurrentUserRole(role)
        } catch (err: any) {
            console.error('Failed to load members:', err)
            setError(err.message || 'Failed to load members')
        } finally {
            setLoading(false)
        }
    }, [room, currentUserId])

    // Subscribe to real-time member changes when panel is open
    useEffect(() => {
        if (!isOpen || !room) return

        const unsubscribe = chatService.subscribeToRoomMembers(room.id, loadMembers)

        return () => {
            unsubscribe()
        }
    }, [isOpen, room, loadMembers])

    // Load nicknames when panel opens
    const loadNicknames = useCallback(async () => {
        if (!room || !currentUserId) return

        try {
            const data = await adminService.getMemberNicknames(room.id, currentUserId)
            const nicknameMap: Record<string, string> = {}
            data.forEach((n: RoomMemberNickname) => {
                nicknameMap[n.target_user_id] = n.nickname
            })
            setNicknames(nicknameMap)
        } catch (err: any) {
            console.error('Failed to load nicknames:', err)
        }
    }, [room, currentUserId])

    useEffect(() => {
        if (isOpen && room) {
            loadNicknames()
        }
    }, [isOpen, room, loadNicknames])

    // Subscribe to nickname changes
    useEffect(() => {
        if (!isOpen || !room || !currentUserId) return

        const unsubscribe = chatService.subscribeToNicknames(room.id, currentUserId, loadNicknames)

        return () => {
            unsubscribe()
        }
    }, [isOpen, room, currentUserId, loadNicknames])

    const handleLeaveRoom = async () => {
        if (!room) return

        if (!confirm('Are you sure you want to leave this room?')) return

        setActionLoading(true)
        try {
            const result = await chatService.leaveRoom(room.id, currentUserId)

            // Send system message about leaving
            const currentUser = members.find(m => m.user_id === currentUserId)
            if (currentUser && result !== 'room_deleted') {
                await chatService.sendSystemMessage(room.id, `${currentUser.username} left the chat`)
            }

            onRoomLeft()
            onClose()
        } catch (err: any) {
            console.error('Failed to leave room:', err)
            setError(err.message || 'Failed to leave room')
        } finally {
            setActionLoading(false)
        }
    }

    const handleAddMember = async (userId: string) => {
        if (!room) return

        setActionLoading(true)
        try {
            const result = await adminService.addMemberToRoom(room.id, userId, currentUserId)

            if (result === 'success') {
                // Send system message
                const addedUser = availableUsers.find(u => u.id === userId)
                const currentUser = members.find(m => m.user_id === currentUserId)
                if (addedUser && currentUser) {
                    await chatService.sendSystemMessage(room.id, `${addedUser.username} was added by ${currentUser.username}`)
                }

                loadMembers()
                onMemberChange()
                setIsAddMemberOpen(false)
            } else {
                setError(result)
            }
        } catch (err: any) {
            console.error('Failed to add member:', err)
            setError(err.message || 'Failed to add member')
        } finally {
            setActionLoading(false)
        }
    }

    const handleRemoveMember = async (userId: string) => {
        if (!room) return

        const member = members.find(m => m.user_id === userId)
        if (!member) return

        if (!confirm(`Remove ${member.username} from this room?`)) return

        setActionLoading(true)
        try {
            const result = await adminService.removeMemberFromRoom(room.id, userId, currentUserId)

            if (result === 'success') {
                // Send system message
                const currentUser = members.find(m => m.user_id === currentUserId)
                if (currentUser) {
                    await chatService.sendSystemMessage(room.id, `${member.username} was removed by ${currentUser.username}`)
                }

                loadMembers()
                onMemberChange()
            } else {
                setError(result)
            }
        } catch (err: any) {
            console.error('Failed to remove member:', err)
            setError(err.message || 'Failed to remove member')
        } finally {
            setActionLoading(false)
        }
    }

    const handlePromoteToAdmin = async (userId: string) => {
        if (!room) return

        const member = members.find(m => m.user_id === userId)
        if (!member) return

        setActionLoading(true)
        try {
            const result = await adminService.addRoomAdmin(room.id, userId, currentUserId)

            if (result === 'success') {
                // Send system message
                await chatService.sendSystemMessage(room.id, `${member.username} is now an admin`)
                loadMembers()
            } else {
                setError(result)
            }
        } catch (err: any) {
            console.error('Failed to promote member:', err)
            setError(err.message || 'Failed to promote member')
        } finally {
            setActionLoading(false)
        }
    }

    const handleDemoteFromAdmin = async (userId: string) => {
        if (!room) return

        const member = members.find(m => m.user_id === userId)
        if (!member) return

        setActionLoading(true)
        try {
            const result = await adminService.removeRoomAdmin(room.id, userId, currentUserId)

            if (result === 'success') {
                // Send system message
                await chatService.sendSystemMessage(room.id, `${member.username} is no longer an admin`)
                loadMembers()
            } else {
                setError(result)
            }
        } catch (err: any) {
            console.error('Failed to demote admin:', err)
            setError(err.message || 'Failed to demote admin')
        } finally {
            setActionLoading(false)
        }
    }

    const handleDeleteRoom = async () => {
        if (!room) return

        if (!confirm(`Are you sure you want to delete "${room.name || 'this room'}"? This will delete all messages and cannot be undone.`)) return

        setActionLoading(true)
        try {
            await adminService.deleteRoom(room.id, currentUserId)
            onRoomLeft()
            onClose()
        } catch (err: any) {
            console.error('Failed to delete room:', err)
            setError(err.message || 'Failed to delete room')
        } finally {
            setActionLoading(false)
        }
    }

    const openAddMemberModal = async () => {
        if (!room) return

        try {
            const users = await adminService.getAvailableUsersForRoom(room.id)
            setAvailableUsers(users)
            setIsAddMemberOpen(true)
        } catch (err: any) {
            console.error('Failed to load available users:', err)
            setError(err.message || 'Failed to load available users')
        }
    }

    // Room name editing handlers
    const handleStartEditName = () => {
        setNewRoomName(room?.name || '')
        setIsEditingName(true)
    }

    const handleCancelEditName = () => {
        setIsEditingName(false)
        setNewRoomName('')
    }

    const handleSaveRoomName = async () => {
        if (!room) return

        const trimmedName = newRoomName.trim()
        if (!trimmedName) {
            setError('Room name cannot be empty')
            return
        }

        // Don't save if name hasn't changed
        if (trimmedName === room.name) {
            setIsEditingName(false)
            return
        }

        setNameEditLoading(true)
        try {
            const result = await adminService.updateRoomName(room.id, trimmedName, currentUserId)

            if (result === 'success') {
                // Send system message about the name change
                const currentUser = members.find(m => m.user_id === currentUserId)
                if (currentUser) {
                    await chatService.sendSystemMessage(room.id, `Group name changed to "${trimmedName}" by ${currentUser.username}`)
                }

                setIsEditingName(false)
                setNewRoomName('')

                // Notify parent to refresh room display name
                onRoomNameChange?.()
                onMemberChange()
            } else {
                setError(result || 'Failed to update room name')
            }
        } catch (err: any) {
            console.error('Failed to update room name:', err)
            setError(err.message || 'Failed to update room name')
        } finally {
            setNameEditLoading(false)
        }
    }

    const handleNameKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSaveRoomName()
        } else if (e.key === 'Escape') {
            handleCancelEditName()
        }
    }

    // Nickname editing handlers
    const handleStartEditNickname = (userId: string, currentNickname?: string) => {
        setEditingNicknameFor(userId)
        setNicknameInput(currentNickname || '')
    }

    const handleCancelEditNickname = () => {
        setEditingNicknameFor(null)
        setNicknameInput('')
    }

    const handleSaveNickname = async (targetUserId: string) => {
        if (!room || !currentUserId) return

        const trimmedNickname = nicknameInput.trim()
        const oldNickname = nicknames[targetUserId]
        const member = members.find(m => m.user_id === targetUserId)
        const displayName = oldNickname || member?.username || 'Someone'

        if (!trimmedNickname) {
            // Delete nickname if empty
            setNicknameLoading(true)
            try {
                await adminService.deleteMemberNickname(room.id, targetUserId, currentUserId)
                await loadNicknames()
                // Notify parent to refresh
                onNicknameChange?.()
                // Send system message about nickname removal
                await chatService.sendSystemMessage(room.id, `${displayName}'s nickname was removed`)
            } catch (err: any) {
                console.error('Failed to delete nickname:', err)
                setError(err.message || 'Failed to remove nickname')
            } finally {
                setNicknameLoading(false)
                setEditingNicknameFor(null)
                setNicknameInput('')
            }
            return
        }

        // Only send system message if nickname actually changed
        if (trimmedNickname === oldNickname) {
            setEditingNicknameFor(null)
            setNicknameInput('')
            return
        }

        setNicknameLoading(true)
        try {
            const result = await adminService.setMemberNickname(room.id, targetUserId, trimmedNickname, currentUserId)
            if (result === 'success') {
                await loadNicknames()
                // Notify parent to refresh
                onNicknameChange?.()
                // Send system message about nickname change
                await chatService.sendSystemMessage(room.id, `${displayName}'s nickname was set to ${trimmedNickname}`)
                setEditingNicknameFor(null)
                setNicknameInput('')
            } else {
                setError(`Failed to set nickname: ${result}`)
            }
        } catch (err: any) {
            console.error('Failed to set nickname:', err)
            setError(err.message || 'Failed to set nickname')
        } finally {
            setNicknameLoading(false)
        }
    }

    const handleNicknameKeyDown = (e: React.KeyboardEvent, targetUserId: string) => {
        if (e.key === 'Enter') {
            handleSaveNickname(targetUserId)
        } else if (e.key === 'Escape') {
            handleCancelEditNickname()
        }
    }

    const getDisplayName = (member: RoomMemberWithUsername) => {
        return nicknames[member.user_id] || member.username
    }

    if (!isOpen || !room) return null

    // For personal chats, show nickname editing panel
    if (isPersonalChat) {
        return (
            <>
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-black/50 z-40"
                    onClick={onClose}
                />

                {/* Sidebar Panel - Personal Chat Panel */}
                <div className="fixed right-0 top-0 h-full w-80 bg-zinc-900 border-l border-white/10 z-50 transform transition-transform duration-300 overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <h3 className="text-lg font-semibold text-white">Personal Chat</h3>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-zinc-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mx-4 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                            {error}
                            <button
                                onClick={() => setError(null)}
                                className="ml-2 text-red-400 hover:text-red-300"
                            >
                                Dismiss
                            </button>
                        </div>
                    )}

                    {/* Members with Nicknames */}
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="mb-4">
                            <h4 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
                                {UI_STRINGS.nicknames.editNicknames}
                            </h4>
                            <p className="text-xs text-zinc-600 mb-4">
                                Set nicknames for this conversation. Only you will see these names.
                            </p>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                            </div>
                        ) : members.length === 0 ? (
                            <div className="text-center py-8 text-zinc-500">
                                <p className="text-sm">No members found</p>
                            </div>
                        ) : (
                            <ul className="space-y-3">
                                {members.map((member) => {
                                    const isCurrentUser = member.user_id === currentUserId
                                    const currentNickname = nicknames[member.user_id]
                                    const isEditingThis = editingNicknameFor === member.user_id

                                    return (
                                        <li
                                            key={member.user_id}
                                            className="flex items-center gap-3 p-3 rounded-lg bg-white/5"
                                        >
                                            {/* Avatar */}
                                            <div className="w-10 h-10 rounded-full overflow-hidden bg-blue-600 flex items-center justify-center text-white text-sm font-medium shrink-0 ring-1 ring-white/10">
                                                {member.avatar_url ? (
                                                    <img
                                                        src={member.avatar_url}
                                                        alt={member.username}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    member.username.charAt(0).toUpperCase()
                                                )}
                                            </div>

                                            {/* Name and Nickname */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-white truncate">
                                                    {member.username}
                                                    {isCurrentUser && (
                                                        <span className="text-zinc-500 text-xs ml-1">(you)</span>
                                                    )}
                                                </p>
                                                {currentNickname && !isEditingThis && (
                                                    <p className="text-xs text-blue-400">
                                                        {UI_STRINGS.nicknames.nickname}: {currentNickname}
                                                    </p>
                                                )}
                                                {!currentNickname && !isEditingThis && (
                                                    <p className="text-xs text-zinc-600">
                                                        {UI_STRINGS.nicknames.noNickname}
                                                    </p>
                                                )}

                                                {/* Edit Nickname Input */}
                                                {isEditingThis && (
                                                    <div className="flex items-center gap-1 mt-2 min-w-0">
                                                        <input
                                                            type="text"
                                                            value={nicknameInput}
                                                            onChange={(e) => setNicknameInput(e.target.value)}
                                                            onKeyDown={(e) => handleNicknameKeyDown(e, member.user_id)}
                                                            placeholder={UI_STRINGS.nicknames.placeholder}
                                                            className="flex-1 min-w-0 bg-white/10 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            autoFocus
                                                            disabled={nicknameLoading}
                                                            maxLength={50}
                                                        />
                                                        <button
                                                            onClick={() => handleSaveNickname(member.user_id)}
                                                            disabled={nicknameLoading}
                                                            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-white/10 rounded transition-colors disabled:opacity-50 shrink-0"
                                                            title="Save nickname"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Edit Button */}
                                            {!isEditingThis && (
                                                <button
                                                    onClick={() => handleStartEditNickname(member.user_id, currentNickname)}
                                                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                                                    title={UI_STRINGS.nicknames.setNickname}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                    </svg>
                                                </button>
                                            )}
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            </>
        )
    }

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={onClose}
            />

            {/* Sidebar Panel */}
            <div className="fixed right-0 top-0 h-full w-80 bg-zinc-900 border-l border-white/10 z-50 transform transition-transform duration-300 overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h3 className="text-lg font-semibold text-white">Group Chat</h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-zinc-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>

                {/* Group Name Section - Only for group chats, all members can edit */}
                {!isPersonalChat && (
                    <div className="px-4 py-3 border-b border-white/10">
                        <label className="text-xs text-zinc-500 uppercase tracking-wide">
                            Group Name
                        </label>
                        {isEditingName ? (
                            <div className="flex items-center gap-2 mt-1">
                                <input
                                    type="text"
                                    value={newRoomName}
                                    onChange={(e) => setNewRoomName(e.target.value)}
                                    onKeyDown={handleNameKeyDown}
                                    placeholder="Enter group name"
                                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    autoFocus
                                    disabled={nameEditLoading}
                                />
                                <button
                                    onClick={handleSaveRoomName}
                                    disabled={nameEditLoading || !newRoomName.trim()}
                                    className="p-1.5 text-green-500 hover:bg-green-500/10 rounded transition-colors disabled:opacity-50"
                                    title="Save"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </button>
                                <button
                                    onClick={handleCancelEditName}
                                    disabled={nameEditLoading}
                                    className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
                                    title="Cancel"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between mt-1">
                                <span className="text-white font-medium truncate">
                                    {room?.name || 'Unnamed Group'}
                                </span>
                                <button
                                    onClick={handleStartEditName}
                                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                                    title="Edit group name"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="mx-4 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                        {error}
                        <button
                            onClick={() => setError(null)}
                            className="ml-2 text-red-400 hover:text-red-300"
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                {/* Nicknames Section */}
                <div className="px-4 py-3 border-b border-white/10">
                    <div className="flex items-center justify-between">
                        <label className="text-xs text-zinc-500 uppercase tracking-wide">
                            {UI_STRINGS.nicknames.editNicknames}
                        </label>
                        <button
                            onClick={() => setIsEditingNicknames(!isEditingNicknames)}
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            {isEditingNicknames ? UI_STRINGS.common.cancel : UI_STRINGS.nicknames.editNicknames}
                        </button>
                    </div>
                    {!isEditingNicknames && (
                        <p className="text-xs text-zinc-600 mt-1">
                            {Object.keys(nicknames).length > 0
                                ? `${Object.keys(nicknames).length} nickname(s) set`
                                : UI_STRINGS.nicknames.noNickname
                            }
                        </p>
                    )}
                    {isEditingNicknames && (
                        <div className="mt-3 space-y-2">
                            <p className="text-xs text-zinc-600 mb-2">
                                Set nicknames for members. Only you will see these names.
                            </p>
                            {members.map((member) => {
                                const currentNickname = nicknames[member.user_id]
                                const isEditingThis = editingNicknameFor === member.user_id

                                return (
                                    <div key={member.user_id} className="flex items-center gap-2 p-2 bg-white/5 rounded">
                                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-medium shrink-0">
                                            {member.username?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-white truncate">{member.username}</p>
                                            {currentNickname && !isEditingThis && (
                                                <p className="text-xs text-blue-400">{currentNickname}</p>
                                            )}
                                            {isEditingThis && (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <input
                                                        type="text"
                                                        value={nicknameInput}
                                                        onChange={(e) => setNicknameInput(e.target.value)}
                                                        onKeyDown={(e) => handleNicknameKeyDown(e, member.user_id)}
                                                        placeholder={UI_STRINGS.nicknames.placeholder}
                                                        className="flex-1 bg-white/10 border border-white/10 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        autoFocus
                                                        disabled={nicknameLoading}
                                                        maxLength={50}
                                                    />
                                                    <button
                                                        onClick={() => handleSaveNickname(member.user_id)}
                                                        disabled={nicknameLoading}
                                                        className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-white/10 rounded"
                                                        title="Save nickname"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {!isEditingThis && (
                                            <button
                                                onClick={() => handleStartEditNickname(member.user_id, currentNickname)}
                                                className="p-1 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                                                title={UI_STRINGS.nicknames.setNickname}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Group Photo Section (Group chats only) */}
                {!isPersonalChat && room && (
                    <div className="p-4 border-b border-white/10 space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                {room.photo_url ? (
                                    <img
                                        src={room.photo_url}
                                        alt={room.name}
                                        className="w-16 h-16 rounded-2xl object-cover ring-2 ring-white/10"
                                    />
                                ) : (
                                    <div className="w-16 h-16 rounded-2xl bg-purple-600 flex items-center justify-center text-white ring-2 ring-white/10">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3.005 3.005 0 013.75-2.906z" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 space-y-1">
                                <h4 className="text-sm font-semibold text-white">Group Photo</h4>
                                <p className="text-xs text-zinc-500">Standardize your group identity</p>
                            </div>
                            {isAdmin && (
                                <button
                                    onClick={() => {
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
                                    }}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors border border-white/5"
                                    title="Change group photo"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                                    </svg>

                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Members List */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                        </div>
                    ) : members.length === 0 ? (
                        <div className="text-center py-8 text-zinc-500">
                            <p className="text-sm">No members yet</p>
                        </div>
                    ) : (
                        <ul className="space-y-1">
                            {members.map((member) => {
                                const isCurrentUser = member.user_id === currentUserId
                                const isMemberAdmin = member.role === 'owner' || member.role === 'admin'

                                return (
                                    <li
                                        key={member.user_id}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
                                    >
                                        {/* Avatar */}
                                        <button
                                            onClick={() => {
                                                if (!isCurrentUser) {
                                                    setSelectedUser({
                                                        id: member.user_id,
                                                        username: member.username,
                                                        avatar_url: member.avatar_url || null,
                                                        is_admin: member.is_admin,
                                                        updated_at: member.joined_at
                                                    })
                                                }
                                            }}
                                            className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium shrink-0 hover:ring-2 hover:ring-blue-400 transition-all overflow-hidden"
                                        >
                                            {member.avatar_url ? (
                                                <img
                                                    src={member.avatar_url}
                                                    alt={member.username}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                member.username?.charAt(0).toUpperCase() || '?'
                                            )}
                                        </button>

                                        {/* Name and Role */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium text-white truncate">
                                                    {getDisplayName(member)}
                                                    {isCurrentUser && (
                                                        <span className="text-zinc-500 text-xs ml-1">(you)</span>
                                                    )}
                                                </p>
                                                {nicknames[member.user_id] && (
                                                    <span className="text-xs text-zinc-600 truncate">
                                                        ({member.username})
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-zinc-500 capitalize">
                                                {member.role}
                                            </p>
                                        </div>

                                        {/* Actions (for admins in group chats) */}
                                        {!isPersonalChat && isAdmin && !isCurrentUser && (
                                            <div className="flex items-center gap-1">
                                                {/* Promote/Demote */}
                                                {isMemberAdmin ? (
                                                    <button
                                                        onClick={() => handleDemoteFromAdmin(member.user_id)}
                                                        disabled={actionLoading}
                                                        className="p-1.5 text-xs text-yellow-500 hover:bg-yellow-500/10 rounded transition-colors disabled:opacity-50"
                                                        title="Remove admin"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                        </svg>
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handlePromoteToAdmin(member.user_id)}
                                                        disabled={actionLoading}
                                                        className="p-1.5 text-xs text-green-500 hover:bg-green-500/10 rounded transition-colors disabled:opacity-50"
                                                        title="Make admin"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                        </svg>
                                                    </button>
                                                )}

                                                {/* Remove */}
                                                <button
                                                    onClick={() => handleRemoveMember(member.user_id)}
                                                    disabled={actionLoading}
                                                    className="p-1.5 text-xs text-red-500 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
                                                    title="Remove member"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </div>
                                        )}
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-white/10 space-y-2">
                    {/* Add Member Button (Admin only in group chats) */}
                    {!isPersonalChat && isAdmin && (
                        <button
                            onClick={openAddMemberModal}
                            disabled={actionLoading}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                            </svg>
                            Add Member
                        </button>
                    )}

                    {/* Leave Room Button - Only show for group chats, not personal chats */}
                    {!isPersonalChat && (
                        <button
                            onClick={handleLeaveRoom}
                            disabled={actionLoading}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-500 font-medium transition-colors disabled:opacity-50"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm11 4.414l-4.293 4.293a1 1 0 01-1.414 0L4 7.414 5.414 6l3.293 3.293L13 5l1 2.414z" clipRule="evenodd" />
                            </svg>
                            Leave Room
                        </button>
                    )}

                    {/* Delete Room Button - Only for room owners, not personal chats */}
                    {!isPersonalChat && currentUserRole === 'owner' && (
                        <button
                            onClick={handleDeleteRoom}
                            disabled={actionLoading}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors disabled:opacity-50"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Delete Room
                        </button>
                    )}
                </div>

                {/* Member Count */}
                <div className="px-4 pb-4">
                    <p className="text-sm text-zinc-500">
                        {members.length} {members.length === 1 ? 'member' : 'members'}
                    </p>
                </div>
            </div >

            {/* Add Member Modal */}
            {
                isAddMemberOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
                        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl">
                            <div className="flex items-center justify-between p-4 border-b border-white/10">
                                <h3 className="text-lg font-semibold text-white">Add Member</h3>
                                <button
                                    onClick={() => setIsAddMemberOpen(false)}
                                    className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-zinc-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>

                            <div className="max-h-80 overflow-y-auto p-2">
                                {availableUsers.length === 0 ? (
                                    <div className="p-4 text-center text-zinc-500 text-sm">
                                        No users available to add
                                    </div>
                                ) : (
                                    availableUsers.map((user) => (
                                        <button
                                            key={user.id}
                                            onClick={() => handleAddMember(user.id)}
                                            disabled={actionLoading}
                                            className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                                                {user.username.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="text-sm text-white">{user.username}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* User Profile Modal */}
            {
                selectedUser && (
                    <UserProfileModal
                        user={selectedUser}
                        currentUserId={currentUserId}
                        onClose={() => setSelectedUser(null)}
                        onChatCreated={() => {
                            setSelectedUser(null)
                            onClose()
                        }}
                    />
                )
            }
            {/* Image Crop Modal */}
            {
                isCropModalOpen && pendingImage && room && (
                    <ImageCropModal
                        imageFile={pendingImage}
                        onCrop={async (blob) => {
                            try {
                                setUploadingPhoto(true)
                                await storageService.uploadGroupPhoto(room.id, blob)
                                // Call the refresh callback if it exists (usually passed from parent)
                                if (onMemberChange) onMemberChange()
                                setIsCropModalOpen(false)
                                setPendingImage(null)
                            } catch (err: any) {
                                console.error('Failed to upload group photo:', err)
                                alert('Failed to upload photo: ' + err.message)
                            } finally {
                                setUploadingPhoto(false)
                            }
                        }}
                        onClose={() => {
                            setIsCropModalOpen(false)
                            setPendingImage(null)
                        }}
                    />
                )
            }
        </>
    )
}

