import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { event_type, metadata, ip_address, user_agent } = body

    // Create a server-side Supabase client that can read the user's session
    // @ts-ignore
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          // @ts-ignore
          setAll(cookiesToSet: any[]) {
            try {
              // @ts-ignore
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
            } catch {}
          },
        },
      }
    )

    // Get the current user from their session cookie
    const { data: { user } } = await supabase.auth.getUser()

    // Insert activity log with real IP from middleware
    const { error } = await supabase.from('activity_log').insert({
      user_id:    user?.id    ?? null,
      user_email: user?.email ?? null,
      event_type,
      metadata:   metadata   ?? {},
      ip_address,
      user_agent,
    })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
