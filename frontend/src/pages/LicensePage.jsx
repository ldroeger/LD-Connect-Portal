import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import api from '../utils/api.js'

// Bezeichnungen der Funktionscodes aus dem Lizenzportal (Produkt "ld-connect")
const FEATURES = {
  calendar: 'Kalender', hours: 'Stundenkonto', vacation: 'Urlaubsplanung', news: 'News', todos: 'Aufgaben',
  documents: 'Dokumente', sick: 'Krankmeldung', manager: 'Auswertung für die Leitung', tools: 'Werkzeugverwaltung',
  display: 'Mitarbeiterbildschirm', app: 'Mobile App mit Push',
}
const LIMITS = { users: 'Mitarbeitende' }
const REASONS = {
  invalid_key: 'Diesen Lizenzschlüssel gibt es nicht. Bitte auf Tippfehler prüfen.',
  wrong_product: 'Der Schlüssel gehört zu einem anderen Produkt.',
  activation_limit: 'Alle Installationen dieser Lizenz sind belegt. Im Kundenkonto kann eine alte Installation freigegeben werden.',
  expired: 'Die Lizenz ist abgelaufen.', revoked: 'Die Lizenz wurde widerrufen.', suspended: 'Die Lizenz ist gesperrt.',
  network: 'Das Lizenzportal ist nicht erreichbar. Internetverbindung prüfen – oder eine Offline-Lizenz einspielen.',
  lease_expired: 'Die Lizenz konnte zu lange nicht beim Lizenzportal geprüft werden.',
  bad_token: 'Die Lizenzdatei ist ungültig oder beschädigt.',
}
const KEY_RE = /^[A-Z0-9]{4,6}(-[0-9A-Z]{5}){4}$/
const STEPS = ['Willkommen', 'Lizenz eintragen', 'Ergebnis']

const reasonText = (code, fallback) => REASONS[code] || fallback || 'Keine Lizenz eingetragen.'
const apiError = e => REASONS[e.response?.data?.code] || e.response?.data?.error || e.message
const fmtDate = d => d ? new Date(d).toLocaleDateString('de-DE') : 'unbefristet'
const fmtDateTime = d => d ? new Date(d).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '–'

function formatKey(v) {
  const clean = v.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const prefix = clean.match(/^[A-Z]{4}/)?.[0] || ''
  const rest = clean.slice(prefix.length).match(/.{1,5}/g) || []
  return [prefix, ...rest].filter(Boolean).join('-').slice(0, 29)
}

const S = {
  card: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:24, maxWidth:720, boxShadow:'var(--shadow)' },
  title: { fontSize:'1.05rem', fontWeight:700, color:'var(--text)', marginBottom:12, display:'flex', alignItems:'center', gap:10 },
  text: { color:'var(--text-2)', fontSize:'0.9rem', lineHeight:1.6 },
  list: { color:'var(--text-2)', fontSize:'0.83rem', lineHeight:1.7, paddingLeft:20, margin:'12px 0' },
  error: { background:'#FEF2F2', border:'1px solid #FECACA', color:'#DC2626', padding:'10px 14px', borderRadius:8, fontSize:'0.86rem', marginBottom:14 },
  input: { width:'100%', maxWidth:420, padding:'11px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--input-bg)', color:'var(--text)',
    fontFamily:'ui-monospace, Consolas, monospace', fontSize:'1.05rem', letterSpacing:'0.06em', boxSizing:'border-box', outline:'none' },
  textarea: { width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--input-bg)', color:'var(--text)',
    fontFamily:'ui-monospace, Consolas, monospace', fontSize:'0.78rem', boxSizing:'border-box', minHeight:120 },
  label: { display:'block', fontSize:'0.83rem', fontWeight:600, color:'var(--text)', marginBottom:6 },
  hint: { fontSize:'0.78rem', color:'var(--text-3)', marginTop:5 },
  actions: { display:'flex', gap:10, flexWrap:'wrap', marginTop:20 },
  fact: { background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px' },
  factLabel: { fontSize:'0.68rem', textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-3)' },
  factValue: { fontWeight:600, color:'var(--text)', wordBreak:'break-all', marginTop:2 },
}
const btn = (v = 'primary') => ({
  padding:'10px 20px', borderRadius:8, border: v === 'secondary' ? '1px solid var(--border)' : 'none',
  background: v === 'primary' ? 'var(--primary)' : v === 'danger' ? 'transparent' : 'var(--surface-2)',
  color: v === 'primary' ? 'white' : v === 'danger' ? '#EF4444' : 'var(--text)',
  fontWeight:600, fontSize:'0.88rem', cursor:'pointer', fontFamily:'var(--font)',
})
const circle = (active, done) => ({
  width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'0.8rem',
  background: done ? 'var(--success)' : active ? 'var(--primary)' : 'var(--border)', color: done || active ? 'white' : 'var(--text-3)',
})

