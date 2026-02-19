'use client'

import { authService } from '@/lib/authService'
import { Profile } from '@/types/database'
import { useEffect, useState } from 'react'

export default function Dashboard() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadProfile() {
            try {
                const data = await authService.getCurrentProfile()
                setProfile(data as Profile)
            } catch (err) {
                console.error('Failed to load profile:', err)
            } finally {
                setLoading(false)
            }
        }
        loadProfile()
    }, [])

    const handleSignOut = async () => {
        await authService.signOut()
        window.location.reload()
    }

    if (loading) {
        return <div className="text-white">Loading your tambayan...</div>
    }

    return (
        <div className="w-full max-w-md space-y-8 rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl shadow-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white">
                Welcome to the Tambayan!
            </h2>
            <p className="mt-2 text-zinc-400">
                You are successfully signed in as: <br />
                <span className="text-blue-400 font-mono font-bold">
                    {profile?.username || 'Authenticated User'}
                </span>
            </p>

            <div className="mt-8">
                <button
                    onClick={handleSignOut}
                    className="text-sm font-medium text-zinc-500 hover:text-white transition-colors"
                >
                    Sign Out
                </button>
            </div>
        </div>
    )
}
