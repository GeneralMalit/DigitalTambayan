import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BOT_CONFIG } from '@/config/botManifest'
import { createAdminClient } from '@/utils/supabase/admin'

function getBearerToken(request: Request) {
    const authorization = request.headers.get('authorization')

    if (!authorization?.startsWith('Bearer ')) {
        return null
    }

    return authorization.slice('Bearer '.length)
}

export async function POST(request: Request) {
    const token = getBearerToken(request)
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const roomId = typeof body?.roomId === 'string' ? body.roomId : ''
    const formattedContext = typeof body?.formattedContext === 'string' ? body.formattedContext : ''

    if (!roomId || !formattedContext.trim()) {
        return NextResponse.json({ error: 'roomId and formattedContext are required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY

    if (!supabaseUrl || !anonKey || !geminiApiKey) {
        return NextResponse.json({ error: 'Missing server environment variables' }, { status: 500 })
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

    const adminClient = createAdminClient()
    const { data: membership } = await adminClient
        .from('room_members')
        .select('room_id')
        .eq('room_id', roomId)
        .eq('user_id', authData.user.id)
        .maybeSingle()

    if (!membership) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const prompt = `${BOT_CONFIG.systemPrompt}\n\nHere is the recent conversation history:\n\n${formattedContext}\n\n${BOT_CONFIG.name}:`
    const requestBody = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 250
        }
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${BOT_CONFIG.modelName}:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return NextResponse.json(
            { error: `Gemini request failed (${response.status})`, details: errorData },
            { status: 502 }
        )
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
        const blockReason = data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason
        const errorMessage = blockReason ? `AI blocked response: ${blockReason}` : 'Unexpected AI response format'
        return NextResponse.json({ error: errorMessage }, { status: 502 })
    }

    return NextResponse.json({ text: text.trim() })
}