/** Hinweis für Administratoren, solange keine gültige Lizenz eingetragen ist (in Layout.jsx). */
export function LicenseBanner() {
  const [status, setStatus] = useState(null)
  const location = useLocation()
  useEffect(() => {
    api.get('/license').then(r => setStatus(r.data)).catch(() => setStatus(null))
    const update = e => setStatus(e.detail)
    window.addEventListener('ldc:license', update)
    return () => window.removeEventListener('ldc:license', update)
  }, [])
  if (!status || status.state === 'valid' || location.pathname.startsWith('/license')) return null
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:16, padding:'10px 14px',
      borderRadius:10, border:`1px solid ${status.enforce ? '#FECACA' : '#FED7AA'}`, background: status.enforce ? '#FEF2F2' : '#FFF7ED',
      color: status.enforce ? '#DC2626' : '#92400E', fontSize:'0.88rem', fontWeight:500 }}>
      <span>{status.state === 'invalid' ? `Die Lizenz ist ungültig: ${reasonText(status.reason, status.message)}` : 'Für diese Installation ist noch keine Lizenz eingetragen.'}</span>
      <Link to="/license" style={{ ...btn(), padding:'7px 14px', textDecoration:'none' }}>Lizenz-Assistent öffnen</Link>
    </div>
  )
}

