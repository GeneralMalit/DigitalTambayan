'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authService } from '@/lib/authService'
import { isPendingUsername, sanitizeUsername, validateUsername } from '@/lib/username'

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback
}

export default function SetupUsernamePage() {
    const router = useRouter()
    const [username, setUsername] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let active = true

        async function loadProfile() {
            try {
                const profile = await authService.getCurrentProfile()
                if (!active) return

                if (!profile) {
                    router.replace('/')
                    return
                }

                if (!isPendingUsername(profile.username)) {
                    router.replace('/')
                    return
                }
            } catch (err: unknown) {
                if (active) setError(getErrorMessage(err, 'Unable to load your profile'))
            } finally {
                if (active) setLoading(false)
            }
        }

        loadProfile()

        return () => {
            active = false
        }
    }, [router])

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault()
        setError(null)

        const cleanUsername = sanitizeUsername(username)
        setUsername(cleanUsername)

        const validationError = validateUsername(cleanUsername)
        if (validationError) {
            setError(validationError)
            return
        }

        setSaving(true)
        try {
            await authService.completeOAuthUsername(cleanUsername)
            router.replace('/')
            router.refresh()
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Unable to save that username'))
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <main className="flex h-full items-center justify-center bg-[#fbfaf7] text-stone-600">
                Loading your account...
            </main>
        )
    }

    return (
        <main className="flex h-full items-center justify-center bg-[#fbfaf7] px-5 text-stone-950">
            <div className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-6 shadow-[0_18px_50px_rgba(80,64,43,0.12)]">
                <div className="mb-6 space-y-1">
                    <h1 className="font-heading text-2xl font-semibold tracking-tight">Choose your username</h1>
                    <p className="text-sm leading-6 text-stone-600">
                        This is the name people will see in Digital Tambayan.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label htmlFor="username" className="text-xs font-medium text-stone-700">Username</label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            autoComplete="username"
                            required
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            className="w-full rounded-md border border-stone-200 bg-white px-3.5 py-3 text-sm text-stone-950 placeholder-stone-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            placeholder="general_malit"
                        />
                        <p className="text-xs text-stone-500">Use 3-24 lowercase letters, numbers, or underscores.</p>
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full rounded-md bg-stone-950 py-3 text-sm font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Continue'}
                    </button>
                </form>
            </div>
        </main>
    )
}
