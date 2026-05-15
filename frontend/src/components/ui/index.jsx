import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { motion } from 'framer-motion'

/* ── Section header ──────────────────────────────────────────── */
export function SectionHeader({ title, subtitle, icon: Icon }) {
  return (
    <div style={{marginBottom:24}}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        {Icon && (
          <div style={{width:40,height:40,borderRadius:12,
                       background:'rgba(255,255,255,0.06)',
                       border:'1px solid rgba(255,255,255,0.10)',
                       display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <Icon size={18} color="#ffffff"/>
          </div>
        )}
        <h1 className="section-title">{title}</h1>
      </div>
      {subtitle && <p className="section-sub" style={{marginLeft:Icon?52:0}}>{subtitle}</p>}
    </div>
  )
}

/* ── KPI card — Bold and vibrant ─────────────────────────────── */
export function KPICard({ title, value, unit='', sub, color }) {
  const colors = {
    red:    { main:'var(--danger)', bar:'var(--danger)' },
    green:  { main:'var(--ok)',     bar:'var(--ok)'     },
    yellow: { main:'var(--warn)',   bar:'var(--warn)'   },
    gray:   { main:'var(--text-secondary)', bar:'var(--text-muted)' },
    white:  { main:'#ffffff',      bar:'rgba(255,255,255,0.3)' },
    accent: { main:'var(--accent)', bar:'var(--accent)' },
  }
  const c = colors[color] || colors.white
  return (
    <motion.div whileHover={{y:-2}} className="card"
      style={{padding:'22px 24px',position:'relative',overflow:'hidden'}}>
      {/* top accent bar */}
      <div style={{position:'absolute',top:0,left:0,right:0,height:3,
                   background:c.bar,borderRadius:'14px 14px 0 0'}}/>
      <div className="label-xs" style={{marginBottom:10}}>{title}</div>
      <div style={{display:'flex',alignItems:'baseline',gap:5}}>
        <span style={{fontSize:32,fontWeight:800,color:c.main,fontFamily:'monospace',lineHeight:1}}>
          {value}
        </span>
        <span style={{fontSize:14,color:'var(--text-muted)',fontWeight:600}}>{unit}</span>
      </div>
      {sub && <div style={{color:'var(--text-secondary)',fontSize:12,marginTop:8}}>{sub}</div>}
    </motion.div>
  )
}

/* ── Real sparkline using actual data array ─────────────────── */
export function RealSparkline({ data=[], color='var(--accent)', width=80, height=30 }) {
  if (!data || data.length < 2) return <span style={{color:'var(--text-muted)',fontSize:10}}>—</span>
  const pts = data.map(v=>({v}))
  return (
    <div style={{width,height,display:'inline-block',verticalAlign:'middle'}}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pts}>
          <Line dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ── Cluster badge ───────────────────────────────────────────── */
export function ClusterBadge({ name }) {
  const map = {
    'NORMAL':     'badge badge-normal',
    'IDLE':       'badge badge-idle',
    'HIGH-STRESS':'badge badge-stress',
    'WARNING':    'badge badge-warning',
    'CRITICAL':   'badge badge-critical',
  }
  const dotColor = {
    'NORMAL':'var(--ok)','IDLE':'var(--idle)',
    'HIGH-STRESS':'var(--danger)','WARNING':'var(--warn)','CRITICAL':'var(--danger)'
  }
  return (
    <span className={map[name]||'badge badge-warning'}>
      <span style={{width:6,height:6,borderRadius:'50%',display:'inline-block',
                    background:dotColor[name]||'var(--warn)'}}/>
      {name}
    </span>
  )
}

/* ── Health gauge ────────────────────────────────────────────── */
export function HealthGauge({ score, size=120 }) {
  const pct   = Math.max(0,Math.min(100,score))
  const color = pct>70?'var(--ok)':pct>40?'var(--warn)':'var(--danger)'
  const r=size*.38, cx=size/2, cy=size*.58
  const circ=2*Math.PI*r, arc=(270/360)*circ, off=arc-(pct/100)*arc
  const angle=-135+(pct/100)*270
  return (
    <svg width={size} height={size*.82} viewBox={`0 0 ${size} ${size*.82}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-card2)" strokeWidth={size*.055}
        strokeDasharray={`${arc} ${circ}`} strokeLinecap="round" transform={`rotate(-225 ${cx} ${cy})`}/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={size*.055}
        strokeDasharray={`${arc} ${circ}`} strokeDashoffset={off} strokeLinecap="round"
        transform={`rotate(-225 ${cx} ${cy})`} style={{transition:'stroke-dashoffset .5s ease-out'}}/>
      <line x1={cx} y1={cy}
        x2={cx+Math.cos((angle-90)*Math.PI/180)*r*.62}
        y2={cy+Math.sin((angle-90)*Math.PI/180)*r*.62}
        stroke={color} strokeWidth={size*.016} strokeLinecap="round"
        style={{transition:'all .5s ease-out'}}/>
      <circle cx={cx} cy={cy} r={size*.032} fill={color}/>
      <text x={cx} y={cy-r*.05} textAnchor="middle" fill={color}
        fontSize={size*.19} fontWeight="800" fontFamily="monospace">{Math.round(pct)}</text>
      <text x={cx} y={cy+r*.3} textAnchor="middle" fill="var(--text-muted)"
        fontSize={size*.08} fontWeight="700" fontFamily="Inter">HEALTH</text>
    </svg>
  )
}

/* ── Spinner ─────────────────────────────────────────────────── */
export function Spinner({ text='Loading...' }) {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',
                 justifyContent:'center',padding:'60px 0',gap:14}}>
      <div style={{position:'relative',width:40,height:40}}>
        <div style={{position:'absolute',inset:0,border:'3px solid var(--border)',borderRadius:'50%'}}/>
        <div style={{position:'absolute',inset:0,border:'3px solid transparent',
                     borderTopColor:'var(--accent)',borderRadius:'50%',animation:'spin .9s linear infinite'}}/>
      </div>
      <p style={{color:'var(--text-secondary)',fontSize:13,fontWeight:600}}>{text}</p>
    </div>
  )
}

/* ── Tooltip ─────────────────────────────────────────────────── */
export const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card" style={{padding:'10px 14px',fontSize:12,minWidth:130}}>
      <p style={{color:'var(--text-muted)',marginBottom:6,fontWeight:600}}>{label}</p>
      {payload.map((p,i)=>(
        <p key={i} style={{color:p.color||'#ffffff',fontFamily:'monospace',fontWeight:600}}>
          {p.name}: {typeof p.value==='number'?p.value.toFixed(4):p.value}
        </p>
      ))}
    </div>
  )
}
