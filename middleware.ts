import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Pages that trigger an activity log entry
const TRACKED_PATHS = ['/dashboard', '/businesses', '/analyses', '/settings', '/onboarding', '/admin']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only track specific pages, skip static assets and API routes
  const shouldTrack = TRACKED_PATHS.some(p => pathname.startsWith(p))

  if (shouldTrack) {
    // Extract real IP — works on Vercel, Railway, Render, Nginx proxy
    const ip =
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('cf-connecting-ip') || // Cloudflare
      null

    const userAgent = request.headers.get('user-agent') || null

    // Fire and forget — don't await so we don't slow down the request
    // We call our own API route which has access to the service role key
    const origin = request.nextUrl.origin
    fetch(`${origin}/api/log-activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'page_view',
        metadata: { path: pathname },
        ip_address: ip,
        user_agent: userAgent,
        // Pass the auth cookie so the API route can identify the user
        cookie: request.headers.get('cookie') || '',
      }),
    }).catch(() => {}) // Never fail the page load
  }

  return NextResponse.next()
}

export const config = {
  // Run on page routes only, skip _next internals, static files, and API routes
  matcher: [
    '/((?!_next/static|_next/image|favicon|api/).*)',
  ],
}
