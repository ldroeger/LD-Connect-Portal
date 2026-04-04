import React, { useState } from 'react'
import api from '../utils/api.js'

const S = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #EFF6FF 0%, #F8FAFC 100%)', padding: 24 },
  card: { background: 'white', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.12)', width: '100%', maxWidth: 560, padding: 40 },
  header: { textAlign: 'center', marginBottom: 32 },
  logo: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, background: 'var(--primary)', borderRadius: 14, color: 'white', fontWeight: 800, fontSize: '1.2rem', marginBottom: 16 },
  title: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', marginBottom: 6 },
  subtitle: { color: 'var(--text-2)', fontSize: '0.9rem' },
  steps: { display: 'flex', marginBottom: 32, position: 'relative' },
  stepLine: { position: 'absolute', top: 16, left: '16.67%', right: '16.67%', height: 2, background: 'var(--border)', zIndex: 0 },
  step: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative', zIndex: 1 },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: 6 },
  input: { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.9rem', outline: 'none', fontFamily: 'var(--font)', boxSizing: 'border-box' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 },
  error: { background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 16 },
  success: { background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#059669', padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 16 },
  hint: { fontSize: '0.8rem', color: 'var(--text-3)', marginTop: 4 },
  info: { background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '10px 14px', marginTop: 8, fontSize: '0.82rem', color: '#92400E' },
  checkbox: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', color: 'var(--text-2)', cursor: 'pointer', marginTop: 8 },
}

const btn = (variant = 'primary') => ({
  padding: '11px 24px', borderRadius: 8, border: variant === 'secondary' ? '1px solid var(--border)' : 'none',
  background: variant === 'primary' ? 'var(--primary)' : 'var(--surface-2)',
  color: variant === 'primary' ? 'white' : 'var(--text)',
  fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'var(--font)',
})

const stepCircle = (active, done) => ({
  width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontWeight: 600, fontSize: '0.85rem',
  background: done ? 'var(--success)' : active ? 'var(--primary)' : 'var(--border)',
  color: done || active ? 'white' : 'var(--text-3)',
  border: `2px solid ${done ? 'var(--success)' : active ? 'var(--primary)' : 'var(--border)'}`,
})

const stepLabel = (active, done) => ({
  fontSize: '0.75rem', fontWeight: active || done ? 600 : 400,
  color: active ? 'var(--primary)' : done ? 'var(--success)' : 'var(--text-3)',
})

const steps = ['Admin-Konto', 'Datenbankverbindung', 'Branding']

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const [admin, setAdmin] = useState({ name: '', email: '', password: '', pw2: '', powerbird_id: '' })
  const [db, setDb] = useState({ host: '', port: '1433', database: '', user: '', password: '', encrypt: false, trust_cert: true })
  const [brand, setBrand] = useState({ company_name: '', primary_color: '#2563EB', logo_url: '/default-logo.png', calendar_range_days: '14', smtp_host: '', smtp_port: '587', smtp_user: '', smtp_password: '' })

  const handleStep1 = async () => {
    if (!admin.name || !admin.email || !admin.password) return setError('Bitte alle Pflichtfelder ausfüllen')
    if (admin.password !== admin.pw2) return setError('Passwörter stimmen nicht überein')
    if (admin.password.length < 8) return setError('Passwort muss mindestens 8 Zeichen lang sein')
    setLoading(true); setError('')
    try { await api.post('/setup/admin', { name: admin.name, email: admin.email, password: admin.password, powerbird_id: admin.powerbird_id }); setStep(1) }
    catch (e) { setError(e.response?.data?.error || 'Fehler') }
    setLoading(false)
  }

  const handleTestDb = async () => {
    setLoading(true); setError(''); setMsg('')
    try { await api.post('/setup/test-database', db); setMsg('✓ Verbindung erfolgreich!') }
    catch (e) { setError(e.response?.data?.error || 'Verbindungsfehler') }
    setLoading(false)
  }

  const handleStep2 = async () => {
    if (!db.host || !db.database || !db.user) return setError('Server, Datenbank und Benutzer sind erforderlich')
    setLoading(true); setError('')
    try { await api.post('/setup/database', db); setStep(2) }
    catch (e) { setError(e.response?.data?.error || 'Fehler') }
    setLoading(false)
  }

  const handleStep3 = async () => {
    setLoading(true); setError('')
    try { await api.post('/setup/branding', brand); onComplete() }
    catch (e) { setError(e.response?.data?.error || 'Fehler') }
    setLoading(false)
  }

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.header}>
          <img src="/default-logo.png" alt="LD Connect" style={{ width:120, height:120, objectFit:'contain', marginBottom:16 }} />
          <h1 style={S.title}>Einrichtungsassistent</h1>
          <p style={S.subtitle}>Willkommen! Bitte folgen Sie den Schritten zur Einrichtung.</p>
        </div>

        <div style={S.steps}>
          <div style={S.stepLine} />
          {steps.map((label, i) => (
            <div key={i} style={S.step}>
              <div style={stepCircle(step === i, step > i)}>{step > i ? '✓' : i + 1}</div>
              <span style={stepLabel(step === i, step > i)}>{label}</span>
            </div>
          ))}
        </div>

        {error && <div style={S.error}>{error}</div>}
        {msg && <div style={S.success}>{msg}</div>}

        {step === 0 && (
          <div>
            <div style={S.field}><label style={S.label}>Name *</label><input style={S.input} value={admin.name} onChange={e => setAdmin(a=>({...a,name:e.target.value}))} placeholder="Max Mustermann" /></div>
            <div style={S.field}><label style={S.label}>E-Mail-Adresse *</label><input style={S.input} type="email" value={admin.email} onChange={e => setAdmin(a=>({...a,email:e.target.value}))} placeholder="admin@firma.de" /></div>
            <div style={S.field}>
              <label style={S.label}>Powerbird-Benutzer-ID</label>
              <input style={S.input} value={admin.powerbird_id} onChange={e => setAdmin(a=>({...a,powerbird_id:e.target.value}))} placeholder="z.B. MM01 oder 42" />
              <div style={S.hint}>Ihre ID aus dem Powerbird-System (Termin_ResourceName)</div>
            </div>
            <div style={S.row}>
              <div style={S.field}><label style={S.label}>Passwort *</label><input style={S.input} type="password" value={admin.password} onChange={e => setAdmin(a=>({...a,password:e.target.value}))} placeholder="Min. 8 Zeichen" /></div>
              <div style={S.field}><label style={S.label}>Passwort wiederholen *</label><input style={S.input} type="password" value={admin.pw2} onChange={e => setAdmin(a=>({...a,pw2:e.target.value}))} /></div>
            </div>
            <div style={S.actions}><button style={btn()} onClick={handleStep1} disabled={loading}>{loading ? 'Wird gespeichert…' : 'Weiter →'}</button></div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div style={S.row}>
              <div style={S.field}><label style={S.label}>SQL Server / Host *</label><input style={S.input} value={db.host} onChange={e => setDb(d=>({...d,host:e.target.value}))} placeholder="192.168.1.100" /></div>
              <div style={S.field}><label style={S.label}>Port</label><input style={S.input} value={db.port} onChange={e => setDb(d=>({...d,port:e.target.value}))} placeholder="1433" /></div>
            </div>
            <div style={S.field}><label style={S.label}>Datenbankname *</label><input style={S.input} value={db.database} onChange={e => setDb(d=>({...d,database:e.target.value}))} placeholder="Powerbird" /></div>
            <div style={S.row}>
              <div style={S.field}><label style={S.label}>Benutzername *</label><input style={S.input} value={db.user} onChange={e => setDb(d=>({...d,user:e.target.value}))} placeholder="sa" /></div>
              <div style={S.field}><label style={S.label}>Passwort</label><input style={S.input} type="password" value={db.password} onChange={e => setDb(d=>({...d,password:e.target.value}))} /></div>
            </div>
            <label style={S.checkbox}><input type="checkbox" checked={db.trust_cert} onChange={e => setDb(d=>({...d,trust_cert:e.target.checked}))} /> Serverzertifikat vertrauen (empfohlen für lokale Server)</label>
            <label style={S.checkbox}><input type="checkbox" checked={db.encrypt} onChange={e => setDb(d=>({...d,encrypt:e.target.checked}))} /> Verbindung verschlüsseln (SSL/TLS)</label>
            <div style={S.info}>ℹ️ Die Powerbird-Datenbank wird <strong>ausschließlich lesend</strong> verwendet.</div>
            <div style={S.actions}>
              <button style={btn('secondary')} onClick={() => setStep(0)}>← Zurück</button>
              <button style={btn('secondary')} onClick={handleTestDb} disabled={loading}>Verbindung testen</button>
              <button style={btn()} onClick={handleStep2} disabled={loading}>{loading ? 'Bitte warten…' : 'Weiter →'}</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={S.row}>
              <div style={S.field}><label style={S.label}>Firmenname</label><input style={S.input} value={brand.company_name} onChange={e => setBrand(b=>({...b,company_name:e.target.value}))} placeholder="Muster GmbH" /></div>
              <div style={S.field}>
                <label style={S.label}>Primärfarbe</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="color" value={brand.primary_color} onChange={e => setBrand(b=>({...b,primary_color:e.target.value}))} style={{ width: 44, height: 40, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', padding: 2 }} />
                  <input style={{ ...S.input, fontFamily: 'monospace', flex: 1 }} value={brand.primary_color} onChange={e => setBrand(b=>({...b,primary_color:e.target.value}))} />
                </div>
              </div>
            </div>
            <div style={S.row}>
              <div style={S.field}><label style={S.label}>Logo-URL (optional)</label><input style={S.input} value={brand.logo_url} onChange={e => setBrand(b=>({...b,logo_url:e.target.value}))} placeholder="https://..." /></div>
              <div style={S.field}><label style={S.label}>Kalenderbereich (Tage)</label><input style={S.input} type="number" min="1" max="365" value={brand.calendar_range_days} onChange={e => setBrand(b=>({...b,calendar_range_days:e.target.value}))} /></div>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 12, color: 'var(--text-2)' }}>E-Mail Einstellungen (für Einladungen & Passwort-Reset)</div>
              <div style={S.row}>
                <div style={S.field}><label style={S.label}>SMTP Server</label><input style={S.input} value={brand.smtp_host} onChange={e => setBrand(b=>({...b,smtp_host:e.target.value}))} placeholder="mail.firma.de" /></div>
                <div style={S.field}><label style={S.label}>SMTP Port</label><input style={S.input} value={brand.smtp_port} onChange={e => setBrand(b=>({...b,smtp_port:e.target.value}))} placeholder="587" /></div>
              </div>
              <div style={S.row}>
                <div style={S.field}><label style={S.label}>SMTP Benutzer</label><input style={S.input} value={brand.smtp_user} onChange={e => setBrand(b=>({...b,smtp_user:e.target.value}))} placeholder="portal@firma.de" /></div>
                <div style={S.field}><label style={S.label}>SMTP Passwort</label><input style={S.input} type="password" value={brand.smtp_password} onChange={e => setBrand(b=>({...b,smtp_password:e.target.value}))} /></div>
              </div>
            </div>
            <div style={S.actions}>
              <button style={btn('secondary')} onClick={() => setStep(1)}>← Zurück</button>
              <button style={btn()} onClick={handleStep3} disabled={loading}>{loading ? 'Wird abgeschlossen…' : '✓ Einrichtung abschließen'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
