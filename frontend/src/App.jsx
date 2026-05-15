import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LayoutDashboard, Radio, Microscope, Bell, TrendingUp, BarChart3, Database, Cpu, Wifi, WifiOff, Sun, Moon, Smartphone, Clock, LogOut } from 'lucide-react'
import LoginPage       from './pages/LoginPage.jsx'
import SystemOverview   from './pages/SystemOverview.jsx'
import LiveMonitor      from './pages/LiveMonitor.jsx'
import ClusterAnalysis  from './pages/ClusterAnalysis.jsx'
import AnomalyAlerts    from './pages/AnomalyAlerts.jsx'
import SensorTrends     from './pages/SensorTrends.jsx'
import ModelPerformance from './pages/ModelPerformance.jsx'
import DatasetReports   from './pages/DatasetReports.jsx'
import IoTMonitor       from './pages/IoTMonitor.jsx'

const NAV = [
  { id:'overview', label:'System Overview',   icon:LayoutDashboard },
  { id:'live',     label:'Live Monitor',      icon:Radio           },
  { id:'clusters', label:'Cluster Analysis',  icon:Microscope      },
  { id:'alerts',   label:'Anomaly Alerts',    icon:Bell            },
  { id:'sensors',  label:'Sensor Trends',     icon:TrendingUp      },
  { id:'model',    label:'Model Performance', icon:BarChart3       },
  { id:'dataset',  label:'Dataset & Reports', icon:Database        },
  { id:'iot',      label:'IoT Sensor',        icon:Smartphone      },
]
const NAV_IDX = NAV.map(n=>n.id)
const PAGES   = { overview:SystemOverview, live:LiveMonitor, clusters:ClusterAnalysis,
                  alerts:AnomalyAlerts, sensors:SensorTrends, model:ModelPerformance, dataset:DatasetReports, iot:IoTMonitor }

/* slide direction based on nav order */
const getDir = (from, to) => {
  const fi = NAV_IDX.indexOf(from), ti = NAV_IDX.indexOf(to)
  return ti > fi ? 1 : -1
}

/* ── Circuit board corner SVG (matches login page but bigger & more visible) ── */
const CircuitCorner = ({ style, flip = '' }) => (
  <svg width="280" height="280" viewBox="0 0 280 280" fill="none"
    style={{ position: 'absolute', ...style, transform: flip, pointerEvents: 'none', zIndex: 0 }}>
    {/* Main traces */}
    <line x1="15" y1="140" x2="220" y2="140" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
    <line x1="140" y1="15" x2="140" y2="220" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
    <line x1="80" y1="80" x2="140" y2="140" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
    <line x1="220" y1="140" x2="250" y2="110" stroke="rgba(255,255,255,0.025)" strokeWidth="0.8" />
    <line x1="140" y1="220" x2="110" y2="250" stroke="rgba(255,255,255,0.025)" strokeWidth="0.8" />
    {/* Additional circuit traces */}
    <line x1="60" y1="140" x2="60" y2="200" stroke="rgba(255,255,255,0.02)" strokeWidth="0.6" />
    <line x1="140" y1="60" x2="200" y2="60" stroke="rgba(255,255,255,0.02)" strokeWidth="0.6" />
    <line x1="100" y1="100" x2="180" y2="100" stroke="rgba(255,255,255,0.018)" strokeWidth="0.6" />
    <line x1="100" y1="100" x2="100" y2="180" stroke="rgba(255,255,255,0.018)" strokeWidth="0.6" />
    {/* IC chip shape */}
    <rect x="175" y="115" width="24" height="50" rx="3" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.8" />
    {/* Chip pads */}
    <line x1="175" y1="128" x2="162" y2="128" stroke="rgba(255,255,255,0.04)" strokeWidth="0.7" />
    <line x1="175" y1="140" x2="162" y2="140" stroke="rgba(255,255,255,0.04)" strokeWidth="0.7" />
    <line x1="175" y1="152" x2="162" y2="152" stroke="rgba(255,255,255,0.04)" strokeWidth="0.7" />
    <line x1="199" y1="128" x2="212" y2="128" stroke="rgba(255,255,255,0.04)" strokeWidth="0.7" />
    <line x1="199" y1="140" x2="212" y2="140" stroke="rgba(255,255,255,0.04)" strokeWidth="0.7" />
    <line x1="199" y1="152" x2="212" y2="152" stroke="rgba(255,255,255,0.04)" strokeWidth="0.7" />
    {/* Junction dots */}
    <circle cx="220" cy="140" r="3.5" fill="rgba(255,255,255,0.08)" />
    <circle cx="140" cy="220" r="3.5" fill="rgba(255,255,255,0.08)" />
    <circle cx="140" cy="140" r="2.5" fill="rgba(255,255,255,0.06)" />
    <circle cx="80" cy="80" r="2" fill="rgba(255,255,255,0.05)" />
    <circle cx="250" cy="110" r="2" fill="rgba(255,255,255,0.06)" />
    <circle cx="110" cy="250" r="2" fill="rgba(255,255,255,0.06)" />
    <circle cx="60" cy="200" r="2" fill="rgba(255,255,255,0.04)" />
    <circle cx="200" cy="60" r="2" fill="rgba(255,255,255,0.04)" />
    {/* Dot grid */}
    {[0,1,2,3,4].map(r => [0,1,2,3,4].map(c => (
      <circle key={`${r}-${c}`} cx={56 + c * 8} cy={56 + r * 8}
        r="0.8" fill="rgba(255,255,255,0.04)" />
    )))}
  </svg>
)

