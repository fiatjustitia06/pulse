'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { analyseLocation, validateLocation } from '@/lib/analysis'
import type { LocationPin } from '@/lib/types'

const STEPS = [
  { label: 'Validating location',       detail: 'Checking this is a real, accessible address in Sydney' },
  { label: 'Geographic context',        detail: 'Suburb, LGA & distance to CBD via Nominatim' },
  { label: 'Transport & accessibility', detail: 'Train stations, buses, light rail & ferries + Walk Score' },
  { label: 'Demographics & planning',   detail: 'ABS 2021 Census, SEIFA index, NSW zoning data' },
  { label: 'Competitor landscape',      detail: 'OSM + Google Places — nearby businesses with ratings' },
  { label: 'Rent & market data',        detail: 'CBRE/JLL estimates + Domain/REA listings nearby' },
  { label: 'Generating AI summary',     detail: 'Claude analyses all data points and scores this location' },
]

// ── External API fetcher (calls server route to protect keys) ────────────────
async function fetchExternalData(pin: LocationPin, profile: any): Promise<Record<string, any>> {
  try {
    const res = await fetch('/api/external-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: pin.lat, lng: pin.lng, suburb: pin.suburb, category: profile.category }),
    })
    if (!res.ok) return {}
    return await res.json()
  } catch {
    return {}
  }
}

