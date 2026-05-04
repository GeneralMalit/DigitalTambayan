'use client'

import { useState } from 'react'
import { authService } from '@/lib/authService'

export default function AuthForm() {
    const [isLogin, setIsLogin] = useState(true)
    const [identifier, setIdentifier] = useState('')
    const [password, setPassword] = useState('')
    const [username, setUsername] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

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
        } catch (err: any) {
            setError(err.message || 'An authentication error occurred')
        } finally {
            setLoading(false)
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
