import React, { useState, useEffect } from 'react'
import api from '../utils/api.js'
import { useAuth } from '../contexts/AuthContext.jsx'

const card = { background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)', padding:20, boxShadow:'var(--shadow)', marginBottom:12 }
const inp = { width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:'0.88rem', fontFamily:'var(--font)', outline:'none', boxSizing:'border-box', background:'var(--surface)', color:'var(--text)', marginBottom:12 }
const lbl = { display:'block', fontSize:'0.82rem', fontWeight:600, color:'var(--text)', marginBottom:5 }
const btn = (v='primary') => ({ padding:'8px 16px', borderRadius:8, border:v==='secondary'?'1px solid var(--border)':'none', background:v==='primary'?'var(--primary)':v==='danger'?'#EF4444':v==='success'?'#10B981':'var(--surface-2)', color:v==='secondary'?'var(--text)':'white', fontWeight:600, fontSize:'0.84rem', cursor:'pointer', fontFamily:'var(--font)' })

export default function TodosPage() {
  const { user } = useAuth()
  const [todos, setTodos] = useState([])
  const [showArchive, setShowArchive] = useState(false)
  const [form, setForm] = useState({ title:'', description:'' })
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')

  const canRead = user?.role === 'admin' || user?.role === 'news_manager' || user?.features?.todos_read !== false
  const canManage = user?.role === 'admin' || !!user?.features?.todos_create

  if (!canRead) return (
    <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-3)' }}>
      <div style={{ fontSize:'3rem', marginBottom:16 }}>🔒</div>
      <div style={{ fontWeight:600, fontSize:'1rem' }}>Kein Zugriff</div>
      <div style={{ fontSize:'0.85rem', marginTop:8 }}>Aufgaben sind für Ihr Konto nicht aktiviert.</div>
    </div>
  )
  const load = () => api.get('/display/todos').then(r => setTodos(r.data.todos))
  useEffect(() => { load() }, [])

  const create = async () => {
    if (!form.title) return setErr('Titel erforderlich')
    setErr('')
    try {
      await api.post('/display/todos', form)
      setForm({ title:'', description:'' }); setMsg('Aufgabe erstellt'); load()
    } catch(e) { setErr(e.response?.data?.error || 'Fehler') }
  }

  const complete = async (id) => {
    try { await api.post(`/display/todos/${id}/complete`); load() }
    catch(e) { alert(e.response?.data?.error || 'Fehler') }
  }

  const confirm = async (id) => {
    try { await api.post(`/display/todos/${id}/confirm`); setMsg('Archiviert'); load() }
    catch(e) { alert(e.response?.data?.error || 'Fehler') }
  }

  const active = todos.filter(t => t.is_active)
  const archived = todos.filter(t => !t.is_active)
  const myId = user?.id

  return (
    <div style={{ maxWidth:1200 }}>
      <h1 style={{ fontSize:'1.2rem', fontWeight:700, marginBottom:4 }}>✅ Aufgaben</h1>
      <p style={{ color:'var(--text-3)', fontSize:'0.85rem', marginBottom:20 }}>Aufgaben für den Mitarbeiterbildschirm</p>

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

      {/* Active todos */}
      {active.length === 0
        ? <div style={{ ...card, textAlign:'center', color:'var(--text-3)' }}>Keine offenen Aufgaben.</div>
        : active.map(t => {
          const myCompletion = t.completions?.find(c => c.userId === myId)
          const allDone = t.completions && t.completions.length > 0
          return (
            <div key={t.id} style={{ ...card, borderLeft:`3px solid #F59E0B` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:'0.95rem', marginBottom:4 }}>{t.title}</div>
                  {t.description && <div style={{ fontSize:'0.85rem', color:'var(--text-2)', lineHeight:1.5, marginBottom:8 }}>{t.description}</div>}
                  <div style={{ fontSize:'0.75rem', color:'var(--text-3)' }}>{t.author_name} · {new Date(t.created_at*1000).toLocaleDateString('de-DE')}</div>

                  {/* Completions */}
                  {t.completions && t.completions.length > 0 && (
                    <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:4 }}>
                      {t.completions.map((c,i) => (
                        <div key={i} style={{ fontSize:'0.78rem', color:'var(--success)', display:'flex', alignItems:'center', gap:6, padding:'4px 8px', background:'rgba(16,185,129,0.08)', borderRadius:6 }}>
                          <span>✓</span>
                          <span style={{ fontWeight:600 }}>{c.name}</span>
                          <span style={{ color:'var(--text-3)' }}>· {c.date}</span>
                          {c.confirmed && <span style={{ color:'#6366F1', fontWeight:600 }}>· archiviert</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end' }}>
                  {/* Complete button for any user */}
                  <button style={{...btn('success'), fontSize:'0.82rem'}} onClick={() => complete(t.id)}>
                    ✓ Als erledigt markieren
                  </button>
                  {/* Confirm + archive for managers */}
                  {canManage && allDone && (
                    <button style={{...btn(), fontSize:'0.82rem', background:'#6366F1'}} onClick={() => confirm(t.id)}>
                      📦 Archivieren
                    </button>
                  )}
                  {canManage && (
                    <button style={{...btn('danger'), fontSize:'0.78rem', padding:'5px 10px'}} onClick={() => { if(window.confirm('Löschen?')) api.delete(`/display/todos/${t.id}`).then(load) }}>✕</button>
                  )}
                </div>
              </div>
            </div>
          )
        })
      }

      {/* Archive toggle */}
      {archived.length > 0 && (
        <div style={{ marginTop:20 }}>
          <button style={{...btn('secondary'), width:'100%'}} onClick={() => setShowArchive(s=>!s)}>
            📦 Archiv ({archived.length}) {showArchive ? '▲' : '▼'}
          </button>
          {showArchive && archived.map(t => (
            <div key={t.id} style={{ ...card, marginTop:8, opacity:0.6, borderLeft:'3px solid var(--border)' }}>
              <div style={{ fontWeight:600, fontSize:'0.9rem' }}>{t.title}</div>
              {t.completions && t.completions.map((c,i) => (
                <div key={i} style={{ fontSize:'0.75rem', color:'var(--success)', marginTop:4 }}>✓ {c.name} · {c.date}</div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
