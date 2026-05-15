import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Lock, ArrowRight, KeyRound, CheckCircle, Eye, EyeOff, Send, ArrowLeft } from 'lucide-react'

/* ── Circuit board corner decoration (SVG) — Large & visible ── */
const CircuitCorner = ({ style, flip = '' }) => (
  <svg width="320" height="320" viewBox="0 0 320 320" fill="none"
    style={{ position: 'absolute', ...style, transform: flip, pointerEvents: 'none' }}>
    {/* Main traces */}
    <line x1="15" y1="160" x2="260" y2="160" stroke="rgba(255,255,255,0.06)" strokeWidth="1.2" />
    <line x1="160" y1="15" x2="160" y2="260" stroke="rgba(255,255,255,0.06)" strokeWidth="1.2" />
    <line x1="90" y1="90" x2="160" y2="160" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
    <line x1="260" y1="160" x2="290" y2="130" stroke="rgba(255,255,255,0.04)" strokeWidth="0.8" />
    <line x1="160" y1="260" x2="130" y2="290" stroke="rgba(255,255,255,0.04)" strokeWidth="0.8" />
    {/* Additional circuit paths */}
    <line x1="70" y1="160" x2="70" y2="230" stroke="rgba(255,255,255,0.035)" strokeWidth="0.7" />
    <line x1="160" y1="70" x2="230" y2="70" stroke="rgba(255,255,255,0.035)" strokeWidth="0.7" />
    <line x1="120" y1="120" x2="200" y2="120" stroke="rgba(255,255,255,0.03)" strokeWidth="0.6" />
    <line x1="120" y1="120" x2="120" y2="200" stroke="rgba(255,255,255,0.03)" strokeWidth="0.6" />
    {/* IC chip shape */}
    <rect x="200" y="130" width="28" height="56" rx="3" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
    {/* Chip pads */}
    <line x1="200" y1="145" x2="185" y2="145" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
    <line x1="200" y1="158" x2="185" y2="158" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
    <line x1="200" y1="171" x2="185" y2="171" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
    <line x1="228" y1="145" x2="243" y2="145" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
    <line x1="228" y1="158" x2="243" y2="158" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
    <line x1="228" y1="171" x2="243" y2="171" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
    {/* Junction dots */}
    <circle cx="260" cy="160" r="4" fill="rgba(255,255,255,0.12)" />
    <circle cx="160" cy="260" r="4" fill="rgba(255,255,255,0.12)" />
    <circle cx="160" cy="160" r="3" fill="rgba(255,255,255,0.09)" />
    <circle cx="90" cy="90" r="2.5" fill="rgba(255,255,255,0.07)" />
    <circle cx="290" cy="130" r="2.5" fill="rgba(255,255,255,0.09)" />
    <circle cx="130" cy="290" r="2.5" fill="rgba(255,255,255,0.09)" />
    <circle cx="70" cy="230" r="2" fill="rgba(255,255,255,0.06)" />
    <circle cx="230" cy="70" r="2" fill="rgba(255,255,255,0.06)" />
    {/* Dot grid near chip */}
    {[0,1,2,3,4,5].map(r => [0,1,2,3,4,5].map(c => (
      <circle key={`${r}-${c}`} cx={60 + c * 9} cy={60 + r * 9}
        r="1" fill="rgba(255,255,255,0.06)" />
    )))}
  </svg>
)

/* ── Modern logo SVG ───────────────────────────────────── */
const Logo = () => (
  <div className="login-logo-wrap">
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      {/* Outer ring with gap */}
      <path d="M20 3 A17 17 0 1 1 8 8" stroke="rgba(255,255,255,0.8)" strokeWidth="2.5"
        strokeLinecap="round" fill="none" />
      {/* Inner gear teeth */}
      <circle cx="20" cy="20" r="8" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none" />
      <circle cx="20" cy="20" r="3" fill="rgba(255,255,255,0.6)" />
      {/* Tick marks */}
      <line x1="20" y1="6" x2="20" y2="9" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="31" x2="20" y2="34" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6" y1="20" x2="9" y2="20" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="31" y1="20" x2="34" y2="20" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  </div>
)

