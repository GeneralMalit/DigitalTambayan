import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(request: Request) {
    const body = await request.json().catch(() => null)
    const identifier = typeof body?.identifier === 'string' ? body.identifier.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!identifier || !password) {
        return NextResponse.json({ error: 'Email or username and password are required' }, { status: 400 })
    }

    let email = identifier

    if (!identifier.includes('@')) {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json(
                { error: 'Username login is unavailable until SUPABASE_SERVICE_ROLE_KEY is set. Use your email address for now.' },
                { status: 500 }
            )
        }

        const adminClient: any = createAdminClient()
        const { data, error } = await adminClient.rpc('lookup_email_for_username', {
            p_username: identifier
        })

        if (error || !data) {
            return NextResponse.json({ error: 'Invalid login credentials' }, { status: 401 })
        }

        email = data
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !anonKey) {
        return NextResponse.json({ error: 'Missing Supabase environment variables' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, anonKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    })

    if (error || !data.session) {
        console.error('Sign-in failed:', {
            identifier,
            resolvedEmail: email,
            message: error?.message ?? 'No session returned'
        })
        return NextResponse.json({ error: error?.message || 'Invalid login credentials' }, { status: 401 })
    }

    return NextResponse.json({
        session: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token
        }
    })
}
