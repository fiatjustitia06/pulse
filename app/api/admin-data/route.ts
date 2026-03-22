import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const ADMIN_EMAIL = 'charles060906@gmail.com'

// Build an auth-aware server client that carries the admin's JWT.
// This makes the RLS policies using auth.jwt()->> 'email' work correctly.
function makeAuthClient(cookieStore: any) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: any[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
}

// Build a service-role client if the key is available (bypasses RLS entirely).
// Falls back to the auth client (uses RLS policies).
function makeAdminClient(authClient: any) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceKey && serviceKey !== 'your_supabase_service_role_key' && serviceKey.length > 20) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  }
  // Fall back to the session-carrying auth client — works because we added
  // admin RLS policies in supabase-schema-patch-v3.sql
  return authClient
}

export async function GET(request: Request) {
  try {
    // @ts-ignore
    const cookieStore = cookies()
    const authClient = makeAuthClient(cookieStore)

    const { data: { user } } = await authClient.auth.getUser()
    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Use service role if available, otherwise rely on admin RLS policies
    const db = makeAdminClient(authClient)

    const { resource } = Object.fromEntries(new URL(request.url).searchParams)

    if (resource === 'businesses') {
      const { data, error } = await db
        .from('business_profiles')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) return NextResponse.json({ error: error.message, hint: 'Run supabase-schema-patch-v3.sql in your Supabase SQL editor to add admin RLS policies.' }, { status: 500 })
      return NextResponse.json({ data })
    }

    if (resource === 'analyses') {
      const { data, error } = await db
        .from('analysis_results')
        .select('id,user_id,business_id,location_address,location_suburb,scores,created_at')
        .order('created_at', { ascending: false })
      if (error) return NextResponse.json({ error: error.message, hint: 'Run supabase-schema-patch-v3.sql in your Supabase SQL editor to add admin RLS policies.' }, { status: 500 })
      return NextResponse.json({ data })
    }

    if (resource === 'logs') {
      const { data, error } = await db
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2000)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: 'Unknown resource' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    // @ts-ignore
    const cookieStore = cookies()
    const authClient = makeAuthClient(cookieStore)

    const { data: { user } } = await authClient.auth.getUser()
    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const db = makeAdminClient(authClient)

    const body = await request.json()
    const { type, id, email, userId } = body

    if (type === 'analysis') {
      const { error } = await db.from('analysis_results').delete().eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else if (type === 'business') {
      // Cascade: delete analyses first, then the business
      await db.from('analysis_results').delete().eq('business_id', id)
      const { error } = await db.from('business_profiles').delete().eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else if (type === 'user') {
      // Get all businesses for this user, delete their analyses, then the businesses, then logs
      const { data: userBiz } = await db
        .from('business_profiles').select('id').eq('user_id', userId)
      for (const b of userBiz || []) {
        await db.from('analysis_results').delete().eq('business_id', b.id)
      }
      await db.from('business_profiles').delete().eq('user_id', userId)
      if (email) await db.from('activity_log').delete().eq('user_email', email)
    } else if (type === 'log') {
      const { error } = await db.from('activity_log').delete().eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
