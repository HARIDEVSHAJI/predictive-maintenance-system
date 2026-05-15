import { useEffect, useState } from 'react'
import { LayoutDashboard, AlertTriangle } from 'lucide-react'
import { LineChart,Line,BarChart,Bar,XAxis,YAxis,Tooltip,ResponsiveContainer,PieChart,Pie,Cell,ReferenceLine } from 'recharts'
import { KPICard, SectionHeader, ClusterBadge, Spinner, RealSparkline, CustomTooltip } from '../components/ui/index.jsx'
import { motion } from 'framer-motion'

const CCOLORS = { NORMAL:'var(--ok)', IDLE:'var(--idle)', 'HIGH-STRESS':'var(--danger)' }

export default function SystemOverview() {
  const [data, setData] = useState(null)
  useEffect(()=>{ fetch('/api/overview').then(r=>r.json()).then(setData).catch(()=>{}) },[])

  if (!data) return <div><SectionHeader title="System Overview" icon={LayoutDashboard}/><Spinner text="Loading overview..."/></div>

  return (
    <div className="anim-fade-up" style={{display:'flex',flexDirection:'column',gap:20}}>
      <SectionHeader title="System Overview" icon={LayoutDashboard}
        subtitle="MetroPT-3 Air Compressor — 213 days of real industrial sensor data"/>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14}}>
        <KPICard title="Anomalies Detected"
          value={(data.alert_count/1000).toFixed(0)} unit="k"
          color="yellow" sub={`${((data.alert_count/data.total_rows)*100).toFixed(1)}% of all readings`}/>
        <KPICard title="Avg Health Score"
          value={data.avg_health} unit="/100"
          color="green" sub="Across 1,516,948 readings"/>
        <KPICard title="Failure Events"
          value={data.failure_events?.length||5} unit="confirmed"
          color="red" sub="Real air leaks — Apr–Jul 2020"/>
        <KPICard title="Median RUL"
          value={data.median_rul_days} unit="days"
          color="gray" sub="Remaining Useful Life estimate"/>
      </div>

      {/* Charts row */}
      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:14}}>
        <div className="card" style={{padding:22}}>
          <div style={{fontWeight:700,color:'var(--text-1)',marginBottom:3}}>Machine Health Over Time — 213 Days</div>
          <div style={{color:'var(--text-3)',fontSize:11,marginBottom:16}}>Daily average anomaly score. Red bands = failure windows.</div>
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={data.timeline}>
              <XAxis dataKey="date" tickFormatter={v=>v.slice(5)} interval={15} tick={{fill:'var(--text-3)',fontSize:10}}/>
              <YAxis domain={[-0.75,-0.35]} tick={{fill:'var(--text-3)',fontSize:10}}/>
              <Tooltip content={<CustomTooltip/>}/>
              <ReferenceLine y={-0.45} stroke="var(--warn)"   strokeDasharray="3 3"/>
              <ReferenceLine y={-0.55} stroke="var(--danger)" strokeDasharray="3 3"/>
              {data.failure_events?.map(f=>(
                <ReferenceLine key={f.id} x={f.date} stroke="var(--danger)" strokeOpacity={.25} strokeWidth={2}/>
              ))}
              <Line dataKey="avg_score" stroke="var(--accent)" strokeWidth={2} dot={false} name="Anomaly Score"/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{padding:22}}>
          <div style={{fontWeight:700,color:'var(--text-1)',marginBottom:3}}>Cluster Distribution</div>
          <div style={{color:'var(--text-3)',fontSize:11,marginBottom:10}}>Behaviour segmentation</div>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={data.cluster_dist} dataKey="count" nameKey="cluster"
                   cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={3}>
                {data.cluster_dist?.map((e,i)=>(
                  <Cell key={i} fill={CCOLORS[e.cluster]||'var(--text-3)'}/>
                ))}
              </Pie>
              <Tooltip formatter={v=>[v.toLocaleString(),'Readings']}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:6}}>
            {data.cluster_dist?.map((d,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{display:'flex',alignItems:'center',gap:7}}>
                  <span style={{width:8,height:8,borderRadius:'50%',background:CCOLORS[d.cluster]||'var(--text-3)',flexShrink:0}}/>
                  <span style={{color:'var(--text-2)',fontSize:11}}>{d.cluster}</span>
                </span>
                <span style={{color:'var(--text-1)',fontSize:11,fontFamily:'monospace',fontWeight:700}}>
                  {((d.count/data.total_rows)*100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14}}>
        <div className="card" style={{padding:20}}>
          <div style={{fontWeight:700,color:'var(--text-1)',marginBottom:14}}>Monthly Readings</div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={data.monthly}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{fill:'var(--text-3)',fontSize:9}} tickFormatter={v=>v.slice(5)} interval={1}/>
              <YAxis tick={{fill:'var(--text-3)',fontSize:9}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
              <Tooltip formatter={v=>[v.toLocaleString(),'Readings']}/>
              <Bar dataKey="count" fill="url(#barGrad)" stroke="rgba(255,255,255,0.4)" strokeWidth={1} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{padding:20}}>
          <div style={{fontWeight:700,color:'var(--text-1)',marginBottom:12}}>Failure Events</div>
          <div style={{display:'flex',flexDirection:'column',gap:7}}>
            {data.failure_events?.map(f=>(
              <div key={f.id} style={{display:'flex',gap:10,alignItems:'center',
                                       padding:'8px 10px',background:'var(--danger-bg)',borderRadius:10}}>
                <AlertTriangle size={13} color="var(--danger)" style={{flexShrink:0}}/>
                <div>
                  <div style={{color:'var(--text-1)',fontSize:12,fontWeight:600}}>{f.date}</div>
                  <div style={{color:'var(--text-3)',fontSize:10}}>{f.type} — {f.duration}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{padding:20}}>
          <div style={{fontWeight:700,color:'var(--text-1)',marginBottom:12}}>Key Metrics</div>
          {[
            {l:'Silhouette Score',  v:'0.6117',  tag:'Excellent', tc:'var(--ok)'},
            {l:'Davies-Bouldin',    v:'1.1267',  tag:'Good',      tc:'var(--warn)'},
            {l:'Calinski-Harabasz',v:'20,024',   tag:'Excellent', tc:'var(--ok)'},
            {l:'PCA Components',   v:'12',        tag:'96% var',  tc:'var(--text-2)'},
            {l:'Training Rows',    v:'857k',      tag:'Feb–May',  tc:'var(--text-3)'},
          ].map(m=>(
            <div key={m.l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                                    padding:'7px 0',borderBottom:'1px solid var(--border)'}}>
              <span style={{color:'var(--text-3)',fontSize:11}}>{m.l}</span>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{color:'var(--text-1)',fontFamily:'monospace',fontWeight:700,fontSize:12}}>{m.v}</span>
                <span style={{fontSize:9,padding:'1px 7px',borderRadius:50,
                               background:'var(--bg-card2)',border:'1px solid var(--border)',
                               color:m.tc,fontWeight:600}}>{m.tag}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent events — REAL sparklines from surrounding anomaly scores */}
      <div className="card" style={{padding:22}}>
        <div style={{fontWeight:700,color:'var(--text-1)',marginBottom:14}}>Recent Anomaly Events</div>
        <table style={{width:'100%',fontSize:11,borderCollapse:'collapse'}}>
          <thead>
            <tr style={{borderBottom:'1px solid var(--border)'}}>
              {['Timestamp','Cluster','Anomaly Score','Health','TP2 (bar)','Oil Temp','Score Context'].map(h=>(
                <th key={h} className="label-xs" style={{textAlign:'left',padding:'8px 12px'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.recent_events?.map((r,i)=>{
              // spark_scores comes from backend — real surrounding anomaly scores
              const spark = r.spark_scores || []
              const sColor = r.anomaly_score<-0.55?'var(--danger)':r.anomaly_score<-0.45?'var(--warn)':'var(--ok)'
              return (
                <motion.tr key={i} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*.03}} className="trow">
                  <td style={{padding:'9px 12px',color:'var(--text-3)',fontFamily:'monospace'}}>{r.timestamp?.slice(0,19)}</td>
                  <td style={{padding:'9px 12px'}}><ClusterBadge name={r.cluster_name}/></td>
                  <td style={{padding:'9px 12px',fontFamily:'monospace',color:sColor}}>{r.anomaly_score?.toFixed(4)}</td>
                  <td style={{padding:'9px 12px',fontFamily:'monospace',fontWeight:700,
                               color:r.health_score>70?'var(--ok)':r.health_score>40?'var(--warn)':'var(--danger)'}}>
                    {r.health_score}</td>
                  <td style={{padding:'9px 12px',fontFamily:'monospace',color:'var(--text-2)'}}>{r.TP2?.toFixed(3)}</td>
                  <td style={{padding:'9px 12px',fontFamily:'monospace',
                               color:r.Oil_temperature>75?'var(--danger)':'var(--text-2)'}}>{r.Oil_temperature?.toFixed(1)}°C</td>
                  <td style={{padding:'9px 12px'}}>
                    {spark.length >= 2
                      ? <RealSparkline data={spark} color={sColor} width={80} height={28}/>
                      : <span style={{color:'var(--text-3)',fontSize:10}}>—</span>}
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
        <div style={{color:'var(--text-3)',fontSize:10,marginTop:8}}>
          "Score Context" shows actual anomaly scores from surrounding readings (±4 rows) for each event.
        </div>
      </div>
    </div>
  )
}
