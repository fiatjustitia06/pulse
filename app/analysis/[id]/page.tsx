'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { LocationInsights, BusinessProjections, LocationPin, BusinessProfile, LocationScores } from '@/lib/types'
import toast from 'react-hot-toast'

interface ReportData {
  scores: LocationScores
  insights: LocationInsights
  projections: BusinessProjections
  ai_summary: string
  pin: LocationPin
  profile: BusinessProfile
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/).map((p, j) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={j} style={{ color: '#0A8754', fontWeight: 600 }}>{p.slice(2,-2)}</strong>
      : <span key={j}>{p}</span>
  )
}
function MarkdownText({ text }: { text: string }) {
  if (!text) return null
  const lines = text.split('\n')
  const out: React.ReactNode[] = []
  let bullets: string[] = []
  let k = 0
  const flush = () => {
    if (!bullets.length) return
    out.push(<ul key={`ul${k++}`} style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {bullets.map((b,i) => <li key={i} style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: '#131515', lineHeight: 1.7 }}>{renderInline(b)}</li>)}
    </ul>)
    bullets = []
  }
  for (const raw of lines) {
    const l = raw.trim()
    if (!l)              { flush(); continue }
    if (l.startsWith('## '))  { flush(); out.push(<h2 key={k++} style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: '#131515', margin: '0.4rem 0 0', lineHeight: 1.3 }}>{renderInline(l.slice(3))}</h2>); continue }
    if (l.startsWith('### ')) { flush(); out.push(<h3 key={k++} style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 700, color: '#0A8754', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0.5rem 0 0' }}>{l.slice(4)}</h3>); continue }
    if (/^[-*]\s/.test(l))   { bullets.push(l.slice(2).trim()); continue }
    flush()
    out.push(<p key={k++} style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: '#131515', lineHeight: 1.8, margin: 0 }}>{renderInline(l)}</p>)
  }
  flush()
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>{out}</div>
}

function SourceBadge({ label, url }: { label: string; url?: string }) {
  const style: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '2px 8px', borderRadius: '20px',
    background: 'rgba(10,135,84,0.07)', border: '1px solid rgba(10,135,84,0.15)',
    fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#0A8754',
    textDecoration: 'none', cursor: url ? 'pointer' : 'default',
  }
  if (url) return <a href={url} target="_blank" rel="noopener noreferrer" style={style}>{label} ↗</a>
  return <span style={style}>{label}</span>
}

