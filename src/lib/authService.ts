import { supabase } from '@/utils/supabase/client'

export const authService = {
    /**
     * Signs up a new user and includes the username in the metadata.
     * This metadata is used by a DB trigger to sync the profiles table.
     */
    async signUp(email: string, password: string, username: string) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username,
                },
            },
        })

        if (error) throw error
        return data
    },

    /**
     * Signs in an existing user with email/username and password.
     */
    async signIn(identifier: string, password: string) {
        const response = await fetch('/api/auth/sign-in', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                identifier,
                password
            })
        })

        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.session) {
            throw new Error(payload?.error || 'Invalid login credentials')
        }

        const { data, error } = await supabase.auth.setSession({
            access_token: payload.session.access_token,
            refresh_token: payload.session.refresh_token
        })

        if (error) throw error
        return data
    },

    /**
     * Signs out the current user.
     */
    async signOut() {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
    },

    /**
     * Gets the current session.
     */
    async getSession() {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        return session
    },

    /**
     * Gets the profile for the current authenticated user.
     */
    async getCurrentProfile() {
        const session = await this.getSession()
        if (!session) return null

        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, is_admin, updated_at')
            .eq('id', session.user.id)
            .single()

        if (error) throw error
        return data
    },

    /**
     * Updates the user's password.
     * It first verifies the old password by re-authenticating.
     */
    async updatePassword(oldPassword: string, newPassword: string) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !user.email) throw new Error('Not authenticated')

        // 1. Verify old password by signing in
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: oldPassword,
        })

        if (signInError) {
            throw new Error('Incorrect old password')
        }

        // 2. Update to new password
        const { error: updateError } = await supabase.auth.updateUser({
            password: newPassword
        })

        if (updateError) throw updateError
    }
}
