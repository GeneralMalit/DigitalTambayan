'use client'

import { useState } from 'react'
import { authService } from '@/lib/authService'
import { useRouter } from 'next/navigation'

export default function AuthForm() {
    const [isLogin, setIsLogin] = useState(true)
    const [identifier, setIdentifier] = useState('')
    const [password, setPassword] = useState('')
    const [username, setUsername] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

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
        <div className="w-full max-w-sm mx-auto space-y-10">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-medium tracking-tight text-white font-heading">
                    {isLogin ? 'Sign in' : 'Create account'}
                </h2>
                <p className="text-sm text-zinc-500">
                    {isLogin ? "Welcome back to the tambayan." : "Join the neighborhood vibe."}
                </p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
                {error && (
                    <div className="rounded-md bg-red-500/5 p-3 text-xs text-red-400 text-center tracking-wide">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    {!isLogin && (
                        <div className="group relative">
                            <input
                                id="username"
                                name="username"
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-white/[0.03] border-none rounded-md py-3 px-4 text-sm text-white placeholder-zinc-600 focus:bg-white/[0.05] focus:ring-1 focus:ring-blue-500/30 outline-none transition-all"
                                placeholder="Username"
                            />
                        </div>
                    )}
                    <div className="group relative">
                        <input
                            id="identifier"
                            name="identifier"
                            type={isLogin ? "text" : "email"}
                            autoComplete={isLogin ? "username" : "email"}
                            required
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            className="w-full bg-white/[0.03] border-none rounded-md py-3 px-4 text-sm text-white placeholder-zinc-600 focus:bg-white/[0.05] focus:ring-1 focus:ring-blue-500/30 outline-none transition-all"
                            placeholder={isLogin ? "Email or Username" : "Email address"}
                        />
                    </div>
                    <div className="group relative">
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-white/[0.03] border-none rounded-md py-3 px-4 text-sm text-white placeholder-zinc-600 focus:bg-white/[0.05] focus:ring-1 focus:ring-blue-500/30 outline-none transition-all"
                            placeholder="Password"
                        />
                    </div>
                </div>

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center items-center rounded-md bg-white text-black py-3 text-sm font-semibold hover:bg-zinc-200 disabled:opacity-50 transition-all duration-300"
                    >
                        {loading ? 'Processing...' : (isLogin ? 'Continue' : 'Create account')}
                    </button>
                </div>

                <div className="text-center">
                    <button
                        type="button"
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-xs font-medium text-zinc-500 hover:text-white transition-colors duration-300"
                    >
                        {isLogin ? "Need an account? Create one" : "Already have an account? Sign in"}
                    </button>
                </div>
            </form>
        </div>
    )
}
