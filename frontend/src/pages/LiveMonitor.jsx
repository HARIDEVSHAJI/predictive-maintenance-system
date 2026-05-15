import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, RotateCcw, Zap, Radio, Upload, Activity, Download, AlertTriangle } from 'lucide-react'
import { LineChart,Line,XAxis,YAxis,Tooltip,ResponsiveContainer,ReferenceLine } from 'recharts'
import { ClusterBadge, HealthGauge, SectionHeader, Spinner, CustomTooltip } from '../components/ui/index.jsx'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'

const SCENARIOS = [
  { id:'healthy',       label:'Normal Operation',   sub:'Feb–Mar 2020 — healthy compressor',     dot:'#22C55E' },
  { id:'pre_failure',   label:'Pre-Failure State',   sub:'Apr 2020 — before air leak event',       dot:'var(--warn)' },
  { id:'active_failure',label:'Active Failure',       sub:'Jun 5–7, 2020 — real air leak event',   dot:'var(--danger)' },
  { id:'custom',        label:'Custom Date Range',   sub:'Select start and end dates',              dot:'var(--text-2)' },
]

const FAULT_TYPES = [
  { id:'air_leak',     label:'Air Leak',     color:'var(--danger)', desc:'Pressure drops, motor overloads' },
  { id:'overheat',     label:'Overheat',     color:'var(--warn)', desc:'Oil temperature rises gradually'  },
  { id:'pressure_drop',label:'Pressure Drop',color:'var(--warn)', desc:'Tank pressure loss detected'      },
  { id:'bearing_wear', label:'Bearing Wear', color:'#EC4899', desc:'Motor current spikes abnormally'  },
]

const ANALOG = ['TP2','TP3','H1','DV_pressure','Reservoirs','Oil_temperature','Motor_current']
const DIGITAL = ['COMP','DV_eletric','Towers','MPG','LPS','Pressure_switch','Oil_level','Caudal_impulses']
const UNITS   = { TP2:'bar', TP3:'bar', H1:'bar', DV_pressure:'bar', Reservoirs:'bar', Oil_temperature:'°C', Motor_current:'A' }
const BOUNDS  = {
  TP2:[-0.03,10.68,-0.013], TP3:[0.73,10.30,8.96], H1:[-0.04,10.29,8.55],
  DV_pressure:[-0.03,9.84,-0.02], Reservoirs:[0.71,10.30,8.96],
  Oil_temperature:[15.4,89.05,62.6], Motor_current:[0.02,9.30,0.04]
}

