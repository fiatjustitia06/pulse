'use client'

import { useEffect, useRef, useState } from 'react'
import type { LocationPin } from '@/lib/types'
import { geocodeAddress, reverseGeocode, validateLocation, isWithinSydney } from '@/lib/analysis'
import toast from 'react-hot-toast'

interface MapProps {
  onLocationSelect: (pin: LocationPin) => void
  selectedPin: LocationPin | null
  hideSearchBar?: boolean
  onMapStyleChange?: (style: 'street' | 'satellite') => void
}

export default function PulseMap({ onLocationSelect, selectedPin, hideSearchBar, onMapStyleChange }: MapProps) {
  const mapRef        = useRef<any>(null)
  const markerRef     = useRef<any>(null)
  const tileLayerRef  = useRef<any>(null)
  const containerRef  = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)
  const [searchQuery, setSearchQuery]     = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [suggestions, setSuggestions]     = useState<LocationPin[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [mapStyle, setMapStyle] = useState<MapStyleKey>('street')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const TILES = {
    street:    { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attr: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>' },
    satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: 'Tiles © Esri — Source: Esri, DigitalGlobe, GeoEye, Earthstar Geographics' },
  } as const
  type MapStyleKey = keyof typeof TILES

  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return
    const L = (window as any)._leafletLib
    if (!L) return
    const map = mapRef.current
    tileLayerRef.current.remove()
    const t = TILES[mapStyle]
    tileLayerRef.current = L.tileLayer(t.url, {
      attribution: t.attr,
      subdomains: mapStyle === 'street' ? 'abcd' : 'abcd',
      maxZoom: 19,
    }).addTo(map)
    tileLayerRef.current.bringToBack()
  }, [mapStyle])

  // ── Initialise Leaflet ────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (initializedRef.current) return
    if (!containerRef.current) return
    initializedRef.current = true

    const initMap = async () => {
      const L = (await import('leaflet')).default
      ;(window as any)._leafletLib = L  // store for tile swap

      // Fix default icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      // Guard: if container already has a leaflet map, destroy it first
      const container = containerRef.current as any
      if (container._leaflet_id) {
        container._leaflet_id = null
      }

      const map = L.map(containerRef.current!, {
        center: [-33.8688, 151.2093], // Sydney CBD
        zoom: 13,
        zoomControl: false,
      })
      mapRef.current = map

      // Initial tile layer
      const initStyle = (document.documentElement.getAttribute('data-map-style') as any) || 'street'
      const t = TILES[initStyle as 'street' | 'dark' | 'satellite'] || TILES.street
      tileLayerRef.current = L.tileLayer(t.url, { attribution: t.attr, subdomains: 'abcd', maxZoom: 19 }).addTo(map)

      // Custom zoom control
      L.control.zoom({ position: 'bottomright' }).addTo(map)

      // Custom pin icon
      const pulseIcon = makePulseIcon(L)

      // Click handler — validates before placing pin
      map.on('click', async (e: any) => {
        const { lat, lng } = e.latlng

        // Quick bounds check (instant, no API call)
        if (!isWithinSydney(lat, lng)) {
          toast.error('Pulse only covers Greater Sydney. Please select a location within Sydney.')
          return
        }

        // Validate land / address via Nominatim
        const validation = await validateLocation(lat, lng)
        if (!validation.valid) {
          toast.error(validation.reason || 'Invalid location — please select a land-based address.')
          return
        }

        const validPin = validation.pin!
        if (markerRef.current) markerRef.current.remove()
        markerRef.current = L.marker([lat, lng], { icon: pulseIcon }).addTo(map)
        onLocationSelectRef.current(validPin)
      })
    }

    initMap()

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        initializedRef.current = false
      }
    }
  }, []) // empty deps — only run once on mount

  // Keep a stable ref to onLocationSelect so the map click handler
  // doesn't go stale when the parent re-renders
  const onLocationSelectRef = useRef(onLocationSelect)
  useEffect(() => { onLocationSelectRef.current = onLocationSelect }, [onLocationSelect])

  // ── Update marker when selectedPin changes externally (e.g. search) ───────
  useEffect(() => {
    if (!selectedPin || !mapRef.current) return

    const updateMarker = async () => {
      const L = (await import('leaflet')).default
      const pulseIcon = makePulseIcon(L)

      if (markerRef.current) markerRef.current.remove()

      markerRef.current = L.marker([selectedPin.lat, selectedPin.lng], { icon: pulseIcon })
        .addTo(mapRef.current)

      mapRef.current.setView([selectedPin.lat, selectedPin.lng], 15, { animate: true })
    }

    updateMarker()
  }, [selectedPin])

  const buildPopupHtml = (pin: LocationPin) => `
    <div style="font-family:var(--font-body);padding:2px 0;">
      <div style="font-size:0.7rem;color:#0A8754;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:5px;">Selected Location</div>
      <div style="font-size:0.88rem;color:#131515;font-weight:500;line-height:1.4;">${pin.address}</div>
      ${pin.suburb ? `<div style="font-size:0.76rem;color:#131515;opacity:0.5;margin-top:2px;">${pin.suburb}${pin.postcode ? ' · ' + pin.postcode : ''}</div>` : ''}
    </div>
  `

  // ── Search / autocomplete ─────────────────────────────────────────────────
  const handleSearchInput = (val: string) => {
    setSearchQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.length < 3) { setSuggestions([]); setShowSuggestions(false); return }

    debounceRef.current = setTimeout(async () => {
      try {
        const query = encodeURIComponent(`${val}, Sydney, NSW, Australia`)
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=5&addressdetails=1&countrycodes=au`,
          { headers: { 'Accept-Language': 'en', 'User-Agent': 'Pulse-Platform/1.0' } }
        )
        const data = await res.json()
        const pins: LocationPin[] = data.map((r: any) => ({
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          address: r.display_name.split(',').slice(0, 3).join(',').trim(),
          suburb: r.address?.suburb || r.address?.city_district || r.address?.town || '',
          postcode: r.address?.postcode || '',
        }))
        setSuggestions(pins)
        setShowSuggestions(true)
      } catch {}
    }, 350)
  }

  const selectSuggestion = (pin: LocationPin) => {
    setSearchQuery(pin.address)
    setSuggestions([])
    setShowSuggestions(false)
    onLocationSelect(pin)
  }

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    try {
      const pin = await geocodeAddress(searchQuery)
      if (!pin) { toast.error('Address not found in Sydney'); return }
      onLocationSelect(pin)
      setSearchQuery(pin.address)
      setShowSuggestions(false)
    } finally {
      setSearchLoading(false)
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Search bar — hidden when dashboard provides its own */}
      {!hideSearchBar && (
      <div style={{
        position: 'absolute', top: '16px', left: '16px', right: '16px',
        zIndex: 1000, maxWidth: '440px',
      }}>
        <form onSubmit={handleSearchSubmit}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: 'rgba(226,239,222,0.97)',
            backdropFilter: 'blur(12px)',
            borderRadius: '14px',
            border: '1.5px solid rgba(10,135,84,0.2)',
            padding: '10px 14px',
            boxShadow: '0 8px 32px rgba(10,135,84,0.12)',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="6.5" cy="6.5" r="5" stroke="#0A8754" strokeWidth="1.5"/>
              <path d="M10 10l3.5 3.5" stroke="#0A8754" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              value={searchQuery}
              onChange={e => handleSearchInput(e.target.value)}
              onFocus={() => suggestions.length && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Search an address in Sydney…"
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#131515',
              }}
            />
            {searchLoading ? (
              <div style={{ width: '16px', height: '16px', border: '2px solid #0A8754', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            ) : (
              <button type="submit" style={{ background: '#0A8754', border: 'none', color: 'white', borderRadius: '8px', padding: '4px 10px', fontFamily: 'var(--font-body)', fontSize: '0.78rem', cursor: 'pointer' }}>
                Go
              </button>
            )}
          </div>
        </form>

        {/* Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div style={{
            marginTop: '4px',
            background: 'rgba(226,239,222,0.97)',
            backdropFilter: 'blur(12px)',
            borderRadius: '12px',
            border: '1.5px solid rgba(10,135,84,0.15)',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(10,135,84,0.12)',
          }}>
            {suggestions.map((s, i) => (
              <button
                key={i}
                onMouseDown={() => selectSuggestion(s)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '10px 14px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-body)', fontSize: '0.83rem', color: '#131515',
                  borderBottom: i < suggestions.length - 1 ? '1px solid rgba(10,135,84,0.08)' : 'none',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(10,135,84,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <svg width="11" height="14" viewBox="0 0 11 14" fill="none" style={{ marginRight: '6px', flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}><path d="M5.5 0C2.46 0 0 2.46 0 5.5c0 4.125 5.5 8.5 5.5 8.5S11 9.625 11 5.5C11 2.46 8.54 0 5.5 0z" fill="#0A8754" opacity="0.7"/><circle cx="5.5" cy="5.5" r="2" fill="white"/></svg>
                {s.address}
                {s.suburb && <span style={{ opacity: 0.5, marginLeft: '4px' }}>· {s.suburb}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      )} {/* end !hideSearchBar */}

      {/* Map style switcher — bottom left */}
      <div style={{
        position: 'absolute', bottom: '20px', left: '16px', zIndex: 1000,
        display: 'flex', gap: '4px',
        background: mapStyle === 'satellite' ? 'rgba(15,15,15,0.6)' : 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        borderRadius: '12px',
        border: mapStyle === 'satellite' ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.5)',
        padding: '4px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
        transition: 'background 0.3s, border-color 0.3s',
      }}>
        {(['street', 'satellite'] as MapStyleKey[]).map(style => (
          <button key={style} onClick={() => { setMapStyle(style); onMapStyleChange?.(style) }} style={{
            padding: '5px 11px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: mapStyle === style ? '#0A8754' : 'transparent',
            color: mapStyle === style ? 'white' : mapStyle === 'satellite' ? 'rgba(255,255,255,0.7)' : '#131515',
            fontFamily: 'var(--font-body)', fontSize: '0.72rem', fontWeight: mapStyle === style ? 600 : 400,
            opacity: mapStyle === style ? 1 : 0.75, transition: 'all 0.15s',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            {style === 'street'
              ? <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M1 3l3.5-1.5 3.5 1.5L12 1.5v9l-4 1.5-3.5-1.5L1 12V3z"/><path d="M4.5 1.5v9M8 3v9"/></svg>
              : <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><circle cx="6.5" cy="6.5" r="5.5"/><ellipse cx="6.5" cy="6.5" rx="2.5" ry="5.5"/><path d="M1 6.5h11"/><path d="M2 4h9M2 9h9"/></svg>
            }
            {style === 'street' ? 'Street' : 'Satellite'}
          </span>
          </button>
        ))}
      </div>

      {/* Map hint */}
      {!selectedPin && (
        <div style={{
          position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000,
          background: mapStyle === 'satellite' ? 'rgba(15,15,15,0.6)' : 'rgba(255,255,255,0.55)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          borderRadius: '10px',
          padding: '8px 16px',
          border: mapStyle === 'satellite' ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.5)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          fontSize: '0.78rem',
          fontFamily: 'var(--font-body)',
          color: mapStyle === 'satellite' ? 'rgba(255,255,255,0.8)' : '#131515',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          transition: 'background 0.3s, color 0.3s, border-color 0.3s',
        }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="#0A8754" strokeWidth="1.2"/><path d="M6.5 3.5v3l2 1.5" stroke="#0A8754" strokeWidth="1.2" strokeLinecap="round"/></svg>
          Click anywhere on the map to drop a pin
        </div>
      )}

      {/* Map container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function makePulseIcon(L: any) {
  // Pure SVG pin — dot is mathematically centered in the head circle
  return L.divIcon({
    html: `
      <svg width="32" height="44" viewBox="0 0 32 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Drop shadow -->
        <ellipse cx="16" cy="42" rx="6" ry="2.5" fill="rgba(0,0,0,0.18)"/>
        <!-- Pin body -->
        <path d="M16 2C9.37 2 4 7.37 4 14C4 23.5 16 42 16 42C16 42 28 23.5 28 14C28 7.37 22.63 2 16 2Z" fill="#0A8754"/>
        <!-- White border ring -->
        <path d="M16 2C9.37 2 4 7.37 4 14C4 23.5 16 42 16 42C16 42 28 23.5 28 14C28 7.37 22.63 2 16 2Z" stroke="white" stroke-width="2.5" fill="none"/>
        <!-- Centered white dot -->
        <circle cx="16" cy="14" r="5" fill="white"/>
      </svg>
    `,
    className: '',
    iconSize: [32, 44],
    iconAnchor: [16, 44],
    popupAnchor: [0, -48],
  })
}
