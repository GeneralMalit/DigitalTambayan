import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/utils/supabase/admin'

function getBearerToken(request: Request) {
    const authorization = request.headers.get('authorization')

    if (!authorization?.startsWith('Bearer ')) {
        return null
    }

    return authorization.slice('Bearer '.length)
}

export async function DELETE(
    request: Request,
    context: { params: Promise<{ userId: string }> }
) {
    const token = getBearerToken(request)
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authData.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient: any = createAdminClient()
    const { data: requesterProfile } = await adminClient
        .from('profiles')
        .select('is_admin')
        .eq('id', authData.user.id)
        .maybeSingle()

    if (!requesterProfile?.is_admin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { userId } = await context.params
    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    if (userId === authData.user.id) {
        return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
    }

    const { error } = await adminClient.auth.admin.deleteUser(userId)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return new NextResponse(null, { status: 204 })
}
