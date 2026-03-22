'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'

interface BusinessProfile {
  id: string
  business_name: string
  category: string
  description: string
  budget: string
  created_at: string
}

const CATEGORY_ICONS: Record<string, string> = {
  'Restaurant & Cafe': '☕', 'Retail & Fashion': '🛍️', 'Health & Fitness': '💪',
  'Professional Services': '💼', 'Technology': '💻', 'Entertainment & Leisure': '🎭',
  'Education': '📚', 'Beauty & Wellness': '✨', 'Automotive': '🚗',
  'Real Estate': '🏠', 'Other': '🌱',
}

export default function BusinessesPage() {
  const [profiles, setProfiles] = useState<BusinessProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }

      setUserEmail(session.user.email || '')

      // Log login activity
      await supabase.from('activity_log').insert({
        user_id: session.user.id,
        user_email: session.user.email,
        event_type: 'page_view',
        metadata: { page: 'businesses' },
      }).then(() => {}) // fire and forget

      const { data } = await supabase
        .from('business_profiles')
        .select('id, business_name, category, description, budget, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      setProfiles(data || [])
      setLoading(false)
    }
    init()
  }, [router])

  const selectBusiness = (profile: BusinessProfile) => {
    // Store selected business in sessionStorage for the dashboard
    sessionStorage.setItem('pulse_active_business', JSON.stringify(profile))
    router.push('/dashboard')
  }

  const deleteBusiness = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this business profile and all its analyses? This cannot be undone.')) return
    setDeleting(id)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('business_profiles').delete().eq('id', id)
      if (error) throw error
      setProfiles(p => p.filter(x => x.id !== id))
      toast.success('Business deleted.')
    } catch {
      toast.error('Failed to delete')
    } finally {
      setDeleting(null)
    }
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return <Spinner />

  return (
    <div style={{ minHeight: '100vh', background: '#E2EFDE' }}>
      {/* Dot pattern */}
      <div style={{ position: 'fixed', inset: 0, opacity: 0.04, pointerEvents: 'none', backgroundImage: 'radial-gradient(rgba(10,135,84,1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(226,239,222,0.92)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(10,135,84,0.1)',
        padding: '0 24px', height: '56px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#0A8754', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3" fill="white"/>
              <circle cx="8" cy="8" r="6" stroke="white" strokeWidth="1.2" strokeDasharray="2 1.5" fill="none"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: '#131515', letterSpacing: '-0.02em' }}>Pulse</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#131515', opacity: 0.45 }}>{userEmail}</span>
          {userEmail === 'charles060906@gmail.com' && (
            <button onClick={() => router.push('/admin')} style={{
              padding: '5px 12px', borderRadius: '8px', background: 'rgba(176,113,86,0.1)',
              border: '1px solid rgba(176,113,86,0.2)', color: '#B07156',
              fontFamily: 'var(--font-mono)', fontSize: '0.68rem', cursor: 'pointer', letterSpacing: '0.05em',
            }}>
              ADMIN
            </button>
          )}
          <button onClick={handleSignOut} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#131515', opacity: 0.45,
            display: 'flex', alignItems: 'center', gap: '5px',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <path d="M5.5 2H2.5a1 1 0 00-1 1v8a1 1 0 001 1h3M9 10l3-3-3-3M12 7H6"/>
            </svg>
            Sign out
          </button>
        </div>
      </header>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '48px 20px 80px', position: 'relative', zIndex: 1 }}>

        <div style={{ marginBottom: '2.5rem' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', color: '#131515', letterSpacing: '-0.025em', marginBottom: '8px' }}>
            Your Businesses
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: '#131515', opacity: 0.5 }}>
            Select a business to analyse locations, or create a new one.
          </p>
        </div>

        {/* Business cards */}
        <motion.div
          style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}
          initial="hidden" animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } }}
        >
          {profiles.map(profile => (
            <motion.div
              key={profile.id}
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25,0.46,0.45,0.94] } } }}
              whileHover={{ y: -2, boxShadow: '0 8px 32px rgba(10,135,84,0.14)', borderColor: 'rgba(10,135,84,0.25)' }}
              whileTap={{ scale: 0.99 }}
              onClick={() => selectBusiness(profile)}
              style={{
                background: 'white', borderRadius: '18px', padding: '1.4rem 1.6rem',
                border: '1.5px solid rgba(10,135,84,0.1)',
                boxShadow: '0 2px 16px rgba(10,135,84,0.05)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '1.2rem',
              }}
            >
              {/* Icon */}
              <div style={{
                width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0,
                background: 'rgba(10,135,84,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem',
              }}>
                {CATEGORY_ICONS[profile.category] || '🌱'}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '1rem', color: '#131515', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile.business_name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: '#0A8754',
                    background: 'rgba(10,135,84,0.08)', padding: '2px 8px', borderRadius: '20px',
                  }}>
                    {profile.category}
                  </span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.76rem', color: '#131515', opacity: 0.4 }}>
                    {profile.budget}
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#131515', opacity: 0.45, marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile.description}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {/* Delete */}
                <button
                  onClick={e => deleteBusiness(profile.id, e)}
                  disabled={deleting === profile.id}
                  style={{
                    width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                    background: 'rgba(176,113,86,0.08)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: deleting === profile.id ? 0.5 : 0.6, transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#B07156" strokeWidth="1.4" strokeLinecap="round">
                    <path d="M2 4h10M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M12 4l-.8 7.5a1 1 0 01-1 .9H3.8a1 1 0 01-1-.9L2 4"/>
                  </svg>
                </button>

                {/* Arrow */}
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#0A8754', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M3 7h8M7 3l4 4-4 4"/>
                  </svg>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Create new */}
        <motion.button
          onClick={() => router.push('/onboarding')}
          whileHover={{ scale: 1.01, borderColor: 'rgba(10,135,84,0.4)', background: 'rgba(10,135,84,0.04)' }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{
            width: '100%', padding: '1.2rem',
            borderRadius: '18px', border: '2px dashed rgba(10,135,84,0.25)',
            background: 'transparent', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
          }}
        >
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(10,135,84,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#0A8754" strokeWidth="1.8" strokeLinecap="round">
              <path d="M7 2v10M2 7h10"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: '#0A8754', fontWeight: 500 }}>
            Add a new business
          </span>
        </motion.button>

        {profiles.length === 0 && (
          <p style={{ textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#131515', opacity: 0.35, marginTop: '2rem' }}>
            No businesses yet — create your first one above.
          </p>
        )}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ minHeight: '100vh', background: '#E2EFDE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '36px', height: '36px', border: '2.5px solid #0A8754', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
