'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ADMIN_EMAIL = 'charles060906@gmail.com'

type Tab = 'activity' | 'users' | 'businesses' | 'analyses'

interface UserRow  { id: string; email: string; created_at: string; last_sign_in_at: string | null; is_anonymous: boolean; business_count: number; analysis_count: number }
interface Business { id: string; user_id: string; user_email?: string; business_name: string; category: string; budget: string; description: string; created_at: string }
interface Analysis { id: string; user_id: string; business_id: string; user_email?: string; business_name?: string; location_address: string; location_suburb: string; scores: any; created_at: string }
interface LogEntry { id: string; user_id: string | null; user_email: string | null; event_type: string; metadata: Record<string,any>; ip_address: string | null; user_agent: string | null; created_at: string }

const ECOL: Record<string,{text:string;bg:string;border:string}> = {
  login:            { text:'#0A8754', bg:'rgba(10,135,84,0.15)',   border:'rgba(10,135,84,0.3)'   },
  logout:           { text:'#B07156', bg:'rgba(176,113,86,0.15)',  border:'rgba(176,113,86,0.3)'  },
  signup:           { text:'#60a5fa', bg:'rgba(96,165,250,0.15)',  border:'rgba(96,165,250,0.3)'  },
  profile_created:  { text:'#a78bfa', bg:'rgba(167,139,250,0.15)', border:'rgba(167,139,250,0.3)' },
  analysis_created: { text:'#fbbf24', bg:'rgba(251,191,36,0.15)',  border:'rgba(251,191,36,0.3)'  },
  page_view:        { text:'#94a3b8', bg:'rgba(148,163,184,0.15)', border:'rgba(148,163,184,0.3)' },
}
const ELABELS: Record<string,string> = {
  login:'Login', logout:'Logout', signup:'Sign Up',
  profile_created:'Business Created', analysis_created:'Analysis Run', page_view:'Page View',
}

