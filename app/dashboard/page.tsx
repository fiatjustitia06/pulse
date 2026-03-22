'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import type { BusinessProfile, LocationPin } from '@/lib/types'
import LocationPopup from '@/components/map/LocationPopup'

const PulseMap = dynamic(() => import('@/components/map/PulseMap'), { ssr: false })

export default function DashboardPage() {
  const [profile, setProfile]         = useState<BusinessProfile | null>(null)
  const [selectedPin, setSelectedPin] = useState<LocationPin | null>(null)
  const [showPopup, setShowPopup]     = useState(false)
  const [loading, setLoading]         = useState(true)
  const [userEmail, setUserEmail]     = useState('')
  const [mapStyle, setMapStyle]       = useState<'street' | 'satellite'>('street')
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }
      setUserEmail(session.user.email || '')

      let activeBusiness = null
      try {
        const stored = sessionStorage.getItem('pulse_active_business')
        if (stored) activeBusiness = JSON.parse(stored)
      } catch {}

      if (!activeBusiness) { router.push('/businesses'); return }
      setProfile(activeBusiness)
      setLoading(false)
    }
    init()
  }, [router])

  const handleLocationSelect = useCallback((pin: LocationPin) => {
    setSelectedPin(pin)
    setShowPopup(true)
  }, [])

  const handleAnalyse = () => {
    if (!selectedPin) return
    const params = new URLSearchParams({
      lat: selectedPin.lat.toString(), lng: selectedPin.lng.toString(),
      address: selectedPin.address, suburb: selectedPin.suburb || '', postcode: selectedPin.postcode || '',
    })
    router.push(`/analysis?${params}`)
  }

  if (loading) return <LoadingScreen />

  const isAdmin = userEmail === 'charles060906@gmail.com'

  const isSat = mapStyle === 'satellite'
  const glassBase = isSat
    ? 'rgba(15,15,15,0.55)'
    : 'rgba(255,255,255,0.55)'
  const glassBorder = isSat
    ? '1px solid rgba(255,255,255,0.12)'
    : '1px solid rgba(255,255,255,0.45)'
  const glassText = isSat ? 'rgba(255,255,255,0.9)' : '#131515'
  const glassShadow = isSat
    ? '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)'
    : '0 4px 24px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.7)'

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>

      {/* ── Map fills entire viewport ───────────────────────────────────────── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <PulseMap onLocationSelect={handleLocationSelect} selectedPin={selectedPin} hideSearchBar onMapStyleChange={setMapStyle} />
      </div>

      {/* ── Floating overlay elements ───────────────────────────────────────── */}

      {/* Pulse logo + current business pill — top left */}
      <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 400, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={() => router.push('/businesses')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 14px 8px 10px', borderRadius: '14px',
            background: glassBase,
            backdropFilter: 'blur(28px) saturate(200%)',
            WebkitBackdropFilter: 'blur(28px) saturate(200%)',
            border: glassBorder,
            boxShadow: glassShadow,
            cursor: 'pointer', transition: 'background 0.2s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isSat ? 'rgba(15,15,15,0.72)' : 'rgba(255,255,255,0.72)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = glassBase }}
        >
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#0A8754', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="7.5" r="2.6" fill="white"/>
              <circle cx="7.5" cy="7.5" r="5.5" stroke="white" strokeWidth="1.1" strokeDasharray="2 1.5" fill="none"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: glassText, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>Pulse</span>
        </button>

        {/* Current business pill */}
        {profile && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '7px 13px', borderRadius: '14px',
            background: glassBase,
            backdropFilter: 'blur(28px) saturate(200%)',
            WebkitBackdropFilter: 'blur(28px) saturate(200%)',
            border: glassBorder,
            boxShadow: glassShadow,
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0A8754', flexShrink: 0, animation: 'blink 3s ease-in-out infinite' }} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: glassText, fontWeight: 500, whiteSpace: 'nowrap', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile.business_name}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: isSat ? 'rgba(255,255,255,0.35)' : 'rgba(19,21,21,0.3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>
              {profile.category}
            </span>
          </div>
        )}
      </div>

      {/* Search bar — top centre */}
      <div style={{ position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 400, width: '100%', maxWidth: '480px', padding: '0 16px' }}>
        <MapSearchBar onLocationSelect={handleLocationSelect} isSatellite={isSat} />
      </div>

      {/* Nav tabs — top right */}
      <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 400 }}>
        <nav style={{
          display: 'flex', alignItems: 'center', gap: '2px', padding: '5px',
          borderRadius: '14px',
          background: glassBase,
          backdropFilter: 'blur(28px) saturate(200%)',
          WebkitBackdropFilter: 'blur(28px) saturate(200%)',
          border: glassBorder,
          boxShadow: glassShadow,
        }}>
          <NavBtn icon={<IcMap />}      label="Map"          active  onClick={() => {}} isSat={isSat} />
          <NavBtn icon={<IcAnalyses />} label="My Analyses"          onClick={() => router.push('/analyses')} isSat={isSat} />
          <NavBtn icon={<IcSwitch />}   label="Businesses"           onClick={() => router.push('/businesses')} isSat={isSat} />
          <NavBtn icon={<IcSettings />} label="Settings"             onClick={() => router.push('/settings')} isSat={isSat} />
          {isAdmin && <NavBtn icon={<IcAdmin />} label="Admin" onClick={() => router.push('/admin')} admin isSat={isSat} />}
        </nav>
      </div>

      {/* Location popup */}
      {showPopup && selectedPin && (
        <LocationPopup
          pin={selectedPin}
          businessName={profile?.business_name || ''}
          onAnalyse={handleAnalyse}
          onDismiss={() => { setShowPopup(false); setSelectedPin(null) }}
          isSatellite={isSat}
        />
      )}

      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}