export default function LicensePage() {
  const [status, setStatus] = useState(null)
  const [step, setStep] = useState(null)
  const [mode, setMode] = useState('key')
  const [key, setKey] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const apply = s => {
    setStatus(s)
    window.dispatchEvent(new CustomEvent('ldc:license', { detail: s }))
  }
  useEffect(() => { api.get('/license').then(r => setStatus(r.data)).catch(e => setError(apiError(e))) }, [])

  if (!status) return <div style={S.text}>{error || 'Lade …'}</div>
  const current = step ?? (status.state === 'valid' ? 3 : 1)
  const l = status.license

  const submit = async e => {
    e.preventDefault()
    setError(null)
    if (mode === 'key' && !KEY_RE.test(key)) return setError('Der Schlüssel hat nicht das erwartete Format (z. B. LDCN-XXXXX-XXXXX-XXXXX-XXXXX).')
    setBusy(true)
    try {
      const r = mode === 'key'
        ? await api.post('/license/activate', { key })
        : await api.post('/license/offline', { token: token.trim() })
      apply(r.data)
      setStep(3)
    } catch (err) {
      setError(apiError(err))
    } finally {
      setBusy(false)
    }
  }
  const refresh = async () => {
    setBusy(true)
    try { apply((await api.post('/license/refresh')).data) } catch (err) { setError(apiError(err)) } finally { setBusy(false) }
  }
  const deactivate = async () => {
    if (!window.confirm('Diese Installation beim Lizenzportal abmelden? Der Platz wird frei, z. B. für einen neuen Server.')) return
    try { apply((await api.post('/license/deactivate')).data); setStep(1) } catch (err) { setError(apiError(err)) }
  }

  return (
    <div>
      <h1 style={{ fontSize:'1.4rem', fontWeight:800, color:'var(--text)', marginBottom:4 }}>🔑 Lizenz</h1>
      <p style={{ ...S.text, marginBottom:18 }}>Lizenz dieser LD-Connect-Installation eintragen und prüfen.</p>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:18 }}>
        {STEPS.map((label, i) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 12px 5px 5px', borderRadius:99,
            border:`1px solid ${current === i + 1 ? 'var(--primary)' : 'var(--border)'}`, background:'var(--surface)',
            color: current === i + 1 ? 'var(--text)' : 'var(--text-3)', fontSize:'0.83rem', fontWeight:600 }}>
            <span style={circle(current === i + 1, current > i + 1)}>{current > i + 1 ? '✓' : i + 1}</span>{label}
          </div>
        ))}
      </div>

      {current === 1 && (
        <div style={S.card}>
          <div style={S.title}>Lizenz für LD Connect</div>
          {status.state === 'invalid' && <div style={S.error}>{reasonText(status.reason, status.message)}</div>}
          <p style={S.text}>Mit dem Lizenzschlüssel wird diese Installation beim Lizenzportal angemeldet. Den Schlüssel finden Sie in der
            Bestätigungs-E-Mail oder im Kundenkonto unter <a href="https://lizenzen.lukasdroeger.de/konto/" target="_blank" rel="noreferrer" style={{ color:'var(--primary)' }}>lizenzen.lukasdroeger.de</a>.</p>
          <ul style={S.list}>
            <li>LD Connect prüft die Lizenz einmal täglich über eine ausgehende HTTPS-Verbindung zu <code>{status.server}</code>.</li>
            <li>Ist das Lizenzportal nicht erreichbar, läuft LD Connect mit der zuletzt geprüften Lizenz bis zu 14 Tage weiter.</li>
            <li>Server ohne Internetzugang erhalten eine Offline-Lizenz.</li>
          </ul>
          <div style={S.actions}>
            <button style={btn()} onClick={() => setStep(2)}>Weiter</button>
            {l && <button style={btn('secondary')} onClick={() => setStep(3)}>Aktuelle Lizenz anzeigen</button>}
          </div>
        </div>
      )}

      {current === 2 && (
        <form style={S.card} onSubmit={submit}>
          <div style={S.title}>Lizenz eintragen</div>
          <div style={{ display:'inline-flex', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom:14 }}>
            {[['key', 'Lizenzschlüssel'], ['offline', 'Offline-Lizenz']].map(([m, label]) => (
              <button type="button" key={m} onClick={() => { setMode(m); setError(null) }}
                style={{ border:'none', padding:'7px 14px', cursor:'pointer', fontFamily:'var(--font)', fontSize:'0.83rem',
                  background: mode === m ? 'var(--primary-light)' : 'var(--surface)', color: mode === m ? 'var(--primary)' : 'var(--text-2)', fontWeight: mode === m ? 600 : 500 }}>
                {label}
              </button>
            ))}
          </div>
          {error && <div style={S.error}>{error}</div>}
          {mode === 'key' ? (
            <div>
              <label style={S.label} htmlFor="lic-key">Lizenzschlüssel</label>
              <input id="lic-key" autoFocus autoComplete="off" spellCheck={false} placeholder="LDCN-XXXXX-XXXXX-XXXXX-XXXXX"
                style={S.input} value={key} onChange={e => setKey(formatKey(e.target.value))} />
              <div style={S.hint}>Groß- und Kleinschreibung sowie Bindestriche sind egal.</div>
            </div>
          ) : (
            <div>
              <label style={S.label} htmlFor="lic-token">Inhalt der Lizenzdatei</label>
              <textarea id="lic-token" spellCheck={false} placeholder="LIC1.…" style={S.textarea} value={token} onChange={e => setToken(e.target.value)} />
              <label style={{ ...S.hint, color:'var(--primary)', cursor:'pointer', display:'inline-block' }}>
                Datei auswählen
                <input type="file" accept=".lic,.txt" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) setToken((await f.text()).trim()) }} />
              </label>
            </div>
          )}
          <div style={S.actions}>
            <button type="button" style={btn('secondary')} onClick={() => { setStep(1); setError(null) }}>Zurück</button>
            <button type="submit" style={{ ...btn(), opacity: busy ? 0.6 : 1 }} disabled={busy || (mode === 'key' ? !key : !token.trim())}>
              {busy ? 'Prüfe …' : mode === 'key' ? 'Lizenz prüfen und aktivieren' : 'Offline-Lizenz einspielen'}
            </button>
          </div>
        </form>
      )}

      {current === 3 && (
        <div style={S.card}>
          <div style={S.title}>{status.state === 'valid' ? '✅ LD Connect ist lizenziert' : '❌ Keine gültige Lizenz'}</div>
          {error && <div style={S.error}>{error}</div>}
          {status.state === 'valid' && l ? (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:10, marginBottom:14 }}>
                {[['Tarif', `${l.planName || l.plan || '–'}${l.trial ? ' (Test)' : ''}`], ['Lizenznehmer', l.licensee || '–'], ['Gültig bis', fmtDate(l.validUntil)], ['Schlüssel', l.key]].map(([k, v]) => (
                  <div key={k} style={S.fact}><div style={S.factLabel}>{k}</div><div style={S.factValue}>{v}</div></div>
                ))}
              </div>
              <div style={{ fontWeight:700, fontSize:'0.88rem', color:'var(--text)', marginBottom:4 }}>Freigeschaltete Funktionen</div>
              <ul style={{ ...S.list, columns:2, marginTop:4 }}>{l.features.map(f => <li key={f}>{FEATURES[f] || f}</li>)}</ul>
              <p style={{ ...S.hint, fontSize:'0.82rem' }}>
                {Object.keys(l.limits || {}).length ? `Grenzen: ${Object.entries(l.limits).map(([k, v]) => `${LIMITS[k] || k}: ${v}`).join(' · ')}` : 'Keine Mengenbegrenzung.'}
                {l.addons?.length ? ` · Zusatzmodule: ${l.addons.join(', ')}` : ''}
              </p>
              <p style={S.hint}>Zuletzt geprüft: {fmtDateTime(status.lastCheck)}
                {status.offline ? ' · Lizenzportal zuletzt nicht erreichbar, die Lizenz gilt vorerst weiter' : ''}
                {l.leaseUntil ? ` · ohne Verbindung gültig bis ${fmtDateTime(l.leaseUntil)}` : ''}</p>
            </>
          ) : (
            <div style={S.error}>{reasonText(status.reason, status.message)}</div>
          )}
          <div style={S.actions}>
            {status.state === 'valid' && <button style={btn('secondary')} disabled={busy} onClick={refresh}>{busy ? 'Prüfe …' : 'Jetzt beim Lizenzportal prüfen'}</button>}
            <button style={btn(status.state === 'valid' ? 'secondary' : 'primary')} onClick={() => { setStep(2); setError(null) }}>
              {status.state === 'valid' ? 'Andere Lizenz eintragen' : 'Lizenz eintragen'}
            </button>
            {l && <button style={btn('danger')} onClick={deactivate}>Installation abmelden</button>}
          </div>
          {!status.enforce && <p style={{ ...S.hint, marginTop:14 }}>Hinweis: Die Lizenz wird derzeit nur angezeigt, Funktionen werden nicht gesperrt.</p>}
        </div>
      )}

      <p style={{ ...S.hint, marginTop:14 }}>Installations-ID: <code>{status.instanceId}</code></p>
    </div>
  )
}
