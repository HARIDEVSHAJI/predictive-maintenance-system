import { useEffect, useState } from 'react'
import { Microscope } from 'lucide-react'
import { ScatterChart,Scatter,XAxis,YAxis,Tooltip,ResponsiveContainer,LineChart,Line,ReferenceLine } from 'recharts'
import { SectionHeader, Spinner, ClusterBadge, RealSparkline } from '../components/ui/index.jsx'
import { motion } from 'framer-motion'

const CCOLORS = { NORMAL:'var(--ok)', IDLE:'var(--idle)', 'HIGH-STRESS':'var(--danger)' }

export default function ClusterAnalysis() {
  const [data, setData] = useState(null)
  useEffect(()=>{ fetch('/api/clusters').then(r=>r.json()).then(setData) },[])
  if (!data) return <div><SectionHeader title="Cluster Analysis" icon={Microscope}/><Spinner/></div>

  const byCluster = {}
  // Since animations are disabled, we can safely render up to 3500 points
  const sampleRate = Math.max(1, Math.ceil((data.scatter?.length || 1) / 3500))
  const sampledScatter = data.scatter?.filter((_, i) => i % sampleRate === 0) || []
  sampledScatter.forEach(p=>{ if(!byCluster[p.cluster_name]) byCluster[p.cluster_name]=[]; byCluster[p.cluster_name].push(p) })
  const trends = data.cluster_weekly_trends || {}

  return (
    <div className="anim-fade-up" style={{display:'flex',flexDirection:'column',gap:20}}>
      <SectionHeader title="Cluster Analysis" icon={Microscope}
        subtitle="Unsupervised K-Means — K=3, Silhouette=0.6117 (Excellent). No labels used during training."/>

      <div className="card" style={{padding:22}}>
        <div style={{fontWeight:700,color:'var(--text-1)',marginBottom:3}}>Machine Behaviour Segmentation — PCA Space</div>
        <div style={{color:'var(--text-3)',fontSize:11,marginBottom:16}}>3,500 sampled readings. 3 states found automatically — no labels provided.</div>
        <ResponsiveContainer width="100%" height={380}>
          <ScatterChart>
            <XAxis type="number" dataKey="PC1" name="PC1" tick={{fill:'var(--text-3)',fontSize:10}}
                   label={{value:'PC1 (37.3% variance)',fill:'var(--text-3)',fontSize:11,position:'insideBottom',offset:-5}}/>
            <YAxis type="number" dataKey="PC2" name="PC2" tick={{fill:'var(--text-3)',fontSize:10}}
                   label={{value:'PC2 (16.9%)',fill:'var(--text-3)',fontSize:11,angle:-90,position:'insideLeft'}}/>
            <Tooltip cursor={{strokeDasharray:'3 3'}}
              content={({payload})=>{
                if(!payload?.length) return null
                const d=payload[0].payload
                return <div className="card" style={{padding:'10px 14px',fontSize:11}}>
                  <p style={{color:CCOLORS[d.cluster_name]||'var(--text-3)',fontWeight:700,marginBottom:4}}>{d.cluster_name}</p>
                  <p style={{color:'var(--text-2)'}}>TP2: {d.TP2?.toFixed(3)} bar</p>
                  <p style={{color:'var(--text-2)'}}>Motor: {d.Motor_current?.toFixed(3)} A</p>
                  <p style={{color:'var(--text-2)'}}>Oil: {d.Oil_temperature?.toFixed(1)}°C</p>
                </div>
              }}/>
            {Object.entries(byCluster).map(([name,pts])=>(
              <Scatter key={name} name={name} data={pts} fill={CCOLORS[name]||'var(--text-3)'} opacity={0.65} isAnimationActive={false}/>
            ))}
          </ScatterChart>
        </ResponsiveContainer>
        <div style={{display:'flex',gap:18,justifyContent:'center',marginTop:8}}>
          {Object.entries(CCOLORS).map(([name,c])=>(
            <div key={name} style={{display:'flex',alignItems:'center',gap:6}}>
              <div style={{width:9,height:9,borderRadius:'50%',background:c}}/>
              <span style={{color:'var(--text-2)',fontSize:11,fontWeight:500}}>{name}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        {/* Cluster profiles with REAL weekly trend sparklines */}
        <div className="card" style={{padding:22}}>
          <div style={{fontWeight:700,color:'var(--text-1)',marginBottom:4}}>Cluster Profiles</div>
          <div style={{color:'var(--text-3)',fontSize:11,marginBottom:14}}>
            Weekly trend shows actual average anomaly score per cluster over 7 months.
          </div>
          <table style={{width:'100%',fontSize:11,borderCollapse:'collapse'}}>
            <thead>
              <tr style={{borderBottom:'1px solid var(--border)'}}>
                {['Cluster','Count','Avg Oil°C','Avg Motor A','Weekly Score Trend'].map(h=>(
                  <th key={h} className="label-xs" style={{textAlign:'left',padding:'7px 8px'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.profiles?.map((p,i)=>{
                const trendData = trends[p.cluster_name] || []
                const tColor = p.cluster_name==='NORMAL'?'var(--ok)':p.cluster_name==='IDLE'?'var(--idle)':'var(--danger)'
                return (
                  <motion.tr key={p.cluster_name} initial={{opacity:0}} animate={{opacity:1}}
                    transition={{delay:i*.08}} className="trow">
                    <td style={{padding:'10px 8px'}}><ClusterBadge name={p.cluster_name}/></td>
                    <td style={{padding:'10px 8px',color:'var(--text-1)',fontFamily:'monospace',fontWeight:700}}>{p.count?.toLocaleString()}</td>
                    <td style={{padding:'10px 8px',color:'var(--text-2)',fontFamily:'monospace'}}>{p.avg_oil?.toFixed(1)}</td>
                    <td style={{padding:'10px 8px',color:'var(--text-2)',fontFamily:'monospace'}}>{p.avg_motor?.toFixed(2)}</td>
                    <td style={{padding:'10px 8px'}}>
                      {trendData.length >= 2
                        ? <RealSparkline data={trendData} color={tColor} width={90} height={30}/>
                        : <span style={{color:'var(--text-3)',fontSize:10}}>Loading...</span>}
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
          <div style={{color:'var(--text-3)',fontSize:10,marginTop:8}}>
            Weekly trend = real average anomaly score per cluster per week (computed from 1.5M rows).
          </div>
        </div>

        {/* Elbow curve + metrics table */}
        <div className="card" style={{padding:22}}>
          <div style={{fontWeight:700,color:'var(--text-1)',marginBottom:3}}>Elbow Curve — K Selection</div>
          <div style={{color:'var(--text-3)',fontSize:11,marginBottom:14}}>K=3 chosen — silhouette peak at 0.6117</div>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={data.metrics_table}>
              <XAxis dataKey="K" tick={{fill:'var(--text-3)',fontSize:11}}/>
              <YAxis tick={{fill:'var(--text-3)',fontSize:10}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
              <Tooltip content={({active,payload,label})=>{
                if(!active||!payload?.length) return null
                return <div className="card" style={{padding:'8px 12px',fontSize:11}}>
                  <p style={{color:'var(--text-3)'}}>K={label}</p>
                  <p style={{color:'var(--text-1)',fontFamily:'monospace'}}>Inertia: {payload[0]?.value?.toLocaleString()}</p>
                </div>
              }}/>
              <ReferenceLine x={3} stroke="var(--accent)" strokeDasharray="3 3"
                label={{value:'K=3 ★',fill:'var(--accent)',fontSize:10}}/>
              <Line dataKey="inertia" stroke="var(--accent)" strokeWidth={2} dot={{fill:'var(--accent)',r:4}}/>
            </LineChart>
          </ResponsiveContainer>

          <div style={{marginTop:16}}>
            <div className="label-xs" style={{marginBottom:8}}>All K metrics</div>
            <table style={{width:'100%',fontSize:10,borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:'1px solid var(--border)'}}>
                  {['K','Silhouette','DB','CH'].map(h=>(
                    <th key={h} className="label-xs" style={{textAlign:'left',padding:'5px 6px'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.metrics_table?.map((r,i)=>(
                  <tr key={i} className="trow"
                    style={{background:r.K===3?'var(--accent-soft)':'transparent'}}>
                    <td style={{padding:'5px 6px',color:r.K===3?'var(--accent)':'var(--text-2)',
                                fontWeight:r.K===3?700:400,fontFamily:'monospace'}}>{r.K}{r.K===3?' ★':''}</td>
                    <td style={{padding:'5px 6px',color:r.K===3?'var(--ok)':'var(--text-3)',fontFamily:'monospace'}}>{r.silhouette}</td>
                    <td style={{padding:'5px 6px',color:'var(--text-3)',fontFamily:'monospace'}}>{r.db}</td>
                    <td style={{padding:'5px 6px',color:'var(--text-3)',fontFamily:'monospace'}}>{(r.ch/1000).toFixed(0)}k</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
