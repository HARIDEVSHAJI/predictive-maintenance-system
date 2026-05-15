import { useEffect, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { BarChart,Bar,XAxis,YAxis,Tooltip,ResponsiveContainer,Cell,AreaChart,Area } from 'recharts'
import { SectionHeader, Spinner, CustomTooltip } from '../components/ui/index.jsx'
import { motion } from 'framer-motion'

export default function ModelPerformance() {
  const [data, setData] = useState(null)
  useEffect(()=>{ fetch('/api/model-performance').then(r=>r.json()).then(setData) },[])
  if (!data) return <div><SectionHeader title="Model Performance" icon={BarChart3}/><Spinner/></div>

  return (
    <div className="anim-fade-up" style={{display:'flex',flexDirection:'column',gap:20}}>
      <SectionHeader title="Model Performance" icon={BarChart3}
        subtitle="Complete evaluation — K-Means clustering + Isolation Forest anomaly detection"/>

      {/* Top metric cards — clean, no fake sparklines */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14}}>
        {[
          {t:'Silhouette Score',  v:'0.6117', g:'Excellent', c:'var(--ok)',   desc:'Well above 0.5 — 3 states are clearly distinguishable.'},
          {t:'Davies-Bouldin',   v:'1.1267', g:'Good',      c:'var(--warn)', desc:'Compact clusters with clear separation between states.'},
          {t:'Calinski-Harabasz',v:'20,024', g:'Excellent', c:'var(--ok)',   desc:'Extremely strong — 20k is excellent for 1.5M industrial readings.'},
          {t:'PCA Variance',     v:'96.0%',  g:'Excellent', c:'var(--ok)',   desc:'12 components capture 96% of all variation from 33 features.'},
        ].map(m=>(
          <motion.div key={m.t} whileHover={{y:-2}} className="card card-hover"
            style={{padding:'20px 22px',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:0,left:0,right:0,height:3,
                          background:m.c,borderRadius:'16px 16px 0 0'}}/>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
              <div className="label-xs">{m.t}</div>
              <span style={{fontSize:9,padding:'2px 8px',borderRadius:50,fontWeight:700,
                background:m.g==='Excellent'?'var(--ok-bg)':'var(--warn-bg)',
                color:m.g==='Excellent'?'var(--ok)':'var(--warn)'}}>
                {m.g}
              </span>
            </div>
            <div style={{color:m.c,fontFamily:'monospace',fontSize:26,fontWeight:800,marginBottom:8}}>{m.v}</div>
            <p style={{color:'var(--text-3)',fontSize:10,lineHeight:1.5}}>{m.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* Bar charts */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
        {[
          {k:'silhouette',label:'Silhouette (Higher = Better)'},
          {k:'db',        label:'Davies-Bouldin (Lower = Better)'},
          {k:'ch',        label:'Calinski-Harabasz (Higher = Better)'},
        ].map(m=>(
          <div key={m.k} className="card" style={{padding:20}}>
            <div style={{fontWeight:600,color:'var(--text-1)',fontSize:12,marginBottom:12}}>{m.label}</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data.clustering_metrics}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="K" tick={{fill:'var(--text-3)',fontSize:11}}/>
                <YAxis tick={{fill:'var(--text-3)',fontSize:10}}
                  tickFormatter={v=>m.k==='ch'?`${(v/1000).toFixed(0)}k`:v?.toFixed?.(2)??v}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Bar dataKey={m.k} radius={[4,4,0,0]}>
                  {data.clustering_metrics?.map(d=>(
                    <Cell key={d.K}
                      fill={d.K===3?'url(#barGrad)':'var(--bg-card2)'}
                      stroke={d.K===3?'rgba(255,255,255,0.4)':'var(--border)'}
                      strokeWidth={1}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>

      {/* PCA charts */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <div className="card" style={{padding:20}}>
          <div style={{fontWeight:700,color:'var(--text-1)',marginBottom:14}}>PCA — Variance per Component</div>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={data.pca_variance}>
              <defs>
                <linearGradient id="pcaBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="component" tick={{fill:'var(--text-3)',fontSize:9}}/>
              <YAxis tick={{fill:'var(--text-3)',fontSize:10}} tickFormatter={v=>`${v}%`}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="variance" fill="url(#pcaBarGrad)" stroke="rgba(255,255,255,0.4)" strokeWidth={1} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card" style={{padding:20}}>
          <div style={{fontWeight:700,color:'var(--text-1)',marginBottom:14}}>Cumulative Variance (95% threshold)</div>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={data.pca_variance}>
              <XAxis dataKey="component" tick={{fill:'var(--text-3)',fontSize:9}}/>
              <YAxis domain={[0,100]} tick={{fill:'var(--text-3)',fontSize:10}} tickFormatter={v=>`${v}%`}/>
              <Tooltip content={<CustomTooltip/>}/>
              <defs>
                <linearGradient id="pcaG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--accent)" stopOpacity={.22}/>
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area dataKey="cumulative" stroke="var(--accent)" fill="url(#pcaG)" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Algorithm comparison — NO fake trend column */}
      <div className="card" style={{padding:22}}>
        <div style={{fontWeight:700,color:'var(--text-1)',marginBottom:14}}>Algorithm Comparison</div>
        <table style={{width:'100%',fontSize:11,borderCollapse:'collapse'}}>
          <thead>
            <tr style={{borderBottom:'1px solid var(--border)'}}>
              {['Algorithm','Role','Metric','Value','Status'].map(h=>(
                <th key={h} className="label-xs" style={{textAlign:'left',padding:'8px 12px'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.algorithm_comparison?.map((r,i)=>(
              <motion.tr key={i} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*.07}} className="trow">
                <td style={{padding:'10px 12px',color:'var(--text-1)',fontFamily:'monospace',fontWeight:700}}>{r.algorithm}</td>
                <td style={{padding:'10px 12px',color:'var(--text-2)'}}>{r.role}</td>
                <td style={{padding:'10px 12px',color:'var(--text-3)'}}>{r.metric}</td>
                <td style={{padding:'10px 12px',color:'var(--text-1)',fontFamily:'monospace',fontWeight:700}}>{r.value}</td>
                <td style={{padding:'10px 12px'}}>
                  <span style={{fontSize:10,padding:'3px 10px',borderRadius:50,fontWeight:700,
                    background:r.status==='Excellent'?'var(--ok-bg)':'var(--warn-bg)',
                    color:r.status==='Excellent'?'var(--ok)':'var(--warn)'}}>
                    {r.status}
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
