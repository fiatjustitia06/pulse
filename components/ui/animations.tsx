'use client'

import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion'
import { useEffect, useState } from 'react'

// ── Reusable easing presets ───────────────────────────────────────────────────
export const ease = {
  smooth:  [0.25, 0.46, 0.45, 0.94],
  spring:  { type: 'spring', stiffness: 400, damping: 30 },
  bounce:  { type: 'spring', stiffness: 500, damping: 25 },
  gentle:  { type: 'spring', stiffness: 200, damping: 28 },
}

// ── Fade + slide up on mount ─────────────────────────────────────────────────
export function FadeUp({
  children, delay = 0, duration = 0.5, className, style,
}: {
  children: React.ReactNode; delay?: number; duration?: number
  className?: string; style?: React.CSSProperties
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: ease.smooth }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  )
}

// ── Staggered children ────────────────────────────────────────────────────────
export function StaggerContainer({
  children, stagger = 0.07, delay = 0, style,
}: {
  children: React.ReactNode; stagger?: number; delay?: number; style?: React.CSSProperties
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
      style={style}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children, style, className,
}: {
  children: React.ReactNode; style?: React.CSSProperties; className?: string
}) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: ease.smooth } } }}
      style={style}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ── Animated button — press scale + tap ripple ───────────────────────────────
export function AnimButton({
  children, onClick, style, disabled, className, variant = 'primary',
}: {
  children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties
  disabled?: boolean; className?: string; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
}) {
  return (
    <motion.button
      onClick={disabled ? undefined : onClick}
      whileHover={disabled ? {} : { scale: 1.03, transition: { duration: 0.15 } }}
      whileTap={disabled ? {} : { scale: 0.96, transition: { duration: 0.1 } }}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', border: 'none', ...style }}
      className={className}
      disabled={disabled}
    >
      {children}
    </motion.button>
  )
}

// ── Card hover lift ───────────────────────────────────────────────────────────
export function HoverCard({
  children, style, onClick, className,
}: {
  children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void; className?: string
}) {
  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: '0 12px 40px rgba(10,135,84,0.14)', transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.99, transition: { duration: 0.1 } }}
      style={{ cursor: onClick ? 'pointer' : 'default', ...style }}
      onClick={onClick}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ── Page transition wrapper ───────────────────────────────────────────────────
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: ease.smooth }}
    >
      {children}
    </motion.div>
  )
}

// ── Slide-in from right (for panels/popups) ──────────────────────────────────
export function SlideIn({
  children, from = 'bottom', style,
}: {
  children: React.ReactNode; from?: 'bottom' | 'right' | 'left'; style?: React.CSSProperties
}) {
  const initial = from === 'bottom' ? { opacity: 0, y: 20 } : from === 'right' ? { opacity: 0, x: 24 } : { opacity: 0, x: -24 }
  return (
    <motion.div
      initial={initial}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={initial}
      transition={ease.gentle}
      style={style}
    >
      {children}
    </motion.div>
  )
}

// ── Animated number counter ──────────────────────────────────────────────────
export function AnimNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const spring = useSpring(0, { stiffness: 80, damping: 20 })
  const display = useTransform(spring, v => Math.round(v).toLocaleString())
  useEffect(() => { spring.set(value) }, [value, spring])
  return <motion.span>{display}{suffix}</motion.span>
}

// ── Pulse dot indicator ──────────────────────────────────────────────────────
export function PulseDot({ color = '#0A8754', size = 8 }: { color?: string; size?: number }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size }}>
      <motion.span
        animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color }}
      />
      <span style={{ position: 'relative', width: size, height: size, borderRadius: '50%', background: color, display: 'inline-block' }} />
    </span>
  )
}

// ── Score ring animation ─────────────────────────────────────────────────────
export function AnimScoreRing({
  score, grade, gradeColor, size = 120,
}: {
  score: number; grade: string; gradeColor: string; size?: number
}) {
  const [displayed, setDisplayed] = useState(0)
  useEffect(() => {
    const timeout = setTimeout(() => setDisplayed(score), 200)
    return () => clearTimeout(timeout)
  }, [score])

  const R = (size / 2) - 10
  const circumference = 2 * Math.PI * R
  const filled = circumference * displayed / 100

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={R} fill="none" stroke="rgba(10,135,84,0.1)" strokeWidth="9"/>
      <motion.circle
        cx={size/2} cy={size/2} r={R} fill="none"
        stroke={gradeColor} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${circumference}`}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference - filled }}
        transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
        style={{ transformOrigin: `${size/2}px ${size/2}px`, transform: 'rotate(-90deg)' }}
      />
      <motion.text
        x={size/2} y={size/2 - 6} textAnchor="middle"
        fill={gradeColor} fontSize="28" fontWeight="700" fontFamily="Georgia,serif"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        {grade}
      </motion.text>
      <motion.text
        x={size/2} y={size/2 + 12} textAnchor="middle"
        fill="#131515" fontSize="9.5" fontFamily="monospace" opacity="0.4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ delay: 0.7, duration: 0.4 }}
      >
        {score}/100
      </motion.text>
    </svg>
  )
}

// ── Progress bar ─────────────────────────────────────────────────────────────
export function AnimProgressBar({
  value, color, delay = 0,
}: {
  value: number; color: string; delay?: number
}) {
  return (
    <div style={{ height: '5px', background: 'rgba(10,135,84,0.07)', borderRadius: '3px', overflow: 'hidden' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.9, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{ height: '100%', background: color, borderRadius: '3px' }}
      />
    </div>
  )
}

// ── Loader step tick ─────────────────────────────────────────────────────────
export function StepTick({ done }: { done: boolean }) {
  return (
    <AnimatePresence>
      {done && (
        <motion.svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0 }}
          transition={ease.bounce}
        >
          <circle cx="8" cy="8" r="7" fill="#0A8754"/>
          <motion.path
            d="M4.5 8l2.5 2.5 4.5-4.5"
            stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          />
        </motion.svg>
      )}
    </AnimatePresence>
  )
}

export { motion, AnimatePresence }
