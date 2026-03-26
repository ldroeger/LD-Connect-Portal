import React, { useState, useEffect } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import api from '../utils/api.js'

const card = { background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)', padding:20, boxShadow:'var(--shadow)', marginBottom:16 }
const lbl = { display:'block', fontSize:'0.82rem', fontWeight:600, color:'var(--text)', marginBottom:5 }
const inp = { width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:'0.88rem', fontFamily:'var(--font)', outline:'none', marginBottom:12, boxSizing:'border-box' }
const btn = (v='primary') => ({ padding:'9px 18px', borderRadius:8, border:v==='secondary'?'1px solid var(--border)':'none', background:v==='primary'?'var(--primary)':v==='danger'?'#EF4444':'var(--surface-2)', color:v==='secondary'?'var(--text)':'white', fontWeight:600, fontSize:'0.86rem', cursor:'pointer', fontFamily:'var(--font)' })
const success = { background:'#ECFDF5', border:'1px solid #A7F3D0', color:'#059669', padding:'10px 14px', borderRadius:8, fontSize:'0.85rem', marginBottom:12 }
const error = { background:'#FEF2F2', border:'1px solid #FECACA', color:'#DC2626', padding:'10px 14px', borderRadius:8, fontSize:'0.85rem', marginBottom:12 }

const ROLE_LABEL = { admin:'Admin', vacation_approver:'Urlaub Gen.', user:'Benutzer' }
const ROLE_COLOR = { admin:'var(--primary)', vacation_approver:'#6366F1', user:'var(--text-3)' }

const FEATURES = [
  { key:'feature_calendar', label:'Kalender', icon:'📅' },
  { key:'feature_vacation', label:'Urlaubsplanung', icon:'🌴' },
  { key:'feature_hours',    label:'Stundenkonto', icon:'⏱' },
]

