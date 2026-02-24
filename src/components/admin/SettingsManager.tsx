'use client'

import { useState, useEffect } from 'react'
import { adminService } from '@/lib/adminService'
import { ChatSettings } from '@/types/database'

interface SettingsManagerProps {
    onRefresh?: () => void
}

const THRESHOLD_OPTIONS = [
    { value: 5, label: '5 minutes' },
    { value: 10, label: '10 minutes' },
    { value: 30, label: '30 minutes' },
    { value: 60, label: '1 hour' },
    { value: 1440, label: '1 day' },
    { value: 10080, label: '1 week' },
]

export default function SettingsManager({ onRefresh }: SettingsManagerProps) {
    const [settings, setSettings] = useState<ChatSettings | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    useEffect(() => {
        loadSettings()
    }, [])

    const loadSettings = async () => {
        setLoading(true)
        try {
            const data = await adminService.getChatSettings()
            setSettings(data)
        } catch (err: any) {
            console.error('Failed to load settings:', err)
            setError(err.message || 'Failed to load settings')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!settings) return

        setSaving(true)
        setError(null)
        setSuccess(null)

        try {
            await adminService.updateChatSettings({
                enable_message_deletion: settings.enable_message_deletion,
                deletion_threshold_minutes: settings.deletion_threshold_minutes
            })
            setSuccess('Settings saved successfully!')
            onRefresh?.()
            setTimeout(() => setSuccess(null), 3000)
        } catch (err: any) {
            console.error('Failed to save settings:', err)
            setError(err.message || 'Failed to save settings')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        )
    }

    if (!settings) {
        return (
            <div className="text-center py-8 text-zinc-500">
                <p>Unable to load settings.</p>
                <p className="text-xs mt-2">Make sure you have run the database migration and are an admin.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Message Deletion Settings */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h4 className="text-sm font-medium text-white mb-4">Message Deletion</h4>

                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-sm text-zinc-300">Allow users to delete their own messages</p>
                        <p className="text-xs text-zinc-500 mt-1">When disabled, the delete button will not appear on messages</p>
                    </div>
                    <button
                        onClick={() => setSettings(prev => prev ? { ...prev, enable_message_deletion: !prev.enable_message_deletion } : null)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings?.enable_message_deletion ? 'bg-blue-600' : 'bg-zinc-600'
                            }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings?.enable_message_deletion ? 'translate-x-6' : 'translate-x-1'
                                }`}
                        />
                    </button>
                </div>

                {/* Threshold Selection */}
                <div className={`transition-opacity ${settings?.enable_message_deletion ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <label className="block text-sm text-zinc-300 mb-2">
                        Delete time window
                    </label>
                    <p className="text-xs text-zinc-500 mb-3">Users can only delete messages within this time period</p>
                    <select
                        value={settings?.deletion_threshold_minutes || 10}
                        onChange={(e) => setSettings(prev => prev ? { ...prev, deletion_threshold_minutes: Number(e.target.value) } : null)}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        {THRESHOLD_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                    {saving ? 'Saving...' : 'Save Settings'}
                </button>
            </div>

            {/* Status Messages */}
            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-sm text-red-400">{error}</p>
                </div>
            )}
            {success && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="text-sm text-green-400">{success}</p>
                </div>
            )}
        </div>
    )
}
