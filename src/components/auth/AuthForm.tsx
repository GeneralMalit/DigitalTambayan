'use client'

import { useEffect, useState } from 'react'
import { authService } from '@/lib/authService'

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback
}

export default function AuthForm() {
    const [isLogin, setIsLogin] = useState(true)
    const [identifier, setIdentifier] = useState('')
    const [password, setPassword] = useState('')
    const [username, setUsername] = useState('')
    const [loading, setLoading] = useState(false)
    const [oauthLoading, setOauthLoading] = useState(false)
    const [error, setError] = useState<string | null>(() => {
        if (typeof window === 'undefined') return null
        return new URLSearchParams(window.location.search).get('auth_error')
    })

    useEffect(() => {
        if (typeof window === 'undefined') return

        const params = new URLSearchParams(window.location.search)
        if (params.has('auth_error')) {
            window.history.replaceState({}, '', window.location.pathname)
        }
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            if (isLogin) {
                await authService.signIn(identifier, password)
            } else {
                await authService.signUp(identifier, password, username)
                alert('Check your email for the confirmation link!')
            }
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'An authentication error occurred'))
        } finally {
            setLoading(false)
        }
    }

    const handleGitHubSignIn = async () => {
        setOauthLoading(true)
        setError(null)

        try {
            await authService.signInWithGitHub()
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Unable to start GitHub sign-in'))
            setOauthLoading(false)
        }
    }

    return (
        <div className="w-full space-y-6">
            <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-stone-950 font-heading">
                    {isLogin ? 'Sign in' : 'Create account'}
                </h2>
                <p className="text-sm text-stone-600">
                    {isLogin ? "Welcome back to the tambayan." : "Start your community account."}
                </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
                {error && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                        {error}
                    </div>
                )}

                <button
                    type="button"
                    onClick={handleGitHubSignIn}
                    disabled={oauthLoading || loading}
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-stone-300 bg-white py-3 text-sm font-semibold text-stone-900 transition-colors hover:bg-stone-50 disabled:opacity-50"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
                        <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.54 2.87 8.39 6.84 9.75.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.27 9.27 0 0 1 12 7.01c.85 0 1.7.12 2.5.35 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.07.36.32.68.94.68 1.9 0 1.38-.01 2.49-.01 2.83 0 .27.18.59.69.49A10.08 10.08 0 0 0 22 12.26C22 6.58 17.52 2 12 2z" />
                    </svg>
                    {oauthLoading ? 'Opening GitHub...' : 'Continue with GitHub'}
                </button>

                <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-stone-200" />
                    <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400">or</span>
                    <div className="h-px flex-1 bg-stone-200" />
                </div>

                <div className="space-y-3">
                    {!isLogin && (
                        <div className="space-y-1.5">
                            <label htmlFor="username" className="text-xs font-medium text-stone-700">Username</label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full rounded-md border border-stone-200 bg-white px-3.5 py-3 text-sm text-stone-950 placeholder-stone-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                placeholder="Username"
                            />
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <label htmlFor="identifier" className="text-xs font-medium text-stone-700">
                            {isLogin ? 'Email or username' : 'Email address'}
                        </label>
                        <input
                            id="identifier"
                            name="identifier"
                            type={isLogin ? "text" : "email"}
                            autoComplete={isLogin ? "username" : "email"}
                            required
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            className="w-full rounded-md border border-stone-200 bg-white px-3.5 py-3 text-sm text-stone-950 placeholder-stone-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            placeholder={isLogin ? "Email or Username" : "Email address"}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="password" className="text-xs font-medium text-stone-700">Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-md border border-stone-200 bg-white px-3.5 py-3 text-sm text-stone-950 placeholder-stone-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            placeholder="Password"
                        />
                    </div>
                </div>

                <div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center items-center rounded-md bg-stone-950 text-white py-3 text-sm font-semibold hover:bg-stone-800 disabled:opacity-50 transition-colors"
                    >
                        {loading ? 'Processing...' : (isLogin ? 'Continue' : 'Create account')}
                    </button>
                </div>

                <div>
                    <button
                        type="button"
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-xs font-medium text-stone-600 hover:text-stone-950 transition-colors"
                    >
                        {isLogin ? "Need an account? Create one" : "Already have an account? Sign in"}
                    </button>
                </div>
            </form>
        </div>
    )
}
