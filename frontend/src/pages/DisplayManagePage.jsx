import React, { useState, useEffect } from 'react'
import api from '../utils/api.js'

const card = { background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)', padding:20, boxShadow:'var(--shadow)', marginBottom:16 }
const inp = { width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:'0.88rem', fontFamily:'var(--font)', outline:'none', boxSizing:'border-box', background:'var(--surface)', color:'var(--text)' }
const lbl = { display:'block', fontSize:'0.82rem', fontWeight:600, color:'var(--text)', marginBottom:5, marginTop:10 }
const btn = (v='primary') => ({ padding:'8px 16px', borderRadius:8, border:v==='secondary'?'1px solid var(--border)':'none', background:v==='primary'?'var(--primary)':v==='danger'?'#EF4444':'var(--surface-2)', color:v==='secondary'?'var(--text)':'white', fontWeight:600, fontSize:'0.84rem', cursor:'pointer', fontFamily:'var(--font)' })

function Toggle({ checked, onChange, label, desc }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'var(--surface-2)', borderRadius:8, marginBottom:8 }}>
      <div onClick={onChange} style={{ width:40, height:22, borderRadius:11, background:checked?'var(--success)':'var(--border)', cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
        <div style={{ position:'absolute', top:3, left:checked?20:3, width:16, height:16, borderRadius:'50%', background:'white', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
      </div>
      <div>
        <div style={{ fontWeight:500, fontSize:'0.88rem' }}>{label}</div>
        {desc && <div style={{ fontSize:'0.75rem', color:'var(--text-3)' }}>{desc}</div>}
      </div>
    </div>
  )
}

const THEMES = [
  { id:'dark', label:'🌙 Dunkel', desc:'Dunkler Hintergrund', bg:'#0f1420' },
  { id:'light', label:'☀️ Hell', desc:'Heller Hintergrund', bg:'#F1F5F9' },
  { id:'black', label:'⬛ Schwarz', desc:'Maximaler Kontrast', bg:'#000000' },
]

const emptyForm = { name:'', show_appointments:true, show_news:true, show_todos:true, show_all_users:false, theme:'dark', logo_url:'', logo_height:48, show_header_name:true, show_footer:true, touch_enabled:false, font_size:100, clock_size:100, scroll_speed:30, popup_auto_close:30 }

export default function DisplayManagePage() {
  const [screens, setScreens] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')

  const load = () => api.get('/display/screens').then(r => setScreens(r.data.screens))
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.name) return setErr('Name erforderlich')
    setErr('')
    try {
      if (editing) {
        await api.put(`/display/screens/${editing}`, form)
        setEditing(null)
        setMsg('Gespeichert')
      } else {
        const r = await api.post('/display/screens', form)
        setMsg(`Bildschirm erstellt! URL: ${r.data.url}`)
      }
      setForm(emptyForm); load()
    } catch(e) { setErr(e.response?.data?.error || 'Fehler') }
  }

  const startEdit = (s) => {
    setEditing(s.id)
    setForm({
      name: s.name,
      show_appointments: !!s.show_appointments,
      show_news: !!s.show_news,
      show_todos: !!s.show_todos,
      show_all_users: !!s.show_all_users,
      theme: s.theme || 'dark',
      logo_url: s.logo_url || '',
      logo_height: s.logo_height || 48,
      show_header_name: s.show_header_name !== 0,
      show_footer: s.show_footer !== 0,
      touch_enabled: !!s.touch_enabled,
      font_size: s.font_size || 100,
      clock_size: s.clock_size || 100,
      scroll_speed: s.scroll_speed || 30,
      popup_auto_close: s.popup_auto_close || 30,
      todo_archive_hours: s.todo_archive_hours || 24,
    })
    window.scrollTo(0, 0)
  }

  return (
    <div style={{ maxWidth:1200 }}>
      <h1 style={{ fontSize:'1.2rem', fontWeight:700, marginBottom:4 }}>🖥 Mitarbeiterbildschirm</h1>
      <p style={{ color:'var(--text-3)', fontSize:'0.85rem', marginBottom:20 }}>Öffentliche Anzeige für TV/Bildschirme im Betrieb</p>

      {/* Form */}
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:16 }}>{editing ? 'Bildschirm bearbeiten' : 'Neuen Bildschirm erstellen'}</div>
        {err && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'var(--error)', padding:'10px 14px', borderRadius:8, fontSize:'0.85rem', marginBottom:12 }}>{err}</div>}
        {msg && <div style={{ background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', color:'var(--success)', padding:'10px 14px', borderRadius:8, fontSize:'0.85rem', marginBottom:12 }}>{msg}</div>}

        <div><label style={{ ...lbl, marginTop:0 }}>Name *</label>
          <input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="z.B. Empfang, Werkstatt..." />
        </div>

        {/* Theme */}
        <label style={lbl}>Design</label>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:8 }}>
          {THEMES.map(t => (
            <div key={t.id} onClick={() => setForm(f=>({...f,theme:t.id}))}
              style={{ padding:'10px 12px', borderRadius:10, border:`2px solid ${form.theme===t.id?'var(--primary)':'var(--border)'}`, cursor:'pointer', background:form.theme===t.id?'var(--primary-light)':'var(--surface-2)', display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:20, height:20, borderRadius:4, background:t.bg, border:'1px solid var(--border)', flexShrink:0 }} />
              <div>
                <div style={{ fontSize:'0.82rem', fontWeight:600 }}>{t.label}</div>
                <div style={{ fontSize:'0.72rem', color:'var(--text-3)' }}>{t.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Logo */}
        <label style={lbl}>Logo (URL, leer = Firmenlogo aus Branding)</label>
        <input style={{ ...inp, marginBottom:8 }} value={form.logo_url} onChange={e=>setForm(f=>({...f,logo_url:e.target.value}))} placeholder="https://... oder leer lassen" />

        <label style={lbl}>Logo-Größe: {form.logo_height}px</label>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
          <input type="range" min="24" max="120" value={form.logo_height} onChange={e=>setForm(f=>({...f,logo_height:parseInt(e.target.value)}))} style={{ flex:1, accentColor:'var(--primary)' }} />
          <span style={{ fontFamily:'monospace', fontSize:'0.85rem', color:'var(--text-2)', width:50 }}>{form.logo_height}px</span>
        </div>
        {(form.logo_url) && (
          <div style={{ padding:12, background:'var(--surface-2)', borderRadius:8, display:'flex', justifyContent:'center', marginBottom:8 }}>
            <img src={form.logo_url} alt="Vorschau" style={{ height:`${form.logo_height}px`, maxWidth:'100%', objectFit:'contain' }} />
          </div>
        )}

        {/* Sections */}
        <label style={lbl}>Inhalte anzeigen</label>
        <Toggle checked={form.show_appointments} onChange={()=>setForm(f=>({...f,show_appointments:!f.show_appointments}))} label="📅 Termine" desc="Heutige Termine aller Mitarbeiter" />
        <Toggle checked={form.show_all_users} onChange={()=>setForm(f=>({...f,show_all_users:!f.show_all_users}))} label="👥 Alle Mitarbeiter anzeigen" desc="Auch Mitarbeiter ohne Termine heute anzeigen" />
        <Toggle checked={form.show_news} onChange={()=>setForm(f=>({...f,show_news:!f.show_news}))} label="📰 News" desc="Aktuelle Neuigkeiten" />
        <Toggle checked={form.show_todos} onChange={()=>setForm(f=>({...f,show_todos:!f.show_todos}))} label="✅ Aufgaben" desc="Zu erledigende Aufgaben" />

        <label style={lbl}>Kopfzeile & Fußzeile</label>
        <Toggle checked={form.show_header_name} onChange={()=>setForm(f=>({...f,show_header_name:!f.show_header_name}))} label="🏢 Firmenname & Bildschirmname anzeigen" desc="Im Header sichtbar" />
        <Toggle checked={form.show_footer} onChange={()=>setForm(f=>({...f,show_footer:!f.show_footer}))} label="📄 Fußzeile anzeigen" desc="Unterste Leiste" />

        <label style={lbl}>Touch-Modus</label>
        <Toggle checked={form.touch_enabled} onChange={()=>setForm(f=>({...f,touch_enabled:!f.touch_enabled}))} label="👆 Touch aktivieren" desc="Termine & Aufgaben antippen, Wochenkalender anzeigen" />

        <label style={lbl}>Schriftgröße: {form.font_size}%</label>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
          <input type="range" min="70" max="150" value={form.font_size} onChange={e=>setForm(f=>({...f,font_size:parseInt(e.target.value)}))} style={{ flex:1, accentColor:'var(--primary)' }} />
          <span style={{ fontFamily:'monospace', fontSize:'0.85rem', color:'var(--text-2)', width:45 }}>{form.font_size}%</span>
        </div>

        <label style={lbl}>Uhrzeitgröße: {form.clock_size}%</label>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
          <input type="range" min="50" max="200" value={form.clock_size} onChange={e=>setForm(f=>({...f,clock_size:parseInt(e.target.value)}))} style={{ flex:1, accentColor:'var(--primary)' }} />
          <span style={{ fontFamily:'monospace', fontSize:'0.85rem', color:'var(--text-2)', width:45 }}>{form.clock_size}%</span>
        </div>

        <label style={lbl}>Auto-Scroll Geschwindigkeit: {form.scroll_speed} px/s (nur wenn Touch deaktiviert)</label>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
          <input type="range" min="5" max="120" value={form.scroll_speed} onChange={e=>setForm(f=>({...f,scroll_speed:parseInt(e.target.value)}))} style={{ flex:1, accentColor:'var(--primary)' }} />
          <span style={{ fontFamily:'monospace', fontSize:'0.85rem', color:'var(--text-2)', width:55 }}>{form.scroll_speed} px/s</span>
        </div>

        <label style={lbl}>Popup automatisch schließen nach: {form.popup_auto_close}s (Touch-Modus)</label>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
          <input type="range" min="5" max="120" value={form.popup_auto_close} onChange={e=>setForm(f=>({...f,popup_auto_close:parseInt(e.target.value)}))} style={{ flex:1, accentColor:'var(--primary)' }} />
          <span style={{ fontFamily:'monospace', fontSize:'0.85rem', color:'var(--text-2)', width:45 }}>{form.popup_auto_close}s</span>
        </div>


        <div style={{ display:'flex', gap:8, marginTop:16 }}>
          <button style={{...btn(), flex:1}} onClick={save}>{editing ? 'Speichern' : '+ Bildschirm erstellen'}</button>
          {editing && <button style={btn('secondary')} onClick={() => { setEditing(null); setForm(emptyForm) }}>Abbrechen</button>}
        </div>
      </div>

      {/* Screen list */}
      {screens.map(s => (
        <div key={s.id} style={card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:'0.95rem', marginBottom:6, display:'flex', alignItems:'center', gap:8 }}>
                {s.name}
                <span style={{ fontSize:'0.72rem', padding:'2px 8px', borderRadius:10, background:'var(--surface-2)', color:'var(--text-3)' }}>
                  {THEMES.find(t=>t.id===s.theme)?.label || '🌙 Dunkel'}
                </span>
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                {!!s.show_appointments && <span style={{ fontSize:'0.72rem', padding:'2px 8px', borderRadius:10, background:'var(--primary-light)', color:'var(--primary)' }}>📅 Termine</span>}
                {!!s.show_all_users && <span style={{ fontSize:'0.72rem', padding:'2px 8px', borderRadius:10, background:'var(--primary-light)', color:'var(--primary)' }}>👥 Alle User</span>}
                {!!s.show_news && <span style={{ fontSize:'0.72rem', padding:'2px 8px', borderRadius:10, background:'rgba(16,185,129,0.1)', color:'var(--success)' }}>📰 News</span>}
                {!!s.show_todos && <span style={{ fontSize:'0.72rem', padding:'2px 8px', borderRadius:10, background:'rgba(245,158,11,0.1)', color:'var(--warning)' }}>✅ Todos</span>}
              </div>
              <div style={{ fontSize:'0.78rem', color:'var(--text-3)', fontFamily:'monospace', wordBreak:'break-all' }}>{s.url}</div>
            </div>
            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
              <button style={{...btn('secondary'), fontSize:'0.8rem'}} onClick={() => window.open(s.url, '_blank')}>🖥 Öffnen</button>
              <button style={{...btn('secondary'), fontSize:'0.8rem'}} onClick={() => { navigator.clipboard.writeText(s.url); setMsg('URL kopiert!') }}>📋</button>
              <button style={{...btn('secondary'), fontSize:'0.8rem'}} onClick={() => startEdit(s)}>✏️</button>
              <button style={{...btn('danger'), fontSize:'0.8rem'}} onClick={() => { if(window.confirm('Löschen?')) api.delete(`/display/screens/${s.id}`).then(load) }}>✕</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
