'use client'

import { motion } from 'framer-motion'
import type { LocationPin } from '@/lib/types'

interface LocationPopupProps {
  pin: LocationPin
  businessName: string
  onAnalyse: () => void
  onDismiss: () => void
  isSatellite?: boolean
}

export default function LocationPopup({ pin, businessName, onAnalyse, onDismiss, isSatellite }: LocationPopupProps) {
  const bg      = isSatellite ? 'rgba(15,15,15,0.72)' : 'rgba(255,255,255,0.72)'
  const border  = isSatellite ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.5)'
  const shadow  = isSatellite ? '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)' : '0 20px 60px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.8)'
  const text    = isSatellite ? 'rgba(255,255,255,0.9)' : '#131515'
  const subText = isSatellite ? 'rgba(255,255,255,0.45)' : 'rgba(19,21,21,0.5)'
  const xBg     = isSatellite ? 'rgba(255,255,255,0.1)' : 'rgba(19,21,21,0.06)'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97, x: '-50%' }}
      animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
      exit={{ opacity: 0, y: 16, scale: 0.97, x: '-50%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      style={{
        position: 'absolute', bottom: '32px', left: '50%',
        zIndex: 2000, width: 'min(420px, calc(100vw - 32px))',
        background: bg,
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        borderRadius: '20px', border, boxShadow: shadow,
        padding: '1.5rem',
      }}
    >
      {/* Close */}
      <button onClick={onDismiss} style={{
        position: 'absolute', top: '14px', right: '14px',
        background: xBg, border: 'none', borderRadius: '8px',
        width: '28px', height: '28px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M1 1l10 10M11 1L1 11" stroke={isSatellite ? 'rgba(255,255,255,0.7)' : '#131515'} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Location info */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '1.2rem' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0, background: 'rgba(10,135,84,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 2C7.69 2 5 4.69 5 8c0 5.25 6 12 6 12s6-6.75 6-12c0-3.31-2.69-6-6-6z" fill="#0A8754" opacity="0.9"/>
            <circle cx="11" cy="8" r="2.5" fill="white"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: '#0A8754', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>
            Selected Location
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.92rem', color: text, fontWeight: 500, lineHeight: 1.4 }}>
            {pin.address}
          </div>
          {pin.suburb && (
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: subText, marginTop: '2px' }}>
              {pin.suburb}{pin.postcode ? ` · ${pin.postcode}` : ''}
              {' · '}{pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <motion.button
        onClick={onAnalyse}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        style={{
          width: '100%', padding: '13px 20px', borderRadius: '13px',
          background: '#0A8754', color: 'white', border: 'none',
          fontFamily: 'var(--font-body)', fontSize: '0.92rem', fontWeight: 500,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '8px', boxShadow: '0 4px 20px rgba(10,135,84,0.4)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 2v12M2 8h12" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
          <circle cx="8" cy="8" r="6.5" stroke="white" strokeWidth="1.2" strokeDasharray="2.5 1.5"/>
        </svg>
        Analyse {businessName ? `for "${businessName}"` : 'this location'}
      </motion.button>
    </motion.div>
  )
}