export default function LoginPage({ onLogin }) {
  const [username, setUsername]       = useState('')
  const [password, setPassword]       = useState('')
  const [showPw, setShowPw]           = useState(false)
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [hints, setHints]             = useState({ username: '', password: '' })

  // Forgot password flow
  const [mode, setMode]               = useState('login')
  const [resetCode, setResetCode]     = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showNewPw, setShowNewPw]     = useState(false)
  const [resetError, setResetError]   = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [codeSending, setCodeSending] = useState(false)

  /* ── Fetch default credentials from backend .env ────── */
  useEffect(() => {
    fetch('/api/login-hints')
      .then(r => r.json())
      .then(d => setHints({ username: d.username || '', password: d.password || '' }))
      .catch(() => setHints({ username: 'admin', password: 'admin123' }))
  }, [])

  /* ── Login ──────────────────────────────────────────── */
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username || hints.username,
          password: password || hints.password,
        }),
      })
      const data = await res.json()
      if (data.success) {
        localStorage.setItem('pdm_token', data.token)
        onLogin(data.token)
      } else {
        setError(data.error || 'Invalid credentials')
      }
    } catch {
      setError('Connection failed')
    }
    setLoading(false)
  }

  /* ── Forgot Password ────────────────────────────────── */
  const handleForgotPassword = async () => {
    setCodeSending(true)
    setResetError('')
    try {
      const res = await fetch('/api/forgot-password', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        if (data.telegram_token && data.telegram_chat_id) {
          try {
            await fetch(`https://api.telegram.org/bot${data.telegram_token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: data.telegram_chat_id,
                text: data.message,
                parse_mode: 'HTML',
              }),
            })
          } catch { /* Telegram might fail — code is still valid */ }
        }
        setMode('reset')
      } else {
        setResetError(data.error || 'Failed to generate code')
      }
    } catch {
      setResetError('Connection failed')
    }
    setCodeSending(false)
  }

  /* ── Reset Password ─────────────────────────────────── */
  const handleResetPassword = async (e) => {
    e.preventDefault()
    setResetLoading(true)
    setResetError('')
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: resetCode, new_password: newPassword }),
      })
      const data = await res.json()
      if (data.success) {
        setMode('success')
        setTimeout(() => {
          setMode('login')
          setPassword('')
          setResetCode('')
          setNewPassword('')
        }, 2500)
      } else {
        setResetError(data.error || 'Reset failed')
      }
    } catch {
      setResetError('Connection failed')
    }
    setResetLoading(false)
  }

  const goBack = () => { setMode('login'); setResetError(''); setResetCode(''); setNewPassword('') }

  const slideIn  = { opacity: 0, y: 16 }
  const slideOn  = { opacity: 1, y: 0 }
  const slideOut = { opacity: 0, y: -16 }

  return (
    <div className="lp">
      {/* Circuit board decorations */}
      <CircuitCorner style={{ top: -30, left: -30 }} />
      <CircuitCorner style={{ top: -30, right: -30 }} flip="scaleX(-1)" />
      <CircuitCorner style={{ bottom: -30, left: -30 }} flip="scaleY(-1)" />
      <CircuitCorner style={{ bottom: -30, right: -30 }} flip="scale(-1)" />

      {/* ── Card ──────────────────────────────────────── */}
      <motion.div
        className="lp-card"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Logo + heading */}
        <div className="lp-head">
          <Logo />
          <h1 className="lp-title">Welcome Back</h1>
          <p className="lp-sub">Predictive Maintenance Dashboard</p>
        </div>

        <AnimatePresence mode="wait">
          {/* ── LOGIN ─────────────────────────────────── */}
          {mode === 'login' && (
            <motion.form key="login" initial={slideIn} animate={slideOn} exit={slideOut}
              transition={{ duration: 0.22 }} onSubmit={handleLogin} className="lp-form">

              <div className="lp-field">
                <User size={15} className="lp-field-ic" />
                <input type="text" placeholder={hints.username || 'username'}
                  value={username} onChange={e => setUsername(e.target.value)}
                  autoComplete="username" />
              </div>

              <div className="lp-field">
                <Lock size={15} className="lp-field-ic" />
                <input type={showPw ? 'text' : 'password'}
                  placeholder={hints.password || 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="lp-eye" tabIndex={-1}>
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }} className="lp-err">{error}</motion.div>
                )}
              </AnimatePresence>

              <button type="submit" className="lp-btn" disabled={loading}>
                {loading
                  ? <span className="lp-btn-load"><span className="lp-spin" />Signing in...</span>
                  : <>Login</>}
              </button>

              <button type="button" onClick={() => { setError(''); setMode('forgot') }}
                className="lp-forgot">
                Forgot Password?
              </button>
            </motion.form>
          )}

          {/* ── FORGOT ────────────────────────────────── */}
          {mode === 'forgot' && (
            <motion.div key="forgot" initial={slideIn} animate={slideOn} exit={slideOut}
              transition={{ duration: 0.22 }} className="lp-form">
              <p className="lp-help">
                A <strong>6-digit code</strong> will be sent to the admin Telegram bot.
              </p>
              <AnimatePresence>
                {resetError && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }} className="lp-err">{resetError}</motion.div>
                )}
              </AnimatePresence>
              <button onClick={handleForgotPassword} className="lp-btn" disabled={codeSending}>
                {codeSending
                  ? <span className="lp-btn-load"><span className="lp-spin" />Sending...</span>
                  : <><Send size={14} /> Send Reset Code</>}
              </button>
              <button onClick={goBack} className="lp-back">
                <ArrowLeft size={13} /> Back to Login
              </button>
            </motion.div>
          )}

          {/* ── RESET ─────────────────────────────────── */}
          {mode === 'reset' && (
            <motion.form key="reset" initial={slideIn} animate={slideOn} exit={slideOut}
              transition={{ duration: 0.22 }} onSubmit={handleResetPassword} className="lp-form">
              <p className="lp-help">Check your Telegram for the 6-digit code.</p>

              <div className="lp-field">
                <KeyRound size={15} className="lp-field-ic" />
                <input type="text" placeholder="6-digit code" value={resetCode}
                  onChange={e => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6} autoComplete="one-time-code"
                  style={{ letterSpacing: '0.3em', fontWeight: 700, textAlign: 'center' }} />
              </div>

              <div className="lp-field">
                <Lock size={15} className="lp-field-ic" />
                <input type={showNewPw ? 'text' : 'password'}
                  placeholder="New password (min 4 chars)"
                  value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  autoComplete="new-password" />
                <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                  className="lp-eye" tabIndex={-1}>
                  {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              <AnimatePresence>
                {resetError && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }} className="lp-err">{resetError}</motion.div>
                )}
              </AnimatePresence>

              <button type="submit" className="lp-btn"
                disabled={resetLoading || resetCode.length !== 6 || newPassword.length < 4}>
                {resetLoading
                  ? <span className="lp-btn-load"><span className="lp-spin" />Resetting...</span>
                  : <><CheckCircle size={14} /> Reset Password</>}
              </button>
              <button type="button" onClick={goBack} className="lp-back">
                <ArrowLeft size={13} /> Back to Login
              </button>
            </motion.form>
          )}

          {/* ── SUCCESS ───────────────────────────────── */}
          {mode === 'success' && (
            <motion.div key="success" initial={slideIn} animate={slideOn} exit={slideOut}
              transition={{ duration: 0.22 }} className="lp-form" style={{ textAlign: 'center', padding: '28px 0' }}>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 12 }}>
                <CheckCircle size={48} color="#4ade80" strokeWidth={1.5} />
              </motion.div>
              <h3 style={{ color: '#4ade80', fontSize: 16, fontWeight: 700, marginTop: 14 }}>
                Password Reset Successful
              </h3>
              <p className="lp-help" style={{ marginTop: 6 }}>Redirecting to login...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