export default function AdminPage() {
  const [tab, setTab]                 = useState<Tab>('users')
  const [loading, setLoading]         = useState(true)
  const [unauthorized, setUnauth]     = useState(false)
  const [needsSetup, setNeedsSetup]   = useState(false)
  const [logs, setLogs]               = useState<LogEntry[]>([])
  const [users, setUsers]             = useState<UserRow[]>([])
  const [businesses, setBusinesses]   = useState<Business[]>([])
  const [analyses, setAnalyses]       = useState<Analysis[]>([])
  const [selectedLog, setSelLog]      = useState<LogEntry | null>(null)
  const [logFilter, setLogFilter]     = useState('all')
  const [searchQ, setSearchQ]         = useState('')
  const [delConfirm, setDelConfirm]   = useState<{type:string;id:string;label:string;cascade?:string}|null>(null)
  const [deleting, setDeleting]       = useState(false)
  const [stats, setStats]             = useState({ logins:0, todayLogins:0, uniqueUsers:0, analyses:0, businesses:0, activeToday:0 })
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data:{ session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }
      if (session.user.email !== ADMIN_EMAIL) { setUnauth(true); setLoading(false); return }
      await loadAll(supabase)
      setLoading(false)
    }
    init()
  }, [router])

  const loadAll = async (supabase: any) => {
    // 1. Activity log — has existing RLS policy allowing admin to read all rows
    const { data: logData } = await supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2000)
    const rows: LogEntry[] = logData || []
    setLogs(rows)

    // 2. Build user_id → email map from activity logs
    const userIdToEmail: Record<string, string> = {}
    rows.forEach((r: any) => {
      if (r.user_id && r.user_email) userIdToEmail[r.user_id] = r.user_email
    })

    // 3. Businesses — try direct Supabase query (works if patch-v3.sql was run,
    //    OR if service role key is set in the API route)
    const { data: bizData, error: bizError } = await supabase
      .from('business_profiles')
      .select('*')
      .order('created_at', { ascending: false })

    const bizList: Business[] = (bizData || []).map((b: any) => ({
      ...b,
      user_email: userIdToEmail[b.user_id] || b.user_email || null,
    }))
    setBusinesses(bizList)

    // 4. Analyses
    const { data: anData, error: anError } = await supabase
      .from('analysis_results')
      .select('id,user_id,business_id,location_address,location_suburb,scores,created_at')
      .order('created_at', { ascending: false })

    const bizMap: Record<string,any> = {}
    bizList.forEach((b: any) => { bizMap[b.id] = b })

    const enrichedAn: Analysis[] = (anData || []).map((a: any) => ({
      ...a,
      business_name: bizMap[a.business_id]?.business_name || '—',
      user_email: bizMap[a.business_id]?.user_email || userIdToEmail[a.user_id] || null,
    }))
    setAnalyses(enrichedAn)

    // 5. Detect if RLS is blocking us (we get 0 results but logs say users exist)
    const hasLogs = rows.length > 0
    const profileLogs = rows.filter((r: any) => r.event_type === 'profile_created')
    const analysisLogs = rows.filter((r: any) => r.event_type === 'analysis_created')
    const rlsMissingForBiz = bizError || (bizList.length === 0 && profileLogs.length > 0)
    const rlsMissingForAn  = anError  || (enrichedAn.length === 0 && analysisLogs.length > 0)
    setNeedsSetup(!!(rlsMissingForBiz || rlsMissingForAn))

    const today = new Date().toDateString()
    const logins = rows.filter((r: any) => r.event_type === 'login')
    setStats({
      logins: logins.length,
      todayLogins: logins.filter((r: any) => new Date(r.created_at).toDateString() === today).length,
      uniqueUsers: new Set(rows.map((r: any) => r.user_email).filter(Boolean)).size,
      analyses: enrichedAn.length,
      businesses: bizList.length,
      activeToday: new Set(rows.filter((r: any) => new Date(r.created_at).toDateString() === today).map((r: any) => r.user_email).filter(Boolean)).size,
    })

    // 6. Build user list from logs + business/analysis counts
    const userMap: Record<string, UserRow> = {}
    rows.forEach((r: any) => {
      if (!r.user_email) return
      if (!userMap[r.user_email]) {
        userMap[r.user_email] = { id: r.user_id || r.user_email, email: r.user_email, created_at: r.created_at, last_sign_in_at: null, is_anonymous: false, business_count: 0, analysis_count: 0 }
      }
      if (r.event_type === 'login' || r.event_type === 'signup') {
        const d = new Date(r.created_at)
        const last = userMap[r.user_email].last_sign_in_at ? new Date(userMap[r.user_email].last_sign_in_at!) : new Date(0)
        if (d > last) userMap[r.user_email].last_sign_in_at = r.created_at
      }
      if (new Date(r.created_at) < new Date(userMap[r.user_email].created_at)) {
        userMap[r.user_email].created_at = r.created_at
      }
    })
    bizList.forEach((b: any) => { if (b.user_email && userMap[b.user_email]) userMap[b.user_email].business_count++ })
    enrichedAn.forEach((a: any) => { if (a.user_email && userMap[a.user_email]) userMap[a.user_email].analysis_count++ })

    // Also add users who appear only in logs (even if no biz/analyses visible yet)
    const allEmails = new Set(rows.map((r: any) => r.user_email).filter(Boolean))
    allEmails.forEach((email: string) => {
      if (!userMap[email]) {
        const firstLog = rows.filter((r: any) => r.user_email === email).slice(-1)[0]
        userMap[email] = { id: firstLog?.user_id || email, email, created_at: firstLog?.created_at || '', last_sign_in_at: null, is_anonymous: false, business_count: 0, analysis_count: 0 }
      }
    })

    setUsers(Object.values(userMap).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
  }

  const doDelete = async () => {
    if (!delConfirm) return
    setDeleting(true)
    try {
      const supabase = createClient()

      if (delConfirm.type === 'analysis') {
        await supabase.from('analysis_results').delete().eq('id', delConfirm.id)
        setAnalyses(a => a.filter(x => x.id !== delConfirm.id))
      } else if (delConfirm.type === 'business') {
        await supabase.from('analysis_results').delete().eq('business_id', delConfirm.id)
        await supabase.from('business_profiles').delete().eq('id', delConfirm.id)
        setAnalyses(a => a.filter(x => x.business_id !== delConfirm.id))
        setBusinesses(b => b.filter(x => x.id !== delConfirm.id))
      } else if (delConfirm.type === 'user') {
        const userBizIds = businesses.filter(b => b.user_email === delConfirm.label || b.user_id === delConfirm.id).map(b => b.id)
        for (const bid of userBizIds) {
          await supabase.from('analysis_results').delete().eq('business_id', bid)
        }
        await supabase.from('business_profiles').delete().eq('user_id', delConfirm.id)
        await supabase.from('activity_log').delete().eq('user_email', delConfirm.label)
        setAnalyses(a => a.filter(x => !userBizIds.includes(x.business_id)))
        setBusinesses(b => b.filter(x => x.user_email !== delConfirm.label && x.user_id !== delConfirm.id))
        setUsers(u => u.filter(x => x.id !== delConfirm.id))
        setLogs(l => l.filter(x => x.user_email !== delConfirm.label))
      } else if (delConfirm.type === 'log') {
        await supabase.from('activity_log').delete().eq('id', delConfirm.id)
        setLogs(l => l.filter(x => x.id !== delConfirm.id))
      }
    } catch (err: any) {
      alert('Delete failed: ' + err.message)
    } finally { setDeleting(false); setDelConfirm(null) }
  }

  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString('en-AU', { day:'numeric', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—'
  const fmtMeta = (m: Record<string,any>) => Object.entries(m||{}).map(([k,v])=>`${k}: ${v}`).join(' · ') || '—'
  const parseUA = (ua:string|null) => { if(!ua) return '—'; if(ua.includes('Chrome')) return 'Chrome'; if(ua.includes('Firefox')) return 'Firefox'; if(ua.includes('Safari')) return 'Safari'; return ua.slice(0,18) }
  const evtSt = (t:string) => ECOL[t] || { text:'#94a3b8', bg:'rgba(148,163,184,0.15)', border:'rgba(148,163,184,0.3)' }

  const filteredLogs = logs.filter(l => {
    if (logFilter !== 'all' && l.event_type !== logFilter) return false
    if (searchQ && !l.user_email?.toLowerCase().includes(searchQ.toLowerCase())) return false
    return true
  })
  const filteredUsers = users.filter(u => !searchQ || u.email.toLowerCase().includes(searchQ.toLowerCase()))
  const filteredBiz   = businesses.filter(b => !searchQ || b.business_name.toLowerCase().includes(searchQ.toLowerCase()) || b.user_email?.toLowerCase().includes(searchQ.toLowerCase()))
  const filteredAn    = analyses.filter(a => !searchQ || (a.location_suburb||'').toLowerCase().includes(searchQ.toLowerCase()) || (a.business_name||'').toLowerCase().includes(searchQ.toLowerCase()) || (a.user_email||'').toLowerCase().includes(searchQ.toLowerCase()))

  if (loading) return <Spinner />
  if (unauthorized) return (
    <div style={{ minHeight:'100vh', background:'#0d1117', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontFamily:'var(--font-display)', fontSize:'2rem', color:'#B07156', marginBottom:'8px' }}>Access Denied</div>
        <button onClick={()=>router.push('/businesses')} style={{ padding:'10px 20px', borderRadius:'10px', background:'#0A8754', color:'white', border:'none', fontFamily:'var(--font-body)', cursor:'pointer' }}>Go back</button>
      </div>
    </div>
  )

  const TABS: {key:Tab;label:string;count:number}[] = [
    { key:'users',      label:'Users',        count: users.length     },
    { key:'businesses', label:'Businesses',   count: businesses.length },
    { key:'analyses',   label:'Analyses',     count: analyses.length  },
    { key:'activity',   label:'Activity Log', count: logs.length      },
  ]

  const DelBtn = ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(176,113,86,0.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:'4px', borderRadius:'6px', transition:'all 0.15s' }}
      onMouseEnter={e=>{const el=e.currentTarget as HTMLElement; el.style.color='#B07156'; el.style.background='rgba(176,113,86,0.1)'}}
      onMouseLeave={e=>{const el=e.currentTarget as HTMLElement; el.style.color='rgba(176,113,86,0.45)'; el.style.background='none'}}
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M1.5 3.5h10M4.5 3.5v-1.5h4v1.5M10 3.5l-.7 7.5H3.7L3 3.5"/></svg>
    </button>
  )

  const TH = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.57rem', color:'rgba(255,255,255,0.2)', textTransform:'uppercase', letterSpacing:'0.1em' }}>{children}</div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#0d1117', color:'rgba(255,255,255,0.85)' }}>

      {/* Header */}
      <header style={{ position:'sticky', top:0, zIndex:100, background:'rgba(13,17,23,0.97)', backdropFilter:'blur(12px)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'0 28px', height:'52px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
          <button onClick={()=>router.push('/dashboard')} style={{ display:'flex', alignItems:'center', gap:'6px', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.35)', fontFamily:'var(--font-body)', fontSize:'0.8rem' }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M8.5 2L3 6.5l5.5 4.5"/></svg>
            Dashboard
          </button>
          <span style={{ color:'rgba(255,255,255,0.1)' }}>/</span>
          <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
            <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#0A8754', animation:'blink 2s infinite', display:'inline-block' }} />
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.78rem', color:'rgba(255,255,255,0.6)', letterSpacing:'0.1em' }}>ADMIN PANEL</span>
          </div>
        </div>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.68rem', color:'rgba(255,255,255,0.2)' }}>{ADMIN_EMAIL}</span>
      </header>

      <div style={{ maxWidth:'1240px', margin:'0 auto', padding:'28px 20px 80px' }}>

        {/* ── Setup banner — shown when RLS is blocking businesses/analyses ── */}
        {needsSetup && (
          <div style={{ marginBottom:'1.5rem', padding:'16px 20px', borderRadius:'14px', background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.25)' }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:'12px' }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink:0, marginTop:'1px' }}><circle cx="9" cy="9" r="7"/><path d="M9 6v4M9 12.5h.01"/></svg>
              <div>
                <div style={{ fontFamily:'var(--font-body)', fontWeight:700, fontSize:'0.88rem', color:'rgba(255,255,255,0.85)', marginBottom:'6px' }}>
                  One-time setup required to see all users' businesses &amp; analyses
                </div>
                <div style={{ fontFamily:'var(--font-body)', fontSize:'0.82rem', color:'rgba(255,255,255,0.5)', lineHeight:1.6, marginBottom:'12px' }}>
                  RLS (Row Level Security) prevents the admin from reading other users' data. Run this SQL once in your Supabase SQL Editor to unlock the admin panel:
                </div>
                <pre style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'#34d399', background:'rgba(0,0,0,0.4)', padding:'12px 14px', borderRadius:'9px', overflowX:'auto', margin:'0 0 10px', lineHeight:1.6 }}>
{`-- Run in Supabase → SQL Editor
create policy "Admin view businesses"
  on public.business_profiles for select
  using (auth.jwt() ->> 'email' = '${ADMIN_EMAIL}');

create policy "Admin delete businesses"
  on public.business_profiles for delete
  using (auth.jwt() ->> 'email' = '${ADMIN_EMAIL}');

create policy "Admin view analyses"
  on public.analysis_results for select
  using (auth.jwt() ->> 'email' = '${ADMIN_EMAIL}');

create policy "Admin delete analyses"
  on public.analysis_results for delete
  using (auth.jwt() ->> 'email' = '${ADMIN_EMAIL}');`}
                </pre>
                <div style={{ fontFamily:'var(--font-body)', fontSize:'0.78rem', color:'rgba(255,255,255,0.35)' }}>
                  This is already in <code style={{ color:'#fbbf24' }}>supabase-schema-patch-v3.sql</code> — copy it from your project files. Activity log is working fine.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'10px', marginBottom:'2rem' }}>
          {[
            { label:'Total Users',     v: users.length          },
            { label:'Active Today',    v: stats.activeToday     },
            { label:"Today's Logins",  v: stats.todayLogins     },
            { label:'Unique Accounts', v: stats.uniqueUsers     },
            { label:'Analyses Run',    v: analyses.length       },
            { label:'Businesses',      v: businesses.length     },
          ].map(s => (
            <div key={s.label} style={{ background:'rgba(255,255,255,0.04)', borderRadius:'12px', border:'1px solid rgba(255,255,255,0.06)', padding:'0.9rem 1rem' }}>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.57rem', color:'rgba(255,255,255,0.22)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'5px' }}>{s.label}</div>
              <div style={{ fontFamily:'var(--font-display)', fontSize:'1.7rem', color:'#0A8754', lineHeight:1 }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Search + tabs */}
        <div style={{ display:'flex', gap:'12px', marginBottom:'1.2rem', alignItems:'center' }}>
          <div style={{ display:'flex', gap:'3px', background:'rgba(255,255,255,0.04)', borderRadius:'10px', padding:'4px' }}>
            {TABS.map(t => (
              <button key={t.key} onClick={()=>setTab(t.key)} style={{
                padding:'7px 14px', borderRadius:'7px', border:'none', cursor:'pointer',
                background: tab===t.key ? '#0A8754' : 'transparent',
                color: tab===t.key ? 'white' : 'rgba(255,255,255,0.38)',
                fontFamily:'var(--font-body)', fontSize:'0.82rem', fontWeight: tab===t.key ? 600 : 400,
                display:'flex', alignItems:'center', gap:'5px', transition:'all 0.15s',
              }}>
                {t.label}
                <span style={{ fontSize:'0.68rem', opacity:0.65 }}>({t.count})</span>
              </button>
            ))}
          </div>
          <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder={`Search ${tab}…`}
            style={{ flex:1, padding:'8px 14px', borderRadius:'9px', border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.6)', fontFamily:'var(--font-mono)', fontSize:'0.73rem', outline:'none' }} />
        </div>

        {/* ── USERS ── */}
        {tab === 'users' && (
          <div style={{ background:'rgba(255,255,255,0.02)', borderRadius:'14px', border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'minmax(0,2.5fr) 110px 80px 80px 160px 160px 40px', padding:'9px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.03)' }}>
              {['Email','Joined','Biz','Analyses','Last Login','User ID',''].map(h=><TH key={h}>{h}</TH>)}
            </div>
            {filteredUsers.length === 0
              ? <Empty>No users found. Activity log may be empty — make sure users have logged in.</Empty>
              : filteredUsers.map((u, i) => (
              <div key={u.id} style={{ display:'grid', gridTemplateColumns:'minmax(0,2.5fr) 110px 80px 80px 160px 160px 40px', padding:'10px 16px', borderBottom: i<filteredUsers.length-1?'1px solid rgba(255,255,255,0.03)':'none', transition:'background 0.1s' }}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.025)'}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}
              >
                <div style={{ display:'flex', alignItems:'center', gap:'8px', paddingRight:'8px', overflow:'hidden' }}>
                  <div style={{ width:'26px', height:'26px', borderRadius:'8px', background:'rgba(10,135,84,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ fontFamily:'var(--font-body)', fontSize:'0.72rem', color:'#0A8754', fontWeight:600 }}>{u.email[0].toUpperCase()}</span>
                  </div>
                  <span style={{ fontFamily:'var(--font-body)', fontSize:'0.82rem', color:'rgba(255,255,255,0.7)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.email}</span>
                </div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.67rem', color:'rgba(255,255,255,0.28)' }}>{fmt(u.created_at)}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color: u.business_count > 0 ? '#a78bfa' : 'rgba(255,255,255,0.2)', fontWeight:600 }}>{u.business_count}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color: u.analysis_count > 0 ? '#fbbf24' : 'rgba(255,255,255,0.2)', fontWeight:600 }}>{u.analysis_count}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.66rem', color:'rgba(255,255,255,0.28)' }}>{fmt(u.last_sign_in_at)}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'rgba(255,255,255,0.18)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.id?.slice(0,20)}…</div>
                <DelBtn onClick={()=>setDelConfirm({ type:'user', id:u.id, label:u.email, cascade:`Deletes ${u.business_count} business(es) and ${u.analysis_count} analysis results.` })} />
              </div>
            ))}
          </div>
        )}

        {/* ── BUSINESSES ── */}
        {tab === 'businesses' && (
          <div style={{ background:'rgba(255,255,255,0.02)', borderRadius:'14px', border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'minmax(0,2fr) minmax(0,1.5fr) 130px 120px minmax(0,1.5fr) 40px', padding:'9px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.03)' }}>
              {['Business','Category','Budget','Created','Owner',''].map(h=><TH key={h}>{h}</TH>)}
            </div>
            {filteredBiz.length === 0
              ? <Empty>{needsSetup ? 'Run the SQL above to unlock all users\' businesses.' : 'No businesses found.'}</Empty>
              : filteredBiz.map((b, i) => (
              <div key={b.id} style={{ display:'grid', gridTemplateColumns:'minmax(0,2fr) minmax(0,1.5fr) 130px 120px minmax(0,1.5fr) 40px', padding:'10px 16px', borderBottom: i<filteredBiz.length-1?'1px solid rgba(255,255,255,0.03)':'none', transition:'background 0.1s' }}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.025)'}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}
              >
                <div style={{ fontFamily:'var(--font-body)', fontSize:'0.83rem', color:'rgba(255,255,255,0.72)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:'8px' }}>{b.business_name}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.67rem', color:'rgba(255,255,255,0.38)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:'8px' }}>{b.category}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.67rem', color:'rgba(255,255,255,0.28)' }}>{b.budget}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.67rem', color:'rgba(255,255,255,0.22)' }}>{fmt(b.created_at)}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'rgba(255,255,255,0.35)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.user_email || b.user_id?.slice(0,20)}</div>
                <DelBtn onClick={()=>setDelConfirm({ type:'business', id:b.id, label:b.business_name, cascade:'All analyses for this business will also be deleted.' })} />
              </div>
            ))}
          </div>
        )}

        {/* ── ANALYSES ── */}
        {tab === 'analyses' && (
          <div style={{ background:'rgba(255,255,255,0.02)', borderRadius:'14px', border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'minmax(0,2fr) minmax(0,1.5fr) 80px 160px minmax(0,1.5fr) 40px', padding:'9px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.03)' }}>
              {['Location','Business','Score','Created','User',''].map(h=><TH key={h}>{h}</TH>)}
            </div>
            {filteredAn.length === 0
              ? <Empty>{needsSetup ? 'Run the SQL above to unlock all users\' analyses.' : 'No analyses found.'}</Empty>
              : filteredAn.map((a, i) => (
              <div key={a.id} style={{ display:'grid', gridTemplateColumns:'minmax(0,2fr) minmax(0,1.5fr) 80px 160px minmax(0,1.5fr) 40px', padding:'10px 16px', borderBottom: i<filteredAn.length-1?'1px solid rgba(255,255,255,0.03)':'none', transition:'background 0.1s' }}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.025)'}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}
              >
                <div style={{ paddingRight:'8px', overflow:'hidden' }}>
                  <div style={{ fontFamily:'var(--font-body)', fontSize:'0.82rem', color:'rgba(255,255,255,0.65)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.location_suburb || a.location_address?.split(',')[0]}</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'rgba(255,255,255,0.22)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:'2px' }}>{a.location_address}</div>
                </div>
                <div style={{ fontFamily:'var(--font-body)', fontSize:'0.78rem', color:'rgba(255,255,255,0.4)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:'8px' }}>{a.business_name}</div>
                <div>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.73rem', fontWeight:700, color:(a.scores?.overall||0)>=70?'#0A8754':(a.scores?.overall||0)>=50?'#fbbf24':'#B07156' }}>
                    {a.scores?.overall??'—'}/100
                  </span>
                </div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.66rem', color:'rgba(255,255,255,0.24)' }}>{fmt(a.created_at)}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.64rem', color:'rgba(255,255,255,0.32)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.user_email || '—'}</div>
                <DelBtn onClick={()=>setDelConfirm({ type:'analysis', id:a.id, label:a.location_suburb||'analysis' })} />
              </div>
            ))}
          </div>
        )}

        {/* ── ACTIVITY LOG ── */}
        {tab === 'activity' && (
          <>
            <div style={{ display:'flex', gap:'8px', marginBottom:'1rem', flexWrap:'wrap', alignItems:'center' }}>
              <div style={{ display:'flex', gap:'3px', background:'rgba(255,255,255,0.04)', borderRadius:'9px', padding:'3px' }}>
                {['all','login','analysis_created','profile_created','page_view','logout'].map(f => (
                  <button key={f} onClick={()=>setLogFilter(f)} style={{ padding:'4px 9px', borderRadius:'6px', border:'none', cursor:'pointer', background:logFilter===f?'#0A8754':'transparent', color:logFilter===f?'white':'rgba(255,255,255,0.32)', fontFamily:'var(--font-mono)', fontSize:'0.6rem', letterSpacing:'0.04em', transition:'all 0.15s' }}>
                    {f==='all'?'ALL':(ELABELS[f]||f).toUpperCase()}
                  </button>
                ))}
              </div>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'rgba(255,255,255,0.2)', marginLeft:'auto' }}>{filteredLogs.length} events</span>
            </div>

            <div style={{ background:'rgba(255,255,255,0.02)', borderRadius:'14px', border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden' }}>
              <div style={{ display:'grid', gridTemplateColumns:'150px minmax(0,1.8fr) 130px minmax(0,1fr) 110px 90px 40px', padding:'9px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.03)' }}>
                {['Time','Email','Event','Details','IP','Browser',''].map(h=><TH key={h}>{h}</TH>)}
              </div>
              {filteredLogs.length === 0
                ? <Empty>No activity logged yet.</Empty>
                : filteredLogs.map((log, i) => {
                  const es = evtSt(log.event_type)
                  return (
                    <div key={log.id} onClick={()=>setSelLog(s=>s?.id===log.id?null:log)}
                      style={{ display:'grid', gridTemplateColumns:'150px minmax(0,1.8fr) 130px minmax(0,1fr) 110px 90px 40px', padding:'8px 16px', borderBottom:i<filteredLogs.length-1?'1px solid rgba(255,255,255,0.03)':'none', cursor:'pointer', background:selectedLog?.id===log.id?'rgba(10,135,84,0.07)':'transparent', transition:'background 0.1s' }}
                      onMouseEnter={e=>{if(selectedLog?.id!==log.id)(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.025)'}}
                      onMouseLeave={e=>{if(selectedLog?.id!==log.id)(e.currentTarget as HTMLElement).style.background='transparent'}}
                    >
                      <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.67rem', color:'rgba(255,255,255,0.28)' }}>{fmt(log.created_at)}</div>
                      <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.67rem', color:'rgba(255,255,255,0.55)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:'8px' }}>{log.user_email||<span style={{opacity:0.3}}>anon</span>}</div>
                      <div><span style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:es.text, background:es.bg, padding:'2px 7px', borderRadius:'20px', border:`1px solid ${es.border}`, whiteSpace:'nowrap' }}>{ELABELS[log.event_type]||log.event_type}</span></div>
                      <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.63rem', color:'rgba(255,255,255,0.28)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:'8px' }}>{fmtMeta(log.metadata)}</div>
                      <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.63rem', color:log.ip_address?'rgba(255,255,255,0.4)':'rgba(255,255,255,0.14)' }}>{log.ip_address||'—'}</div>
                      <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.63rem', color:'rgba(255,255,255,0.22)' }}>{parseUA(log.user_agent)}</div>
                      <DelBtn onClick={e=>{(e as any).stopPropagation?.(); setDelConfirm({type:'log',id:log.id,label:'log entry'})}} />
                    </div>
                  )
                })}
            </div>

            {selectedLog && (
              <div style={{ marginTop:'14px', background:'rgba(255,255,255,0.03)', borderRadius:'14px', border:'1px solid rgba(255,255,255,0.07)', padding:'1.4rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'1rem' }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.68rem', color:'rgba(255,255,255,0.32)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Event Detail</span>
                  <button onClick={()=>setSelLog(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.3)', fontSize:'1rem' }}>✕</button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))', gap:'9px' }}>
                  {[['ID',selectedLog.id],['User ID',selectedLog.user_id||'—'],['Email',selectedLog.user_email||'anonymous'],['Event',ELABELS[selectedLog.event_type]||selectedLog.event_type],['Time',new Date(selectedLog.created_at).toLocaleString('en-AU')],['IP',selectedLog.ip_address||'—'],['Browser',selectedLog.user_agent||'—'],['Metadata',JSON.stringify(selectedLog.metadata||{})]].map(([k,v])=>(
                    <div key={k} style={{ padding:'8px 10px', borderRadius:'8px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.56rem', color:'rgba(255,255,255,0.2)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'3px' }}>{k}</div>
                      <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.69rem', color:'rgba(255,255,255,0.6)', wordBreak:'break-all' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete modal */}
      {delConfirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.72)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(6px)' }}>
          <div style={{ background:'#1a1f2e', borderRadius:'20px', padding:'2rem', border:'1px solid rgba(176,113,86,0.3)', maxWidth:'400px', width:'90%', boxShadow:'0 24px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'1.2rem' }}>
              <div style={{ width:'38px', height:'38px', borderRadius:'10px', background:'rgba(176,113,86,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="#B07156" strokeWidth="1.5" strokeLinecap="round"><circle cx="8.5" cy="8.5" r="6.5"/><path d="M8.5 5.5v3.5M8.5 11.5h.01"/></svg>
              </div>
              <div>
                <div style={{ fontFamily:'var(--font-body)', fontWeight:700, color:'rgba(255,255,255,0.88)', fontSize:'0.98rem' }}>Delete {delConfirm.type}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.63rem', color:'rgba(255,255,255,0.28)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:'1px' }}>{delConfirm.type} · irreversible</div>
              </div>
            </div>
            <p style={{ fontFamily:'var(--font-body)', fontSize:'0.88rem', color:'rgba(255,255,255,0.55)', lineHeight:1.65, marginBottom: delConfirm.cascade ? '0.8rem' : '1.5rem' }}>
              Delete <strong style={{ color:'rgba(255,255,255,0.82)' }}>{delConfirm.label}</strong>? This cannot be undone.
            </p>
            {delConfirm.cascade && (
              <div style={{ marginBottom:'1.5rem', padding:'10px 14px', borderRadius:'10px', background:'rgba(176,113,86,0.08)', border:'1px solid rgba(176,113,86,0.2)' }}>
                <p style={{ fontFamily:'var(--font-mono)', fontSize:'0.68rem', color:'rgba(176,113,86,0.85)', margin:0 }}>⚠ {delConfirm.cascade}</p>
              </div>
            )}
            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={()=>setDelConfirm(null)} style={{ flex:1, padding:'11px', borderRadius:'10px', background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.48)', border:'none', fontFamily:'var(--font-body)', fontSize:'0.88rem', cursor:'pointer' }}>Cancel</button>
              <button onClick={doDelete} disabled={deleting} style={{ flex:1, padding:'11px', borderRadius:'10px', background:'#B07156', color:'white', border:'none', fontFamily:'var(--font-body)', fontSize:'0.88rem', fontWeight:600, cursor:deleting?'not-allowed':'pointer', opacity:deleting?0.65:1 }}>
                {deleting ? 'Deleting…' : `Delete ${delConfirm.type}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding:'3rem', textAlign:'center', color:'rgba(255,255,255,0.18)', fontFamily:'var(--font-body)', fontSize:'0.85rem' }}>{children}</div>
}

function Spinner() {
  return (
    <div style={{ minHeight:'100vh', background:'#0d1117', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:'32px', height:'32px', border:'2px solid #0A8754', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