export default function AnalysisLoader() {
  const [currentStep, setCurrentStep] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const params = useSearchParams()
  const hasRun = useRef(false)

  const pin: LocationPin = {
    lat: parseFloat(params.get('lat') || '-33.8688'),
    lng: parseFloat(params.get('lng') || '151.2093'),
    address: params.get('address') || 'Sydney',
    suburb: params.get('suburb') || '',
    postcode: params.get('postcode') || '',
  }

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true
    runAnalysis()
  }, [])

  const runAnalysis = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      // Load active business from sessionStorage (set by /businesses selector)
      let profile = null
      try {
        const stored = sessionStorage.getItem('pulse_active_business')
        if (stored) profile = JSON.parse(stored)
      } catch {}
      if (!profile) { router.push('/businesses'); return }

      // ── Step 0: validate location ──────────────────────────────────
      setCurrentStep(0)
      const validation = await validateLocation(pin.lat, pin.lng)
      if (!validation.valid) {
        setError(validation.reason || 'Invalid location — please select a valid Sydney address.')
        return
      }
      const validPin = validation.pin || pin

      // ── Animate remaining steps concurrently with real work ────────
      let stepIdx = 1
      const stepInterval = setInterval(() => {
        stepIdx++
        if (stepIdx < STEPS.length) setCurrentStep(stepIdx)
        else clearInterval(stepInterval)
      }, 900)

      // ── Run core analysis + external API calls in parallel ────────
      const [result, externalData] = await Promise.all([
        analyseLocation(validPin, profile),
        fetchExternalData(validPin, profile),
      ])

      if ((result as any).invalid) {
        clearInterval(stepInterval)
        setError((result as any).invalid)
        return
      }

      const { scores, insights, projections } = result

      // Merge external data into insights
      ;(insights as any).externalData = externalData

      // Adjust scores with Walk Score if available
      if (externalData.walkScore) {
        const wsBonus = Math.round((externalData.walkScore - 50) * 0.08)
        scores.transport = Math.min(98, Math.max(10, scores.transport + wsBonus))
      }

      // ── AI summary + AI overall score ─────────────────────────────
      let ai_summary = ''
      let aiOverall: number | null = null
      try {
        const res = await fetch('/api/ai-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: validPin, profile, scores, insights, projections }),
        })
        const d = await res.json()
        ai_summary = d.summary || ''
        aiOverall  = typeof d.aiOverall === 'number' ? d.aiOverall : null
        if (aiOverall !== null) {
          // Replace algorithm score with AI score
          scores.overall = aiOverall
          ;(scores as any).aiScoredOverall = true
          ;(scores as any).aiScoreRationale = d.aiRationale || ''
        }
      } catch {
        ai_summary = generateFallback(profile, validPin, scores)
      }

      clearInterval(stepInterval)
      setCurrentStep(STEPS.length - 1)

      // ── Save to Supabase ───────────────────────────────────────────
      const { data: saved, error: saveErr } = await supabase
        .from('analysis_results')
        .insert({
          business_id: profile.id, user_id: user.id,
          location_lat: validPin.lat,  location_lng: validPin.lng,
          location_address: validPin.address, location_suburb: validPin.suburb,
          location_postcode: validPin.postcode,
          scores, insights, projections, ai_summary,
        })
        .select().single()

      if (saveErr) {
        console.warn('DB save failed:', saveErr.message)
        try {
          sessionStorage.setItem('pulse_analysis', JSON.stringify({
            scores, insights, projections, ai_summary, pin: validPin, profile
          }))
        } catch {}
      }

      supabase.from('activity_log').insert({
        user_id: user.id, user_email: user.email,
        event_type: 'analysis_created',
        metadata: { address: validPin.address, suburb: validPin.suburb, score: scores.overall, business: profile.business_name, category: profile.category },
      }).then(() => {})

      setDone(true)
      setTimeout(() => { router.push(saved?.id ? `/analysis/${saved.id}` : '/analysis/preview') }, 700)

    } catch (err: any) {
      setError(err.message || 'Analysis failed — please try again.')
    }
  }

  const progress = Math.round(((currentStep + 1) / STEPS.length) * 100)

  return (
    <div style={{ minHeight: '100vh', background: '#E2EFDE', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '500px' }}>

        {/* Status icon + heading */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '18px', margin: '0 auto 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: error ? 'rgba(176,113,86,0.08)' : done ? '#0A8754' : 'white',
            border: error ? '1.5px solid rgba(176,113,86,0.25)' : done ? 'none' : '1.5px solid rgba(10,135,84,0.12)',
            boxShadow: done ? '0 8px 28px rgba(10,135,84,0.28)' : '0 4px 16px rgba(10,135,84,0.07)',
            transition: 'all 0.4s',
          }}>
            {error ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B07156" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 15.5h.01"/>
              </svg>
            ) : done ? (
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                <path d="M5 13l5.5 5.5L21 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <div style={{ width: '26px', height: '26px', border: '2.5px solid #0A8754', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            )}
          </div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: '#131515', marginBottom: '5px', letterSpacing: '-0.02em' }}>
            {error ? 'Location issue' : done ? 'Analysis complete!' : 'Analysing location…'}
          </h1>
          {!error && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#131515', opacity: 0.45 }}>
              {done ? 'Redirecting to your report…' : `${pin.suburb ? pin.suburb + ' · ' : ''}${pin.address.split(',')[0]}`}
            </p>
          )}
        </div>

        {/* Error state */}
        {error ? (
          <div style={{ background: 'white', borderRadius: '18px', padding: '1.8rem', border: '1px solid rgba(176,113,86,0.18)', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: '#B07156', lineHeight: 1.65, marginBottom: '1.5rem' }}>
              {error}
            </p>
            <button onClick={() => router.push('/dashboard')} style={{
              padding: '10px 24px', borderRadius: '10px', background: '#0A8754',
              color: 'white', border: 'none', fontFamily: 'var(--font-body)',
              fontSize: '0.88rem', cursor: 'pointer', fontWeight: 500,
            }}>
              ← Back to map
            </button>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div style={{ marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#0A8754', letterSpacing: '0.02em' }}>
                  {STEPS[currentStep]?.label}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#131515', opacity: 0.35 }}>
                  {progress}%
                </span>
              </div>
              <div style={{ height: '5px', background: 'rgba(10,135,84,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: '#0A8754', borderRadius: '3px',
                  width: `${progress}%`, transition: 'width 0.7s ease',
                  boxShadow: '2px 0 8px rgba(10,135,84,0.4)',
                }} />
              </div>
            </div>

            {/* Step list */}
            <div style={{
              background: 'white', borderRadius: '18px',
              border: '1.5px solid rgba(10,135,84,0.08)',
              overflow: 'hidden', boxShadow: '0 4px 20px rgba(10,135,84,0.05)',
            }}>
              {STEPS.map((step, i) => {
                const isComplete = i < currentStep || done
                const isActive = i === currentStep && !done
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '11px 16px',
                    borderBottom: i < STEPS.length - 1 ? '1px solid rgba(10,135,84,0.05)' : 'none',
                    background: isActive ? 'rgba(10,135,84,0.03)' : 'transparent',
                    transition: 'background 0.3s',
                  }}>
                    {/* State indicator */}
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '7px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isComplete ? '#0A8754' : isActive ? 'rgba(10,135,84,0.1)' : 'rgba(19,21,21,0.04)',
                      transition: 'all 0.3s',
                    }}>
                      {isComplete ? (
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                          <path d="M1.5 5.5l2.5 2.5 5.5-5.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                        </svg>
                      ) : isActive ? (
                        <div style={{ width: '10px', height: '10px', border: '1.8px solid #0A8754', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      ) : (
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#131515', opacity: 0.15 }} />
                      )}
                    </div>

                    {/* Label */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontFamily: 'var(--font-body)', fontSize: '0.83rem',
                        color: isActive ? '#0A8754' : '#131515',
                        fontWeight: isActive ? 500 : 400,
                        opacity: (i > currentStep && !done) ? 0.28 : 1,
                        transition: 'all 0.3s',
                      }}>
                        {step.label}
                      </div>
                      {isActive && (
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', color: '#0A8754', opacity: 0.6, marginTop: '1px' }}>
                          {step.detail}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <p style={{ textAlign: 'center', marginTop: '14px', fontFamily: 'var(--font-body)', fontSize: '0.7rem', color: '#131515', opacity: 0.28 }}>
              Overpass API · Nominatim · ABS Census 2021 · Claude AI
            </p>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function generateFallback(profile: any, pin: LocationPin, scores: any): string {
  const s = scores.overall
  const rating = s >= 75 ? 'excellent' : s >= 60 ? 'strong' : s >= 45 ? 'moderate' : 'challenging'
  return `## Verdict\n\n${pin.suburb || 'This location'} presents a **${rating} opportunity** for ${profile.business_name} with an overall score of **${s}/100**.\n\n## Opportunities\n\n- ${scores.transport > 65 ? '**Strong public transit connectivity** expands your customer catchment beyond walking distance' : 'Local accessibility supports community-driven customer traffic'}\n- ${scores.footTraffic > 60 ? '**Meaningful daily foot traffic** from nearby amenities and density' : 'Steady local customer base with predictable demand patterns'}\n- ${scores.demographics > 60 ? '**Favourable demographics** align well with your target customer profile' : 'Moderate demographic match — targeted marketing will sharpen customer acquisition'}\n\n## Risks\n\n- ${scores.competition < 52 ? `**High competition** (${scores.competition}/100) — a clear differentiation strategy and strong brand identity are essential` : 'Competition levels are manageable for a well-positioned business with clear value proposition'}\n- ${scores.rentValue < 45 ? '**Rental costs relative to budget** will require careful cash flow planning, especially in months 1–6' : 'Rental costs appear within range for your stated budget'}\n\n## Recommendation\n\n${s >= 60 ? `This location shows genuine promise. Engage a commercial leasing agent (try CBRE or Colliers in Sydney) to verify rental estimates, and review the relevant council DA portal for any planned nearby developments.` : `Consider exploring alternative nearby suburbs or adjusting your budget and format before committing. A pop-up or short-term lease trial would reduce risk.`}`
}
