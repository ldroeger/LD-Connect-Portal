import React, { useState, useEffect } from 'react'
import api from '../utils/api.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useLang } from '../contexts/LanguageContext.jsx'
import { tr } from '../i18n/translations.js'

const card = { background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)', padding:20, boxShadow:'var(--shadow)', marginBottom:12 }
const inp = { width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:'0.88rem', fontFamily:'var(--font)', outline:'none', boxSizing:'border-box', background:'var(--surface)', color:'var(--text)', marginBottom:12 }
const lbl = { display:'block', fontSize:'0.82rem', fontWeight:600, color:'var(--text)', marginBottom:5 }
const btn = (v='primary') => ({ padding:'8px 16px', borderRadius:8, border:v==='secondary'?'1px solid var(--border)':'none', background:v==='primary'?'var(--primary)':v==='danger'?'#EF4444':'var(--surface-2)', color:v==='secondary'?'var(--text)':'white', fontWeight:600, fontSize:'0.84rem', cursor:'pointer', fontFamily:'var(--font)' })

export default function NewsPage() {
  const { user } = useAuth()
  const { lang } = useLang()
  const [news, setNews] = useState([])
  const [form, setForm] = useState({ title:'', content:'' })
  const [editing, setEditing] = useState(null)
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')

  const canRead = user?.features?.news_read !== false
  const canManage = user?.role === 'admin' || !!user?.features?.news_write

  if (!canRead) return (
    <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-3)' }}>
      <div style={{ fontSize:'3rem', marginBottom:16 }}>🔒</div>
      <div style={{ fontWeight:600, fontSize:'1rem' }}>Kein Zugriff</div>
      <div style={{ fontSize:'0.85rem', marginTop:8 }}>News sind für Ihr Konto nicht aktiviert.</div>
    </div>
  )
  const load = () => api.get('/display/news').then(r => setNews(r.data.news))
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.title) return setErr('Titel erforderlich')
    setErr('')
    try {
      if (editing) { await api.put(`/display/news/${editing}`, form); setEditing(null) }
      else await api.post('/display/news', form)
      setForm({ title:'', content:'' }); setMsg('Gespeichert'); load()
    } catch(e) { setErr(e.response?.data?.error || 'Fehler') }
  }

  return (
    <div style={{ maxWidth:1200 }}>
      <h1 style={{ fontSize:'1.2rem', fontWeight:700, marginBottom:4 }}>📰 News</h1>
      <p style={{ color:'var(--text-3)', fontSize:'0.85rem', marginBottom:20 }}>Nachrichten für den Mitarbeiterbildschirm</p>

      {canManage && (
        <div style={card}>
          <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:14 }}>{editing ? 'News bearbeiten' : 'Neue News erstellen'}</div>
          {err && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'var(--error)', padding:'10px 14px', borderRadius:8, fontSize:'0.85rem', marginBottom:12 }}>{err}</div>}
          {msg && <div style={{ background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', color:'var(--success)', padding:'10px 14px', borderRadius:8, fontSize:'0.85rem', marginBottom:12 }}>{msg}</div>}
          <div><label style={lbl}>Titel *</label><input style={inp} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Neuigkeit..." /></div>
          <div><label style={lbl}>Inhalt (optional)</label><textarea style={{...inp, minHeight:80, resize:'vertical'}} value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} placeholder="Beschreibung..." /></div>
          <div style={{ display:'flex', gap:8 }}>
            <button style={{...btn(), flex:1}} onClick={save}>{editing ? 'Speichern' : '+ Erstellen'}</button>
            {editing && <button style={btn('secondary')} onClick={() => { setEditing(null); setForm({ title:'', content:'' }) }}>Abbrechen</button>}
          </div>
        </div>
      )}

      <div>
        {news.length === 0 && <div style={{ ...card, textAlign:'center', color:'var(--text-3)' }}>Noch keine News vorhanden.</div>}
        {news.map(n => (
          <div key={n.id} style={{ ...card, borderLeft:`3px solid ${n.is_active?'#10B981':'var(--border)'}`, opacity:n.is_active?1:0.55 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:'0.95rem', marginBottom:4, display:'flex', alignItems:'center', gap:8 }}>
                  {n.title}
                  {!n.is_active && <span style={{ fontSize:'0.72rem', padding:'2px 8px', borderRadius:10, background:'var(--surface-2)', color:'var(--text-3)' }}>Ausgeblendet</span>}
                </div>
                {n.content && <div style={{ fontSize:'0.85rem', color:'var(--text-2)', lineHeight:1.5 }}>{n.content}</div>}
                <div style={{ fontSize:'0.75rem', color:'var(--text-3)', marginTop:6 }}>{n.author_name} · {new Date(n.created_at*1000).toLocaleDateString('de-DE')}</div>
              </div>
              {canManage && (
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button style={{...btn('secondary'), fontSize:'0.78rem', padding:'5px 10px'}} onClick={() => { setEditing(n.id); setForm({ title:n.title, content:n.content||'' }); window.scrollTo(0,0) }}>✏️</button>
                  <button style={{...btn('secondary'), fontSize:'0.78rem', padding:'5px 10px'}} onClick={() => api.put(`/display/news/${n.id}`, { is_active:n.is_active?0:1 }).then(load)}>
                    {n.is_active ? '🙈' : '👁'}
                  </button>
                  <button style={{...btn('danger'), fontSize:'0.78rem', padding:'5px 10px'}} onClick={() => { if(window.confirm('Löschen?')) api.delete(`/display/news/${n.id}`).then(load) }}>✕</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
