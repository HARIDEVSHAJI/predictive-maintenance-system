import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { LineChart,Line,XAxis,YAxis,Tooltip,ResponsiveContainer,ReferenceLine } from 'recharts'
import { SectionHeader, Spinner, CustomTooltip } from '../components/ui/index.jsx'

const ANALOG = ['TP2','TP3','H1','DV_pressure','Reservoirs','Oil_temperature','Motor_current']
const COLORS  = { TP2:'var(--text-2)', TP3:'#22C55E', H1:'#8B5CF6', DV_pressure:'var(--warn)',
                  Reservoirs:'#06B6D4', Oil_temperature:'var(--danger)', Motor_current:'#F97316' }
const FAIL_DATES = ['2020-04-18','2020-05-29','2020-06-05','2020-07-15','2020-07-16']

export default function SensorTrends() {
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState(['TP2','TP3','Oil_temperature'])
  const [days,     setDays]     = useState(213)

  useEffect(()=>{
    setLoading(true)
    setData(null)
    fetch(`/api/sensors?days=${days}`)
      .then(r=>r.json())
      .then(d=>{ setData(d); setLoading(false) })
      .catch(()=>setLoading(false))
  },[days])

  const toggle = s => setSelected(p=>p.includes(s)?p.filter(x=>x!==s):[...p,s])

  return (
    <div className="animate-fade-in" style={{display:'flex',flexDirection:'column',gap:20}}>
      <SectionHeader title="Sensor Trends" icon={TrendingUp}
        subtitle="Multi-sensor time series with anomaly overlay and correlation matrix"/>

      {/* Controls */}
      <div className="card" style={{padding:16,display:'flex',gap:24,flexWrap:'wrap',alignItems:'flex-end'}}>
        <div>
          <div style={{color:'var(--text-3)',fontSize:11,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Sensors</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {ANALOG.map(s=>(
              <button key={s} onClick={()=>toggle(s)}
                style={{padding:'5px 10px',borderRadius:7,fontSize:11,fontWeight:600,cursor:'pointer',
                        transition:'all .15s',
                        border:selected.includes(s)?`1px solid ${COLORS[s]}44`:'1px solid var(--bg-card2)',
                        background:selected.includes(s)?`${COLORS[s]}18`:'transparent',
                        color:selected.includes(s)?COLORS[s]:'var(--text-2)'}}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{color:'var(--text-3)',fontSize:11,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Period</div>
          <div style={{display:'flex',gap:6}}>
            {[7,30,90,213].map(d=>(
              <button key={d} onClick={()=>setDays(d)}
                style={{padding:'5px 12px',borderRadius:7,fontSize:11,fontWeight:600,cursor:'pointer',
                        transition:'all .15s',
                        border:days===d?'1px solid var(--border-strong)':'1px solid var(--bg-card2)',
                        background:days===d?'var(--bg-card2)':'transparent',
                        color:days===d?'var(--text-1)':'var(--text-2)'}}>
                {d===213?'All':d+'d'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <Spinner text="Loading sensor trends..."/>}

      {!loading && data && (
        <>
          <div className="card" style={{padding:20}}>
            <div style={{color:'var(--text-1)',fontWeight:600,marginBottom:4}}>Multi-Sensor Trends</div>
            <div style={{color:'var(--text-3)',fontSize:11,marginBottom:16}}>
              Red markers = anomaly points. Vertical lines = failure windows.
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.trends?.filter((_, i) => i % Math.max(1, Math.ceil((data.trends?.length || 1) / 800)) === 0)}>
                <XAxis dataKey="timestamp" tick={{fill:'var(--text-3)',fontSize:9}}
                       tickFormatter={v=>v?.slice(5,10)} interval="preserveStartEnd"/>
                <YAxis tick={{fill:'var(--text-3)',fontSize:10}}/>
                <Tooltip content={<CustomTooltip/>} labelFormatter={v=>v?.slice(0,16)}/>
                {FAIL_DATES.map(d=>(
                  <ReferenceLine key={d} x={d} stroke="#EF4444" strokeOpacity={.25} strokeWidth={2}/>
                ))}
                {selected.map(s=>(
                  <Line key={s} dataKey={s} stroke={COLORS[s]} strokeWidth={1.2}
                        dot={false} name={s} isAnimationActive={false} connectNulls/>
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Correlation matrix */}
          {data.correlation && (
            <div className="card" style={{padding:20}}>
              <div style={{color:'var(--text-1)',fontWeight:600,marginBottom:4}}>Sensor Correlation Matrix</div>
              <div style={{color:'var(--text-3)',fontSize:11,marginBottom:16}}>
                TP2↔H1 = −0.961 (physics: anti-correlated pressure pair) &nbsp;|&nbsp;
                TP3↔Reservoirs ≈ +1.000 (same circuit)
              </div>
              <div style={{overflowX:'auto'}}>
                <table style={{borderCollapse:'collapse',fontSize:11}}>
                  <thead>
                    <tr>
                      <th style={{width:130}}/>
                      {Object.keys(data.correlation).map(k=>(
                        <th key={k} style={{padding:'4px 8px',color:'var(--text-3)',fontWeight:600,
                                             fontSize:10,textAlign:'center',width:90}}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(data.correlation).map(row=>(
                      <tr key={row}>
                        <td style={{padding:'4px 12px 4px 0',color:'var(--text-3)',fontWeight:600,
                                     textAlign:'right',fontSize:10}}>{row}</td>
                        {Object.keys(data.correlation).map(col=>{
                          const v = data.correlation?.[row]?.[col]??0
                          const bg = v>0.7?'rgba(34,197,94,.15)':v<-0.7?'rgba(239,68,68,.15)':
                                     v>0.4?'rgba(34,197,94,.07)':v<-0.4?'rgba(239,68,68,.07)':'transparent'
                          const tc = v>0.4?'var(--ok)':v<-0.4?'#F87171':'var(--text-2)'
                          return (
                            <td key={col} style={{padding:'6px 8px',textAlign:'center',
                                                   background:bg,borderRadius:4}}>
                              <span style={{fontFamily:'monospace',fontWeight:700,fontSize:10,color:tc}}>
                                {v.toFixed(2)}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
