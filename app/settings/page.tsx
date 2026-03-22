'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { BusinessCategory, BudgetRange } from '@/lib/types'
import toast from 'react-hot-toast'

const CATEGORIES: BusinessCategory[] = [
  'Restaurant & Cafe', 'Retail & Fashion', 'Health & Fitness', 'Professional Services',
  'Technology', 'Entertainment & Leisure', 'Education', 'Beauty & Wellness',
  'Automotive', 'Real Estate', 'Other',
]
const BUDGETS: BudgetRange[] = ['Under $50K', '$50K – $150K', '$150K – $500K', '$500K – $1M', 'Over $1M']

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [form, setForm] = useState({ business_name: '', owner_name: '', category: '', description: '', budget: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }
      setUserEmail(session.user.email || '')

      // Load active business from sessionStorage
      let activeBusiness = null
      try {
        const stored = sessionStorage.getItem('pulse_active_business')
        if (stored) activeBusiness = JSON.parse(stored)
      } catch {}

      if (!activeBusiness) { router.push('/businesses'); return }
      setProfile(activeBusiness)
      setForm({
        business_name: activeBusiness.business_name,
        owner_name: activeBusiness.owner_name,
        category: activeBusiness.category,
        description: activeBusiness.description,
        budget: activeBusiness.budget,
      })
      setLoading(false)
    }
    init()
  }, [router])

  const handleSave = async () => {
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('business_profiles').update(form).eq('id', profile.id)
      if (error) throw error
      const updated = { ...profile, ...form }
      setProfile(updated)
      // Keep sessionStorage in sync
      sessionStorage.setItem('pulse_active_business', JSON.stringify(updated))
      toast.success('Settings saved!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save')
    } finally {
      setSaving(false)
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
      <header style={{
        position: 'sticky', top: 0, zIndex: 100, background: 'rgba(226,239,222,0.92)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(10,135,84,0.1)', padding: '0 24px', height: '56px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.push('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#131515', opacity: 0.5 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 2L4 7l5 5"/></svg>
            Dashboard
          </button>
          <span style={{ color: 'rgba(19,21,21,0.2)' }}>/</span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#131515', fontWeight: 500 }}>Settings</span>
        </div>
      </header>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 20px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: '#131515', letterSpacing: '-0.02em', marginBottom: '8px' }}>Settings</h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#131515', opacity: 0.5, marginBottom: '2.5rem' }}>
          Manage your business profile and account.
        </p>

        {/* Account info */}
        <Section title="Account">
          <div style={{ padding: '1rem 1.2rem', borderRadius: '12px', background: 'rgba(10,135,84,0.05)', border: '1px solid rgba(10,135,84,0.1)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#131515', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Signed in as</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: '#131515', fontWeight: 500 }}>{userEmail || 'Guest / Anonymous'}</div>
          </div>
        </Section>

        {/* Business profile */}
        <Section title="Business Profile">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Field label="Business Name">
              <input value={form.business_name} onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
                style={inputSt} onFocus={e => e.target.style.borderColor='#0A8754'} onBlur={e => e.target.style.borderColor='rgba(10,135,84,0.2)'}/>
            </Field>
            <Field label="Your Name">
              <input value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))}
                style={inputSt} onFocus={e => e.target.style.borderColor='#0A8754'} onBlur={e => e.target.style.borderColor='rgba(10,135,84,0.2)'}/>
            </Field>
            <Field label="Description">
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3} maxLength={180} style={{ ...inputSt, resize: 'none' }}
                onFocus={e => e.target.style.borderColor='#0A8754'} onBlur={e => e.target.style.borderColor='rgba(10,135,84,0.2)'}/>
            </Field>
            <Field label="Business Category">
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputSt}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Budget Range">
              <select value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} style={inputSt}>
                {BUDGETS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
          </div>
          <button onClick={handleSave} disabled={saving} style={{
            marginTop: '1.5rem', width: '100%', padding: '12px', borderRadius: '12px',
            background: '#0A8754', color: 'white', border: 'none',
            fontFamily: 'var(--font-body)', fontSize: '0.9rem', fontWeight: 500,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
            boxShadow: '0 3px 12px rgba(10,135,84,0.25)',
          }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </Section>

        {/* Change business */}
        <Section title="Business">
          <div style={{ padding: '1rem 1.2rem', borderRadius: '12px', background: 'rgba(10,135,84,0.05)', border: '1px solid rgba(10,135,84,0.1)', marginBottom: '1rem' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: '#131515', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Active business</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', color: '#131515', fontWeight: 600 }}>{profile?.business_name}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#0A8754', marginTop: '2px' }}>{profile?.category}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => router.push('/businesses')} style={{
              flex: 1, padding: '11px', borderRadius: '12px',
              background: 'rgba(10,135,84,0.08)', color: '#0A8754',
              border: '1px solid rgba(10,135,84,0.15)',
              fontFamily: 'var(--font-body)', fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M1 7h12M9 3l4 4-4 4"/></svg>
              Switch Business
            </button>
            <button onClick={() => router.push('/onboarding')} style={{
              flex: 1, padding: '11px', borderRadius: '12px',
              background: 'transparent', color: '#131515',
              border: '1px solid rgba(10,135,84,0.15)',
              fontFamily: 'var(--font-body)', fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M7 1v12M1 7h12"/></svg>
              Add New Business
            </button>
          </div>
        </Section>

        {/* Sign out */}
        <Section title="Account Actions">
          <button onClick={handleSignOut} style={{
            width: '100%', padding: '11px', borderRadius: '12px',
            background: 'rgba(176,113,86,0.08)', color: '#B07156',
            border: '1px solid rgba(176,113,86,0.2)',
            fontFamily: 'var(--font-body)', fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M6.5 2.5H3a1 1 0 00-1 1v9a1 1 0 001 1h3.5M10.5 11l3-3-3-3M13.5 8H7"/>
            </svg>
            Sign Out
          </button>
        </Section>

        {/* Data sources note */}
        <div style={{ marginTop: '3rem', padding: '1.2rem', borderRadius: '14px', background: 'rgba(10,135,84,0.05)', border: '1px solid rgba(10,135,84,0.1)' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 600, color: '#131515', marginBottom: '8px' }}>Data Sources</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.76rem', color: '#131515', opacity: 0.55, lineHeight: 1.65 }}>
            Map tiles and geocoding via OpenStreetMap & CARTO. Amenity data via Overpass API.
            Suburb demographics from publicly available ABS Census data (2021). Rent estimates based on suburb location relative to Sydney CBD.
            AI summaries generated by Anthropic Claude.
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', borderRadius: '18px', padding: '1.5rem', border: '1px solid rgba(10,135,84,0.08)', marginBottom: '1rem' }}>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 700, color: '#131515', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1.2rem', opacity: 0.6 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'var(--font-body)', color: '#131515', opacity: 0.55, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputSt: React.CSSProperties = {
  width: '100%', padding: '10px 13px', borderRadius: '10px',
  border: '1.5px solid rgba(10,135,84,0.2)', background: '#E2EFDE',
  color: '#131515', fontFamily: 'var(--font-body)', fontSize: '0.9rem',
  outline: 'none', transition: 'border-color 0.2s',
}

function Spinner() {
  return (
    <div style={{ minHeight: '100vh', background: '#E2EFDE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '36px', height: '36px', border: '2.5px solid #0A8754', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
