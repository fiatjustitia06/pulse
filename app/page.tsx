'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/businesses')
    })
  }, [router])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    const nodes = [
      {x:0.1,y:0.05},{x:0.25,y:0.1},{x:0.5,y:0.08},{x:0.75,y:0.12},{x:0.9,y:0.07},
      {x:0.15,y:0.28},{x:0.35,y:0.32},{x:0.55,y:0.25},{x:0.72,y:0.30},{x:0.88,y:0.22},
      {x:0.05,y:0.50},{x:0.28,y:0.52},{x:0.48,y:0.48},{x:0.65,y:0.55},{x:0.85,y:0.50},
      {x:0.12,y:0.72},{x:0.32,y:0.70},{x:0.52,y:0.75},{x:0.70,y:0.68},{x:0.92,y:0.73},
      {x:0.20,y:0.90},{x:0.45,y:0.92},{x:0.68,y:0.88},{x:0.85,y:0.93},
    ]
    const edges = [
      [0,1],[1,2],[2,3],[3,4],[1,5],[2,6],[3,7],[4,8],[5,6],[6,7],[7,8],[8,9],
      [5,10],[6,11],[7,12],[8,13],[9,14],[10,11],[11,12],[12,13],[13,14],
      [10,15],[11,16],[12,17],[13,18],[14,19],[15,16],[16,17],[17,18],[18,19],
      [15,20],[17,21],[18,22],[19,23],[20,21],[21,22],[22,23],[0,10],[4,14],[0,5],[2,12],[4,9]
    ]
    const particles: {edgeIdx:number;t:number;speed:number;alpha:number;size:number}[] = []
    for (let i = 0; i < 60; i++) particles.push({edgeIdx:Math.floor(Math.random()*edges.length),t:Math.random(),speed:0.0008+Math.random()*0.0012,alpha:0.3+Math.random()*0.5,size:1.5+Math.random()*2})
    const pulsePhases = nodes.map(() => Math.random() * Math.PI * 2)
    let animId: number, time = 0
    const draw = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height)
      const W = canvas.width, H = canvas.height
      time += 0.01
      edges.forEach(([a,b]) => {
        const n1=nodes[a],n2=nodes[b]
        ctx.beginPath();ctx.moveTo(n1.x*W,n1.y*H);ctx.lineTo(n2.x*W,n2.y*H)
        ctx.strokeStyle='rgba(10,135,84,0.18)';ctx.lineWidth=1.5;ctx.stroke()
      })
      nodes.forEach((n,i) => {
        const pulse=Math.sin(time+pulsePhases[i])*0.5+0.5,r=2.5+pulse*2
        ctx.beginPath();ctx.arc(n.x*W,n.y*H,r,0,Math.PI*2)
        ctx.fillStyle=`rgba(10,135,84,${0.2+pulse*0.3})`;ctx.fill()
        if(i%4===0){ctx.beginPath();ctx.arc(n.x*W,n.y*H,r+pulse*8,0,Math.PI*2);ctx.strokeStyle=`rgba(10,135,84,${0.08*pulse})`;ctx.lineWidth=1;ctx.stroke()}
      })
      particles.forEach(p => {
        p.t+=p.speed
        if(p.t>1){p.t=0;p.edgeIdx=Math.floor(Math.random()*edges.length)}
        const [a,b]=edges[p.edgeIdx],n1=nodes[a],n2=nodes[b]
        const x=(n1.x+(n2.x-n1.x)*p.t)*W,y=(n1.y+(n2.y-n1.y)*p.t)*H
        ctx.beginPath();ctx.arc(x,y,p.size,0,Math.PI*2);ctx.fillStyle=`rgba(10,135,84,${p.alpha})`;ctx.fill()
        const trailT=Math.max(0,p.t-0.05),tx=(n1.x+(n2.x-n1.x)*trailT)*W,ty=(n1.y+(n2.y-n1.y)*trailT)*H
        const grad=ctx.createLinearGradient(tx,ty,x,y)
        grad.addColorStop(0,'rgba(10,135,84,0)');grad.addColorStop(1,`rgba(10,135,84,${p.alpha*0.4})`)
        ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(x,y);ctx.strokeStyle=grad;ctx.lineWidth=p.size*0.8;ctx.stroke()
      })
      animId=requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize',resize) }
  }, [])

  const features = [
    {
      icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#0A8754" strokeWidth="1.5" strokeLinecap="round"><path d="M11 2C7.13 2 4 5.13 4 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="11" cy="9" r="2.5" fill="#0A8754" stroke="none"/></svg>,
      title: 'Pin Any Location',
      desc: 'Drop a pin anywhere on the Sydney map. Click or search by address — we validate the location and fetch live data instantly.',
    },
    {
      icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#0A8754" strokeWidth="1.5" strokeLinecap="round"><circle cx="11" cy="11" r="9"/><path d="M11 6v5l3 3"/></svg>,
      title: 'Transport Analysis',
      desc: 'Real train station names and walking distances from OpenStreetMap. Bus stops, light rail, and ferry terminals within 800m.',
    },
    {
      icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#0A8754" strokeWidth="1.5" strokeLinecap="round"><path d="M3 20h16M5 20V9l6-6 6 6v11"/><path d="M9 20v-5h4v5"/></svg>,
      title: 'Demographics',
      desc: 'Median age, household income, population density and annual growth rate for the suburb — sourced directly from ABS 2021 Census.',
    },
    {
      icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#0A8754" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="8" width="7" height="12" rx="1"/><rect x="13" y="3" width="7" height="17" rx="1"/></svg>,
      title: 'Direct Competitors',
      desc: 'Named competitors within 800m matched to your business category from OpenStreetMap. Each links directly to Google Maps.',
    },
    {
      icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#0A8754" strokeWidth="1.5" strokeLinecap="round"><circle cx="11" cy="11" r="9"/><path d="M11 7v4.5M11 14h.01"/></svg>,
      title: 'Rent Estimates',
      desc: 'Indicative commercial rent bands by tenancy size — calibrated from CBRE and JLL Sydney market reports for the CBD distance band.',
    },
    {
      icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#0A8754" strokeWidth="1.5" strokeLinecap="round"><path d="M12 2l2.5 5.5L20 8.5l-4 4 1 5.5L12 15.5 7 18l1-5.5-4-4 5.5-1z"/></svg>,
      title: 'AI Executive Summary',
      desc: 'Claude (Anthropic) reads all the verified data points and writes a structured verdict, opportunities, and key concerns specific to your business description.',
    },
    {
      icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#0A8754" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="16" height="16" rx="2"/><path d="M3 9h16M9 21V9"/></svg>,
      title: 'Multiple Businesses',
      desc: 'Create and switch between multiple business profiles. Each gets its own set of location analyses, stored and ranked by score.',
    },
    {
      icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#0A8754" strokeWidth="1.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>,
      title: 'PDF Export',
      desc: 'Export any analysis as a formatted PDF report with all data sources cited — ready to share with business partners or investors.',
    },
  ]

  const dataPoints = [
    { label: 'Train & bus distances', src: 'OpenStreetMap' },
    { label: 'Named competitors', src: 'OpenStreetMap' },
    { label: 'Suburb median income', src: 'ABS 2021 Census' },
    { label: 'Population density', src: 'ABS 2021 Census' },
    { label: 'Population growth rate', src: 'ABS 2021 Census' },
    { label: 'Median resident age', src: 'ABS 2021 Census' },
    { label: 'CBD distance (haversine)', src: 'Calculated' },
    { label: 'Nearby food & retail count', src: 'OpenStreetMap' },
    { label: 'Light rail & ferry access', src: 'OpenStreetMap' },
    { label: 'Commercial rent bands', src: 'CBRE / JLL 2023' },
    { label: 'Geographic score', src: 'Computed' },
    { label: 'AI executive summary', src: 'Anthropic Claude' },
  ]

  return (
    <div style={{ background: '#E2EFDE', minHeight: '100vh', overflowX: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(to bottom, transparent 60%, #E2EFDE)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', inset: 0, opacity: 0.05, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(10,135,84,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(10,135,84,0.5) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* Header */}
      <header style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#0A8754', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="3" fill="white"/><circle cx="10" cy="10" r="7" stroke="white" strokeWidth="1.5" strokeDasharray="2 2"/></svg>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: '#131515', letterSpacing: '-0.02em' }}>Pulse</span>
        </div>
        <button onClick={() => router.push('/auth')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px', borderRadius: '12px', background: '#0A8754', color: 'white', border: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer', boxShadow: '0 4px 16px rgba(10,135,84,0.25)' }}>
          Sign In
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"><path d="M2.5 6.5h8M7 3l3.5 3.5L7 10"/></svg>
        </button>
      </header>

      {/* Hero */}
      <section style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '60px 20px 80px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(3rem,8vw,7rem)', lineHeight: 1.0, color: '#131515', letterSpacing: '-0.03em', maxWidth: '900px', marginBottom: '1.5rem', opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(20px)', transition: 'all 0.7s ease 0.1s' }}>
          Find where your
          <span style={{ color: '#0A8754', fontStyle: 'italic' }}> business</span>
          <br />belongs.
        </h1>

        <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.1rem', color: '#131515', opacity: mounted ? 0.6 : 0, maxWidth: '500px', lineHeight: 1.75, transform: mounted ? 'none' : 'translateY(20px)', transition: 'all 0.7s ease 0.2s' }}>
          Pin any Sydney location and get a full data-backed analysis — transport access, demographics, competitors, and estimated rent — in under 30 seconds.
        </p>

        <div style={{ display: 'flex', gap: '12px', marginTop: '2.5rem', opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(20px)', transition: 'all 0.7s ease 0.35s' }}>
          <button onClick={() => router.push('/auth')} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 28px', borderRadius: '16px', background: '#0A8754', color: 'white', border: 'none', fontFamily: 'var(--font-body)', fontSize: '1rem', fontWeight: 500, cursor: 'pointer', boxShadow: '0 8px 32px rgba(10,135,84,0.3)' }}>
            Start analysing
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round"><path d="M2.5 7.5h10M8 3.5l4 4-4 4"/></svg>
          </button>
          <button onClick={() => router.push('/auth')} style={{ padding: '14px 28px', borderRadius: '16px', border: '1.5px solid rgba(10,135,84,0.25)', background: 'rgba(10,135,84,0.04)', color: '#131515', fontFamily: 'var(--font-body)', fontSize: '1rem', cursor: 'pointer' }}>
            Demo access
          </button>
        </div>

        {/* Data points row */}
        <div style={{ display: 'flex', gap: '2.5rem', marginTop: '4rem', flexWrap: 'wrap', justifyContent: 'center', opacity: mounted ? 1 : 0, transition: 'opacity 0.7s ease 0.5s' }}>
          {[
            { num: '12', label: 'Data points analysed' },
            { num: 'ABS', label: '2021 Census data' },
            { num: 'AI', label: 'Executive summary' },
          ].map(({ num, label }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: '#0A8754', lineHeight: 1 }}>{num}</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#131515', opacity: 0.5, marginTop: '4px' }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section style={{ position: 'relative', zIndex: 10, maxWidth: '1100px', margin: '0 auto', padding: '0 24px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem,4vw,2.8rem)', color: '#131515', letterSpacing: '-0.025em', marginBottom: '12px' }}>
            Everything you need to <span style={{ color: '#0A8754' }}>decide</span>
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: '#131515', opacity: 0.55, maxWidth: '480px', margin: '0 auto', lineHeight: 1.7 }}>
            An intelligence tool that provides you with all the insight for you to start your business.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {features.map((f, i) => (
            <div key={i} style={{ background: 'white', borderRadius: '20px', padding: '1.6rem', border: '1px solid rgba(10,135,84,0.08)', boxShadow: '0 2px 16px rgba(10,135,84,0.04)', transition: 'all 0.2s' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 32px rgba(10,135,84,0.1)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = '0 2px 16px rgba(10,135,84,0.04)' }}
            >
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(10,135,84,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                {f.icon}
              </div>
              <h3 style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.95rem', color: '#131515', marginBottom: '8px' }}>{f.title}</h3>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.83rem', color: '#131515', opacity: 0.55, lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Data sources section */}
      <section style={{ position: 'relative', zIndex: 10, maxWidth: '900px', margin: '0 auto', padding: '0 24px 100px' }}>
        <div style={{ background: 'white', borderRadius: '24px', padding: '2.5rem', border: '1px solid rgba(10,135,84,0.08)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: '#131515', letterSpacing: '-0.02em', marginBottom: '6px' }}>
            What we actually analyse
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#131515', opacity: 0.5, marginBottom: '2rem', lineHeight: 1.6 }}>
            Every data point below is fetched live or sourced from published datasets. If we can't justify a number, we don't show it.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
            {dataPoints.map((d, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(10,135,84,0.04)', border: '1px solid rgba(10,135,84,0.08)' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#131515', fontWeight: 500 }}>{d.label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#0A8754' }}>{d.src}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '0 24px 120px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem,4vw,3rem)', color: '#131515', letterSpacing: '-0.025em', marginBottom: '12px' }}>
          Ready to find your location?
        </h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: '#131515', opacity: 0.55, marginBottom: '2rem' }}>
          Sign in with your email — no password, no credit card.
        </p>
        <button onClick={() => router.push('/auth')} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '16px 36px', borderRadius: '18px', background: '#0A8754', color: 'white', border: 'none', fontFamily: 'var(--font-body)', fontSize: '1.05rem', fontWeight: 500, cursor: 'pointer', boxShadow: '0 8px 32px rgba(10,135,84,0.3)' }}>
          Get started — free
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round"><path d="M2.5 7.5h10M8 3.5l4 4-4 4"/></svg>
        </button>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#131515', opacity: 0.3, marginTop: '1.5rem', letterSpacing: '0.05em' }}>
          SYDNEY ONLY · BUILT WITH OPENSTREETMAP · ABS · CBRE/JLL
        </p>
      </section>
    </div>
  )
}
