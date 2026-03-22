'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'

type Step = 'email' | 'code'

export default function AuthPage() {
  const [step, setStep]         = useState<Step>('email')
  const [email, setEmail]       = useState('')
  const [code, setCode]         = useState(['', '', '', '', '', ''])
  const [loading, setLoading]   = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const inputRefs               = useRef<(HTMLInputElement | null)[]>([])
  const timerRef                = useRef<ReturnType<typeof setInterval>>()
  const router                  = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/businesses')
    })
  }, [router])

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer <= 0) return
    timerRef.current = setInterval(() => {
      setResendTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [resendTimer])

  // ── Send OTP ──────────────────────────────────────────────────────────────
  const handleSendCode = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      })
      if (error) throw error
      setStep('code')
      setCode(['', '', '', '', '', ''])
      setResendTimer(60)
      toast.success('Code sent — check your email.')
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    } catch (err: any) {
      toast.error(err.message || 'Failed to send code')
    } finally {
      setLoading(false)
    }
  }

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const handleVerify = async (fullCode: string) => {
    if (fullCode.length !== 6) return
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: fullCode,
        type: 'email',
      })
      if (error) throw error

      // Log login activity
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('activity_log').insert({
          user_id: user.id,
          user_email: user.email,
          event_type: 'login',
          metadata: { method: 'otp', email: user.email },
        }).then(() => {})
      }

      toast.success('Signed in!')
      router.push('/businesses')
    } catch (err: any) {
      toast.error('Invalid code — please try again.')
      setCode(['', '', '', '', '', ''])
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
    } finally {
      setLoading(false)
    }
  }

  // ── OTP digit input handler ───────────────────────────────────────────────
  const handleDigit = (idx: number, val: string) => {
    // Handle paste of full code
    if (val.length > 1) {
      const digits = val.replace(/\D/g, '').slice(0, 6).split('')
      const next = [...code]
      digits.forEach((d, i) => { if (i < 6) next[i] = d })
      setCode(next)
      const focusIdx = Math.min(digits.length, 5)
      inputRefs.current[focusIdx]?.focus()
      if (digits.length === 6) handleVerify(digits.join(''))
      return
    }

    const digit = val.replace(/\D/g, '')
    const next = [...code]
    next[idx] = digit
    setCode(next)

    if (digit && idx < 5) inputRefs.current[idx + 1]?.focus()

    const full = next.join('')
    if (full.length === 6 && next.every(d => d)) handleVerify(full)
  }

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus()
    }
  }

  // ── Demo access ───────────────────────────────────────────────────────────
  const handleDemo = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInAnonymously()
      if (error) throw error
      router.push('/onboarding')
    } catch {
      router.push('/onboarding')
    } finally {
      setLoading(false)
    }
  }

  // ── Shared styles ─────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px', borderRadius: '12px',
    border: '1.5px solid rgba(10,135,84,0.2)', background: '#E2EFDE',
    color: '#131515', fontFamily: 'var(--font-body)', fontSize: '0.95rem',
    outline: 'none', transition: 'border-color 0.2s',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#E2EFDE' }}>
      {/* Dot pattern */}
      <div style={{ position: 'fixed', inset: 0, opacity: 0.05, pointerEvents: 'none', backgroundImage: 'radial-gradient(rgba(10,135,84,0.8) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 10 }}>
        {/* Back */}
        <motion.button
          onClick={() => step === 'code' ? setStep('email') : router.push('/')}
          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}
          whileTap={{ scale: 0.96 }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2rem', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#131515', opacity: 0.55 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 2L4 7l5 5"/></svg>
          {step === 'code' ? 'Change email' : 'Back to Pulse'}
        </motion.button>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ background: 'white', borderRadius: '24px', padding: '2rem', border: '1.5px solid rgba(10,135,84,0.12)', boxShadow: '0 20px 60px rgba(10,135,84,0.08)' }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#0A8754', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="3.5" fill="white"/>
                <circle cx="10" cy="10" r="7.5" stroke="white" strokeWidth="1.3" strokeDasharray="2.5 2" fill="none"/>
              </svg>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: '#131515', letterSpacing: '-0.02em' }}>Pulse</span>
          </div>

          {/* ── Step 1: Email ─────────────────────────────────────────── */}
          <AnimatePresence mode="wait">
          {step === 'email' && (
            <motion.div key="email" initial={{ opacity:0, x:-12 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:12 }} transition={{ duration:0.25 }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: '#131515', marginBottom: '6px', letterSpacing: '-0.02em' }}>
                Sign in
              </h1>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#131515', opacity: 0.5, marginBottom: '1.8rem' }}>
                Enter your email and we'll send a 6-digit code.
              </p>

              <form onSubmit={handleSendCode} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'var(--font-body)', color: '#131515', opacity: 0.55, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Email address
                  </label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com" required autoFocus
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor = '#0A8754'}
                    onBlur={e => e.target.style.borderColor = 'rgba(10,135,84,0.2)'}
                  />
                </div>
                <motion.button type="submit" disabled={loading || !email.trim()}
                  whileHover={!loading && email.trim() ? { scale: 1.02 } : {}}
                  whileTap={!loading && email.trim() ? { scale: 0.97 } : {}}
                  style={{ padding: '13px', borderRadius: '12px', background: '#0A8754', color: 'white', border: 'none', fontFamily: 'var(--font-body)', fontSize: '0.92rem', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, boxShadow: '0 4px 16px rgba(10,135,84,0.25)', transition: 'opacity 0.2s' }}>
                  {loading ? 'Sending…' : 'Send code →'}
                </motion.button>
              </form>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.5rem 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(19,21,21,0.08)' }} />
                <span style={{ fontSize: '0.78rem', color: '#131515', opacity: 0.35, fontFamily: 'var(--font-body)' }}>or</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(19,21,21,0.08)' }} />
              </div>

              <motion.button onClick={handleDemo} disabled={loading}
                whileHover={{ scale: 1.02, borderColor: 'rgba(10,135,84,0.4)' }}
                whileTap={{ scale: 0.97 }}
                style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'transparent', border: '1.5px solid rgba(10,135,84,0.2)', color: '#131515', fontFamily: 'var(--font-body)', fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="#0A8754" strokeWidth="1.4" strokeLinecap="round"><path d="M7.5 1l1.5 3.5L13 5.5l-3 2.5 1 4-3.5-2L4 12l1-4L2 5.5l4-.5z"/></svg>
                Guest / Demo Sign In
              </motion.button>
            </motion.div>
          )}

          {/* ── Step 2: Code entry ────────────────────────────────────── */}
          {step === 'code' && (
            <motion.div key="code" initial={{ opacity:0, x:12 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-12 }} transition={{ duration:0.25 }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: '#131515', marginBottom: '6px', letterSpacing: '-0.02em' }}>
                Enter your code
              </h1>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#131515', opacity: 0.5, marginBottom: '2rem', lineHeight: 1.6 }}>
                We sent an 6-digit code to <strong style={{ color: '#131515', opacity: 1 }}>{email}</strong>. It expires in 10 minutes.
              </p>

              {/* 6-digit input */}
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '1.5rem' }}>
                {code.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => { inputRefs.current[idx] = el }}
                    type="text" inputMode="numeric" maxLength={6}
                    value={digit}
                    onChange={e => handleDigit(idx, e.target.value)}
                    onKeyDown={e => handleKeyDown(idx, e)}
                    onPaste={e => {
                      e.preventDefault()
                      handleDigit(0, e.clipboardData.getData('text'))
                    }}
                    onFocus={e => { e.target.style.borderColor = '#0A8754'; e.target.style.background = 'white' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(10,135,84,0.2)'; e.target.style.background = '#E2EFDE' }}
                    disabled={loading}
                    style={{
                      width: '40px', height: '52px', textAlign: 'center',
                      fontSize: '1.3rem', fontFamily: 'var(--font-mono)', fontWeight: 600,
                      borderRadius: '10px', border: '1.5px solid rgba(10,135,84,0.2)',
                      background: digit ? 'white' : '#E2EFDE', color: '#131515',
                      outline: 'none', transition: 'all 0.15s', caretColor: '#0A8754',
                    }}
                  />
                ))}
              </div>

              {/* Loading indicator */}
              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '1rem' }}>
                  <div style={{ width: '16px', height: '16px', border: '2px solid #0A8754', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.84rem', color: '#0A8754' }}>Verifying…</span>
                </div>
              )}

              {/* Manual verify button (fallback) */}
              <button
                onClick={() => handleVerify(code.join(''))}
                disabled={loading || code.join('').length !== 6}
                style={{
                  width: '100%', padding: '13px', borderRadius: '12px',
                  background: code.join('').length === 6 ? '#0A8754' : 'rgba(10,135,84,0.3)',
                  color: 'white', border: 'none', fontFamily: 'var(--font-body)',
                  fontSize: '0.92rem', fontWeight: 500,
                  cursor: code.join('').length === 6 ? 'pointer' : 'not-allowed',
                  transition: 'background 0.2s',
                }}>
                Verify code
              </button>

              {/* Resend */}
              <div style={{ textAlign: 'center', marginTop: '1.2rem' }}>
                {resendTimer > 0 ? (
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#131515', opacity: 0.4 }}>
                    Resend in {resendTimer}s
                  </span>
                ) : (
                  <button onClick={() => handleSendCode()} disabled={loading} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#0A8754',
                  }}>
                    Didn't receive it? Resend code
                  </button>
                )}
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </motion.div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
