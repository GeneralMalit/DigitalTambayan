import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { isPendingUsername } from '@/lib/username'

type CookieToSet = {
    name: string
    value: string
    options: Record<string, unknown>
}

function redirectWithCookies(url: URL, cookiesToSet: CookieToSet[]) {
    const response = NextResponse.redirect(url)
    cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
    })
    return response
}

export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const origin = requestUrl.origin
    const code = requestUrl.searchParams.get('code')
    const cookiesToSet: CookieToSet[] = []

    if (!code) {
        const redirectUrl = new URL('/', origin)
        redirectUrl.searchParams.set('auth_error', 'GitHub sign-in was cancelled or did not return a code.')
        return NextResponse.redirect(redirectUrl)
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(nextCookies) {
                    nextCookies.forEach((cookie) => {
                        cookiesToSet.push({
                            name: cookie.name,
                            value: cookie.value,
                            options: cookie.options,
                        })
                    })
                },
            },
        }
    )

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
        const redirectUrl = new URL('/', origin)
        redirectUrl.searchParams.set('auth_error', exchangeError.message)
        return redirectWithCookies(redirectUrl, cookiesToSet)
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
        const redirectUrl = new URL('/', origin)
        redirectUrl.searchParams.set('auth_error', 'Unable to verify the GitHub session.')
        return redirectWithCookies(redirectUrl, cookiesToSet)
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userData.user.id)
        .single()

    if (profileError || isPendingUsername(profile?.username)) {
        return redirectWithCookies(new URL('/auth/setup-username', origin), cookiesToSet)
    }

    return redirectWithCookies(new URL('/', origin), cookiesToSet)
}
