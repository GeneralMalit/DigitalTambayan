'use client'

import { useState } from 'react'
import RoomManager from './RoomManager'
import UserManager from './UserManager'
import SettingsManager from './SettingsManager'
import { UI_STRINGS } from '@/config/uiStrings'

interface AdminDashboardProps {
    currentUserId?: string
    onRefresh?: () => void
    onMessagesCleared?: () => void
}

export default function AdminDashboard({ currentUserId, onRefresh, onMessagesCleared }: AdminDashboardProps) {
    const [activeTab, setActiveTab] = useState<'rooms' | 'users' | 'settings'>('rooms')

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h3 className="text-xl font-bold text-white">{UI_STRINGS.admin.dashboardTitle}</h3>
                <p className="text-sm text-zinc-400 mt-1">{UI_STRINGS.admin.dashboardSubtitle}</p>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-white/10">
                <button
                    onClick={() => setActiveTab('rooms')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors relative ${activeTab === 'rooms'
                        ? 'text-blue-400'
                        : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                >
                    {UI_STRINGS.admin.rooms}
                    {activeTab === 'rooms' && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors relative ${activeTab === 'users'
                        ? 'text-blue-400'
                        : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                >
                    {UI_STRINGS.admin.users}
                    {activeTab === 'users' && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors relative ${activeTab === 'settings'
                        ? 'text-blue-400'
                        : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                >
                    {UI_STRINGS.admin.settings}
                    {activeTab === 'settings' && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                    )}
                </button>
            </div>

            {/* Tab Content */}
            <div className="py-2">
                {activeTab === 'rooms' && (
                    <RoomManager currentUserId={currentUserId} onRefresh={onRefresh} onMessagesCleared={onMessagesCleared} />
                )}
                {activeTab === 'users' && (
                    <UserManager currentUserId={currentUserId} onRefresh={onRefresh} />
                )}
                {activeTab === 'settings' && (
                    <SettingsManager onRefresh={onRefresh} />
                )}
            </div>
        </div>
    )
}