export default function AnalysisResultPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exportLoading, setExportLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'costs'>('overview')
  const router = useRouter()
  const params = useParams()

  useEffect(() => {
    const init = async () => {
      const id = params.id as string
      if (id === 'preview') {
        try {
          const raw = sessionStorage.getItem('pulse_analysis')
          if (raw) { setData(JSON.parse(raw)); setLoading(false); return }
        } catch {}
        router.push('/dashboard'); return
      }
      if (!id) { router.push('/dashboard'); return }
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }
      const { data: row, error } = await supabase
        .from('analysis_results')
        .select('*, business_profiles(*)')
        .eq('id', id).single()
      if (error || !row) { toast.error('Could not load analysis'); router.push('/dashboard'); return }
      setData({
        scores: row.scores, insights: row.insights, projections: row.projections,
        ai_summary: row.ai_summary || '',
        pin: { lat: row.location_lat, lng: row.location_lng, address: row.location_address, suburb: row.location_suburb, postcode: row.location_postcode },
        profile: row.business_profiles,
      })
      setLoading(false)
    }
    init()
  }, [params.id, router])

  const exportPDF = async () => {
    if (!data) return
    setExportLoading(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210, M = 18; let y = M

      const ln = (text: string, size = 10, bold = false, color: [number,number,number] = [19,21,21]) => {
        doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setTextColor(...color)
        const lines = doc.splitTextToSize(text.replace(/\*\*/g,''), W - M*2)
        if (y + lines.length * size * 0.42 > 278) { doc.addPage(); y = M }
        doc.text(lines, M, y); y += lines.length * size * 0.42 + 2
      }

      const sec = (t: string) => {
        y += 5
        if (y > 270) { doc.addPage(); y = M }
        doc.setFillColor(10,135,84); doc.rect(M, y-2, W-M*2, 7, 'F')
        doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255)
        doc.text(t.toUpperCase(), M+3, y+3); y += 11
      }

      const divider = () => {
        doc.setDrawColor(10,135,84,0.2); doc.setLineWidth(0.2)
        doc.line(M, y, W-M, y); y += 4
      }

      // ── Header ──
      doc.setFillColor(226,239,222); doc.rect(0,0,W,46,'F')
      doc.setFillColor(10,135,84); doc.rect(0,0,5,46,'F')
      doc.setFontSize(22); doc.setFont('helvetica','bold'); doc.setTextColor(10,135,84)
      doc.text('PULSE', M, 16)
      doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(80,100,80)
      doc.text('Location Intelligence Report', M, 23)
      doc.setFontSize(8); doc.setTextColor(100,115,100)
      doc.text(data.pin.address, M, 29)
      doc.text(new Date().toLocaleDateString('en-AU', { day:'numeric', month:'long', year:'numeric' }), M, 34)

      // Overall score circle
      const grade = data.scores.overall >= 80 ? 'A' : data.scores.overall >= 70 ? 'B' : data.scores.overall >= 60 ? 'C' : data.scores.overall >= 50 ? 'D' : 'E'
      const scoreColor: [number,number,number] = data.scores.overall >= 70 ? [10,135,84] : data.scores.overall >= 50 ? [176,113,86] : [192,57,43]
      doc.setFillColor(...scoreColor); doc.circle(W-M-14, 22, 14, 'F')
      doc.setFontSize(16); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255)
      doc.text(grade, W-M-14, 24, { align: 'center' })
      doc.setFontSize(7); doc.setFont('helvetica','normal')
      doc.text(`${data.scores.overall}/100`, W-M-14, 30, { align: 'center' })

      y = 52

      // Business info
      doc.setFontSize(10.5); doc.setFont('helvetica','bold'); doc.setTextColor(19,21,21)
      doc.text(data.profile.business_name, M, y); y += 5
      doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(80,80,80)
      doc.text(`${data.profile.category}  ·  Budget: ${data.profile.budget}  ·  ${data.pin.suburb || data.pin.address.split(',')[0]}`, M, y); y += 8
      divider()

      // ── Score breakdown ──
      sec('SCORE BREAKDOWN')
      const scoreItems = [
        ['Geographic',              data.scores.geographic,   'OpenStreetMap / Nominatim'],
        ['Transport',               data.scores.transport,    'OpenStreetMap Overpass API'],
        ['Nearby Activity (proxy)', data.scores.footTraffic,  'OpenStreetMap Overpass API'],
        ['Demographics',            data.scores.demographics, 'ABS 2021 Census'],
        ['Competition',             data.scores.competition,  'OpenStreetMap Overpass API'],
        ['Rent Affordability',      data.scores.rentValue,    'CBRE/JLL 2023 market reports'],
      ] as [string,number,string][]

      scoreItems.forEach(([label, score, src]) => {
        const barW = Math.round((W - M*2 - 50) * score / 100)
        const sColor: [number,number,number] = score >= 70 ? [10,135,84] : score >= 50 ? [176,113,86] : [192,57,43]
        doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(19,21,21)
        doc.text(label, M, y)
        doc.setFont('helvetica','bold'); doc.setTextColor(...sColor)
        doc.text(`${score}`, W-M-32, y, { align: 'right' })
        doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(140,140,140)
        doc.text(src, W-M, y, { align: 'right' })
        y += 3
        doc.setFillColor(230,240,230); doc.rect(M, y, W-M*2-32, 2.5, 'F')
        doc.setFillColor(...sColor); doc.rect(M, y, barW, 2.5, 'F')
        y += 6
      })
      y += 2

      // ── AI Summary ──
      if (data.ai_summary) {
        sec('AI EXECUTIVE SUMMARY')
        ln(data.ai_summary.replace(/#{1,3} /g,'').replace(/\*\*/g,''), 8.5)
        y += 2
      }

      // ── Transport ──
      sec('TRANSPORT  ·  OpenStreetMap')
      if ((data.insights.transport?.allStations?.length ?? 0) > 0) {
        data.insights.transport!.allStations.slice(0,3).forEach((s, i) => {
          ln(`${i===0?'Nearest: ':''}${s.name} — ${s.distanceM}m`, 8.5, i===0)
        })
      } else {
        ln(`Nearest station: ${data.insights.transport?.nearestStation} (${((data.insights.transport?.stationDistance||0)*1000).toFixed(0)}m)`, 8.5)
      }
      ln(`Bus stops within 800m: ${data.insights.transport?.busRoutes}`, 8.5)
      if (data.insights.transport?.nearestLightRail) ln(`Light rail: ${data.insights.transport.nearestLightRail}`, 8.5)
      if (data.insights.transport?.nearestFerry) ln(`Ferry: ${data.insights.transport.nearestFerry}`, 8.5)
      ln(`Parking: ${data.insights.transport?.parkingAvailability}`, 8.5)

      // ── Walkability ──
      const walkData = (data.insights as any)?.externalData
      if (walkData?.walkabilityScore > 0) {
        sec('WALKABILITY  ·  OpenStreetMap Overpass API')
        ln(`Walkability score: ${walkData.walkabilityScore}/100 — ${walkData.walkabilityLabel}`, 8.5, true)
        ln(`Cycling score: ${walkData.cyclingScore}/100`, 8.5)
        ln(`Footpaths within 600m: ${walkData.footpathCount}  ·  Pedestrian crossings: ${walkData.crossingCount}  ·  Bike lanes: ${walkData.bikeLaneCount}`, 8.5)
      }

      // ── Demographics ──
      sec('DEMOGRAPHICS  ·  ABS Census 2021')
      const demo = data.insights.demographics
      ln(`Suburb: ${demo?.suburbMatched ? data.pin.suburb : 'Greater Sydney avg (no exact match)'}`, 8.5)
      ln(`Median age: ${demo?.medianAge} yrs  ·  Median household income: $${demo?.medianIncome?.toLocaleString()}/yr`, 8.5)
      ln(`Population density: ${demo?.populationDensity?.toLocaleString()} persons/km²  ·  Annual growth: ${demo?.growthRate}%/yr`, 8.5)
      if ((demo as any)?.chinesePct !== undefined) {
        const groups = [
          ['Anglo-Australian', (demo as any).angloAustralianPct],
          ['Chinese', (demo as any).chinesePct],
          ['Indian', (demo as any).indianPct],
          ['Arabic/M-E', (demo as any).arabicPct],
          ['Korean', (demo as any).koreanPct],
          ['Muslim', (demo as any).muslimPct],
          ['Hindu', (demo as any).hinduPct],
          ['Buddhist', (demo as any).buddhistPct],
        ].filter(([,v]) => (v as number) >= 3)
        if (groups.length) ln(`Cultural composition: ${groups.map(([k,v]) => `${k} ${v}%`).join(' · ')}`, 8)
      }

      // ── Cultural Fit ──
      const cf = (data.insights as any)?.culturalFit
      if (cf) {
        sec('CULTURAL FIT  ·  ABS 2021 Census')
        ln(`${cf.fitLabel} — Score ${cf.score}/100`, 8.5, true)
        if (cf.warnings?.length) cf.warnings.forEach((w: string) => ln(`⚠ ${w}`, 8))
        if (cf.opportunities?.length) cf.opportunities.forEach((o: string) => ln(`✓ ${o}`, 8))
      }

      // ── Competition ──
      sec('COMPETITION  ·  OpenStreetMap')
      ln(`${data.insights.competition?.directCompetitors || 0} ${data.profile.category} competitors within 800m — ${data.insights.competition?.marketSaturation} saturation`, 8.5)
      if (data.insights.competition?.competitorNames?.length) {
        data.insights.competition.competitorNames.slice(0,5).forEach(n => ln(`→ ${n}`, 8))
      }

      // ── OSM Nearby ──
      if (walkData?.osmNearbyCount > 0) {
        sec('NEARBY VENUES  ·  OpenStreetMap')
        ln(`${walkData.osmNearbyCount} category-matched venues within 800m`, 8.5)
        if (walkData.osmTopNames?.length) ln(`Top venues: ${walkData.osmTopNames.slice(0,5).join(', ')}`, 8)
      }

      // ── Rent ──
      sec('ESTIMATED COMMERCIAL RENT  ·  CBRE/JLL 2023')
      const rv = data.insights.rentValue as any
      ln(`${rv?.bandName || ''} — source: ${rv?.rentBandSource || 'CBRE/JLL 2023'}`, 8)
      ln(`Small tenancy (40–80 sqm): $${rv?.smallTenancyRent?.min?.toLocaleString()}–$${rv?.smallTenancyRent?.max?.toLocaleString()}/mo`, 8.5)
      ln(`Medium tenancy (80–150 sqm): $${rv?.mediumTenancyRent?.min?.toLocaleString()}–$${rv?.mediumTenancyRent?.max?.toLocaleString()}/mo`, 8.5)
      ln(`Price/sqm/yr: $${rv?.pricePerSqm?.toLocaleString()}  ·  Budget vs rent yr1: ${data.projections?.budgetVsRentYear1||0}% of ${data.profile.budget}`, 8)
      ln('⚠ Accuracy ±40% — always verify with a licensed commercial agent.', 8, true)

      // ── Risks & Opportunities ──
      if (data.projections?.keyRisks?.length) {
        sec('KEY RISKS')
        data.projections.keyRisks.slice(0,4).forEach(r => ln(`→ ${r}`, 8))
      }
      if (data.projections?.keyOpportunities?.filter(Boolean).length) {
        sec('KEY OPPORTUNITIES')
        data.projections.keyOpportunities.filter(Boolean).slice(0,4).forEach(o => ln(`→ ${o}`, 8))
      }

      // ── Footer ──
      const pages = (doc as any).internal.getNumberOfPages()
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i)
        doc.setFontSize(6.5); doc.setTextColor(160,160,160)
        doc.text(`Pulse · OpenStreetMap (ODbL), ABS Census 2021, CBRE/JLL published market reports · Page ${i}/${pages}`, M, 292)
      }

      doc.save(`Pulse_${data.pin.suburb || 'Sydney'}_${data.profile.business_name.replace(/[^a-z0-9]/gi,'_')}.pdf`)
      toast.success('Report exported!')
    } catch (err) { toast.error('Export failed'); console.error(err) }
    finally { setExportLoading(false) }
  }

  if (loading) return <Spinner label="Loading report…" />
  if (!data) return null
  const { scores, insights, projections, ai_summary, pin, profile } = data
  const grade = scores.overall >= 80 ? 'A' : scores.overall >= 70 ? 'B' : scores.overall >= 60 ? 'C' : scores.overall >= 50 ? 'D' : 'E'
  const gradeColor = scores.overall >= 70 ? '#0A8754' : scores.overall >= 50 ? '#B07156' : '#c0392b'
  const gradeTrack = scores.overall >= 70 ? 'rgba(10,135,84,0.1)' : scores.overall >= 50 ? 'rgba(176,113,86,0.1)' : 'rgba(192,57,43,0.1)'
  const walkData = (insights as any)?.externalData

  return (
    <div style={{ minHeight: '100vh', background: '#F0F5EE' }}>

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(240,245,238,0.95)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(10,135,84,0.1)',
        padding: '0 24px', height: '56px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.push('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#131515', opacity: 0.5 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 2L4 7l5 5"/></svg>
            Dashboard
          </button>
          <span style={{ color: 'rgba(19,21,21,0.2)' }}>/</span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#131515', fontWeight: 500 }}>
            {pin.suburb || pin.address.split(',')[0]}
          </span>
        </div>
        <button onClick={exportPDF} disabled={exportLoading} style={{
          display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 18px', borderRadius: '10px',
          background: '#0A8754', color: 'white', border: 'none',
          fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontWeight: 500,
          cursor: exportLoading ? 'not-allowed' : 'pointer', opacity: exportLoading ? 0.6 : 1,
          boxShadow: '0 2px 12px rgba(10,135,84,0.3)',
        }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"><path d="M6.5 1v8M4 7l2.5 2.5L9 7"/><path d="M1.5 11.5h10"/></svg>
          {exportLoading ? 'Exporting…' : 'Export PDF'}
        </button>
      </header>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '32px 20px 100px' }}>

        {/* ── Hero card ─────────────────────────────────────────────────────── */}
        <div style={{
          background: 'white', borderRadius: '28px',
          border: '1px solid rgba(10,135,84,0.08)',
          boxShadow: '0 8px 40px rgba(10,135,84,0.08)',
          overflow: 'hidden', marginBottom: '1.5rem',
        }}>
          {/* Green top bar */}
          <div style={{ height: '5px', background: `linear-gradient(90deg, #0A8754, ${gradeColor})` }} />

          <div style={{ padding: '2rem 2.5rem', display: 'grid', gridTemplateColumns: '1fr auto', gap: '2rem', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: '#0A8754', textTransform: 'uppercase', letterSpacing: '0.12em', background: 'rgba(10,135,84,0.08)', padding: '3px 10px', borderRadius: '20px' }}>Location Report</span>
                <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: '#131515', opacity: 0.3 }}>{new Date().toLocaleDateString('en-AU')}</span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.4rem, 3vw, 2rem)', color: '#131515', letterSpacing: '-0.025em', lineHeight: 1.15, marginBottom: '6px' }}>
                {pin.address.split(',').slice(0,2).join(',')}
              </h1>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#131515', opacity: 0.5, marginBottom: '22px' }}>
                For <strong style={{ opacity: 1 }}>{profile.business_name}</strong> · {profile.category}
              </p>
              {/* Mini score pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[
                  { l: 'Transport', v: scores.transport },
                  { l: 'Demographics', v: scores.demographics },
                  { l: 'Competition', v: scores.competition },
                  { l: 'Rent', v: scores.rentValue },
                ].map(s => (
                  <div key={s.l} style={{
                    padding: '4px 12px', borderRadius: '20px',
                    background: s.v >= 65 ? 'rgba(10,135,84,0.07)' : 'rgba(19,21,21,0.04)',
                    border: `1px solid ${s.v >= 65 ? 'rgba(10,135,84,0.14)' : 'rgba(19,21,21,0.08)'}`,
                  }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.73rem', color: '#131515', opacity: 0.65 }}>
                      {s.l} <strong style={{ color: s.v >= 65 ? '#0A8754' : s.v >= 50 ? '#B07156' : '#c0392b', opacity: 1 }}>{s.v}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Centered score circle ────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              {(() => {
                const R = 48, cx = 58, cy = 58
                const circ = 2 * Math.PI * R
                const filled = circ * scores.overall / 100
                return (
                  <svg width="116" height="116" viewBox="0 0 116 116" style={{ display: 'block' }}>
                    {/* Track */}
                    <circle cx={cx} cy={cy} r={R} fill="none" stroke={gradeTrack} strokeWidth="10"/>
                    {/* Fill — rotate -90° so it starts at top */}
                    <circle cx={cx} cy={cy} r={R} fill="none"
                      stroke={gradeColor} strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={`${filled} ${circ - filled}`}
                      style={{ transformOrigin: `${cx}px ${cy}px`, transform: 'rotate(-90deg)', transition: 'stroke-dasharray 1.2s ease' }}
                    />
                    {/* Grade letter — perfectly centred */}
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
                      fill={gradeColor} fontSize="30" fontWeight="700" fontFamily="Georgia,serif"
                    >{grade}</text>
                    {/* Score label below */}
                    <text x={cx} y={cy + 22} textAnchor="middle" dominantBaseline="central"
                      fill="#131515" fontSize="9" fontFamily="monospace" opacity="0.35"
                    >{scores.overall}/100</text>
                  </svg>
                )
              })()}
              {(scores as any).aiScoredOverall && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(10,135,84,0.08)', border: '1px solid rgba(10,135,84,0.15)' }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1l1 2.5 2.5 1L6 6l.5 3L5 7.5 3.5 9l.5-3L2 4.5l2.5-1z" stroke="#0A8754" strokeWidth="1" strokeLinecap="round"/></svg>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#0A8754', letterSpacing: '0.04em' }}>AI Scored</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '1.5rem', background: 'rgba(10,135,84,0.06)', borderRadius: '14px', padding: '4px' }}>
          {([
            { key: 'overview', label: 'Overview' },
            { key: 'details',  label: 'Data Deep Dive' },
            { key: 'costs',    label: 'Costs & Context' },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              flex: 1, padding: '10px 12px', borderRadius: '11px', border: 'none',
              background: activeTab === tab.key ? 'white' : 'none',
              fontFamily: 'var(--font-body)', fontSize: '0.84rem',
              color: activeTab === tab.key ? '#0A8754' : '#131515',
              fontWeight: activeTab === tab.key ? 600 : 400, cursor: 'pointer',
              boxShadow: activeTab === tab.key ? '0 2px 12px rgba(10,135,84,0.1)' : 'none',
              transition: 'all 0.2s',
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gap: '1.2rem' }}>

            {/* AI Summary */}
            {ai_summary && (
              <Card title="AI Executive Summary" icon={<IcSparkle size={14} color="#0A8754"/>}>
                <MarkdownText text={ai_summary} />
              </Card>
            )}

            {/* Score breakdown */}
            <Card title="Score Breakdown" icon={<IcChart size={14}/>}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.8rem' }}>
                {[
                  { l: 'Geographic',   s: scores.geographic,   src: 'OpenStreetMap',  desc: `${(insights.geographic?.proximityToCBD||0).toFixed(1)}km from CBD · ${insights.geographic?.lga}` },
                  { l: 'Transport',    s: scores.transport,    src: 'OpenStreetMap',  desc: `${insights.transport?.nearestStation} at ${((insights.transport?.stationDistance||0)*1000).toFixed(0)}m · ${insights.transport?.busRoutes} bus stops` },
                  { l: 'Demographics', s: scores.demographics, src: 'ABS 2021',       desc: `Median income $${(insights.demographics?.medianIncome||0).toLocaleString()} · ${insights.demographics?.growthRate}%/yr growth` },
                  { l: 'Competition',  s: scores.competition,  src: 'OpenStreetMap',  desc: `${insights.competition?.directCompetitors} direct competitors within 800m` },
                  { l: 'Rent',         s: scores.rentValue,    src: 'CBRE/JLL 2023',  desc: `Est. $${insights.rentValue?.estimatedMonthlyRent?.min?.toLocaleString()}–$${insights.rentValue?.estimatedMonthlyRent?.max?.toLocaleString()}/mo` },
                  ...(walkData?.walkabilityScore > 0 ? [{ l: 'Walkability', s: walkData.walkabilityScore, src: 'OpenStreetMap', desc: `${walkData.walkabilityLabel} · ${walkData.footpathCount} footpaths · ${walkData.crossingCount} crossings within 600m` }] : []),
                ].map(item => (
                  <div key={item.l}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', alignItems: 'flex-start', gap: '1rem' }}>
                      <div>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.84rem', color: '#131515', fontWeight: 500 }}>{item.l}</span>
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.74rem', color: '#131515', opacity: 0.42, marginTop: '1px' }}>{item.desc}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <SourceBadge label={item.src} />
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700,
                          color: item.s >= 70 ? '#0A8754' : item.s >= 50 ? '#B07156' : '#c0392b',
                          background: item.s >= 70 ? 'rgba(10,135,84,0.08)' : item.s >= 50 ? 'rgba(176,113,86,0.08)' : 'rgba(192,57,43,0.08)',
                          padding: '2px 9px', borderRadius: '20px',
                        }}>{item.s}</span>
                      </div>
                    </div>
                    <div style={{ height: '5px', background: 'rgba(10,135,84,0.07)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: item.s >= 70 ? '#0A8754' : item.s >= 50 ? '#B07156' : '#c0392b', borderRadius: '3px', width: `${item.s}%`, transition: 'width 1.2s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Key stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '1rem' }}>
              <StatCard icon={<IcTransit size={18} color="#0A8754"/>}
                label="Nearest Train Station" value={insights.transport?.nearestStation || '–'}
                sub={`${((insights.transport?.stationDistance||0)*1000).toFixed(0)}m · ${insights.transport?.busRoutes} bus stops`}
                source="OpenStreetMap" />
              <StatCard icon={<IcPeople size={18} color="#0A8754"/>}
                label="Median Household Income" value={`$${(insights.demographics?.medianIncome||0).toLocaleString()}`}
                sub={`ABS 2021 · ${insights.demographics?.suburbMatched ? pin.suburb : 'Greater Sydney avg'}`}
                source="ABS Census 2021" />
              <StatCard icon={<IcComp size={18} color="#B07156"/>}
                label={`${profile.category} competitors`} value={`${insights.competition?.directCompetitors||0} found`}
                sub={`within 800m · ${insights.competition?.marketSaturation} saturation`}
                source="OpenStreetMap" />
              <StatCard icon={<IcMoney size={18} color="#0A8754"/>}
                label="Est. Monthly Rent" value={`$${(insights.rentValue?.estimatedMonthlyRent?.min||0).toLocaleString()}`}
                sub={`to $${(insights.rentValue?.estimatedMonthlyRent?.max||0).toLocaleString()} · indicative only`}
                source="CBRE/JLL 2023" />
            </div>

            {/* Walkability stat cards */}
            {walkData?.walkabilityScore > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem' }}>
                {[
                  { label: 'Walkability',     value: walkData.walkabilityScore, desc: walkData.walkabilityLabel,   icon: <IcWalk size={18} color="#0A8754"/> },
                  { label: 'Cycling Score',   value: walkData.cyclingScore,     desc: `${walkData.bikeLaneCount} bike lanes nearby`, icon: <IcBike size={18} color="#0A8754"/> },
                  { label: 'Pedestrian Access', value: `${walkData.footpathCount}`, desc: `footpaths + ${walkData.crossingCount} crossings`, isCount: true, icon: <IcFoot size={18} color="#0A8754"/> },
                ].map((s, i) => (
                  <div key={i} style={{ background: 'white', borderRadius: '16px', padding: '1.2rem', border: '1px solid rgba(10,135,84,0.08)' }}>
                    <div style={{ marginBottom: '8px' }}>{s.icon}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', color: '#0A8754', lineHeight: 1 }}>
                      {s.isCount ? s.value : `${s.value}`}
                      {!s.isCount && <span style={{ fontSize: '0.75rem', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>/100</span>}
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#131515', opacity: 0.4, marginTop: '3px' }}>{s.desc}</div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#131515', fontWeight: 600, marginTop: '6px' }}>{s.label}</div>
                    <SourceBadge label="OpenStreetMap" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── DETAILS TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'details' && (
          <div style={{ display: 'grid', gap: '1rem' }}>

            {/* Geographic */}
            <Card title="Geographic Context" icon={<IcGeo size={14}/>}>
              <Row k="Address" v={pin.address} />
              <Row k="Suburb" v={pin.suburb || 'Unknown'} />
              <Row k="Postcode" v={pin.postcode || 'Unknown'} />
              <Row k="LGA" v={insights.geographic?.lga} />
              <Row k="Distance to Sydney CBD" v={`${insights.geographic?.proximityToCBD} km`} />
              <Row k="Distance to Bondi Beach" v={`${insights.geographic?.coastalProximity} km`} />
              <Row k="Zoning map" v="View on NSW Planning Portal →" link="https://spatialviewer.planning.nsw.gov.au/map/" />
              {insights.geographic?.nearbyLandmarks?.length > 0 && (
                <Row k="Tourist attractions nearby" v={insights.geographic.nearbyLandmarks.join(', ')} />
              )}
            </Card>

            {/* Transport */}
            <Card title="Transport & Accessibility" icon={<IcTransit size={14}/>}>
              {(insights.transport?.allStations?.length ?? 0) > 0 ? (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#131515', opacity: 0.5, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Train Stations within 1.5km</div>
                  {insights.transport!.allStations.map((s, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(10,135,84,0.05)' }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.84rem', color: '#131515', fontWeight: i === 0 ? 600 : 400 }}>{s.name}{i === 0 ? ' (nearest)' : ''}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#0A8754' }}>{s.distanceM}m</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.84rem', color: '#131515', opacity: 0.5, marginBottom: '8px' }}>No train stations found within 1.5km.</div>
              )}
              <Row k="Bus stops within 800m" v={`${insights.transport?.busRoutes || 0}`} />
              {insights.transport?.nearestLightRail && <Row k="Light rail" v={insights.transport.nearestLightRail} />}
              {insights.transport?.nearestFerry && <Row k="Ferry terminal" v={insights.transport.nearestFerry} />}
              <Row k="Parking" v={`${insights.transport?.parkingAvailability}`} />
              <Row k="Live timetables" v="transportnsw.info →" link="https://transportnsw.info" />
            </Card>

            {/* Walkability — new section */}
            {walkData?.walkabilityScore > 0 && (
              <Card title="Walkability & Cycling" icon={<IcWalk size={14}/>}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '10px', marginBottom: '16px' }}>
                  {[
                    { label: 'Walkability Score', value: walkData.walkabilityScore, desc: walkData.walkabilityLabel, max: 100 },
                    { label: 'Cycling Score',     value: walkData.cyclingScore,     desc: 'Bike infrastructure',     max: 100 },
                  ].map(item => (
                    <div key={item.label} style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(10,135,84,0.04)', border: '1px solid rgba(10,135,84,0.08)', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: item.value >= 70 ? '#0A8754' : item.value >= 50 ? '#B07156' : '#c0392b', lineHeight: 1 }}>{item.value}</div>
                      <div style={{ height: '4px', background: 'rgba(10,135,84,0.08)', borderRadius: '2px', margin: '8px 0', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${item.value}%`, background: item.value >= 70 ? '#0A8754' : item.value >= 50 ? '#B07156' : '#c0392b', borderRadius: '2px', transition: 'width 1s ease' }} />
                      </div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#131515', fontWeight: 600, opacity: 0.75 }}>{item.label}</div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.68rem', color: '#131515', opacity: 0.4, marginTop: '2px' }}>{item.desc}</div>
                    </div>
                  ))}
                </div>
                <Row k="Footpaths within 600m" v={`${walkData.footpathCount}`} />
                <Row k="Pedestrian crossings within 400m" v={`${walkData.crossingCount}`} />
                <Row k="Bike lanes within 600m" v={`${walkData.bikeLaneCount}`} />
                <Row k="Source" v="OpenStreetMap via Overpass API" link="https://www.openstreetmap.org" />
              </Card>
            )}

            {/* Demographics */}
            <Card title="Demographics" icon={<IcPeople size={14}/>}>
              {!insights.demographics?.suburbMatched && (
                <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(10,135,84,0.05)', border: '1px solid rgba(10,135,84,0.12)', marginBottom: '12px', fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#131515', opacity: 0.6 }}>
                  Suburb not in ABS lookup — showing Greater Sydney averages.
                </div>
              )}
              <Row k="Median age" v={`${insights.demographics?.medianAge} years`} />
              <Row k="Median household income" v={`$${(insights.demographics?.medianIncome||0).toLocaleString()}/year`} />
              <Row k="Population density" v={`${(insights.demographics?.populationDensity||0).toLocaleString()} persons/km²`} />
              <Row k="Annual growth" v={`${insights.demographics?.growthRate}%`} />
              <Row k="Top age groups" v={insights.demographics?.topAgeGroups?.join(', ') || '–'} />
              <Row k="Source" v={`ABS Census ${insights.demographics?.absDataYear}`} link="https://www.abs.gov.au/census/find-census-data/community-profiles" />

              {(insights.demographics as any)?.chinesePct !== undefined && (
                <div style={{ marginTop: '16px', borderTop: '1px solid rgba(10,135,84,0.08)', paddingTop: '14px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#131515', opacity: 0.35, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Cultural Composition · ABS 2021</div>
                  {[
                    { label: 'Anglo-Australian', pct: (insights.demographics as any)?.angloAustralianPct||0, color: '#0A8754' },
                    { label: 'Chinese',          pct: (insights.demographics as any)?.chinesePct||0,         color: '#60a5fa' },
                    { label: 'Indian',           pct: (insights.demographics as any)?.indianPct||0,          color: '#f97316' },
                    { label: 'Arabic/Mid-East',  pct: (insights.demographics as any)?.arabicPct||0,          color: '#a78bfa' },
                    { label: 'Korean',           pct: (insights.demographics as any)?.koreanPct||0,          color: '#34d399' },
                    { label: 'Muslim (religion)',pct: (insights.demographics as any)?.muslimPct||0,          color: '#fbbf24' },
                    { label: 'Hindu (religion)', pct: (insights.demographics as any)?.hinduPct||0,           color: '#fb7185' },
                    { label: 'Buddhist',         pct: (insights.demographics as any)?.buddhistPct||0,        color: '#c084fc' },
                  ].filter(g => g.pct >= 1).map(g => (
                    <div key={g.label} style={{ marginBottom: '7px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#131515', opacity: 0.65 }}>{g.label}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: g.color, fontWeight: 600 }}>{g.pct}%</span>
                      </div>
                      <div style={{ height: '5px', background: 'rgba(10,135,84,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(g.pct * 1.5, 100)}%`, background: g.color, borderRadius: '3px', opacity: 0.75, transition: 'width 1s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Cultural Fit */}
            {(insights as any)?.culturalFit && (
              <Card title="Cultural Fit Analysis" icon={<IcCultural size={14}/>}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ position: 'relative', width: '72px', height: '72px', flexShrink: 0 }}>
                    <svg width="72" height="72" viewBox="0 0 72 72">
                      <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(10,135,84,0.1)" strokeWidth="7"/>
                      <circle cx="36" cy="36" r="28" fill="none"
                        stroke={(insights as any).culturalFit.score >= 70 ? '#0A8754' : (insights as any).culturalFit.score >= 45 ? '#fbbf24' : '#B07156'}
                        strokeWidth="7" strokeLinecap="round"
                        strokeDasharray={`${2*Math.PI*28}`}
                        strokeDashoffset={`${2*Math.PI*28*(1-(insights as any).culturalFit.score/100)}`}
                        style={{ transformOrigin: '36px 36px', transform: 'rotate(-90deg)', transition: 'stroke-dashoffset 1s ease' }}
                      />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: '#131515', lineHeight: 1 }}>{(insights as any).culturalFit.score}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '1rem', color: '#131515', marginBottom: '3px' }}>{(insights as any).culturalFit.fitLabel}</div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#131515', opacity: 0.5, lineHeight: 1.5 }}>
                      Cultural alignment between <strong style={{ opacity: 0.8 }}>{profile.category}</strong> and {pin.suburb || 'this suburb'}
                    </div>
                  </div>
                </div>
                {(insights as any).culturalFit.dominantGroups?.length > 0 && (
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#131515', opacity: 0.35, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Area Profile</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {(insights as any).culturalFit.dominantGroups.map((g: string, i: number) => (
                        <span key={i} style={{ padding: '3px 10px', borderRadius: '20px', background: 'rgba(10,135,84,0.07)', border: '1px solid rgba(10,135,84,0.12)', fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#131515', opacity: 0.75 }}>{g}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(insights as any).culturalFit.warnings?.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#B07156', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '7px' }}>⚠ Considerations</div>
                    {(insights as any).culturalFit.warnings.map((w: string, i: number) => (
                      <div key={i} style={{ padding: '9px 12px', borderRadius: '8px', background: 'rgba(176,113,86,0.06)', border: '1px solid rgba(176,113,86,0.15)', marginBottom: '6px', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#131515', opacity: 0.8, lineHeight: 1.55 }}>{w}</div>
                    ))}
                  </div>
                )}
                {(insights as any).culturalFit.opportunities?.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#0A8754', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '7px' }}>✓ Opportunities</div>
                    {(insights as any).culturalFit.opportunities.map((o: string, i: number) => (
                      <div key={i} style={{ padding: '9px 12px', borderRadius: '8px', background: 'rgba(10,135,84,0.05)', border: '1px solid rgba(10,135,84,0.12)', marginBottom: '6px', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#131515', opacity: 0.8, lineHeight: 1.55 }}>{o}</div>
                    ))}
                  </div>
                )}
                {(insights as any).culturalFit.signals?.length > 0 && (
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '7px' }}>ℹ Signals</div>
                    {(insights as any).culturalFit.signals.map((s: string, i: number) => (
                      <div key={i} style={{ padding: '9px 12px', borderRadius: '8px', background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.12)', marginBottom: '6px', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#131515', opacity: 0.8, lineHeight: 1.55 }}>{s}</div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* OSM Nearby Places */}
            {walkData?.osmNearbyCount > 0 && (
              <Card title="Nearby Category Venues" icon={<IcComp size={14}/>}>
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: '#0A8754', lineHeight: 1 }}>{walkData.osmNearbyCount}</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#131515', opacity: 0.5, marginLeft: '8px' }}>{profile.category} venues within 800m</span>
                </div>
                {walkData.osmTopNames?.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#131515', opacity: 0.35, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Named venues</div>
                    {walkData.osmTopNames.map((name: string, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 0', borderBottom: '1px solid rgba(10,135,84,0.05)' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0A8754', flexShrink: 0 }} />
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.84rem', color: '#131515' }}>{name}</span>
                      </div>
                    ))}
                  </div>
                )}
                <Row k="Source" v="OpenStreetMap via Overpass API" link="https://www.openstreetmap.org" />
              </Card>
            )}

            {/* Competition */}
            <Card title="Competitors" icon={<IcComp size={14}/>}>
              <div style={{ marginBottom: '12px' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: insights.competition?.directCompetitors === 0 ? '#0A8754' : '#131515', lineHeight: 1 }}>
                  {insights.competition?.directCompetitors || 0}
                </span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#131515', opacity: 0.5, marginLeft: '8px' }}>
                  {profile.category} within 800m · {insights.competition?.marketSaturation} saturation
                </span>
              </div>
              {(insights.competition?.competitorDetails?.length ?? 0) > 0 && (
                <div style={{ marginBottom: '14px' }}>
                  {(insights.competition?.competitorDetails || []).map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(10,135,84,0.05)' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.84rem', color: '#131515', fontWeight: 500 }}>{c.name}</div>
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#131515', opacity: 0.4 }}>{c.distanceM}m away</div>
                      </div>
                      <a href={`https://www.google.com/maps/search/${encodeURIComponent(c.name)}/@${pin.lat},${pin.lng},17z`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#0A8754', textDecoration: 'none', padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(10,135,84,0.2)', background: 'rgba(10,135,84,0.05)', whiteSpace: 'nowrap' }}>
                        Maps ↗
                      </a>
                    </div>
                  ))}
                </div>
              )}
              <a href={insights.competition?.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9px', background: '#0A8754', color: 'white', fontFamily: 'var(--font-body)', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 500 }}>
                Search all {profile.category} on Google Maps ↗
              </a>
            </Card>

            {/* SEIFA */}
            {walkData?.seifaScore && (
              <Card title="Socioeconomic Advantage (SEIFA)" icon={<IcPeople size={14}/>}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', color: walkData.seifaDecile >= 7 ? '#0A8754' : walkData.seifaDecile >= 4 ? '#B07156' : '#c0392b', lineHeight: 1 }}>
                      {walkData.seifaDecile}<span style={{ fontSize: '1rem', opacity: 0.5 }}>/10</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#131515', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Decile</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.95rem', color: '#131515', marginBottom: '4px' }}>{walkData.seifaLabel}</div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#131515', opacity: 0.55, lineHeight: 1.5 }}>SEIFA score {walkData.seifaScore} (national avg = 1000). Decile 10 = most advantaged.</div>
                  </div>
                </div>
                <Row k="Source" v="ABS SEIFA 2021 — IRSAD index" link="https://www.abs.gov.au/statistics/people/people-and-communities/socio-economic-indexes-areas-seifa-australia/latest-release" />
              </Card>
            )}

            {/* NSW Planning zone */}
            {walkData?.zoningType && (
              <Card title="Zoning & Planning" icon={<IcBuild size={14}/>}>
                <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(10,135,84,0.05)', border: '1px solid rgba(10,135,84,0.1)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#0A8754', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'white', fontWeight: 700 }}>{(walkData.zoningType || '').split('—')[0].trim()}</span>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#131515', fontWeight: 600 }}>{walkData.zoningType}</div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#131515', opacity: 0.5, marginTop: '2px' }}>
                      {walkData.commercialZone ? '✓ Commercial use permitted in this zone' : '⚠ Verify commercial use with council'}
                    </div>
                  </div>
                </div>
                <Row k="Verify at" v="NSW Planning Portal" link="https://planningportal.nsw.gov.au" />
              </Card>
            )}
          </div>
        )}

        {/* ── COSTS TAB ────────────────────────────────────────────────────── */}
        {activeTab === 'costs' && (
          <div style={{ display: 'grid', gap: '1.2rem' }}>

            {/* Rent */}
            <Card title="Estimated Commercial Rent" icon={<IcMoney size={14}/>}>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#131515', opacity: 0.5, marginBottom: '16px' }}>
                {(insights.rentValue as any)?.bandName || ''} · Source: {insights.rentValue?.rentBandSource || 'CBRE/JLL 2023'} · Accuracy: ±40% — always verify with a leasing agent
              </div>

              {[
                { label: 'Small tenancy (~40–80 sqm)',  rent: (insights.rentValue as any)?.smallTenancyRent },
                { label: 'Medium tenancy (~80–150 sqm)', rent: (insights.rentValue as any)?.mediumTenancyRent },
              ].map(tier => (
                <div key={tier.label} style={{ marginBottom: '1.2rem' }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 600, color: '#131515', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {tier.label}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[{ lbl: 'Low', val: tier.rent?.min }, { lbl: 'High', val: tier.rent?.max }].map(({ lbl, val }) => (
                      <div key={lbl} style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(10,135,84,0.05)', border: '1px solid rgba(10,135,84,0.1)', textAlign: 'center' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#131515', opacity: 0.4, marginBottom: '3px', textTransform: 'uppercase' }}>{lbl}</div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: '#0A8754' }}>${(val||0).toLocaleString()}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#131515', opacity: 0.35 }}>/month</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <Row k="Price per sqm/year" v={`$${insights.rentValue?.pricePerSqm?.toLocaleString() || '–'}`} />
              <Row k="Budget vs medium tenancy yr 1" v={`${projections?.budgetVsRentYear1 || 0}% of ${profile.budget} budget`} />
              <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {[
                  { l: 'CBRE Australia', url: 'https://www.cbre.com.au' },
                  { l: 'JLL Australia', url: 'https://www.jll.com.au' },
                  { l: 'commercialrealestate.com.au', url: 'https://www.commercialrealestate.com.au' },
                ].map((l, i) => (
                  <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#0A8754', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="#0A8754" strokeWidth="1.5" strokeLinecap="round"><path d="M1.5 5.5h8M5.5 1.5l4 4-4 4"/></svg>
                    {l.l}
                  </a>
                ))}
              </div>
            </Card>

            {/* Risks & Opps */}
            {projections && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Card title="Risks" icon={<IcAlert size={14} color="#B07156"/>}>
                  <ul style={{ listStyle: 'none', margin: '0.75rem 0 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(projections.keyRisks || []).map((r, i) => (
                      <li key={i} style={{ display: 'flex', gap: '8px', fontFamily: 'var(--font-body)', fontSize: '0.84rem', color: '#131515', lineHeight: 1.55 }}>
                        <span style={{ color: '#B07156', flexShrink: 0 }}>→</span>{r}
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card title="Opportunities" icon={<IcCheck size={14} color="#0A8754"/>}>
                  <ul style={{ listStyle: 'none', margin: '0.75rem 0 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(projections.keyOpportunities || []).filter(Boolean).map((o, i) => (
                      <li key={i} style={{ display: 'flex', gap: '8px', fontFamily: 'var(--font-body)', fontSize: '0.84rem', color: '#131515', lineHeight: 1.55 }}>
                        <span style={{ color: '#0A8754', flexShrink: 0 }}>→</span>{o}
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', borderRadius: '20px', padding: '1.6rem', border: '1px solid rgba(10,135,84,0.07)', boxShadow: '0 2px 16px rgba(10,135,84,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
        <span style={{ color: '#0A8754', display: 'flex' }}>{icon}</span>
        <h3 style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.78rem', color: '#131515', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Row({ k, v, link }: { k: string; v?: string | null; link?: string }) {
  if (!v) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2rem', padding: '7px 0', borderBottom: '1px solid rgba(10,135,84,0.05)' }}>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.81rem', color: '#131515', opacity: 0.45, flexShrink: 0 }}>{k}</span>
      {link
        ? <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-body)', fontSize: '0.81rem', color: '#0A8754', textAlign: 'right', textDecoration: 'underline' }}>{v}</a>
        : <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.81rem', color: '#131515', textAlign: 'right' }}>{v}</span>
      }
    </div>
  )
}

function StatCard({ icon, label, value, sub, source }: { icon: React.ReactNode; label: string; value: string; sub: string; source: string }) {
  return (
    <div style={{ background: 'white', borderRadius: '18px', padding: '1.25rem', border: '1px solid rgba(10,135,84,0.07)', boxShadow: '0 2px 12px rgba(10,135,84,0.04)' }}>
      <div style={{ marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', color: '#0A8754', lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#131515', opacity: 0.4, marginTop: '3px' }}>{sub}</div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#131515', fontWeight: 600, marginTop: '6px' }}>{label}</div>
      <div style={{ marginTop: '4px' }}><SourceBadge label={source} /></div>
    </div>
  )
}

function Spinner({ label }: { label: string }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F0F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '36px', height: '36px', border: '2.5px solid #0A8754', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#131515', opacity: 0.45 }}>{label}</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// Icons
const IcSparkle  = ({ size, color='currentColor' }: { size:number; color?:string }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2l1.5 3.5L13 7l-3.5 1.5L8 13l-1.5-4.5L3 7l3.5-1.5z"/></svg>
const IcChart    = ({ size }: { size:number }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 10l2-3 2 2 2-3"/></svg>
const IcGeo      = ({ size }: { size:number }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 2C5.24 2 3 4.24 3 7c0 4.38 5 9 5 9s5-4.62 5-9c0-2.76-2.24-5-5-5z"/><circle cx="8" cy="7" r="1.8" fill="currentColor" stroke="none"/></svg>
const IcTransit  = ({ size, color='currentColor' }: { size:number; color?:string }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"><rect x="4" y="2" width="8" height="10" rx="2"/><path d="M6 14h4M4 6h8"/><circle cx="6.5" cy="9" r="0.8" fill="currentColor" stroke="none"/><circle cx="9.5" cy="9" r="0.8" fill="currentColor" stroke="none"/></svg>
const IcWalk     = ({ size, color='currentColor' }: { size:number; color?:string }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="3" r="1.5"/><path d="M6.5 6l-2 8M9.5 6l2 8M6 10h4"/><path d="M7 6l1.5 3 1.5-2"/></svg>
const IcBike     = ({ size, color='currentColor' }: { size:number; color?:string }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"><circle cx="4" cy="11" r="3"/><circle cx="12" cy="11" r="3"/><path d="M4 11l4-6 2 3h2M8 5h2"/></svg>
const IcFoot     = ({ size }: { size:number }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="6" cy="3" r="1.5"/><path d="M5.5 5l-2 7"/><circle cx="10" cy="5" r="1.5"/><path d="M10.5 7l1.5 6"/><path d="M3.5 12h4M9 13h4"/></svg>
const IcPeople   = ({ size, color='currentColor' }: { size:number; color?:string }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"><circle cx="6" cy="5" r="2"/><path d="M2 13c0-2.21 1.79-4 4-4s4 1.79 4 4"/><circle cx="12" cy="5.5" r="1.5"/><path d="M12 9.5c1.66 0 3 1.12 3 2.5"/></svg>
const IcComp     = ({ size }: { size:number }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="5" width="6" height="9" rx="1"/><rect x="9" y="2" width="6" height="12" rx="1"/></svg>
const IcMoney    = ({ size, color='currentColor' }: { size:number; color?:string }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 5.5v5M6.5 7.5h2.8a1.2 1.2 0 010 2.4H6.5"/></svg>
const IcBuild    = ({ size }: { size:number }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 14h12M4 14V8.5l4-5 4 5V14M6.5 14v-3h3v3"/></svg>
const IcCultural = ({ size }: { size:number }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/><path d="M8 2C4.69 2 2 4.69 2 8c0 3.31 2.69 6 6 6s6-2.69 6-6c0-3.31-2.69-6-6-6z"/><path d="M5.5 10.5c.5-1.5 1.5-2 2.5-2s2 .5 2.5 2"/></svg>
const IcCheck    = ({ size, color='currentColor' }: { size:number; color?:string }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8l4 4 8-8"/></svg>
const IcAlert    = ({ size, color='currentColor' }: { size:number; color?:string }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 5.5v3M8 10.5h.01"/></svg>
