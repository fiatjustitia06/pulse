'use client'

import { useState, useEffect } from 'react'
import React from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { BusinessCategory, BudgetRange } from '@/lib/types'
import toast from 'react-hot-toast'

const CATEGORIES: BusinessCategory[] = [
  'Restaurant & Cafe', 'Retail & Fashion', 'Health & Fitness',
  'Professional Services', 'Technology', 'Entertainment & Leisure',
  'Education', 'Beauty & Wellness', 'Automotive', 'Real Estate', 'Other'
]

const BUDGETS: BudgetRange[] = [
  'Under $50K', '$50K – $150K', '$150K – $500K', '$500K – $1M', 'Over $1M'
]

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Restaurant & Cafe':       <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M5 2v4a2 2 0 004 0V2M7 6v8"/><path d="M11 2v12"/></svg>,
  'Retail & Fashion':        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3a1.5 1.5 0 010-3 1.5 1.5 0 010 3"/><path d="M8 3L3.5 6.5 1 8l2.5 1v5.5h9V9L15 8l-2.5-1.5L8 3z"/></svg>,
  'Health & Fitness':        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M1 8h2l2-4 2 8 2-6 2 3 1-1h2"/></svg>,
  'Professional Services':   <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="2" y="4" width="12" height="10" rx="1.5"/><path d="M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M2 8h12"/></svg>,
  'Technology':              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="1" y="3" width="14" height="9" rx="1.5"/><path d="M5 14.5h6M8 12v2.5"/></svg>,
  'Entertainment & Leisure': <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="8" cy="8" r="6.5"/><path d="M6 5.5l5 2.5-5 2.5V5.5z" fill="currentColor" stroke="none" opacity="0.7"/></svg>,
  'Education':               <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M1 5l7-3 7 3-7 3-7-3z"/><path d="M4 6.5V11c0 1.1 1.8 2 4 2s4-.9 4-2V6.5"/><path d="M14 5v4"/></svg>,
  'Beauty & Wellness':       <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M8 2c0 0-5 3-5 7a5 5 0 0010 0c0-4-5-7-5-7z"/><path d="M8 9v4"/></svg>,
  'Automotive':              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M2 9h12M3.5 9L5 5h6l1.5 4"/><rect x="1" y="9" width="14" height="3" rx="1"/><circle cx="4.5" cy="12.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="11.5" cy="12.5" r="1.2" fill="currentColor" stroke="none"/></svg>,
  'Real Estate':             <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M1 14h14M3 14V7.5l5-4.5 5 4.5V14"/><path d="M6 14v-4h4v4"/></svg>,
  'Other':                   <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="8" cy="8" r="6.5"/><path d="M8 5v3.5L10.5 11"/></svg>,
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    business_name: '',
    owner_name: '',
    category: '' as BusinessCategory | '',
    description: '',
    budget: '' as BudgetRange | '',
  })
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/auth'); return }
      // No longer redirect if profile exists — multiple businesses allowed
    })
  }, [router])

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const steps = [
    {
      title: 'Tell us about your business',
      subtitle: 'This helps us personalise your location analysis.',
      fields: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <Field label="Business Name" required>
            <input
              value={form.business_name}
              onChange={e => update('business_name', e.target.value)}
              placeholder="e.g. The Green Cup"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#0A8754'}
              onBlur={e => e.target.style.borderColor = 'rgba(10,135,84,0.2)'}
            />
          </Field>
          <Field label="Your Name" required>
            <input
              value={form.owner_name}
              onChange={e => update('owner_name', e.target.value)}
              placeholder="e.g. Jamie Chen"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#0A8754'}
              onBlur={e => e.target.style.borderColor = 'rgba(10,135,84,0.2)'}
            />
          </Field>
          <Field label="Describe your business in one sentence" required>
            <textarea
              value={form.description}
              onChange={e => update('description', e.target.value)}
              placeholder="e.g. A specialty coffee shop focusing on single-origin pour-overs and artisan pastries."
              maxLength={180}
              rows={3}
              style={{ ...inputStyle, resize: 'none' }}
              onFocus={e => e.target.style.borderColor = '#0A8754'}
              onBlur={e => e.target.style.borderColor = 'rgba(10,135,84,0.2)'}
            />
            <span style={{ fontSize: '0.72rem', color: '#131515', opacity: 0.4, fontFamily: 'var(--font-body)' }}>
              {form.description.length}/180 characters
            </span>
          </Field>
        </div>
      ),
      valid: form.business_name.trim() && form.owner_name.trim() && form.description.trim(),
    },
    {
      title: 'What type of business?',
      subtitle: "We'll use this to find relevant competitors and market data.",
      fields: (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => update('category', cat)}
              style={{
                padding: '12px 14px',
                borderRadius: '14px',
                border: `1.5px solid ${form.category === cat ? '#0A8754' : 'rgba(10,135,84,0.15)'}`,
                background: form.category === cat ? 'rgba(10,135,84,0.08)' : 'white',
                color: '#131515',
                fontFamily: 'var(--font-body)',
                fontSize: '0.82rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: form.category === cat ? 'rgba(10,135,84,0.15)' : 'rgba(10,135,84,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: form.category === cat ? '#0A8754' : '#131515' }}>
                {CATEGORY_ICONS[cat]}
              </div>
              {cat}
            </button>
          ))}
        </div>
      ),
      valid: form.category,
    },
    {
      title: 'What\'s your budget?',
      subtitle: 'This helps us evaluate affordability and realistic projections.',
      fields: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {BUDGETS.map(b => (
            <button
              key={b}
              onClick={() => update('budget', b)}
              style={{
                padding: '16px 20px',
                borderRadius: '14px',
                border: `1.5px solid ${form.budget === b ? '#0A8754' : 'rgba(10,135,84,0.15)'}`,
                background: form.budget === b ? 'rgba(10,135,84,0.08)' : 'white',
                color: '#131515',
                fontFamily: 'var(--font-body)',
                fontSize: '1rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>{b}</span>
              {form.budget === b && (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="8.25" stroke="#0A8754" strokeWidth="1.5"/>
                  <path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="#0A8754" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      ),
      valid: form.budget,
    },
  ]

  const handleNext = () => {
    if (step < steps.length - 1) setStep(s => s + 1)
    else handleSubmit()
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase.from('business_profiles').insert({
        user_id: user.id,
        business_name: form.business_name,
        owner_name: form.owner_name,
        category: form.category,
        description: form.description,
        budget: form.budget,
      })

      if (error) throw error

      // Log activity
      await supabase.from('activity_log').insert({
        user_id: user.id,
        user_email: user.email,
        event_type: 'profile_created',
        metadata: { business_name: form.business_name, category: form.category },
      }).then(() => {})

      toast.success(`${form.business_name} created!`)
      router.push('/businesses')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save profile')
    } finally {
      setLoading(false)
    }
  }

  const current = steps[step]
  const progress = ((step + 1) / steps.length) * 100

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: '#E2EFDE' }}>
      <div
        className="fixed inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(rgba(10,135,84,1) 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      />

      <div className="w-full max-w-lg relative z-10">
        {/* Header row with logo and exit */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#0A8754' }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="3" fill="white"/>
                <circle cx="9" cy="9" r="6.5" stroke="white" strokeWidth="1.2" strokeDasharray="2 1.5"/>
              </svg>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: '#131515' }}>Pulse</span>
          </div>
          <button
            onClick={() => router.push('/businesses')}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: '0.82rem',
              color: '#131515', opacity: 0.45,
              padding: '6px 10px', borderRadius: '8px',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.45')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M10 2L4 8l6 6" opacity="0.6"/>
              <path d="M7 2L1 8l6 6"/>
            </svg>
            Exit
          </button>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#0A8754', letterSpacing: '0.05em' }}>
              STEP {step + 1} OF {steps.length}
            </span>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#131515', opacity: 0.4 }}>
              {Math.round(progress)}%
            </span>
          </div>
          <div style={{ height: '4px', background: 'rgba(10,135,84,0.12)', borderRadius: '2px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                background: '#0A8754',
                borderRadius: '2px',
                width: `${progress}%`,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'white',
            borderRadius: '24px',
            padding: '2rem',
            border: '1.5px solid rgba(10,135,84,0.1)',
            boxShadow: '0 20px 60px rgba(10,135,84,0.08)',
          }}
        >
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', color: '#131515', marginBottom: '0.4rem', letterSpacing: '-0.02em' }}>
            {current.title}
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#131515', opacity: 0.55, marginBottom: '1.8rem' }}>
            {current.subtitle}
          </p>

          {current.fields}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem' }}>
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{
                  flex: 1,
                  padding: '13px',
                  borderRadius: '12px',
                  border: '1.5px solid rgba(10,135,84,0.2)',
                  background: 'transparent',
                  color: '#131515',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                ← Back
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!current.valid || loading}
              style={{
                flex: 2,
                padding: '13px',
                borderRadius: '12px',
                background: current.valid ? '#0A8754' : 'rgba(10,135,84,0.3)',
                color: 'white',
                fontFamily: 'var(--font-body)',
                fontSize: '0.9rem',
                fontWeight: 500,
                cursor: current.valid ? 'pointer' : 'not-allowed',
                border: 'none',
                transition: 'all 0.2s',
                boxShadow: current.valid ? '0 4px 16px rgba(10,135,84,0.25)' : 'none',
              }}
            >
              {loading ? 'Saving…' : step === steps.length - 1 ? 'Start analysing →' : 'Continue →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: '0.75rem', fontFamily: 'var(--font-body)',
        color: '#131515', opacity: 0.6, marginBottom: '6px',
        textTransform: 'uppercase', letterSpacing: '0.08em'
      }}>
        {label}{required && <span style={{ color: '#0A8754' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: '11px',
  border: '1.5px solid rgba(10,135,84,0.2)',
  background: '#E2EFDE',
  color: '#131515',
  fontFamily: 'var(--font-body)',
  fontSize: '0.92rem',
  outline: 'none',
  transition: 'border-color 0.2s',
}