function Toggle({ checked, onChange }) {
  return (
    <div onClick={onChange} style={{ width:40, height:22, borderRadius:11, background:checked?'var(--success)':'var(--border)', cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
      <div style={{ position:'absolute', top:3, left:checked?20:3, width:16, height:16, borderRadius:'50%', background:'var(--surface)', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
    </div>
  )
}

function EditModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    powerbird_id: user.powerbird_id,
    role: user.role,
    is_active: user.is_active === 1,
    feature_calendar: user.feature_calendar !== 0,
    feature_vacation: user.feature_vacation !== 0,
    feature_hours:    user.feature_hours    !== 0,
  })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    setErr(''); setLoading(true)
    try {
      await api.put(`/users/${user.id}`, form)
      onSaved()
    } catch(e) { setErr(e.response?.data?.error || 'Fehler') }
    setLoading(false)
  }

  const resetPw = async () => {
    try {
      await api.post(`/users/${user.id}/reset-password`)
      alert('Passwort-Reset E-Mail gesendet')
    } catch(e) { setErr(e.response?.data?.error || 'Fehler') }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={onClose}>
      <div style={{ background:'var(--surface)', borderRadius:12, padding:28, maxWidth:500, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', maxHeight:'90vh', overflowY:'auto', color:'var(--text)' }}
        onClick={e=>e.stopPropagation()}>
        <h3 style={{ fontWeight:700, fontSize:'1.1rem', marginBottom:20 }}>Benutzer bearbeiten</h3>
        {err && <div style={error}>{err}</div>}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }} className="form-row">
          <div><label style={lbl}>Name</label><input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} /></div>
          <div><label style={lbl}>E-Mail</label><input style={inp} type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} /></div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }} className="form-row">
          <div><label style={lbl}>Powerbird-ID</label><input style={inp} value={form.powerbird_id} onChange={e=>setForm(f=>({...f,powerbird_id:e.target.value}))} /></div>
          <div><label style={lbl}>Rolle</label>
            <select style={{...inp, cursor:'pointer'}} value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
              <option value="user">Benutzer</option>
              <option value="vacation_approver">Urlaub genehmigen</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
        </div>

        {/* Status */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, padding:'12px 14px', background:'var(--surface-2)', borderRadius:8 }}>
          <Toggle checked={form.is_active} onChange={()=>setForm(f=>({...f,is_active:!f.is_active}))} />
          <div>
            <div style={{ fontWeight:600, fontSize:'0.88rem' }}>Konto aktiv</div>
            <div style={{ fontSize:'0.78rem', color:'var(--text-3)' }}>Gesperrte Benutzer können sich nicht anmelden</div>
          </div>
        </div>

        {/* Feature Flags */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontWeight:600, fontSize:'0.88rem', marginBottom:12, color:'var(--text)' }}>Funktionen aktivieren</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {FEATURES.map(f => (
              <div key={f.key} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'var(--surface-2)', borderRadius:8 }}>
                <Toggle checked={form[f.key]} onChange={()=>setForm(ff=>({...ff,[f.key]:!ff[f.key]}))} />
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span>{f.icon}</span>
                  <div>
                    <div style={{ fontWeight:500, fontSize:'0.88rem' }}>{f.label}</div>
                    <div style={{ fontSize:'0.75rem', color:'var(--text-3)' }}>{form[f.key] ? 'Aktiviert' : 'Deaktiviert'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'space-between', flexWrap:'wrap' }}>
          <button style={{...btn('secondary'), fontSize:'0.82rem'}} onClick={resetPw}>🔑 Passwort-Reset senden</button>
          <div style={{ display:'flex', gap:8 }}>
            <button style={btn('secondary')} onClick={onClose}>Abbrechen</button>
            <button style={btn()} onClick={save} disabled={loading}>{loading?'Speichern...':'Speichern'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function UserAdmin() {
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({ name:'', email:'', powerbird_id:'', role:'user' })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')
  const [editUser, setEditUser] = useState(null)

  const load = () => api.get('/users').then(r => setUsers(r.data.users))
  useEffect(() => { load() }, [])

  const create = async () => {
    if (!form.name||!form.email||!form.powerbird_id) return setErr('Alle Felder erforderlich')
    setLoading(true); setErr(''); setMsg('')
    try { await api.post('/users', form); setMsg('Benutzer angelegt und Einladung versendet'); setForm({name:'',email:'',powerbird_id:'',role:'user'}); load() }
    catch(e) { setErr(e.response?.data?.error||'Fehler') }
    setLoading(false)
  }

  return (
    <div>
      {/* Neuer Benutzer */}
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:4 }}>Neuen Benutzer anlegen</div>
        <div style={{ color:'var(--text-3)', fontSize:'0.82rem', marginBottom:14 }}>Benutzer erhält eine Einladungs-E-Mail.</div>
        {err && <div style={error}>{err}</div>}
        {msg && <div style={success}>{msg}</div>}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }} className="form-row">
          <div><label style={lbl}>Name *</label><input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Max Mustermann" /></div>
          <div><label style={lbl}>E-Mail *</label><input style={inp} type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="name@firma.de" /></div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }} className="form-row">
          <div><label style={lbl}>Powerbird-ID *</label><input style={inp} value={form.powerbird_id} onChange={e=>setForm(f=>({...f,powerbird_id:e.target.value}))} placeholder="z.B. MM01" /></div>
          <div><label style={lbl}>Rolle</label>
            <select style={{...inp, cursor:'pointer'}} value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
              <option value="user">Benutzer</option>
              <option value="vacation_approver">Urlaub genehmigen</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
        </div>
        <button style={{...btn(), width:'100%'}} onClick={create} disabled={loading}>{loading?'Wird angelegt...':'+ Benutzer anlegen & einladen'}</button>
      </div>

      {/* Benutzerliste */}
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:14 }}>Benutzerliste ({users.length})</div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {users.map(u => (
            <div key={u.id} style={{ border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px', background:u.is_active?'white':'#FAFAFA' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                    <span style={{ fontWeight:700, fontSize:'0.95rem' }}>{u.name}</span>
                    <span style={{ fontSize:'0.75rem', fontWeight:600, padding:'2px 8px', borderRadius:12, background:ROLE_COLOR[u.role]+'22', color:ROLE_COLOR[u.role] }}>{ROLE_LABEL[u.role]||u.role}</span>
                    {!u.is_active && <span style={{ fontSize:'0.72rem', fontWeight:600, padding:'2px 8px', borderRadius:12, background:'#FEF2F2', color:'#DC2626' }}>Gesperrt</span>}
                  </div>
                  <div style={{ fontSize:'0.82rem', color:'var(--text-3)', marginBottom:6 }}>
                    {u.email} · ID: <code style={{ fontFamily:'monospace' }}>{u.powerbird_id}</code>
                  </div>
                  {/* Feature badges */}
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                    {FEATURES.map(f => (
                      <span key={f.key} style={{ fontSize:'0.72rem', padding:'1px 7px', borderRadius:10, background:u[f.key]!==0?'var(--primary-light)':'#F1F5F9', color:u[f.key]!==0?'var(--primary)':'var(--text-3)' }}>
                        {f.icon} {f.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button style={{...btn('secondary'), padding:'6px 14px', fontSize:'0.82rem'}} onClick={()=>setEditUser(u)}>✏️ Bearbeiten</button>
                  <button style={{...btn('danger'), padding:'6px 10px', fontSize:'0.82rem'}} onClick={()=>{if(window.confirm(`"${u.name}" löschen?`))api.delete(`/users/${u.id}`).then(load)}}>✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editUser && (
        <EditModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); setMsg('Benutzer gespeichert'); load() }}
        />
      )}
    </div>
  )
}

function UploadField({ label, settingKey, currentUrl, hint, accept }) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(currentUrl || '')
  const fileRef = React.useRef()

  useEffect(() => { setPreview(currentUrl || '') }, [currentUrl])

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await api.post(`/upload/${settingKey}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setPreview(r.data.url)
    } catch(err) { alert(err.response?.data?.error || 'Upload fehlgeschlagen') }
    setUploading(false)
  }

  const handleDelete = async () => {
    if (!window.confirm('Bild entfernen?')) return
    try {
      await api.delete(`/upload/${settingKey}`)
      setPreview('')
    } catch(e) {}
  }

  return (
    <div>
      <label style={lbl}>{label}</label>
      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        {preview && (
          <div style={{ position:'relative' }}>
            <img src={preview} alt="Vorschau" style={{ height:48, maxWidth:160, objectFit:'contain', borderRadius:8, border:'1px solid var(--border)', background:'#f8f9fa', padding:4 }} />
            <button onClick={handleDelete} style={{ position:'absolute', top:-6, right:-6, width:18, height:18, borderRadius:'50%', background:'#EF4444', color:'white', border:'none', cursor:'pointer', fontSize:'10px', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
          </div>
        )}
        <div>
          <button onClick={() => fileRef.current.click()}
            style={{ ...btn('secondary'), fontSize:'0.82rem', padding:'7px 14px' }}
            disabled={uploading}>
            {uploading ? 'Lädt...' : preview ? '📁 Ersetzen' : '📁 Hochladen'}
          </button>
          <div style={{ fontSize:'0.75rem', color:'var(--text-3)', marginTop:4 }}>{hint}</div>
        </div>
        <input ref={fileRef} type="file" accept={accept} onChange={handleUpload} style={{ display:'none' }} />
      </div>
    </div>
  )
}

function BrandingAdmin() {
  const [brand, setBrand] = useState({company_name:'',primary_color:'#2563EB',logo_mode:'icon',banner_height:'48',calendar_range_days:'14',cal_min_time:'06:00',cal_max_time:'22:00'})
  const [brandingData, setBrandingData] = useState({})
  const [labels, setLabels] = useState([])
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')

  const loadBranding = () => {
    api.get('/branding').then(r => {
      setBrandingData(r.data)
      setBrand({
        company_name: r.data.company_name || '',
        primary_color: r.data.primary_color || '#2563EB',
        logo_mode: r.data.logo_mode || 'icon',
        banner_height: String(r.data.banner_height || '48'),
        calendar_range_days: String(r.data.calendar_range_days || '14'),
        cal_min_time: r.data.cal_min_time || '06:00',
        cal_max_time: r.data.cal_max_time || '22:00',
      })
    })
  }

  useEffect(() => {
    loadBranding()
    api.get('/calendar/labels').then(r=>{
      api.get('/branding/labels').then(br=>{
        const map={}; br.data.labels.forEach(l=>map[l.name]=l.color)
        setLabels(r.data.labels.map(l=>({name:l.name,color:map[l.name]||l.color})))
      })
    }).catch(()=>{})
  }, [])

  const save = async () => {
    setErr(''); setMsg('')
    try {
      await api.put('/branding', brand)
      await api.put('/branding/labels', {labels})
      loadBranding()
      setMsg('Gespeichert – Seite neu laden um Änderungen zu sehen')
    }
    catch(e) { setErr(e.response?.data?.error||'Fehler') }
  }

  return (
    <div>
      {err&&<div style={error}>{err}</div>}{msg&&<div style={success}>{msg}</div>}
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:14 }}>Branding</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }} className="form-row">
          <div><label style={lbl}>Firmenname</label><input style={inp} value={brand.company_name} onChange={e=>setBrand(b=>({...b,company_name:e.target.value}))} /></div>
          <div><label style={lbl}>Primärfarbe</label>
            <div style={{ display:'flex', gap:8 }}>
              <input type="color" value={brand.primary_color} onChange={e=>setBrand(b=>({...b,primary_color:e.target.value}))} style={{ width:44,height:40,borderRadius:8,border:'1px solid var(--border)',cursor:'pointer',padding:2 }} />
              <input style={{...inp,fontFamily:'monospace',marginBottom:0,flex:1}} value={brand.primary_color} onChange={e=>setBrand(b=>({...b,primary_color:e.target.value}))} />
            </div>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }} className="form-row">
          <div><label style={lbl}>Kalenderbereich (Tage)</label><input style={inp} type="number" min="1" max="365" value={brand.calendar_range_days} onChange={e=>setBrand(b=>({...b,calendar_range_days:e.target.value}))} /></div>
          <div><label style={lbl}>Früheste Uhrzeit</label><input style={inp} type="time" value={brand.cal_min_time} onChange={e=>setBrand(b=>({...b,cal_min_time:e.target.value}))} /></div>
          <div><label style={lbl}>Späteste Uhrzeit</label><input style={inp} type="time" value={brand.cal_max_time} onChange={e=>setBrand(b=>({...b,cal_max_time:e.target.value}))} /></div>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:4 }}>Logo</div>
        <div style={{ color:'var(--text-3)', fontSize:'0.82rem', marginBottom:14 }}>PNG, JPG oder SVG, max. 2 MB</div>

        <UploadField
          label="Logo-Datei"
          settingKey="logo"
          currentUrl={brandingData.logo_url}
          hint="Empfohlen: quadratisch für Icon-Modus, breit für Banner-Modus"
          accept="image/*"
        />

        <div style={{ marginTop:16 }}>
          <label style={lbl}>Anzeigemodus</label>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            {[
              { val:'icon', label:'Icon', desc:'Kleines Logo neben Firmennamen', preview:'🟦 Firmenname' },
              { val:'banner', label:'Banner', desc:'Logo ersetzt den Firmennamen komplett', preview:'📸 (Logo als Banner)' },
            ].map(m => (
              <div key={m.val}
                onClick={() => setBrand(b=>({...b,logo_mode:m.val}))}
                style={{ flex:1, minWidth:140, padding:'12px 16px', borderRadius:10, border:`2px solid ${brand.logo_mode===m.val?'var(--primary)':'var(--border)'}`, cursor:'pointer', background:brand.logo_mode===m.val?'var(--primary-light)':'white', transition:'all 0.15s' }}>
                <div style={{ fontWeight:600, fontSize:'0.88rem', color:brand.logo_mode===m.val?'var(--primary)':'var(--text)', marginBottom:3 }}>{m.label}</div>
                <div style={{ fontSize:'0.75rem', color:'var(--text-3)' }}>{m.desc}</div>
                <div style={{ fontSize:'0.75rem', color:'var(--text-2)', marginTop:6, fontFamily:'monospace' }}>{m.preview}</div>
              </div>
            ))}
          </div>
        </div>

        {brand.logo_mode === 'banner' && (
          <div style={{ marginTop:16 }}>
            <label style={lbl}>Banner-Höhe: {brand.banner_height}px</label>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <input type="range" min="24" max="120" value={brand.banner_height}
                onChange={e=>setBrand(b=>({...b,banner_height:e.target.value}))}
                style={{ flex:1, accentColor:'var(--primary)' }} />
              <span style={{ fontFamily:'monospace', fontSize:'0.85rem', color:'var(--text-2)', width:50 }}>{brand.banner_height}px</span>
            </div>
            {brandingData.logo_url && (
              <div style={{ marginTop:12, padding:12, background:'var(--surface-2)', borderRadius:8, display:'flex', justifyContent:'center', alignItems:'center', border:'1px solid var(--border)' }}>
                <img src={brandingData.logo_url} alt="Vorschau" style={{ height:`${brand.banner_height}px`, maxWidth:'100%', objectFit:'contain' }} />
              </div>
            )}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:4 }}>Browser-Tab Icon (Favicon)</div>
        <div style={{ color:'var(--text-3)', fontSize:'0.82rem', marginBottom:14 }}>ICO, PNG oder SVG, max. 2 MB. Empfohlen: 32×32 oder 64×64 px</div>
        <UploadField
          label="Favicon"
          settingKey="favicon"
          currentUrl={brandingData.favicon_url}
          hint="Wird als Icon im Browser-Tab angezeigt"
          accept="image/*,.ico"
        />
      </div>
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:4 }}>Termin-Labels & Farben</div>
        <div style={{ color:'var(--text-3)', fontSize:'0.82rem', marginBottom:14 }}>Automatisch aus Powerbird erkannt</div>
        {labels.length===0 ? <div style={{ color:'var(--text-3)' }}>Noch keine Labels vorhanden.</div>
          : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {labels.map((l,i)=>(
                <div key={l.name} style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <input type="color" value={l.color} onChange={e=>setLabels(ls=>ls.map((x,j)=>j===i?{...x,color:e.target.value}:x))} style={{ width:36,height:36,borderRadius:8,border:'1px solid var(--border)',cursor:'pointer',padding:2,flexShrink:0 }} />
                  <span style={{ flex:1, fontSize:'0.88rem' }}>{l.name}</span>
                </div>
              ))}
            </div>}
      </div>
      <button style={{...btn(), width:'100%'}} onClick={save}>Einstellungen speichern</button>
    </div>
  )
}

function SettingsAdmin() {
  const [form, setForm] = useState({})
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')
  useEffect(() => { api.get('/admin/settings').then(r=>setForm(r.data.settings)) }, [])
  const save = async () => {
    setErr(''); setMsg('')
    try { await api.put('/admin/settings',form); setMsg('Gespeichert') }
    catch(e) { setErr(e.response?.data?.error||'Fehler') }
  }
  const f = key => ({ value:form[key]||'', onChange:e=>setForm(p=>({...p,[key]:e.target.value})) })

  return (
    <div>
      {err&&<div style={error}>{err}</div>}{msg&&<div style={success}>{msg}</div>}
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:14 }}>Datenbankverbindung</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }} className="form-row">
          <div><label style={lbl}>SQL Server</label><input style={inp} {...f('db_host')} /></div>
          <div><label style={lbl}>Port</label><input style={inp} {...f('db_port')} /></div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }} className="form-row">
          <div><label style={lbl}>Datenbank</label><input style={inp} {...f('db_name')} /></div>
          <div><label style={lbl}>Benutzer</label><input style={inp} {...f('db_user')} /></div>
        </div>
        <div><label style={lbl}>Passwort</label><input style={inp} type="password" value={form.db_password||''} onChange={e=>setForm(p=>({...p,db_password:e.target.value}))} placeholder="(unverändert)" /></div>
      </div>
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:14 }}>E-Mail (SMTP)</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }} className="form-row">
          <div><label style={lbl}>SMTP Host</label><input style={inp} {...f('smtp_host')} /></div>
          <div><label style={lbl}>Port</label><input style={inp} {...f('smtp_port')} /></div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }} className="form-row">
          <div><label style={lbl}>Benutzer</label><input style={inp} {...f('smtp_user')} /></div>
          <div><label style={lbl}>Passwort</label><input style={inp} type="password" value={form.smtp_password||''} onChange={e=>setForm(p=>({...p,smtp_password:e.target.value}))} placeholder="(unverändert)" /></div>
        </div>
        <div><label style={lbl}>Absender</label><input style={inp} {...f('smtp_from')} /></div>
      </div>
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:14 }}>Allgemein</div>
        <div><label style={lbl}>App-URL (für E-Mail-Links)</label><input style={inp} {...f('app_url')} placeholder="https://portal.firma.de" /></div>
      </div>
      <button style={{...btn(), width:'100%'}} onClick={save}>Einstellungen speichern</button>
    </div>
  )
}

const navLinkStyle = (active) => ({ display:'block', padding:'9px 12px', borderRadius:8, textDecoration:'none', fontSize:'0.88rem', fontWeight:active?600:400, color:active?'var(--primary)':'var(--text-2)', background:active?'var(--primary-light)':'transparent', color:active?'var(--primary)':'var(--text-2)', marginBottom:2 })

export default function AdminPage() {
  return (
    <div style={{ maxWidth:900 }}>
      <h1 style={{ fontSize:'1.2rem', fontWeight:700, marginBottom:16 }}>Administration</h1>
      <div style={{ display:'flex', gap:20, alignItems:'flex-start', flexWrap:'wrap' }}>
        <div style={{ width:180, flexShrink:0, background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)', padding:8, boxShadow:'var(--shadow)' }}>
          <NavLink to="/admin" end style={({isActive})=>navLinkStyle(isActive)}>👥 Benutzer</NavLink>
          <NavLink to="/admin/branding" style={({isActive})=>navLinkStyle(isActive)}>🎨 Branding & Labels</NavLink>
          <NavLink to="/admin/settings" style={({isActive})=>navLinkStyle(isActive)}>🔧 Verbindung & SMTP</NavLink>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <Routes>
            <Route index element={<UserAdmin />} />
            <Route path="branding" element={<BrandingAdmin />} />
            <Route path="settings" element={<SettingsAdmin />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}
