import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-db'

// GET /api/health
//
// Lightweight liveness + DB reachability probe.
//
// Why this exists:
//   1. Ops / uptime monitors need a cheap endpoint to hit.
//   2. Supabase's free tier auto-pauses projects after ~7 days of inactivity.
//      Our GitHub Actions keepalive workflow pings this endpoint every ~3
//      days to keep the DB awake. See docs/services/supabase.md.
//
// The endpoint runs a trivial `count` on the `users` table. That's enough to
// (a) prove Postgres is reachable and (b) count as "activity" for the
// inactivity timer.
export async function GET() {
  const startedAt = Date.now()

  try {
    const { error } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })

    if (error) throw error

    return NextResponse.json({
      status: 'ok',
      db: 'ok',
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    // Return 200 so uptime monitors don't page on a healthy-server /
    // sleeping-DB situation; the JSON body carries the real state.
    return NextResponse.json(
      {
        status: 'ok',
        db: 'error',
        error: err?.message ?? 'Unknown database error',
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    )
  }
}
