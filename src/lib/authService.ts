import { createClient } from '@/utils/supabase/client'

const supabase = createClient()

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
     * Signs in an existing user with email and password.
     */
    async signIn(email: string, password: string) {
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
    }
}