// ── Search bar with live suggestions via Photon (Komoot) ─────────────────
import { geocodeAddress } from '@/lib/analysis'
import toast from 'react-hot-toast'
import { useRef } from 'react'

function MapSearchBar({ onLocationSelect, isSatellite }: { onLocationSelect: (pin: LocationPin) => void; isSatellite?: boolean }) {
  const [query, setQuery]             = useState('')
  const [busy, setBusy]               = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSug, setShowSug]         = useState(false)
  const debounceRef                   = useRef<ReturnType<typeof setTimeout>>()

  const fetchSuggestions = (q: string) => {
    clearTimeout(debounceRef.current)
    if (q.trim().length < 2) { setSuggestions([]); setShowSug(false); return }
    debounceRef.current = setTimeout(async () => {
      try {
        // Photon by Komoot — free, no API key, excellent address autocomplete
        // bbox restricts to Greater Sydney: W,S,E,N
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q + ' Sydney')}&limit=6&bbox=150.5,-34.2,151.7,-33.4&lang=en`
        const res  = await fetch(url)
        const data = await res.json()
        const features = (data.features || []).filter((f: any) => {
          const props = f.properties
          // Only keep results actually within NSW/Sydney
          return props.state === 'New South Wales' || props.country === 'Australia'
        })
        setSuggestions(features)
        setShowSug(features.length > 0)
      } catch {}
    }, 250)
  }

  const selectSuggestion = (feature: any) => {
    const props = feature.properties
    const [lng, lat] = feature.geometry.coordinates
    // Build a clean address string from Photon's properties
    const parts = [props.name, props.street && props.housenumber ? `${props.housenumber} ${props.street}` : props.street, props.city || props.town || props.village, props.postcode].filter(Boolean)
    const address = parts.slice(0, 3).join(', ')
    const suburb  = props.city || props.town || props.village || props.suburb || ''
    const pin: LocationPin = { lat, lng, address, suburb, postcode: props.postcode || '' }
    setQuery(address)
    setSuggestions([])
    setShowSug(false)
    onLocationSelect(pin)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setShowSug(false)
    setBusy(true)
    try {
      const pin = await geocodeAddress(query)
      if (!pin) { toast.error('Address not found in Sydney'); return }
      onLocationSelect(pin)
      setQuery(pin.address.split(',').slice(0, 2).join(',').trim())
    } finally {
      setBusy(false)
    }
  }

  const formatSuggestion = (feature: any) => {
    const p = feature.properties
    const main = p.name || (p.housenumber ? `${p.housenumber} ${p.street}` : p.street) || p.city || ''
    const sub  = [p.street && p.name ? p.street : null, p.suburb || p.city || p.town, p.state].filter(Boolean).join(', ')
    return { main, sub }
  }

  const sbBg     = isSatellite ? 'rgba(15,15,15,0.55)'       : 'rgba(255,255,255,0.55)'
  const sbBorder = isSatellite ? 'rgba(255,255,255,0.12)'    : 'rgba(255,255,255,0.45)'
  const sbText   = isSatellite ? 'rgba(255,255,255,0.85)'    : '#131515'
  const sbBotBrd = isSatellite ? 'rgba(255,255,255,0.06)'    : 'rgba(255,255,255,0.2)'
  const sbShadow = isSatellite ? '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)' : '0 4px 24px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.7)'
  const sugBg    = isSatellite ? 'rgba(20,20,20,0.88)'       : 'rgba(255,255,255,0.82)'
  const sugBorder= isSatellite ? 'rgba(255,255,255,0.1)'     : 'rgba(255,255,255,0.6)'

  return (
    <div style={{ position: 'relative' }}>
      <form onSubmit={handleSubmit}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          height: '44px', padding: '0 6px 0 14px',
          borderRadius: showSug ? '14px 14px 0 0' : '14px',
          background: sbBg,
          backdropFilter: 'blur(28px) saturate(200%)',
          WebkitBackdropFilter: 'blur(28px) saturate(200%)',
          border: `1px solid ${sbBorder}`,
          borderBottom: showSug ? `1px solid ${sbBotBrd}` : `1px solid ${sbBorder}`,
          boxShadow: sbShadow,
          transition: 'box-shadow 0.15s, border-color 0.15s',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
            <circle cx="6" cy="6" r="4.5" stroke={sbText} strokeWidth="1.4"/>
            <path d="M9.5 9.5l2.5 2.5" stroke={sbText} strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); fetchSuggestions(e.target.value) }}
            onFocus={() => suggestions.length > 0 && setShowSug(true)}
            onBlur={() => setTimeout(() => setShowSug(false), 180)}
            placeholder="Search address, suburb or landmark…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: sbText, minWidth: 0 }}
          />
          <button type="submit" disabled={busy} style={{
            height: '32px', padding: '0 14px', borderRadius: '10px',
            background: '#0A8754', color: 'white', border: 'none',
            fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 500,
            cursor: busy ? 'not-allowed' : 'pointer', flexShrink: 0, transition: 'background 0.15s',
          }}
            onMouseEnter={e => { if (!busy) e.currentTarget.style.background = '#087044' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#0A8754' }}
          >
            {busy ? '…' : 'Search'}
          </button>
        </div>
      </form>

      {/* Suggestions */}
      {showSug && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '44px', left: 0, right: 0, zIndex: 500,
          background: sugBg, backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          borderRadius: '0 0 14px 14px',
          border: `1px solid ${sugBorder}`, borderTop: 'none',
          boxShadow: '0 12px 40px rgba(0,0,0,0.18)', overflow: 'hidden',
        }}>
          {suggestions.map((feat, i) => {
            const { main, sub } = formatSuggestion(feat)
            const type = feat.properties.type || feat.properties.osm_value || ''
            return (
              <button key={i} onMouseDown={() => selectSuggestion(feat)} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                width: '100%', textAlign: 'left', padding: '9px 14px',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: i < suggestions.length - 1 ? `1px solid ${isSatellite ? 'rgba(255,255,255,0.05)' : 'rgba(10,135,84,0.05)'}` : 'none',
                transition: 'background 0.1s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = isSatellite ? 'rgba(255,255,255,0.07)' : 'rgba(10,135,84,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(10,135,84,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="11" height="13" viewBox="0 0 11 13" fill="none">
                    <path d="M5.5 0C2.46 0 0 2.46 0 5.5c0 4.125 5.5 7.5 5.5 7.5S11 9.625 11 5.5C11 2.46 8.54 0 5.5 0z" fill="#0A8754" opacity="0.8"/>
                    <circle cx="5.5" cy="5.5" r="2" fill="white"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.84rem', color: sbText, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{main}</div>
                  {sub && <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: sbText, opacity: 0.45, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
                </div>
                {type && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#0A8754', background: 'rgba(10,135,84,0.12)', padding: '2px 7px', borderRadius: '20px', flexShrink: 0, textTransform: 'capitalize' }}>{type}</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Nav button ─────────────────────────────────────────────────────────────
function NavBtn({ icon, label, active, onClick, admin, isSat }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void; admin?: boolean; isSat?: boolean }) {
  const textColor = active ? '#0A8754' : admin ? '#B07156' : isSat ? 'rgba(255,255,255,0.82)' : '#131515'
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      padding: '6px 10px', borderRadius: '9px', border: 'none', cursor: 'pointer',
      background: active ? 'rgba(10,135,84,0.18)' : 'transparent',
      color: textColor,
      fontFamily: 'var(--font-body)', fontSize: '0.82rem',
      fontWeight: active ? 600 : 400,
      whiteSpace: 'nowrap', transition: 'background 0.15s',
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = admin ? 'rgba(176,113,86,0.15)' : isSat ? 'rgba(255,255,255,0.1)' : 'rgba(10,135,84,0.07)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ display: 'flex', opacity: active ? 1 : admin ? 0.8 : 0.65 }}>{icon}</span>
      {label}
    </button>
  )
}

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#E2EFDE' }}>
      <div style={{ width: '36px', height: '36px', border: '2.5px solid #0A8754', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const IcMap      = () => <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M1 3l4-1.5 4 1.5 4-1.5v10.5l-4 1.5-4-1.5-4 1.5V3z"/><path d="M5 1.5v10.5M9 3v10.5"/></svg>
const IcAnalyses = () => <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="1.5" width="12" height="12" rx="2"/><path d="M4.5 10l2-3 2 2 2-3"/></svg>
const IcSettings = () => <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="7.5" cy="7.5" r="2.2"/><path d="M7.5 1.5v1.5M7.5 12v1.5M1.5 7.5H3M12 7.5h1.5M3.2 3.2l1 1M10.8 10.8l1 1M3.2 11.8l1-1M10.8 4.2l1-1"/></svg>
const IcSwitch   = () => <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="1" y="3" width="6" height="4" rx="1"/><rect x="8" y="8" width="6" height="4" rx="1"/><path d="M7 5h1.5M6.5 10H5"/></svg>
const IcAdmin    = () => <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M7.5 1.5L2 4v4c0 3 2.5 5.5 5.5 6 3-0.5 5.5-3 5.5-6V4z"/></svg>
