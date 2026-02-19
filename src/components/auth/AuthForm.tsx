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
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
            <div className="w-full max-w-md space-y-8 rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl shadow-2xl">
                <div className="text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-white">
                        {isLogin ? 'Welcome Back' : 'Join the Tambayan'}
                    </h2>
                    <p className="mt-2 text-sm text-zinc-400">
                        {isLogin ? "Ready to hang out?" : "Be part of the neighborhood."}
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && (
                        <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500 border border-red-500/20">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4 rounded-md shadow-sm">
                        {!isLogin && (
                            <div>
                                <label htmlFor="username" className="sr-only">Username</label>
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="relative block w-full rounded-lg border-0 bg-white/5 py-3 text-white ring-1 ring-inset ring-white/10 placeholder:text-zinc-500 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6"
                                    placeholder="Username"
                                />
                            </div>
                        )}
                        <div>
                            <label htmlFor="identifier" className="sr-only">
                                {isLogin ? 'Email or Username' : 'Email address'}
                            </label>
                            <input
                                id="identifier"
                                name="identifier"
                                type={isLogin ? "text" : "email"}
                                autoComplete={isLogin ? "username" : "email"}
                                required
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                className="relative block w-full rounded-lg border-0 bg-white/5 py-3 text-white ring-1 ring-inset ring-white/10 placeholder:text-zinc-500 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6"
                                placeholder={isLogin ? "Email or Username" : "Email address"}
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="relative block w-full rounded-lg border-0 bg-white/5 py-3 text-white ring-1 ring-inset ring-white/10 placeholder:text-zinc-500 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6"
                                placeholder="Password"
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative flex w-full justify-center rounded-lg bg-blue-600 px-3 py-3 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 transition-all shadow-lg hover:shadow-blue-500/20"
                        >
                            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
                        </button>
                    </div>

                    <div className="text-center">
                        <button
                            type="button"
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
