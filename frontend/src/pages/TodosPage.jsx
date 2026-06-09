import React, { useState, useEffect } from 'react'
import api from '../utils/api.js'
import { useAuth } from '../contexts/AuthContext.jsx'

const card = { background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)', padding:20, boxShadow:'var(--shadow)', marginBottom:12 }
const inp  = { width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:'0.88rem', fontFamily:'var(--font)', outline:'none', boxSizing:'border-box', background:'var(--surface)', color:'var(--text)', marginBottom:12 }
const lbl  = { display:'block', fontSize:'0.82rem', fontWeight:600, color:'var(--text)', marginBottom:5 }
const btn  = (v='primary') => ({ padding:'8px 16px', borderRadius:8, border:v==='secondary'?'1px solid var(--border)':'none', background:v==='primary'?'var(--primary)':v==='danger'?'#EF4444':v==='success'?'#10B981':v==='warn'?'#F59E0B':'var(--surface-2)', color:v==='secondary'?'var(--text)':'white', fontWeight:600, fontSize:'0.84rem', cursor:'pointer', fontFamily:'var(--font)' })

export default function TodosPage() {
  const { user } = useAuth()
  const [todos, setTodos] = useState([])
  const [form, setForm]   = useState({ title:'', description:'' })
  const [msg, setMsg]     = useState('')
  const [err, setErr]     = useState('')

  const canRead   = user?.role === 'admin' || user?.features?.todos_read !== false
  const canManage = user?.role === 'admin' || !!user?.features?.todos_create

  if (!canRead) return (
    <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-3)' }}>
      <div style={{ fontSize:'3rem', marginBottom:16 }}>🔒</div>
      <div style={{ fontWeight:600, fontSize:'1rem' }}>Kein Zugriff</div>
    </div>
  )

  const load = () => api.get('/display/todos').then(r => setTodos(r.data.todos))
  useEffect(() => { load() }, [])

  const create = async () => {
    if (!form.title) return setErr('Titel erforderlich')
    setErr('')
    try { await api.post('/display/todos', form); setForm({ title:'', description:'' }); setMsg('Aufgabe erstellt'); load() }
    catch(e) { setErr(e.response?.data?.error || 'Fehler') }
  }

  const complete = async (id) => {
    try { await api.post(`/display/todos/${id}/complete`); load() }
    catch(e) { alert(e.response?.data?.error || 'Fehler') }
  }

  const confirm = async (id) => {
    try { await api.post(`/display/todos/${id}/confirm`); setMsg('Archiviert'); load() }
    catch(e) { alert(e.response?.data?.error || 'Fehler') }
  }

  const reopen = async (id) => {
    try { await api.post(`/display/todos/${id}/reopen`); setMsg('Aufgabe wieder geöffnet'); load() }
    catch(e) { alert(e.response?.data?.error || 'Fehler') }
  }

  const remove = async (id) => {
    if (!window.confirm('Aufgabe wirklich löschen?')) return
    try { await api.delete(`/display/todos/${id}`); load() }
    catch(e) { alert(e.response?.data?.error || 'Fehler') }
  }

  const active   = todos.filter(t =>  t.is_active)
  const archived = todos.filter(t => !t.is_active)
  const myId     = user?.id

  // Ob breites Layout (2 Spalten) genutzt wird — via CSS-Klasse
  return (
    <div style={{ width:'100%' }}>
      <h1 style={{ fontSize:'1.2rem', fontWeight:700, marginBottom:4 }}>✅ Aufgaben</h1>
      <p style={{ color:'var(--text-3)', fontSize:'0.85rem', marginBottom:20 }}>Aufgaben für den Mitarbeiterbildschirm</p>

      {/* 2-Spalten-Layout: links Aktiv, rechts Archiv */}
      <div style={{ display:'grid', gridTemplateColumns: archived.length > 0 ? 'minmax(0,1fr) minmax(0,380px)' : '1fr', gap:24, alignItems:'start' }}>

        {/* ── Linke Spalte: Formular + Aktive Aufgaben ── */}
        <div>
          {canManage && (
            <div style={card}>
              <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:14 }}>Neue Aufgabe erstellen</div>
              {err && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'var(--error)', padding:'10px 14px', borderRadius:8, fontSize:'0.85rem', marginBottom:12 }}>{err}</div>}
              {msg && <div style={{ background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', color:'var(--success)', padding:'10px 14px', borderRadius:8, fontSize:'0.85rem', marginBottom:12 }}>{msg}</div>}
              <div><label style={lbl}>Titel *</label><input style={inp} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Was ist zu tun?" /></div>
              <div><label style={lbl}>Beschreibung (optional)</label><textarea style={{...inp, minHeight:70, resize:'vertical'}} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Details..." /></div>
              <button style={{...btn(), width:'100%'}} onClick={create}>+ Aufgabe erstellen</button>
            </div>
          )}

          {active.length === 0
            ? <div style={{ ...card, textAlign:'center', color:'var(--text-3)' }}>Keine offenen Aufgaben.</div>
            : active.map(t => {
              const allDone = t.completions && t.completions.length > 0
              return (
                <div key={t.id} style={{ ...card, borderLeft:'3px solid #F59E0B' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:'0.95rem', marginBottom:4 }}>{t.title}</div>
                      {t.description && <div style={{ fontSize:'0.85rem', color:'var(--text-2)', lineHeight:1.5, marginBottom:8 }}>{t.description}</div>}
                      <div style={{ fontSize:'0.75rem', color:'var(--text-3)' }}>{t.author_name} · {new Date(t.created_at*1000).toLocaleDateString('de-DE')}</div>
                      {t.completions && t.completions.length > 0 && (
                        <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:4 }}>
                          {t.completions.map((c,i) => (
                            <div key={i} style={{ fontSize:'0.78rem', color:'var(--success)', display:'flex', alignItems:'center', gap:6, padding:'4px 8px', background:'rgba(16,185,129,0.08)', borderRadius:6 }}>
                              <span>✓</span><span style={{ fontWeight:600 }}>{c.name}</span><span style={{ color:'var(--text-3)' }}>· {c.date}</span>
                              {c.confirmed && <span style={{ color:'#6366F1', fontWeight:600 }}>· archiviert</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end' }}>
                      <button style={{...btn('success'), fontSize:'0.82rem'}} onClick={() => complete(t.id)}>✓ Erledigt</button>
                      {canManage && allDone && (
                        <button style={{...btn(), fontSize:'0.82rem', background:'#6366F1'}} onClick={() => confirm(t.id)}>📦 Archivieren</button>
                      )}
                      {canManage && (
                        <button style={{...btn('danger'), fontSize:'0.78rem', padding:'5px 10px'}} onClick={() => remove(t.id)}>✕</button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          }
        </div>

        {/* ── Rechte Spalte: Archiv ── */}
        {archived.length > 0 && (
          <div>
            <div style={{ fontWeight:700, fontSize:'0.9rem', color:'var(--text-3)', textTransform:'uppercase',
              letterSpacing:'0.06em', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
              <span>📦 Archiv</span>
              <span style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:20,
                padding:'2px 10px', fontSize:'0.78rem', fontWeight:600, color:'var(--text-2)' }}>
                {archived.length}
              </span>
            </div>
            {archived.map(t => (
              <div key={t.id} style={{ ...card, opacity:0.75, borderLeft:'3px solid var(--border)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:'0.9rem', marginBottom:4 }}>{t.title}</div>
                    {t.description && <div style={{ fontSize:'0.8rem', color:'var(--text-3)', marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.description}</div>}
                    {t.completions && t.completions.map((c,i) => (
                      <div key={i} style={{ fontSize:'0.75rem', color:'var(--success)', marginTop:2 }}>✓ {c.name} · {c.date}</div>
                    ))}
                  </div>
                  {canManage && (
                    <div style={{ display:'flex', flexDirection:'column', gap:4, flexShrink:0 }}>
                      <button style={{...btn('warn'), fontSize:'0.75rem', padding:'4px 8px'}} onClick={() => reopen(t.id)}
                        title="Wieder öffnen">
                        🔄 Öffnen
                      </button>
                      <button style={{...btn('danger'), fontSize:'0.75rem', padding:'4px 8px'}} onClick={() => remove(t.id)}
                        title="Löschen">
                        🗑 Löschen
                      </button>
                    </div>
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
