import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Smartphone, Wifi, WifiOff, Activity, AlertTriangle, Link2, Trash2, Copy, Check, Download, Send, QrCode, X } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { SectionHeader, KPICard, ClusterBadge, HealthGauge, Spinner, CustomTooltip } from '../components/ui/index.jsx'
import { QRCodeSVG } from 'qrcode.react'

export default function IoTMonitor() {
  const [wsState, setWsState]         = useState('disconnected') // 'disconnected' | 'connecting' | 'connected'
  const [connectedSensors, setConnectedSensors] = useState(0)
  const [totalReadings, setTotalReadings]   = useState(0)
  const [latestData, setLatestData]   = useState(null)
  const [healthHistory, setHealthHistory] = useState([])
  const [anomalyHistory, setAnomalyHistory] = useState([])
  const [alertLog, setAlertLog]       = useState([])
  const [generatedLink, setGeneratedLink] = useState('')
  const [devices, setDevices] = useState([])
  const [linkLoading, setLinkLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [linkTimer, setLinkTimer] = useState(0)
  const [telegramSending, setTelegramSending] = useState(false)
  const wsRef = useRef(null)
  const reconnectRef = useRef(null)
  const indexRef = useRef(0)
  const telegramConfigRef = useRef({ token: '', chat_id: '' })
  const lastTelegramSentRef = useRef(0)
  const linkTimeoutRef = useRef(null)

  const connectWS = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= 1) return
    setWsState('connecting')

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/iot-dashboard`)
    wsRef.current = ws

    ws.onopen = () => {
      setWsState('connected')
      if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null }
    }

    ws.onmessage = (evt) => {
      try {
        const d = JSON.parse(evt.data)

        // Initial history payload
        if (d.type === 'init') {
          setConnectedSensors(d.connected_count || 0)
          setTotalReadings(d.total_readings || 0)
          if (d.history && d.history.length > 0) {
            const hh = d.history.map((h, i) => ({ idx: i, health: h.health_score }))
            const ah = d.history.map((h, i) => ({ idx: i, score: h.anomaly_score }))
            setHealthHistory(hh.slice(-100))
            setAnomalyHistory(ah.slice(-100))
            setLatestData(d.history[d.history.length - 1])

            // Build initial alert log
            const alerts = d.history
              .filter(h => h.alert_level === 'WARNING' || h.alert_level === 'CRITICAL')
              .slice(-10)
              .reverse()
            setAlertLog(alerts)
          }
          return
        }

        // Device list changed (connect/disconnect)
        if (d.type === 'device_change') {
          setDevices(d.devices || [])
          setConnectedSensors(d.count || 0)
          return
        }

        // All devices disconnected — reset dashboard
        if (d.type === 'all_disconnected') {
          setLatestData(null)
          setHealthHistory([])
          setAnomalyHistory([])
          setAlertLog([])
          setTotalReadings(0)
          setConnectedSensors(0)
          setDevices([])
          indexRef.current = 0
          return
        }

        // Live update
        setLatestData(d)
        setTotalReadings(prev => prev + 1)
        setConnectedSensors(prev => Math.max(prev, 1))

        const idx = indexRef.current++
        setHealthHistory(prev => {
          const next = [...prev, { idx, health: d.health_score }]
          return next.slice(-100)
        })
        setAnomalyHistory(prev => {
          const next = [...prev, { idx, score: d.anomaly_score }]
          return next.slice(-100)
        })

        // Alert log
        if (d.alert_level === 'WARNING' || d.alert_level === 'CRITICAL') {
          setAlertLog(prev => {
            const next = [d, ...prev].slice(0, 10)
            return next
          })
        }

        // Send Telegram alert directly from frontend to bypass Hugging Face firewall
        if (d.alert_level === 'CRITICAL') {
          const cfg = telegramConfigRef.current
          if (cfg.token && cfg.chat_id) {
            const now = Date.now()
            if (now - lastTelegramSentRef.current > 30000) { // 30-second cooldown
              lastTelegramSentRef.current = now
              const msg = `🚨 <b>CRITICAL MACHINE ALERT</b> 🚨\n\n<b>Cluster:</b> HIGH-STRESS\n<b>Anomaly Score:</b> ${(d.anomaly_score||0).toFixed(4)}\n<b>Health:</b> ${d.health_score}/100\n\n<i>Immediate maintenance required!</i>`
              fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: cfg.chat_id, text: msg, parse_mode: 'HTML' })
              }).then(() => console.log("📨 Telegram sent from frontend!"))
                .catch(e => console.error("⚠️ Telegram send failed:", e))
            }
          }
        }
      } catch (e) { /* ignore parse errors */ }
    }

    ws.onclose = () => {
      setWsState('disconnected')
      reconnectRef.current = setTimeout(connectWS, 3000)
    }

    ws.onerror = () => {
      setWsState('disconnected')
    }
  }, [])

  useEffect(() => {
    connectWS()
    // Also poll /api/iot/history every 5s for connected count
    const poll = setInterval(() => {
      fetch('/api/iot/history').then(r => r.json()).then(d => {
        setConnectedSensors(d.connected_count || 0)
        setTotalReadings(d.total_readings || 0)
      }).catch(() => {})
    }, 5000)

    // Fetch Telegram config from backend
    fetch('/api/config').then(r => r.json()).then(d => {
      if (d.telegram_token) {
        telegramConfigRef.current = { token: d.telegram_token, chat_id: d.telegram_chat_id }
      }
    }).catch(() => {})
    return () => {
      clearInterval(poll)
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      if (linkTimeoutRef.current) clearInterval(linkTimeoutRef.current)
      if (wsRef.current) wsRef.current.close()
    }
  }, [connectWS])

  // Generate a one-time-use link
  const generateLink = async () => {
    setLinkLoading(true)
    setCopied(false)
    setShowQR(false)
    if (linkTimeoutRef.current) clearTimeout(linkTimeoutRef.current)

    try {
      const res = await fetch('/api/iot/generate-token', { method: 'POST' })
      const data = await res.json()
      // Build URL on frontend — always correct even behind reverse proxy
      const url = `${window.location.origin}/iot?token=${data.token}`
      setGeneratedLink(url)
      
      // Auto-hide the link after 30 seconds with visible countdown
      setLinkTimer(30)
      linkTimeoutRef.current = setInterval(() => {
        setLinkTimer(prev => {
          if (prev <= 1) {
            clearInterval(linkTimeoutRef.current)
            setGeneratedLink('')
            setShowQR(false)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (e) {
      console.error('Failed to generate link:', e)
    }
    setLinkLoading(false)
  }

  // Copy link to clipboard
  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Disconnect a device by token
  const disconnectDevice = async (token) => {
    try {
      await fetch(`/api/iot/disconnect/${token}`, { method: 'POST' })
      setGeneratedLink('') // Clear the link since it's now expired
    } catch (e) {
      console.error('Failed to disconnect:', e)
    }
  }

  // Download CSV reliably in all environments (iframes, Safari, etc.)
  const downloadCSV = async () => {
    try {
      const res = await fetch('/api/iot/export-csv')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `iot_sensor_data_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Failed to download CSV:', e)
      alert("Failed to download CSV.")
    }
  }

  // Send CSV directly to Telegram Bot
  const sendCSVToTelegram = async () => {
    const { token, chat_id } = telegramConfigRef.current
    if (!token || !chat_id) {
      alert("Telegram is not configured. Please add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to your .env file.")
      return
    }
    setTelegramSending(true)
    try {
      const res = await fetch('/api/iot/export-csv')
      const blob = await res.blob()
      
      const formData = new FormData()
      formData.append('chat_id', chat_id)
      formData.append('document', blob, `iot_sensor_data_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`)
      formData.append('caption', '📊 Here is the latest IoT sensor data export.')

      const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: 'POST',
        body: formData
      })
      if (tgRes.ok) {
        alert("✅ CSV successfully sent to Telegram!")
      } else {
        alert("❌ Failed to send to Telegram. Check console.")
      }
    } catch (e) {
      console.error('Failed to send CSV to Telegram:', e)
      alert("❌ Error sending to Telegram.")
    }
    setTelegramSending(false)
  }

  const ld = latestData || {}

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <SectionHeader
        title="IoT Sensor Monitor"
        subtitle="Real-time phone accelerometer → ML pipeline → predictive maintenance"
        icon={Smartphone}
      />

      {/* ── Section 1: Link Generator & Device Manager ───────────── */}
      <motion.div
        initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="card" style={{ padding: '24px 28px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
            {/* Left: Link Generator */}
            <div style={{ flex: 1, minWidth: 280 }}>
              <div className="label-xs" style={{ marginBottom: 10 }}>🔗 Generate Sensor Link</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={generateLink}
                  disabled={linkLoading || linkTimer > 0}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '12px 20px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.08)', color: '#ffffff',
                    fontSize: 14, fontWeight: 700,
                    cursor: linkLoading ? 'wait' : (linkTimer > 0 ? 'not-allowed' : 'pointer'),
                    opacity: linkLoading || linkTimer > 0 ? 0.7 : 1, transition: 'all 0.2s',
                    border: '1px solid rgba(255,255,255,0.20)',
                  }}
                >
                  <Link2 size={16} />
                  {linkLoading ? 'Generating...' : 'Generate New Link'}
                </button>
                {generatedLink && linkTimer > 0 && (
                  <span style={{
                    fontSize: 12, fontWeight: 800, 
                    color: linkTimer <= 15 ? '#ef4444' : '#ffffff',
                    background: linkTimer <= 15 ? 'rgba(239,68,68,0.1)' : (linkTimer <= 30 ? 'rgba(255,255,255,0.1)' : 'var(--bg-card2)'), 
                    padding: '6px 12px', borderRadius: 8,
                    border: linkTimer <= 15 ? '1px solid rgba(239,68,68,0.5)' : (linkTimer <= 30 ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.15)'),
                    boxShadow: linkTimer <= 15 ? '0 0 16px rgba(239,68,68,0.6)' : (linkTimer <= 30 ? '0 0 16px rgba(255,255,255,0.3)' : 'none'),
                    display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'all 0.3s ease'
                  }}>
                    ⏳ {linkTimer}s
                  </span>
                )}
              </div>

              {generatedLink && (
                <div style={{ marginTop: 12 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: 'var(--bg-card2)', border: '1px solid var(--border)',
                    borderRadius: 12, padding: '10px 14px',
                  }}>
                    <span style={{
                      flex: 1, fontSize: 12, fontFamily: 'monospace', color: 'var(--text-primary)',
                      wordBreak: 'break-all', fontWeight: 600,
                    }}>
                      {generatedLink}
                    </span>
                    
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => setShowQR(true)}
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid var(--border)',
                          borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                          color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6,
                          fontSize: 11, fontWeight: 700, transition: 'all 0.2s',
                        }}
                      >
                        <QrCode size={12} /> Show QR
                      </button>
                      
                      <button
                        onClick={copyLink}
                        style={{
                          background: copied ? 'var(--ok)' : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${copied ? 'var(--ok)' : 'var(--border)'}`,
                          borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                          color: copied ? '#fff' : 'var(--text-primary)',
                          display: 'flex', alignItems: 'center', gap: 6,
                          fontSize: 11, fontWeight: 700, transition: 'all 0.2s',
                        }}
                      >
                        {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy Link</>}
                      </button>
                    </div>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 8 }}>
                    ⚠️ This link is one-time use. It expires in 5 minutes or after disconnect.
                  </p>
                </div>
              )}
            </div>

            {/* Right: Status KPIs */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <div style={{
                background: 'var(--bg-card2)', borderRadius: 14, padding: '16px 22px',
                border: '1px solid var(--border)', minWidth: 130, textAlign: 'center'
              }}>
                <div className="label-xs" style={{ marginBottom: 8 }}>Sensors Online</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: connectedSensors > 0 ? 'var(--ok)' : 'var(--danger)',
                    boxShadow: connectedSensors > 0 ? '0 0 8px var(--ok)' : 'none',
                    display: 'inline-block'
                  }} />
                  <span style={{ fontSize: 28, fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                    {connectedSensors}
                  </span>
                </div>
              </div>
              <div style={{
                background: 'var(--bg-card2)', borderRadius: 14, padding: '16px 22px',
                border: '1px solid var(--border)', minWidth: 130, textAlign: 'center'
              }}>
                <div className="label-xs" style={{ marginBottom: 8 }}>Total Readings</div>
                <span style={{ fontSize: 28, fontWeight: 800, fontFamily: 'monospace', color: 'var(--accent)' }}>
                  {totalReadings.toLocaleString()}
                </span>
              </div>
              <div style={{
                background: 'var(--bg-card2)', borderRadius: 14, padding: '16px 22px',
                border: '1px solid var(--border)', minWidth: 130, textAlign: 'center'
              }}>
                <div className="label-xs" style={{ marginBottom: 8 }}>WS Status</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {wsState === 'connected'
                    ? <><Wifi size={14} color="var(--ok)" /><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ok)' }}>Live</span></>
                    : <><WifiOff size={14} color="var(--danger)" /><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)' }}>{wsState === 'connecting' ? 'Connecting' : 'Offline'}</span></>
                  }
                </div>
              </div>

              {/* Export Data */}
              <div style={{
                background: 'var(--bg-card2)', borderRadius: 14, padding: '12px 18px',
                border: '1px solid var(--border)', minWidth: 150, textAlign: 'center',
                opacity: totalReadings > 0 ? 1 : 0.5
              }}>
                <div className="label-xs" style={{ marginBottom: 8 }}>Export Data</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <button
                    onClick={downloadCSV}
                    disabled={totalReadings === 0}
                    title="Download to PC"
                    style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
                      padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6,
                      cursor: totalReadings > 0 ? 'pointer' : 'not-allowed', color: 'var(--accent)'
                    }}
                  >
                    <Download size={14} /> <span style={{fontSize: 11, fontWeight: 700}}>CSV</span>
                  </button>
                  <button
                    onClick={sendCSVToTelegram}
                    disabled={totalReadings === 0 || telegramSending}
                    title="Send to Telegram"
                    style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
                      padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6,
                      cursor: totalReadings > 0 && !telegramSending ? 'pointer' : 'not-allowed', color: '#0088cc'
                    }}
                  >
                    <Send size={14} /> <span style={{fontSize: 11, fontWeight: 700}}>{telegramSending ? '...' : 'Bot'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Section 1.5: Connected Devices List ─────────────────── */}
      {devices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="card" style={{ padding: '20px 28px', marginBottom: 20 }}>
            <div className="label-xs" style={{ marginBottom: 12 }}>📱 Connected Devices ({devices.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {devices.map((dev) => (
                <div key={dev.token} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--bg-card2)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '12px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', background: 'var(--ok)',
                      boxShadow: '0 0 8px var(--ok)', display: 'inline-block',
                    }} />
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        {dev.token_short}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                        Connected
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => disconnectDevice(dev.token)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px', borderRadius: 10, border: '1px solid var(--danger)',
                      background: 'rgba(239,68,68,0.1)', color: 'var(--danger)',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.target.style.background = 'var(--danger)'; e.target.style.color = '#fff' }}
                    onMouseLeave={e => { e.target.style.background = 'rgba(239,68,68,0.1)'; e.target.style.color = 'var(--danger)' }}
                  >
                    <Trash2 size={12} /> Disconnect
                  </button>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Section 2: Live Dashboard ────────────────────────────── */}
      {!latestData ? (
        <div className="card" style={{ padding: '60px 0', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <Smartphone size={48} color="var(--text-muted)" style={{ opacity: 0.4 }} />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 500 }}>
            Waiting for IoT sensor data...
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>
            Generate a link above, send it to your phone, and shake it
          </p>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <motion.div
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}
          >
            <KPICard title="Cluster" value={ld.cluster || '—'}
              color={ld.cluster === 'NORMAL' ? 'green' : ld.cluster === 'IDLE' ? 'gray' : 'red'} />
            <KPICard title="Health Score" value={ld.health_score ?? '—'} unit="/100"
              color={ld.health_score > 70 ? 'green' : ld.health_score > 40 ? 'yellow' : 'red'} />
            <KPICard title="Anomaly Score" value={(ld.anomaly_score ?? 0).toFixed(4)}
              color={ld.anomaly_score < -0.55 ? 'red' : ld.anomaly_score < -0.45 ? 'yellow' : 'green'} />
            <KPICard title="RUL" value={ld.rul_hours ?? '—'} unit="hours"
              color={ld.rul_hours <= 48 ? 'red' : ld.rul_hours <= 168 ? 'yellow' : 'green'} />
          </motion.div>

          {/* Shake Intensity Indicator */}
          <motion.div
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.12 }}
            className="card" style={{ padding: '14px 24px', marginBottom: 20 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div className="label-xs" style={{ minWidth: 100 }}>📊 Shake Intensity</div>
              <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                {['STILL', 'MEDIUM', 'HARD'].map(level => {
                  const vib = ld.vibration || 0
                  const active = vib > 3 ? 'HARD' : vib > 0.5 ? 'MEDIUM' : 'STILL'
                  const isActive = level === active
                  const colors = { STILL: 'var(--ok)', MEDIUM: 'var(--warn)', HARD: 'var(--danger)' }
                  const bgs = { STILL: 'var(--ok-bg)', MEDIUM: 'var(--warn-bg)', HARD: 'var(--danger-bg)' }
                  return (
                    <div key={level} style={{
                      flex: 1, padding: '10px 12px', borderRadius: 10, textAlign: 'center',
                      background: isActive ? bgs[level] : 'var(--bg-card2)',
                      border: `2px solid ${isActive ? colors[level] : 'var(--border)'}`,
                      transition: 'all 0.3s', boxShadow: isActive ? `0 0 12px ${colors[level]}40` : 'none',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: isActive ? colors[level] : 'var(--text-muted)' }}>
                        {level === 'STILL' ? '📱' : level === 'MEDIUM' ? '🤝' : '💥'} {level}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', minWidth: 80, textAlign: 'right' }}>
                Vib: {(ld.vibration || 0).toFixed(2)}
              </div>
            </div>
          </motion.div>

          {/* Health Gauge + Raw Values Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, marginBottom: 20 }}>
            {/* Health Gauge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
            >
              <div className="label-xs" style={{ marginBottom: 12 }}>System Health</div>
              <HealthGauge score={ld.health_score || 0} size={160} />
              <div style={{ marginTop: 12 }}>
                <ClusterBadge name={ld.cluster || 'UNKNOWN'} />
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
                {ld.recommendation || '—'}
              </div>
            </motion.div>

            {/* Raw sensor values */}
            <motion.div
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="card" style={{ padding: '20px 24px' }}
            >
              <div className="label-xs" style={{ marginBottom: 14 }}>Raw Accelerometer Values</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
                {[
                  { label: 'Magnitude', value: ld.magnitude, unit: 'm/s²', color: 'var(--accent)' },
                  { label: 'Vibration', value: ld.vibration, unit: 'δ', color: 'var(--warn)' },
                  { label: 'Accel X', value: ld.ax, unit: 'm/s²', color: 'var(--text-secondary)' },
                  { label: 'Accel Y', value: ld.ay, unit: 'm/s²', color: 'var(--text-secondary)' },
                  { label: 'Accel Z', value: ld.az, unit: 'm/s²', color: 'var(--text-secondary)' },
                ].map((s, i) => (
                  <div key={i} style={{
                    background: 'var(--bg-card2)', borderRadius: 12, padding: '14px 16px',
                    border: '1px solid var(--border)'
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color: s.color, marginTop: 4 }}>
                      {typeof s.value === 'number' ? s.value.toFixed(2) : '—'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{s.unit}</div>
                  </div>
                ))}
              </div>

              {/* Mapped Sensor Values */}
              {ld.sensors && (
                <div style={{ marginTop: 16 }}>
                  <div className="label-xs" style={{ marginBottom: 10 }}>Mapped Industrial Sensors</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8 }}>
                    {Object.entries(ld.sensors).map(([key, val]) => (
                      <div key={key} style={{
                        background: 'var(--bg-card2)', borderRadius: 8, padding: '8px 10px',
                        border: '1px solid var(--border)', textAlign: 'center'
                      }}>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.03em' }}>{key}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)', marginTop: 2 }}>
                          {typeof val === 'number' ? val.toFixed(3) : val}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            {/* Health Score History */}
            <motion.div
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.25 }}
              className="card" style={{ padding: '20px 24px' }}
            >
              <div className="label-xs" style={{ marginBottom: 14 }}>Health Score — Last 100 Readings</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={healthHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="idx" tick={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={70} stroke="var(--ok)" strokeDasharray="4 4" strokeOpacity={0.5} />
                  <ReferenceLine y={40} stroke="var(--warn)" strokeDasharray="4 4" strokeOpacity={0.5} />
                  <Line type="monotone" dataKey="health" stroke="var(--ok)" strokeWidth={2}
                    dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Anomaly Score History */}
            <motion.div
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="card" style={{ padding: '20px 24px' }}
            >
              <div className="label-xs" style={{ marginBottom: 14 }}>Anomaly Score — Last 100 Readings</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={anomalyHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="idx" tick={false} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={-0.45} stroke="var(--warn)" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: 'Warning', fill: 'var(--warn)', fontSize: 9 }} />
                  <ReferenceLine y={-0.55} stroke="var(--danger)" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: 'Critical', fill: 'var(--danger)', fontSize: 9 }} />
                  <Line type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2}
                    dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
          </div>

          {/* Alert Log */}
          <motion.div
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.35 }}
            className="card" style={{ padding: '20px 24px', marginBottom: 20 }}
          >
            <div className="label-xs" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={12} /> Alert Log (Last 10)
            </div>
            {alertLog.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
                No alerts yet. Shake the phone harder to trigger warnings!
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Time', 'Cluster', 'Alert', 'Health', 'Anomaly Score', 'Recommendation'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {alertLog.map((a, i) => (
                      <tr key={i} className="trow" style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)' }}>{a.timestamp || '—'}</td>
                        <td style={{ padding: '8px 10px' }}><ClusterBadge name={a.cluster || 'UNKNOWN'} /></td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 8px', borderRadius: 50, fontSize: 10, fontWeight: 700,
                            background: a.alert_level === 'CRITICAL' ? 'var(--danger-bg)' : 'var(--warn-bg)',
                            color: a.alert_level === 'CRITICAL' ? 'var(--danger)' : 'var(--warn)',
                          }}>
                            {a.alert_level}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 700 }}>{a.health_score}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: 'var(--accent)' }}>{(a.anomaly_score || 0).toFixed(4)}</td>
                        <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.recommendation || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </>
      )}


      {/* QR Code Modal Overlay */}
      {showQR && generatedLink && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 16, padding: 30, display: 'flex', flexDirection: 'column',
              alignItems: 'center', position: 'relative', minWidth: 280,
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}
          >
            {/* Close Button */}
            <button 
              onClick={() => setShowQR(false)}
              style={{
                position: 'absolute', top: 12, right: 12,
                background: 'transparent', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%', transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 20 }}>Scan to Connect</h3>

            {/* QR Code */}
            <div style={{
              background: '#ffffff', padding: 16, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 20
            }}>
              <QRCodeSVG value={generatedLink} size={200} level="M" />
            </div>

            {/* Same Timer styling from the main UI */}
            <span style={{
              fontSize: 14, fontWeight: 800, 
              color: linkTimer <= 15 ? '#ef4444' : '#ffffff',
              background: linkTimer <= 15 ? 'rgba(239,68,68,0.1)' : (linkTimer <= 30 ? 'rgba(255,255,255,0.1)' : 'var(--bg-card2)'), 
              padding: '8px 16px', borderRadius: 8,
              border: linkTimer <= 15 ? '1px solid rgba(239,68,68,0.5)' : (linkTimer <= 30 ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.15)'),
              boxShadow: linkTimer <= 15 ? '0 0 16px rgba(239,68,68,0.6)' : (linkTimer <= 30 ? '0 0 16px rgba(255,255,255,0.3)' : 'none'),
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.3s ease'
            }}>
              ⏳ Expires in {linkTimer}s
            </span>
          </motion.div>
        </div>
      )}
    </div>
  )
}