function PredCard({ p }) {
  if (!p) return null
  const isCrit = p.alert_level==='CRITICAL', isWarn = p.alert_level==='WARNING'
  const borderColor = isCrit?'var(--danger)':isWarn?'rgba(245,158,11,.2)':'rgba(34,197,94,.15)'
  const bgColor     = isCrit?'var(--danger-bg)':isWarn?'rgba(245,158,11,.03)':'var(--ok-bg)'

  return (
    <motion.div key={p.index} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}
      transition={{duration:.2}}
      className={isCrit?'pulse-danger':''} style={{border:`1px solid ${borderColor}`,
      background:bgColor,borderRadius:12,padding:16,position:'relative',overflow:'hidden'}}>

      <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
        <div>
          <div style={{color:'var(--text-3)',fontSize:10,fontFamily:'monospace',marginBottom:6}}>
            {p.timestamp?.slice(0,19)}
            {p.fault_active && <span style={{marginLeft:8,color:'var(--warn)',fontWeight:700}}>
              ⚡ FAULT: {p.fault_active.replace('_',' ').toUpperCase()}
            </span>}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <ClusterBadge name={p.cluster}/>
            <span style={{color:'var(--text-3)',fontSize:11}}>|</span>
            <span style={{fontWeight:700,fontSize:12,fontFamily:'monospace',
              color:isCrit?'var(--danger)':isWarn?'var(--warn)':'var(--ok)'}}>{p.alert_level}</span>
          </div>
        </div>
        <HealthGauge score={p.health_score||0} size={90}/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:10}}>
        {[
          {l:'Health',  v:`${p.health_score}/100`, c:p.health_score>70?'var(--ok)':p.health_score>40?'var(--warn)':'var(--danger)'},
          {l:'Score',   v:p.anomaly_score?.toFixed(4), c:p.anomaly_score<-0.55?'var(--danger)':p.anomaly_score<-0.45?'var(--warn)':'var(--text-2)'},
          {l:'RUL',     v:`${(p.rul_hours/24).toFixed(1)}d`, c:'var(--text-1)'},
        ].map(m=>(
          <div key={m.l} style={{background:'var(--bg-card2)',borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
            <div style={{color:'var(--text-3)',fontSize:10,marginBottom:3}}>{m.l}</div>
            <div style={{color:m.c,fontFamily:'monospace',fontWeight:700,fontSize:12}}>{m.v}</div>
          </div>
        ))}
      </div>

      {p.sensors && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:10}}>
          {Object.entries(p.sensors).map(([k,v])=>(
            <div key={k} style={{textAlign:'center'}}>
              <div style={{color:'var(--text-3)',fontSize:9}}>{k}</div>
              <div style={{color:'var(--text-2)',fontFamily:'monospace',fontSize:10,fontWeight:600}}>
                {v?.toFixed(2)} <span style={{color:'var(--text-3)',fontSize:9}}>{UNITS[k]}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{fontSize:11,padding:'7px 10px',borderRadius:7,fontWeight:500,
        background:isCrit?'var(--danger-bg)':isWarn?'var(--warn-bg)':'var(--ok-bg)',
        color:isCrit?'var(--danger)':isWarn?'var(--warn)':'var(--ok)'}}>
        {p.recommendation}
      </div>
    </motion.div>
  )
}

export default function LiveMonitor() {
  const [tab,        setTab]        = useState('historical')  // historical | synthetic | upload | manual
  const [scenario,   setScenario]   = useState('healthy')
  const [speed,      setSpeed]      = useState(1)
  const [playing,    setPlaying]    = useState(false)
  const [pred,       setPred]       = useState(null)
  const [history,    setHistory]    = useState([])
  const [rawStream,  setRawStream]  = useState([])
  const [progress,   setProgress]   = useState(0)
  const [total,      setTotal]      = useState(0)
  const [status,     setStatus]     = useState('idle')
  // Synthetic
  const [synthFault, setSynthFault] = useState(null)
  const [synthSteps, setSynthSteps] = useState(200)
  // Upload
  const [uploadRes,  setUploadRes]  = useState(null)
  const [uploading,  setUploading]  = useState(false)
  // Manual
  const [manual, setManual] = useState({
    TP2:-0.013,TP3:8.96,H1:8.55,DV_pressure:-0.02,
    Reservoirs:8.96,Oil_temperature:62.6,Motor_current:0.04,
    COMP:1,DV_eletric:0,Towers:1,MPG:1,LPS:0,Pressure_switch:1,Oil_level:1,Caudal_impulses:1
  })
  const [manualRes, setManualRes] = useState(null)
  // Report
  const [reportRows, setReportRows] = useState([])

  const wsRef    = useRef(null)
  const speedRef = useRef(speed)
  speedRef.current = speed

  const stopWs = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.send(JSON.stringify({action:'stop'})) } catch {}
      wsRef.current.close(); wsRef.current=null
    }
    setPlaying(false)
  }, [])

  const reset = useCallback(() => {
    stopWs()
    setPred(null); setHistory([]); setRawStream([])
    setProgress(0); setTotal(0); setStatus('idle')
    setReportRows([])
    setSynthFault(null)   // ← clear stuck fault button
  }, [stopWs])

  const connectWs = useCallback((endpoint, configMsg) => {
    reset()
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${window.location.host}/${endpoint}`)
    wsRef.current = ws
    setStatus('connecting'); setPlaying(true)

    ws.onopen = () => { ws.send(JSON.stringify(configMsg)); setStatus('running') }
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type==='start') { setTotal(msg.total); return }
      if (msg.type==='row') {
        setProgress(msg.index+1)
        setPred(msg)
        const pt = { ...msg, name: msg.timestamp?.slice(11,16)||`${msg.index}` }
        setHistory(h=>[...h.slice(-100), pt])
        setRawStream(h=>[...h.slice(-8), msg])
        setReportRows(r=>[...r, {
          timestamp: msg.timestamp, cluster: msg.cluster,
          health_score: msg.health_score, anomaly_score: msg.anomaly_score,
          alert_level: msg.alert_level, rul_hours: msg.rul_hours,
          recommendation: msg.recommendation,
          ...msg.sensors
        }])
      }
      if (msg.type==='done')  { setPlaying(false); setStatus('done') }
      if (msg.type==='error') { setPlaying(false); setStatus('error') }
    }
    ws.onerror = () => { setStatus('error'); setPlaying(false) }
    ws.onclose = () => setPlaying(false)
  }, [reset])

  useEffect(() => {
    if (wsRef.current?.readyState===1 && status==='running') {
      wsRef.current.send(JSON.stringify({action:'speed',value:speed}))
    }
  }, [speed, status])

  const playHistorical = () => connectWs('ws/live', {scenario, speed})
  const playSynthetic  = () => connectWs('ws/synthetic', {speed, steps:synthSteps, fault:null})

  const injectFault = (faultId) => {
    setSynthFault(faultId)
    if (wsRef.current?.readyState===1) {
      wsRef.current.send(JSON.stringify({action:'inject_fault', fault:faultId}))
    }
  }
  const recover = () => {
    setSynthFault(null)
    if (wsRef.current?.readyState===1) {
      wsRef.current.send(JSON.stringify({action:'recover'}))
    }
  }

  const downloadReport = () => {
    if (!reportRows.length) return
    const keys = Object.keys(reportRows[0])
    const csv  = [keys.join(','), ...reportRows.map(r=>keys.map(k=>r[k]??'').join(','))].join('\n')
    const blob = new Blob([csv],{type:'text/csv'})
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href=url; a.download='live_monitor_report.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (files) => {
      if (!files[0]) return
      setUploading(true); setUploadRes(null)
      const fd = new FormData(); fd.append('file',files[0])
      try { const r=await axios.post('/api/upload',fd); setUploadRes(r.data) }
      catch { setUploadRes({success:false,error:'Upload failed'}) }
      setUploading(false)
    },
    accept:{'text/csv':['.csv']}, multiple:false
  })

  const predictManual = async () => {
    const r=await fetch('/api/predict-single',{method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(manual)})
    setManualRes(await r.json())
  }

  return (
    <div className="animate-fade-in" style={{display:'flex',flexDirection:'column',gap:20}}>
      <SectionHeader title="Live Monitor" icon={Radio}
        subtitle="Real-time machine state prediction — historical replay, synthetic simulation, CSV upload, manual input"/>

      {/* Tab selector */}
      <div style={{display:'flex',gap:8}}>
        {[
          {id:'historical', label:'📼 Historical Replay'},
          {id:'synthetic',  label:'🔬 Synthetic Simulator'},
          {id:'upload',     label:'📁 Upload CSV'},
          {id:'manual',     label:'🎛️ Manual Input'},
        ].map(t=>(
          <button key={t.id} onClick={()=>{reset();setTab(t.id)}}
            className={tab===t.id?'btn-tab active':'btn-tab'}
            style={{fontSize:12,fontWeight:600}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── HISTORICAL TAB ── */}
      {tab==='historical' && (
        <div className="card" style={{padding:20}}>
          <div style={{color:'var(--text-1)',fontWeight:600,marginBottom:16}}>Select Scenario</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
            {SCENARIOS.map(s=>(
              <button key={s.id} onClick={()=>setScenario(s.id)}
                className={`scenario-card ${scenario===s.id?'active':''}`}>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                  <div style={{width:7,height:7,borderRadius:'50%',background:s.dot,flexShrink:0}}/>
                  <span className="sc-title" style={{fontWeight:600,fontSize:12}}>{s.label}</span>
                </div>
                <div className="sc-sub" style={{fontSize:10}}>{s.sub}</div>
              </button>
            ))}
          </div>

          {/* Controls */}
          <div style={{display:'flex',alignItems:'center',gap:20,padding:'12px 16px',
                       background:'var(--bg-card2)',borderRadius:8,marginBottom:total>0?16:0}}>
            <div style={{flex:1}}>
              <div style={{color:'var(--text-3)',fontSize:11,marginBottom:6}}>
                Speed: <span style={{color:'var(--text-2)',fontWeight:700}}>{speed}x</span>
              </div>
              <input type="range" min={0.1} max={20} step={0.1} value={speed}
                onChange={e=>setSpeed(parseFloat(e.target.value))} style={{width:'100%',accentColor:'var(--accent)'}}/>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={playHistorical} disabled={playing} className="btn-primary" style={{opacity:playing?.5:1}}>
                <Play size={14}/> PLAY
              </button>
              <button onClick={stopWs} disabled={!playing} className="btn-ghost">
                <Pause size={14}/> PAUSE
              </button>
              <button onClick={reset} className="btn-ghost">
                <RotateCcw size={14}/> RESET
              </button>
            </div>
          </div>

          {total>0 && (
            <div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text-3)',marginBottom:4}}>
                <span style={{display:'flex',alignItems:'center',gap:6}}>
                  {status==='running'&&<Activity size={11} color="#94A3B8" style={{animation:'spin 1.5s linear infinite'}}/>}
                  {status==='running'?'Streaming...':status==='done'?'✓ Complete':status==='error'?'Error':''}
                </span>
                <span style={{fontFamily:'monospace'}}>{progress} / {total}</span>
              </div>
              <div style={{height:3,background:'var(--bg-card2)',borderRadius:2,overflow:'hidden'}}>
                <div style={{height:'100%',background:'var(--text-2)',borderRadius:2,
                              width:`${(progress/total)*100}%`,transition:'width .1s'}}/>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SYNTHETIC TAB ── */}
      {tab==='synthetic' && (
        <div className="card" style={{padding:20}}>
          <div style={{color:'var(--text-1)',fontWeight:600,marginBottom:4}}>Synthetic Live Simulator</div>
          <div style={{color:'var(--text-3)',fontSize:11,marginBottom:16}}>
            Generates statistically realistic sensor readings in real time. Inject faults to watch the model respond live.
          </div>

          <div style={{display:'flex',gap:16,marginBottom:20,alignItems:'flex-end'}}>
            <div style={{flex:1}}>
              <div style={{color:'var(--text-3)',fontSize:11,marginBottom:6}}>Speed: <span style={{color:'var(--text-2)'}}>{speed}x</span></div>
              <input type="range" min={0.1} max={20} step={0.1} value={speed}
                onChange={e=>setSpeed(parseFloat(e.target.value))} style={{width:'100%',accentColor:'var(--accent)'}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{color:'var(--text-3)',fontSize:11,marginBottom:6}}>Steps: <span style={{color:'var(--text-2)'}}>{synthSteps}</span></div>
              <input type="range" min={50} max={500} step={50} value={synthSteps}
                onChange={e=>setSynthSteps(parseInt(e.target.value))} style={{width:'100%',accentColor:'var(--accent)'}}/>
            </div>
            <button onClick={playSynthetic} disabled={playing} className="btn-primary" style={{opacity:playing?.5:1}}>
              <Play size={14}/> START
            </button>
            <button onClick={reset} className="btn-ghost"><RotateCcw size={14}/> RESET</button>
          </div>

          {/* Fault injection buttons */}
          <div style={{marginBottom:16}}>
            <div style={{color:'var(--text-2)',fontSize:11,fontWeight:600,marginBottom:10,textTransform:'uppercase',letterSpacing:'0.05em'}}>
              Fault Injection {playing ? '(click to inject)' : '(start simulator first)'}
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {FAULT_TYPES.map(f=>(
                <button key={f.id}
                  onClick={()=>{ if(playing) injectFault(f.id) }}
                  style={{padding:'8px 14px',borderRadius:8,
                          cursor: playing ? 'pointer' : 'not-allowed',
                          border:`1px solid ${synthFault===f.id ? f.color : 'var(--border)'}`,
                          background: synthFault===f.id ? `${f.color}18` : 'var(--bg-card2)',
                          color: synthFault===f.id ? f.color : playing ? 'var(--text-3)' : '#2D3748',
                          fontSize:12, fontWeight:600, transition:'all .15s',
                          opacity: playing ? 1 : 0.4}}>
                  <AlertTriangle size={12} style={{display:'inline',marginRight:5}}/>
                  {f.label}
                </button>
              ))}
              {synthFault && playing && (
                <button onClick={recover}
                  style={{padding:'8px 14px',borderRadius:8,cursor:'pointer',
                          border:'1px solid rgba(34,197,94,.3)',background:'var(--ok-bg)',
                          color:'var(--ok)',fontSize:12,fontWeight:600}}>
                  ✓ Recover
                </button>
              )}
            </div>
            {synthFault && playing && (
              <div style={{marginTop:8,fontSize:11,color:'var(--warn)',padding:'6px 10px',
                           background:'var(--warn-bg)',borderRadius:6,
                           border:'1px solid rgba(249,115,22,.2)'}}>
                ⚡ Active fault: <strong>{FAULT_TYPES.find(f=>f.id===synthFault)?.label}</strong> —{' '}
                {FAULT_TYPES.find(f=>f.id===synthFault)?.desc}. Watch the model detect it gradually.
              </div>
            )}
            {!playing && status === 'idle' && (
              <div style={{marginTop:6,fontSize:10,color:'var(--text-3)'}}>
                Click START to begin generating sensor data, then inject faults while running.
              </div>
            )}
          </div>

          {total>0 && (
            <div style={{height:3,background:'var(--bg-card2)',borderRadius:2,overflow:'hidden'}}>
              <div style={{height:'100%',background:'var(--text-2)',borderRadius:2,
                            width:`${(progress/total)*100}%`,transition:'width .1s'}}/>
            </div>
          )}
        </div>
      )}

      {/* ── UPLOAD TAB ── */}
      {tab==='upload' && (
        <div className="card" style={{padding:20}}>
          <div style={{color:'var(--text-1)',fontWeight:600,marginBottom:4}}>Upload Sensor CSV</div>
          <div style={{color:'var(--text-3)',fontSize:11,marginBottom:16}}>
            Required columns: {ANALOG.join(', ')}
          </div>
          <div {...getRootProps()} style={{border:`2px dashed ${isDragActive?'var(--text-2)':'var(--border)'}`,
            borderRadius:10,padding:40,textAlign:'center',cursor:'pointer',
            background:isDragActive?'var(--bg-card2)':'transparent',transition:'all .2s'}}>
            <input {...getInputProps()}/>
            {uploading
              ? <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
                  <div style={{width:32,height:32,border:'3px solid var(--border)',
                               borderTopColor:'var(--text-2)',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
                  {['Feature engineering','Normalising','K-Means prediction','Anomaly scoring'].map((s,i)=>(
                    <div key={s} style={{color:'var(--text-3)',fontSize:11}}>{s}...</div>
                  ))}
                </div>
              : <div>
                  <Upload size={24} color="#374151" style={{margin:'0 auto 10px'}}/>
                  <p style={{color:'var(--text-2)',fontWeight:600}}>{isDragActive?'Drop it here':'Drag & drop CSV'}</p>
                  <p style={{color:'var(--text-3)',fontSize:11,marginTop:4}}>or click to browse</p>
                </div>}
          </div>
          {uploadRes && (
            <div style={{marginTop:16,padding:16,borderRadius:10,
              border:uploadRes.success?'1px solid rgba(34,197,94,.2)':'1px solid rgba(239,68,68,.2)',
              background:uploadRes.success?'rgba(34,197,94,.04)':'rgba(239,68,68,.04)'}}>
              {uploadRes.success
                ? <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
                    {[{l:'Rows',v:uploadRes.rows?.toLocaleString()},{l:'Avg Health',v:uploadRes.avg_health},
                      ...Object.entries(uploadRes.cluster_dist||{}).map(([k,v])=>({l:k,v:v.toLocaleString()}))
                    ].map(x=>(
                      <div key={x.l} style={{textAlign:'center'}}>
                        <div style={{color:'var(--ok)',fontFamily:'monospace',fontWeight:700,fontSize:18}}>{x.v}</div>
                        <div style={{color:'var(--text-3)',fontSize:11,marginTop:2}}>{x.l}</div>
                      </div>
                    ))}
                  </div>
                : <p style={{color:'var(--danger)',fontSize:12}}>{uploadRes.error}</p>}
            </div>
          )}
        </div>
      )}

      {/* ── MANUAL TAB ── */}
      {tab==='manual' && (
        <div className="card" style={{padding:20}}>
          <div style={{color:'var(--text-1)',fontWeight:600,marginBottom:4}}>Manual Sensor Input</div>
          <div style={{color:'var(--text-3)',fontSize:11,marginBottom:16}}>Adjust all 15 sensors and predict</div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
            <div>
              <div style={{color:'var(--text-3)',fontSize:11,fontWeight:600,textTransform:'uppercase',
                           letterSpacing:'0.05em',marginBottom:10}}>Analog Sensors</div>
              {ANALOG.map(s=>(
                <div key={s} style={{marginBottom:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{color:'var(--text-3)',fontSize:11}}>{s}</span>
                    <span style={{color:'var(--text-2)',fontFamily:'monospace',fontSize:11}}>
                      {manual[s]?.toFixed(3)} <span style={{color:'var(--text-3)'}}>{UNITS[s]}</span>
                    </span>
                  </div>
                  <input type="range" min={BOUNDS[s][0]} max={BOUNDS[s][1]} step={0.001} value={manual[s]}
                    onChange={e=>setManual(v=>({...v,[s]:parseFloat(e.target.value)}))}
                    style={{width:'100%',accentColor:'var(--accent)'}}/>
                </div>
              ))}
            </div>
            <div>
              <div style={{color:'var(--text-3)',fontSize:11,fontWeight:600,textTransform:'uppercase',
                           letterSpacing:'0.05em',marginBottom:10}}>Digital Signals (0=OFF, 1=ON)</div>
              {DIGITAL.map(d=>(
                <div key={d} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                                      padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,.04)'}}>
                  <span style={{color:'var(--text-3)',fontSize:11}}>{d}</span>
                  <div style={{display:'flex',gap:8}}>
                    {[0,1].map(v=>(
                      <button key={v} onClick={()=>setManual(m=>({...m,[d]:v}))}
                        style={{padding:'3px 10px',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer',
                                border:`1px solid ${manual[d]===v?'var(--border-strong)':'var(--bg-card2)'}`,
                                background:manual[d]===v?'var(--border)':'transparent',
                                color:manual[d]===v?'#F1F5F9':'var(--text-3)',transition:'all .1s'}}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button onClick={predictManual} className="btn-primary" style={{width:'100%',justifyContent:'center',padding:'10px'}}>
            <Zap size={15}/> Predict Now
          </button>

          {manualRes && !manualRes.error && (
            <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} style={{marginTop:16}}>
              <PredCard p={{...manualRes, index:0, timestamp:new Date().toISOString(),
                            sensors:ANALOG.reduce((a,k)=>({...a,[k]:manual[k]}),{})}}/>
            </motion.div>
          )}
        </div>
      )}

      {/* ── LIVE OUTPUT (historical + synthetic) ── */}
      {(pred||history.length>0) && (tab==='historical'||tab==='synthetic') && (
        <div style={{display:'grid',gridTemplateColumns:'2fr 3fr',gap:16}}>
          {/* Left: pred card + raw stream */}
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <PredCard p={pred}/>
            <div className="card" style={{padding:14}}>
              <div style={{color:'var(--text-3)',fontSize:10,fontWeight:600,textTransform:'uppercase',
                           letterSpacing:'0.05em',marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
                <Activity size={11} color="#475569"/>Raw Data Stream
              </div>
              <div style={{maxHeight:160,overflowY:'auto'}}>
                {rawStream.slice().reverse().map((r,i)=>(
                  <div key={i} className="stream-in"
                    style={{display:'flex',gap:8,padding:'4px 0',borderBottom:'1px solid var(--bg-card2)'}}>
                    <span style={{color:'var(--text-3)',fontFamily:'monospace',fontSize:9,width:24}}>{r.index}</span>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      {ANALOG.slice(0,4).map(s=>(
                        <span key={s} style={{fontSize:9,fontFamily:'monospace',
                                               background:'var(--bg-card2)',padding:'1px 5px',
                                               borderRadius:4,color:'var(--text-2)'}}>
                          <span style={{color:'var(--text-3)'}}>{s}</span>:{r.sensors?.[s]?.toFixed(2)||'—'}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Download report */}
            {reportRows.length>0 && (
              <button onClick={downloadReport} className="btn-primary" style={{width:'100%',justifyContent:'center'}}>
                <Download size={14}/> Download Report ({reportRows.length} rows)
              </button>
            )}
          </div>

          {/* Right: charts */}
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div className="card" style={{padding:16}}>
              <div style={{color:'var(--text-2)',fontSize:11,fontWeight:600,marginBottom:10}}>Health Score</div>
              <ResponsiveContainer width="100%" height={130}>
                <LineChart data={history}>
                  <XAxis dataKey="name" tick={{fill:'var(--text-3)',fontSize:9}} interval={15}/>
                  <YAxis domain={[0,100]} tick={{fill:'var(--text-3)',fontSize:9}}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <ReferenceLine y={70} stroke="#F59E0B" strokeDasharray="2 3"/>
                  <ReferenceLine y={40} stroke="#EF4444" strokeDasharray="2 3"/>
                  <Line dataKey="health_score" stroke="#4ADE80" strokeWidth={2} dot={false} isAnimationActive={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="card" style={{padding:16}}>
              <div style={{color:'var(--text-2)',fontSize:11,fontWeight:600,marginBottom:10}}>Anomaly Score</div>
              <ResponsiveContainer width="100%" height={130}>
                <LineChart data={history}>
                  <XAxis dataKey="name" tick={{fill:'var(--text-3)',fontSize:9}} interval={15}/>
                  <YAxis domain={[-0.75,-0.35]} tick={{fill:'var(--text-3)',fontSize:9}}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <ReferenceLine y={-0.45} stroke="#F59E0B" strokeDasharray="2 3"/>
                  <ReferenceLine y={-0.55} stroke="#EF4444" strokeDasharray="2 3"/>
                  <Line dataKey="anomaly_score" stroke="#94A3B8" strokeWidth={2} dot={false} isAnimationActive={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="card" style={{padding:16}}>
              <div style={{color:'var(--text-2)',fontSize:11,fontWeight:600,marginBottom:10}}>Oil Temperature (°C)</div>
              <ResponsiveContainer width="100%" height={110}>
                <LineChart data={history}>
                  <XAxis dataKey="name" tick={{fill:'var(--text-3)',fontSize:9}} interval={15}/>
                  <YAxis domain={[50,90]} tick={{fill:'var(--text-3)',fontSize:9}}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <ReferenceLine y={75} stroke="#EF4444" strokeDasharray="2 3"/>
                  <Line dataKey={h=>h.sensors?.Oil_temperature} name="Oil Temp"
                        stroke="#F87171" strokeWidth={2} dot={false} isAnimationActive={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Download scenario buttons — always visible */}
      <div className="card" style={{padding:16}}>
        <div style={{color:'var(--text-3)',fontSize:11,fontWeight:600,textTransform:'uppercase',
                     letterSpacing:'0.05em',marginBottom:10}}>Download Scenario Data</div>
        <div style={{display:'flex',gap:8}}>
          {['healthy','warning','critical','full'].map(s=>(
            <a key={s} href={`/api/download/${s}`} download className="btn-ghost" style={{fontSize:11}}>
              <Download size={11}/> {s.charAt(0).toUpperCase()+s.slice(1)}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
