'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const GRADES = ['A', 'B', 'C', 'D', 'E'] as const
type Grade = typeof GRADES[number]

function scoreToGrade(score: number): Grade {
  if (score >= 80) return 'A'
  if (score >= 70) return 'B'
  if (score >= 60) return 'C'
  if (score >= 50) return 'D'
  return 'E'
}

export default function AnalysesPage() {
  const [analyses, setAnalyses]     = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [businesses, setBusinesses] = useState<Record<string, string>>({})
  const [sortBy, setSortBy]         = useState<'date' | 'score'>('date')
  const [filterBiz, setFilterBiz]   = useState<string>('all')
  const [filterGrade, setFilterGrade] = useState<Grade | 'all'>('all')
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }

      const { data: bizRows } = await supabase
        .from('business_profiles')
        .select('id, business_name')
        .eq('user_id', session.user.id)

      const bizMap: Record<string, string> = {}
      ;(bizRows || []).forEach((b: any) => { bizMap[b.id] = b.business_name })
      setBusinesses(bizMap)

      const { data: rows } = await supabase
        .from('analysis_results')
        .select('id, business_id, location_address, location_suburb, location_postcode, scores, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      setAnalyses(rows || [])
      setLoading(false)
    }
    init()
  }, [router])

  const deleteAnalysis = async (id: string) => {
    const supabase = createClient()
    await supabase.from('analysis_results').delete().eq('id', id)
    setAnalyses(a => a.filter((x: any) => x.id !== id))
  }

  if (loading) return <Spinner />

  // unique businesses that have at least one analysis
  const bizOptions = Object.entries(businesses).filter(([id]) =>
    analyses.some((a: any) => a.business_id === id)
  )

  const filtered = analyses
    .filter((a: any) => filterBiz === 'all' || a.business_id === filterBiz)
    .filter((a: any) => filterGrade === 'all' || scoreToGrade(a.scores?.overall ?? 0) === filterGrade)

  const sorted = [...filtered].sort((a: any, b: any) => {
    if (sortBy === 'score') {
      const diff = (b.scores?.overall ?? 0) - (a.scores?.overall ?? 0)
      return diff !== 0 ? diff : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const gradeColor = (g: Grade) => g <= 'B' ? '#0A8754' : g === 'C' ? '#B07156' : '#c0392b'

  const FilterPill = ({
    active, onClick, children,
  }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer',
        background: active ? '#0A8754' : 'rgba(10,135,84,0.07)',
        color: active ? 'white' : '#131515',
        fontFamily: 'var(--font-body)', fontSize: '0.78rem',
        fontWeight: active ? 600 : 400,
        opacity: active ? 1 : 0.6,
        transition: 'all 0.15s',
        whiteSpace: 'nowrap' as const,
      }}
    >
      {children}
    </button>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#E2EFDE' }}>

      {/* ── Header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(226,239,222,0.92)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(10,135,84,0.1)', padding: '0 24px', height: '56px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.push('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#131515', opacity: 0.5 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 2L4 7l5 5"/></svg>
            Dashboard
          </button>
          <span style={{ color: 'rgba(19,21,21,0.2)' }}>/</span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#131515', fontWeight: 500 }}>My Analyses</span>
        </div>
        <button onClick={() => router.push('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 14px', borderRadius: '10px', background: '#0A8754', color: 'white', border: 'none', fontFamily: 'var(--font-body)', fontSize: '0.8rem', cursor: 'pointer' }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"><path d="M8 3v10M3 8h10"/></svg>
          New Analysis
        </button>
      </header>

      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '32px 20px' }}>

        {/* ── Title row ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: '#131515', letterSpacing: '-0.02em', marginBottom: '4px' }}>
              Your Analyses
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#131515', opacity: 0.45, margin: 0 }}>
              {sorted.length === analyses.length
                ? `${analyses.length} location${analyses.length !== 1 ? 's' : ''} across all businesses`
                : `${sorted.length} of ${analyses.length} shown`}
            </p>
          </div>

          {/* Sort toggle */}
          <div style={{ display: 'flex', gap: '3px', background: 'rgba(10,135,84,0.07)', borderRadius: '10px', padding: '3px' }}>
            {([{ key: 'date', label: 'Recent first' }, { key: 'score', label: 'Best score' }] as const).map(opt => (
              <button key={opt.key} onClick={() => setSortBy(opt.key)} style={{
                padding: '5px 13px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                background: sortBy === opt.key ? 'white' : 'transparent',
                color: sortBy === opt.key ? '#0A8754' : '#131515',
                fontFamily: 'var(--font-body)', fontSize: '0.78rem',
                fontWeight: sortBy === opt.key ? 600 : 400,
                boxShadow: sortBy === opt.key ? '0 1px 6px rgba(10,135,84,0.1)' : 'none',
                transition: 'all 0.15s', opacity: sortBy === opt.key ? 1 : 0.5,
              }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Filter bar ── */}
        {(bizOptions.length > 1 || true) && (
          <div style={{
            background: 'white', borderRadius: '16px', padding: '14px 16px',
            border: '1px solid rgba(10,135,84,0.08)', marginBottom: '1.2rem',
            display: 'flex', flexDirection: 'column', gap: '10px',
          }}>
            {/* Business filter */}
            {bizOptions.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: '#131515', opacity: 0.35, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>Business</span>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  <FilterPill active={filterBiz === 'all'} onClick={() => setFilterBiz('all')}>All businesses</FilterPill>
                  {bizOptions.map(([id, name]) => (
                    <FilterPill key={id} active={filterBiz === id} onClick={() => setFilterBiz(id)}>{name}</FilterPill>
                  ))}
                </div>
              </div>
            )}

            {/* Grade filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: '#131515', opacity: 0.35, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>Grade</span>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                <FilterPill active={filterGrade === 'all'} onClick={() => setFilterGrade('all')}>All grades</FilterPill>
                {GRADES.map(g => {
                  const count = analyses.filter((a: any) =>
                    (filterBiz === 'all' || a.business_id === filterBiz) &&
                    scoreToGrade(a.scores?.overall ?? 0) === g
                  ).length
                  const gc = gradeColor(g)
                  return (
                    <button
                      key={g}
                      onClick={() => setFilterGrade(filterGrade === g ? 'all' : g)}
                      style={{
                        padding: '4px 12px', borderRadius: '20px', border: 'none', cursor: count === 0 ? 'default' : 'pointer',
                        background: filterGrade === g ? gc : `${gc}12`,
                        color: filterGrade === g ? 'white' : gc,
                        fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: filterGrade === g ? 700 : 500,
                        opacity: count === 0 ? 0.3 : 1,
                        transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '5px',
                      }}
                      disabled={count === 0}
                    >
                      <span>{g}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', opacity: 0.65 }}>{count}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── List ── */}
        {sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'white', borderRadius: '20px', border: '1px solid rgba(10,135,84,0.08)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(10,135,84,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A8754" strokeWidth="1.5" strokeLinecap="round">
                <rect x="2" y="2" width="20" height="20" rx="4"/><path d="M7 14l3-4 3 3 3-4"/>
              </svg>
            </div>
            {analyses.length === 0 ? (
              <>
                <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, color: '#131515', marginBottom: '6px' }}>No analyses yet</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.84rem', color: '#131515', opacity: 0.45, marginBottom: '20px' }}>Pin a location on the map to get started.</div>
                <button onClick={() => router.push('/dashboard')} style={{ padding: '10px 20px', borderRadius: '10px', background: '#0A8754', color: 'white', border: 'none', fontFamily: 'var(--font-body)', fontSize: '0.85rem', cursor: 'pointer' }}>Go to Map</button>
              </>
            ) : (
              <>
                <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, color: '#131515', marginBottom: '6px' }}>No matches</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.84rem', color: '#131515', opacity: 0.45, marginBottom: '16px' }}>No analyses match the current filters.</div>
                <button onClick={() => { setFilterBiz('all'); setFilterGrade('all') }} style={{ padding: '8px 18px', borderRadius: '10px', background: '#0A8754', color: 'white', border: 'none', fontFamily: 'var(--font-body)', fontSize: '0.84rem', cursor: 'pointer' }}>Clear filters</button>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sorted.map((a: any) => {
              const score = a.scores?.overall ?? 0
              const grade = scoreToGrade(score)
              const gc = gradeColor(grade)
              const date = new Date(a.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
              const bizName = businesses[a.business_id]
              return (
                <div
                  key={a.id}
                  onClick={() => router.push(`/analysis/${a.id}`)}
                  style={{ background: 'white', borderRadius: '16px', padding: '1.2rem 1.5rem', border: '1px solid rgba(10,135,84,0.08)', display: 'flex', alignItems: 'center', gap: '1.2rem', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = '0 4px 20px rgba(10,135,84,0.1)'; el.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = 'none'; el.style.transform = 'none' }}
                >
                  {/* Grade circle */}
                  <div style={{ width: '46px', height: '46px', borderRadius: '50%', flexShrink: 0, background: `${gc}18`, border: `2px solid ${gc}35`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: gc, lineHeight: 1 }}>{grade}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: gc, opacity: 0.7 }}>{score}</span>
                  </div>

                  {/* Address + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.9rem', color: '#131515', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.location_address?.split(',').slice(0, 2).join(',') || 'Unknown location'}
                    </div>
                    <div style={{ display: 'flex', gap: '7px', marginTop: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {a.location_suburb && <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.74rem', color: '#0A8754' }}>{a.location_suburb}</span>}
                      {bizName && (
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#131515', opacity: 0.4, background: 'rgba(19,21,21,0.05)', padding: '1px 7px', borderRadius: '20px' }}>
                          {bizName}
                        </span>
                      )}
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#131515', opacity: 0.3 }}>{date}</span>
                    </div>
                  </div>

                  {/* Mini score bars */}
                  <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '26px', flexShrink: 0 }}>
                    {(['transport', 'footTraffic', 'demographics', 'competition'] as const).map(k => {
                      const v = a.scores?.[k] ?? 0
                      return <div key={k} style={{ width: '6px', borderRadius: '2px', background: v >= 65 ? '#0A8754' : '#B07156', height: `${Math.max(4, (v / 100) * 26)}px`, opacity: 0.65 }} />
                    })}
                  </div>

                  {/* Delete */}
                  <button
                    onClick={e => { e.stopPropagation(); deleteAnalysis(a.id) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', color: '#131515', opacity: 0.2, flexShrink: 0, display: 'flex' }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.opacity = '1'; el.style.background = 'rgba(176,113,86,0.08)'; el.style.color = '#B07156' }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.opacity = '0.2'; el.style.background = 'none'; el.style.color = '#131515' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M2 4h10M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M12 4l-.8 7.5a1 1 0 01-1 .9H3.8a1 1 0 01-1-.9L2 4"/>
                    </svg>
                  </button>

                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#131515" strokeWidth="1.5" strokeLinecap="round" style={{ opacity: 0.2, flexShrink: 0 }}>
                    <path d="M4 7h6M7 4l3 3-3 3"/>
                  </svg>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ minHeight: '100vh', background: '#E2EFDE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '36px', height: '36px', border: '2.5px solid #0A8754', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#131515', opacity: 0.45 }}>Loading…</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
