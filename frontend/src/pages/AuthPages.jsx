import React, { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useBranding } from '../contexts/BrandingContext.jsx'
import api from '../utils/api.js'

const S = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #EFF6FF 0%, #F8FAFC 100%)', padding: 24 },
  card: { background: 'white', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.12)', width: '100%', maxWidth: 420, padding: 40 },
  header: { textAlign: 'center', marginBottom: 32 },
  logo: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, background: 'var(--primary)', borderRadius: 14, color: 'white', fontWeight: 800, fontSize: '1.2rem', marginBottom: 16 },
  title: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', marginBottom: 4 },
  subtitle: { color: 'var(--text-3)', fontSize: '0.88rem' },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: 6 },
  input: { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.9rem', outline: 'none', fontFamily: 'var(--font)', boxSizing: 'border-box' },
  btn: { width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'var(--font)', marginTop: 8 },
  error: { background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 16 },
  success: { background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#059669', padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 16 },
  link: { color: 'var(--primary)', textDecoration: 'none', fontSize: '0.85rem' },
  forgotRow: { textAlign: 'right', marginTop: -8, marginBottom: 16 },
  back: { display: 'block', textAlign: 'center', marginTop: 20, color: 'var(--primary)', textDecoration: 'none', fontSize: '0.85rem' },
}

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const { branding } = useBranding()
  const navigate = useNavigate()

  const handleSubmit = async () => {
    if (!email || !password) return setError('Bitte E-Mail und Passwort eingeben')
    setLoading(true); setError('')
    try { await login(email, password); navigate('/') }
    catch (e) { setError(e.response?.data?.error || 'Anmeldung fehlgeschlagen') }
    setLoading(false)
  }

  return (
    <div style={S.wrap}>
      <div style={{ position:'fixed', top:16, right:16, zIndex:100 }}>
</div>
      <div style={S.card}>
        <div style={S.header}>
          {branding.logo_url
            ? <img src={branding.logo_url} alt="Logo" style={{ height: 56, objectFit: 'contain', marginBottom: 12 }} />
            : <img src="/default-logo.png" alt="LD Connect" style={{ height:56, objectFit:'contain', marginBottom:12 }} />}
          <h1 style={S.title}>{branding.company_name}</h1>
          <p style={S.subtitle}>LD Connect · {'Anmelden'}</p>
        </div>
        {error && <div style={S.error}>{error}</div>}
        <div style={S.field}>
          <label style={S.label}>{'E-Mail'}</label>
          <input style={S.input} type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key==='Enter' && handleSubmit()} placeholder="name@firma.de" autoFocus />
        </div>
        <div style={S.field}>
          <label style={S.label}>{'Passwort'}</label>
          <input style={S.input} type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key==='Enter' && handleSubmit()} placeholder="Ihr Passwort" />
        </div>
        <div style={S.forgotRow}><Link to="/forgot-password" style={S.link}>{'Passwort vergessen?'}</Link></div>
        <button style={S.btn} onClick={handleSubmit} disabled={loading}>{loading ? 'Lädt...' : 'Anmelden'}</button>
      </div>
    </div>
  )
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    if (!email) return setError('Bitte E-Mail eingeben')
    setLoading(true); setError('')
    try { await api.post('/auth/forgot-password', { email }); setDone(true) }
    catch (e) { setError(e.response?.data?.error || 'Fehler') }
    setLoading(false)
  }

  return (
    <div style={S.wrap}>
      <div style={{ position:'fixed', top:16, right:16, zIndex:100 }}>
</div>
      <div style={S.card}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="/default-logo.png" alt="LD Connect" style={{ height:56, objectFit:'contain', marginBottom:12 }} />
          <h1 style={S.title}>Passwort vergessen</h1>
          <p style={S.subtitle}>Geben Sie Ihre E-Mail-Adresse ein.</p>
        </div>
        {error && <div style={S.error}>{error}</div>}
        {done
          ? <div style={S.success}>Falls die E-Mail registriert ist, wurde ein Link gesendet. Bitte prüfen Sie Ihr Postfach.</div>
          : <>
              <label style={S.label}>{'E-Mail'}</label>
              <input style={{ ...S.input, marginBottom: 16 }} type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key==='Enter' && handleSubmit()} placeholder="name@firma.de" autoFocus />
              <button style={S.btn} onClick={handleSubmit} disabled={loading}>{loading ? 'Senden…' : 'Reset-Link senden'}</button>
            </>}
        <Link to="/login" style={S.back}>← Zurück zur Anmeldung</Link>
      </div>
    </div>
  )
}

export function SetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [password, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async () => {
    if (!password || !pw2) return setError('Bitte beide Felder ausfüllen')
    if (password !== pw2) return setError('Passwörter stimmen nicht überein')
    if (password.length < 8) return setError('Passwort muss mindestens 8 Zeichen lang sein')
    setLoading(true); setError('')
    try {
      await api.post('/auth/set-password', { token, password })
      setDone(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (e) { setError(e.response?.data?.error || 'Fehler') }
    setLoading(false)
  }

  if (!token) return (
    <div style={S.wrap}><div style={S.card}>
      <div style={S.error}>Ungültiger Link. Bitte fordern Sie einen neuen Link an.</div>
      <Link to="/login" style={S.back}>← Zur Anmeldung</Link>
    </div></div>
  )

  return (
    <div style={S.wrap}>
      <div style={{ position:'fixed', top:16, right:16, zIndex:100 }}>
</div>
      <div style={S.card}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="/default-logo.png" alt="LD Connect" style={{ height:56, objectFit:'contain', marginBottom:12 }} />
          <h1 style={S.title}>Passwort festlegen</h1>
          <p style={S.subtitle}>Bitte wählen Sie ein sicheres Passwort (min. 8 Zeichen).</p>
        </div>
        {error && <div style={S.error}>{error}</div>}
        {done
          ? <div style={S.success}>✓ Passwort erfolgreich gesetzt! Sie werden weitergeleitet…</div>
          : <>
              <label style={S.label}>Neues Passwort</label>
              <input style={{ ...S.input, marginBottom: 16 }} type="password" value={password} onChange={e => setPw(e.target.value)} placeholder="Min. 8 Zeichen" autoFocus />
              <label style={S.label}>Passwort bestätigen</label>
              <input style={{ ...S.input, marginBottom: 0 }} type="password" value={pw2} onChange={e => setPw2(e.target.value)} onKeyDown={e => e.key==='Enter' && handleSubmit()} placeholder="Passwort wiederholen" />
              <button style={S.btn} onClick={handleSubmit} disabled={loading}>{loading ? 'Wird gesetzt…' : 'Passwort festlegen'}</button>
            </>}
      </div>
    </div>
  )
}

export default LoginPage
