import { useEffect, useState } from 'react'
import { Database, Download } from 'lucide-react'
import { SectionHeader, Spinner } from '../components/ui/index.jsx'
import { motion } from 'framer-motion'

export default function DatasetReports() {
  const [info, setInfo] = useState(null)
  useEffect(()=>{ fetch('/api/dataset-info').then(r=>r.json()).then(setInfo) },[])

  return (
    <div className="animate-fade-in" style={{display:'flex',flexDirection:'column',gap:20}}>
      <SectionHeader title="Dataset & Reports" icon={Database}
        subtitle="Dataset documentation, scenario downloads and report generation"/>

      {/* Dataset info */}
      {info && (
        <div className="card" style={{padding:20}}>
          <div style={{color:'var(--text-1)',fontWeight:600,marginBottom:14}}>Dataset Information</div>

          {/* Description block - new */}
          <div style={{background:'var(--bg-card2)',border:'1px solid var(--bg-card2)',
                       borderRadius:10,padding:'16px 18px',marginBottom:18}}>
            <div style={{color:'var(--text-2)',fontSize:11,fontWeight:600,textTransform:'uppercase',
                         letterSpacing:'0.05em',marginBottom:10}}>About This Dataset</div>
            <p style={{color:'var(--text-3)',fontSize:12,lineHeight:1.8,marginBottom:10}}>
              The <span style={{color:'var(--text-2)',fontWeight:600}}>MetroPT-3 dataset</span> was collected from a real metro train operating in Porto, Portugal in 2022.
              Sensor readings were captured from the train's <span style={{color:'var(--text-2)'}}>Air Production Unit (APU)</span> — the compressor system responsible for maintaining pressure in the braking and door systems.
            </p>
            <p style={{color:'var(--text-3)',fontSize:12,lineHeight:1.8,marginBottom:10}}>
              The APU was monitored at a <span style={{color:'var(--text-2)'}}>1 Hz sampling rate</span> (one reading per second), producing
              1,516,948 readings across 213 days. The system records 7 analog sensors (pressure, temperature, motor current)
              and 8 digital signals (valve states, safety switches). Five real failure events — all air leaks — were recorded
              by the company's maintenance team and are included as ground truth for anomaly validation.
            </p>
            <p style={{color:'var(--text-3)',fontSize:12,lineHeight:1.8}}>
              This dataset is unique because it contains <span style={{color:'var(--text-2)'}}>real industrial failure events</span> with company-confirmed maintenance reports,
              making it one of the few publicly available predictive maintenance datasets with verifiable ground truth.
              It was published in <span style={{color:'var(--text-2)',fontStyle:'italic'}}>Nature Scientific Data</span> in 2022 and is freely available under CC BY 4.0.
            </p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginTop:16,
                          paddingTop:14,borderTop:'1px solid var(--bg-card2)'}}>
              {[
                {icon:'📡',label:'Sampling Rate', value:'~10 sec interval'},
                {icon:'🏭',label:'Equipment',     value:'Air Compressor (APU)'},
                {icon:'📅',label:'Collection Period',value:'Feb – Sep 2020'},
                {icon:'🔬',label:'Published In',  value:'Nature Sci. Data 2022'},
              ].map(s=>(
                <div key={s.label} style={{textAlign:'center',padding:'8px 0'}}>
                  <div style={{fontSize:20,marginBottom:4}}>{s.icon}</div>
                  <div style={{color:'var(--text-2)',fontSize:10,marginBottom:2}}>{s.label}</div>
                  <div style={{color:'var(--text-2)',fontSize:11,fontWeight:600}}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats row */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:18}}>
            {[
              {l:'Total Rows',    v:info.rows?.toLocaleString(),    c:'var(--text-1)'},
              {l:'Columns',      v:info.columns,                    c:'var(--text-2)'},
              {l:'Missing Values',v:'Zero',                         c:'var(--ok)'},
              {l:'Sensor Types', v:'7 Analog + 8 Digital',          c:'var(--text-2)'},
              {l:'Failure Events',v:'5 confirmed',                  c:'#F87171'},
            ].map(s=>(
              <div key={s.l} style={{background:'var(--bg-card2)',border:'1px solid var(--bg-card2)',
                                      borderRadius:8,padding:'10px 12px',textAlign:'center'}}>
                <div style={{color:s.c,fontFamily:'monospace',fontWeight:700,fontSize:14,marginBottom:3}}>{s.v}</div>
                <div style={{color:'var(--text-3)',fontSize:10}}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Key-value info */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:0}}>
            {[
              {l:'Name',      v:info.name},
              {l:'Published', v:info.published},
              {l:'DOI',       v:info.doi, link:`https://doi.org/${info.doi}`},
              {l:'License',   v:info.license},
              {l:'Source',    v:info.source},
              {l:'Equipment', v:info.equipment},
            ].map(r=>(
              <div key={r.l} style={{display:'flex',gap:12,padding:'9px 0',
                                      borderBottom:'1px solid rgba(255,255,255,.04)'}}>
                <span style={{color:'var(--text-3)',fontSize:11,width:100,flexShrink:0}}>{r.l}</span>
                {r.link
                  ? <a href={r.link} target="_blank" rel="noreferrer"
                       style={{color:'var(--text-2)',fontSize:11,fontFamily:'monospace',textDecoration:'none'}}>
                      {r.v}
                    </a>
                  : <span style={{color:'var(--text-2)',fontSize:11}}>{r.v}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Downloads */}
      <div className="card" style={{padding:20}}>
        <div style={{color:'var(--text-1)',fontWeight:600,marginBottom:4}}>Download Scenario Data</div>
        <div style={{color:'var(--text-3)',fontSize:11,marginBottom:14}}>Generated dynamically from MetroPT-3 dataset</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
          {[
            {id:'healthy',  label:'Healthy Scenario',   sub:'5,000 rows — normal operation',            dot:'#22C55E'},
            {id:'warning',  label:'Warning Scenario',   sub:'5,000 rows — elevated temperature',         dot:'var(--warn)'},
            {id:'critical', label:'Critical Failure',    sub:'Real air leak — Jun 5–7, 2020',            dot:'var(--danger)'},
            {id:'full',     label:'Full Labelled Sample',sub:'50,000 rows with predictions',             dot:'var(--text-2)'},
          ].map(s=>(
            <motion.a key={s.id} href={`/api/download/${s.id}`} download
              whileHover={{scale:1.02,y:-2}} whileTap={{scale:.98}}
              style={{display:'block',padding:16,borderRadius:10,textDecoration:'none',
                      border:'1px solid var(--border)',background:'var(--bg-card2)',
                      transition:'border-color .15s',cursor:'pointer'}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:s.dot,marginBottom:8}}/>
              <div style={{color:'var(--text-1)',fontWeight:600,fontSize:12,marginBottom:3}}>{s.label}</div>
              <div style={{color:'var(--text-3)',fontSize:10,marginBottom:10}}>{s.sub}</div>
              <div style={{display:'flex',alignItems:'center',gap:5,color:'var(--text-3)',fontSize:11}}>
                <Download size={11}/> Download CSV
              </div>
            </motion.a>
          ))}
        </div>
      </div>

      {/* Column docs */}
      {info && (
        <div className="card" style={{padding:20}}>
          <div style={{color:'var(--text-1)',fontWeight:600,marginBottom:12}}>Column Documentation</div>
          <table style={{width:'100%',fontSize:11,borderCollapse:'collapse'}}>
            <thead>
              <tr style={{borderBottom:'1px solid var(--border)'}}>
                {['Column','Description','Unit','Type'].map(h=>(
                  <th key={h} style={{textAlign:'left',padding:'8px 12px',color:'var(--text-3)',
                                       fontWeight:600,textTransform:'uppercase',letterSpacing:'0.04em'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {info.columns_doc?.map((c,i)=>(
                <motion.tr key={i} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*.02}} className="trow">
                  <td style={{padding:'8px 12px',color:'var(--text-2)',fontFamily:'monospace',fontWeight:700}}>{c.column}</td>
                  <td style={{padding:'8px 12px',color:'var(--text-3)'}}>{c.description}</td>
                  <td style={{padding:'8px 12px',color:'var(--text-2)',fontFamily:'monospace'}}>{c.unit}</td>
                  <td style={{padding:'8px 12px'}}>
                    <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,fontWeight:600,
                      background:c.type==='Analog'?'rgba(148,163,184,.1)':'rgba(139,92,246,.1)',
                      color:c.type==='Analog'?'var(--text-1)':'#A78BFA',
                      border:`1px solid ${c.type==='Analog'?'rgba(148,163,184,.15)':'rgba(139,92,246,.15)'}`}}>
                      {c.type}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Citation */}
      <div className="card" style={{padding:20,border:'1px solid var(--border)'}}>
        <div style={{color:'var(--text-3)',fontSize:11,fontWeight:600,textTransform:'uppercase',
                     letterSpacing:'0.05em',marginBottom:10}}>Citation</div>
        <div style={{background:'#070A10',borderRadius:8,padding:'14px 16px',
                     fontFamily:'monospace',fontSize:11,lineHeight:1.7,color:'var(--text-2)',
                     border:'1px solid rgba(255,255,255,.04)'}}>
          Veloso, B., Ribeiro, R.P., Gama, J., & Pereira, P.M. (2022).<br/>
          <em style={{color:'var(--text-1)'}}>The MetroPT dataset for predictive maintenance.</em><br/>
          Scientific Data, 9(1), 764.<br/>
          <a href="https://doi.org/10.1038/s41597-022-01877-3" target="_blank" rel="noreferrer"
             style={{color:'var(--text-3)'}}>https://doi.org/10.1038/s41597-022-01877-3</a>
        </div>
      </div>
    </div>
  )
}
