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
        let email = identifier

        // Basic check: if identifier doesn't contain '@', treat it as a username
        if (!identifier.includes('@')) {
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('email')
                .eq('username', identifier)
                .single()

            if (profileError || !profile) {
                throw new Error('Username not found')
            }
            email = profile.email
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
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
            .select('*')
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