/* ── Logo SVG — matches login page gear design ──────────────── */
const Logo = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    {/* Outer ring with gap */}
    <path d="M20 3 A17 17 0 1 1 8 8" stroke="rgba(255,255,255,0.7)" strokeWidth="2.2"
      strokeLinecap="round" fill="none" />
    {/* Inner gear */}
    <circle cx="20" cy="20" r="8" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" fill="none" />
    <circle cx="20" cy="20" r="3" fill="rgba(255,255,255,0.45)" />
    {/* Tick marks */}
    <line x1="20" y1="6" x2="20" y2="9" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="20" y1="31" x2="20" y2="34" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="6" y1="20" x2="9" y2="20" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="31" y1="20" x2="34" y2="20" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

export default function App() {
  const [authed,     setAuthed]     = useState(false)
  const [authLoading,setAuthLoading]= useState(true)
  const [page,       setPage]       = useState('overview')
  const [prevPage,   setPrevPage]   = useState('overview')
  const [online,     setOnline]     = useState(false)
  const [rows,       setRows]       = useState(null)
  const [alertCount, setAlertCount] = useState(null)
  const [time,       setTime]       = useState(new Date())
  /* ── Theme (Locked to Dark Mode) ────────────────────────── */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
  }, [])

  /* ── Check existing session on mount ────────────────────── */
  useEffect(() => {
    const token = localStorage.getItem('pdm_token')
    if (!token) { setAuthLoading(false); return }
    fetch('/api/verify-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(d => { setAuthed(d.valid); setAuthLoading(false) })
      .catch(() => { setAuthed(false); setAuthLoading(false) })
  }, [])

  /* ── Backend health polling ─────────────────────────────── */
  useEffect(() => {
    if (!authed) return
    const check = () => fetch('/api/health').then(r=>r.json())
      .then(d=>{setOnline(d.models_loaded); setRows(d.rows)}).catch(()=>setOnline(false))
    check(); const iv=setInterval(check,8000); return ()=>clearInterval(iv)
  }, [authed])

  useEffect(() => {
    if(online) fetch('/api/overview').then(r=>r.json())
      .then(d=>setAlertCount(d.alert_count)).catch(()=>{})
  }, [online])

  useEffect(() => {
    const iv=setInterval(()=>setTime(new Date()),1000); return ()=>clearInterval(iv)
  }, [])

  /* ── Auth handlers ──────────────────────────────────────── */
  const handleLogin = () => setAuthed(true)

  const handleLogout = async () => {
    const token = localStorage.getItem('pdm_token')
    if (token) {
      try {
        await fetch('/api/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
      } catch { /* ignore */ }
    }
    localStorage.removeItem('pdm_token')
    setAuthed(false)
    setPage('overview')
  }

  const navigate = (id) => {
    if(id===page) return
    setPrevPage(page)
    setPage(id)
  }

  /* ── Loading state ──────────────────────────────────────── */
  if (authLoading) {
    return (
      <div style={{
        display:'flex',alignItems:'center',justifyContent:'center',
        height:'100vh',background:'#0a0a0f',
      }}>
        <div style={{
          width:38,height:38,border:'3px solid rgba(255,255,255,0.08)',
          borderTopColor:'var(--accent)',borderRadius:'50%',
          animation:'spin .9s linear infinite',
        }}/>
      </div>
    )
  }

  /* ── Login gate ─────────────────────────────────────────── */
  if (!authed) {
    return <LoginPage onLogin={handleLogin} />
  }

  /* ── Dashboard ──────────────────────────────────────────── */
  const dir = getDir(prevPage, page)
  const Page = PAGES[page] || SystemOverview

  return (
    <div style={{display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg-base)'}}>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside style={{
        width:'var(--sidebar-w)', flexShrink:0, display:'flex', flexDirection:'column',
        background:'#000000',
        borderRight:'1px solid var(--border)',
        padding:'20px 14px 16px', gap:6,
      }}>
        {/* Logo — matches login page gear */}
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'4px 8px',marginBottom:24}}>
          <div style={{
            width:46,height:46,borderRadius:14,
            background:'rgba(255,255,255,0.05)',
            border:'1px solid rgba(255,255,255,0.10)',
            display:'flex',alignItems:'center',justifyContent:'center',
            flexShrink:0,
          }}>
            <Logo size={32}/>
          </div>
          <div>
            <div style={{fontWeight:800,fontSize:15,color:'#ffffff',lineHeight:1.15,letterSpacing:'-0.01em'}}>Predictive</div>
            <div style={{fontWeight:500,fontSize:12,color:'var(--text-muted)',lineHeight:1.15}}>Maintenance</div>
          </div>
        </div>

        {/* Section label */}
        <div className="label-xs" style={{padding:'0 14px',marginBottom:6}}>NAVIGATION</div>

        {/* Nav */}
        {NAV.map(item => {
          const Icon = item.icon
          const active = page===item.id
          return (
            <button key={item.id} onClick={()=>navigate(item.id)}
              className={`nav-item ${active?'active':''}`}>
              <Icon size={18} color={active ? '#ffffff' : 'var(--text-muted)'}/>
              <span style={{flex:1,fontWeight:active?800:600,color:active?'#ffffff':'var(--text-secondary)',fontSize:14.5}}>{item.label}</span>
              {item.id==='alerts' && alertCount>0 &&
                <span style={{fontSize:10,fontWeight:800,background:'rgba(255,255,255,0.12)',color:'#ffffff',
                              padding:'2px 8px',borderRadius:50,marginLeft:'auto',
                              border:'1px solid rgba(255,255,255,0.15)'}}>
                  {(alertCount/1000).toFixed(0)}k
                </span>}
              {item.id==='live' &&
                <span style={{width:5,height:5,borderRadius:'50%',background:'var(--ok)',
                              boxShadow:'0 0 6px var(--ok)',marginLeft:'auto'}}/>}
            </button>
          )
        })}

        <div style={{flex:1}}/>

        {/* Bottom */}
        <div style={{borderTop:'1px solid var(--border)',paddingTop:14,display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'2px 14px'}}>
            {online
              ? <><Wifi size={13} color="var(--ok)"/><span style={{color:'var(--ok)',fontSize:12,fontWeight:700}}>Backend Online</span></>
              : <><WifiOff size={13} color="var(--danger)"/><span style={{color:'var(--danger)',fontSize:12,fontWeight:600}}>Run train.py first</span></>}
          </div>

          <div style={{
            background:'var(--bg-card2)', border:'1px solid var(--border)', borderRadius:12,
            padding:'11px 14px', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          }}>
            <Clock size={14} color="#ffffff" />
            <span style={{color:'#ffffff', fontSize:13, fontFamily:'monospace', fontWeight:700, letterSpacing:'0.04em'}}>
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            style={{
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              padding:'10px 14px', borderRadius:12, width:'100%',
              background:'transparent', border:'1px solid var(--border)',
              color:'var(--text-secondary)', fontSize:13, fontWeight:700,
              cursor:'pointer', transition:'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--danger-bg)'
              e.currentTarget.style.borderColor = 'var(--danger)'
              e.currentTarget.style.color = 'var(--danger)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content area ────────────────────────────────────── */}
      <main style={{flex:1, overflow:'hidden', position:'relative', background:'var(--bg-base)'}}>

        {/* Circuit board decorations on the dashboard */}
        <CircuitCorner style={{ top: -20, right: -20 }} flip="scaleX(-1)" />
        <CircuitCorner style={{ bottom: -20, left: -20 }} flip="scaleY(-1)" />
        

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={page}
            initial={{ x: dir * 40, opacity: 0 }}
            animate={{ x: 0,        opacity: 1 }}
            exit={{    x: dir * -40, opacity: 0 }}
            transition={{ duration: .28, ease: [.22,1,.36,1] }}
            style={{
              position: 'absolute', inset: 0,
              overflowY: 'auto',
              padding: '32px 36px',
              zIndex: 1,
            }}
          >
            <Page/>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
