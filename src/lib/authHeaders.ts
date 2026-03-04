import { supabase } from '@/utils/supabase/client'

export async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
        throw error
    }

    if (!session?.access_token) {
        throw new Error('Not authenticated')
    }

    return {
        Authorization: `Bearer ${session.access_token}`
    }
}
