import React, { useState, useEffect } from 'react'
import api from '../utils/api.js'
import { useAuth } from '../contexts/AuthContext.jsx'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' })
}

function calcDays(from, to) {
  const d = Math.round((new Date(to) - new Date(from)) / 86400000) + 1
  return d > 0 ? d : 1
}

export default function SickPage() {
  const { user, isAdmin } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ from_date: '', to_date: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    api.get('/sick').then(r => {
      setReports(r.data.sick_reports || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const submit = async () => {
    if (!form.from_date || !form.to_date) return setError('Bitte Datum auswählen')
    if (form.to_date < form.from_date) return setError('Enddatum vor Startdatum')
    setSaving(true); setError('')
    try {
      await api.post('/sick', form)
      setForm({ from_date: '', to_date: '', note: '' })
      setShowForm(false)
      load()
    } catch(e) {
      setError(e.response?.data?.error || 'Fehler beim Speichern')
    }
    setSaving(false)
  }

  const del = async (id) => {
    if (!confirm('Krankmeldung wirklich löschen?')) return
    await api.delete(`/sick/${id}`).catch(() => {})
    load()
  }


  return (
    <div style={{ maxWidth:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:'1.3rem', fontWeight:800 }}>🤒 Krankmeldungen</h1>
          <p style={{ color:'var(--text-3)', fontSize:'0.85rem', marginTop:2 }}>
            {isAdmin ? 'Alle Mitarbeiter' : 'Meine Krankmeldungen'}
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding:'8px 18px', borderRadius:10, border:'none', cursor:'pointer',
            background:'var(--primary)', color:'white', fontFamily:'var(--font)', fontWeight:600, fontSize:'0.88rem' }}>
          {showForm ? '✕ Abbrechen' : '+ Krankmeldung'}
        </button>
      </div>

      {/* Hinweis telefonische Meldung */}
      <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:12,
        padding:'14px 18px', marginBottom:16, display:'flex', gap:12, alignItems:'flex-start' }}>
        <span style={{ fontSize:'1.4rem', flexShrink:0 }}>📞</span>
        <div>
          <div style={{ fontWeight:700, fontSize:'0.9rem', color:'#991B1B', marginBottom:4 }}>
            Wichtiger Hinweis
          </div>
          <div style={{ fontSize:'0.84rem', color:'#991B1B', lineHeight:1.6 }}>
            Bitte melden Sie sich <strong>vor jeder Krankmeldung telefonisch im Büro</strong>.
            Die Eintragung hier ersetzt <strong>nicht</strong> die persönliche Krankmeldung.
          </div>
        </div>
      </div>

      {/* Formular */}
      {showForm && (
        <div style={{ background:'var(--surface)', borderRadius:14, border:'1px solid var(--border)',
          padding:24, boxShadow:'var(--shadow)', marginBottom:24 }}>
          <div style={{ fontWeight:700, marginBottom:16 }}>Neue Krankmeldung</div>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:12 }}>
            <div>
              <div style={{ fontSize:'0.8rem', color:'var(--text-3)', marginBottom:4 }}>Von</div>
              <input type="date" value={form.from_date}
                onChange={e => setForm(f => ({ ...f, from_date: e.target.value, to_date: f.to_date || e.target.value }))}
                style={{ padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)',
                  background:'var(--surface-2)', color:'var(--text)', fontFamily:'var(--font)', fontSize:'0.9rem' }} />
            </div>
            <div>
              <div style={{ fontSize:'0.8rem', color:'var(--text-3)', marginBottom:4 }}>Bis</div>
              <input type="date" value={form.to_date} min={form.from_date || undefined}
                onChange={e => setForm(f => ({ ...f, to_date: e.target.value }))}
                style={{ padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)',
                  background:'var(--surface-2)', color:'var(--text)', fontFamily:'var(--font)', fontSize:'0.9rem' }} />
            </div>
            {form.from_date && form.to_date && (
              <div style={{ display:'flex', alignItems:'flex-end', paddingBottom:2 }}>
                <span style={{ fontSize:'0.85rem', color:'var(--text-3)' }}>
                  {calcDays(form.from_date, form.to_date)} Tag{calcDays(form.from_date, form.to_date) !== 1 ? 'e' : ''}
                </span>
              </div>
            )}
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:'0.8rem', color:'var(--text-3)', marginBottom:4 }}>Notiz (optional)</div>
            <input type="text" value={form.note} placeholder="z.B. Erkältung, Rücken..."
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)',
                background:'var(--surface-2)', color:'var(--text)', fontFamily:'var(--font)', fontSize:'0.9rem',
                boxSizing:'border-box' }} />
          </div>
          {error && <div style={{ color:'var(--error)', fontSize:'0.85rem', marginBottom:12 }}>{error}</div>}
          <button onClick={submit} disabled={saving}
            style={{ padding:'8px 20px', borderRadius:8, border:'none', cursor:'pointer',
              background:'var(--primary)', color:'white', fontFamily:'var(--font)', fontWeight:600 }}>
            {saving ? 'Wird gespeichert...' : 'Krankmeldung einreichen'}
          </button>
        </div>
      )}

      {/* Liste */}
      <div style={{ background:'var(--surface)', borderRadius:14, border:'1px solid var(--border)', padding:20, boxShadow:'var(--shadow)' }}>
        {loading ? (
          <div style={{ color:'var(--text-3)', textAlign:'center', padding:20 }}>Lädt...</div>
        ) : reports.length === 0 ? (
          <div style={{ color:'var(--text-3)', textAlign:'center', padding:20 }}>Keine Krankmeldungen vorhanden</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {reports.map(r => (
              <div key={r.id} style={{ display:'flex', gap:0, alignItems:'stretch', borderRadius:10,
                overflow:'hidden', border:'1px solid var(--border)' }}>
                <div style={{ width:4, background:'#8712441'.replace('#','#'), flexShrink:0,
                  background: 'rgb(135,18,69)' }} />
                <div style={{ flex:1, padding:'12px 14px', background:'var(--surface-2)',
                  display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                  <div>
                    {isAdmin && (
                      <div style={{ fontWeight:700, fontSize:'0.88rem', marginBottom:3 }}>
                        👤 {r.user_name || r.powerbird_id || `User #${r.user_id}`}
                      </div>
                    )}
                    <div style={{ fontWeight:600, fontSize:'0.9rem' }}>
                      🤒 Krank · {fmtDate(r.from_date)} – {fmtDate(r.to_date)}
                      <span style={{ fontWeight:400, color:'var(--text-3)', marginLeft:8, fontSize:'0.82rem' }}>
                        ({calcDays(r.from_date, r.to_date)} Tag{calcDays(r.from_date, r.to_date) !== 1 ? 'e' : ''})
                      </span>
                    </div>
                    {r.note && <div style={{ fontSize:'0.8rem', color:'var(--text-3)', marginTop:2 }}>{r.note}</div>}
                    <div style={{ fontSize:'0.75rem', color:'var(--text-3)', marginTop:3 }}>
                      Eingetragen: {fmtDate(r.created_at)}
                      {r.hwter_recno && <span style={{ marginLeft:8, color:'var(--success)' }}>✓ Powerbird</span>}
                    </div>
                  </div>
                  {(isAdmin || r.user_id === user?.id) && (
                    <button onClick={() => del(r.id)}
                      style={{ padding:'5px 12px', borderRadius:8, border:'1px solid var(--border)',
                        background:'var(--surface)', color:'var(--error)', cursor:'pointer',
                        fontFamily:'var(--font)', fontSize:'0.8rem' }}>
                      Löschen
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
