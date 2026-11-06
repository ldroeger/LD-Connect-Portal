import React, { useState, useEffect } from 'react'
import api from '../utils/api.js'

const card = { background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)', padding:20, boxShadow:'var(--shadow)', marginBottom:16 }
const lbl = { display:'block', fontSize:'0.82rem', fontWeight:600, color:'var(--text)', marginBottom:5 }
const inp = { width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:'0.88rem', fontFamily:'var(--font)', outline:'none', marginBottom:12, boxSizing:'border-box', background:'var(--surface)', color:'var(--text)' }
const btn = (v='primary') => ({ padding:'9px 18px', borderRadius:8, border:v==='secondary'?'1px solid var(--border)':'none', background:v==='primary'?'var(--primary)':'var(--surface-2)', color:v==='secondary'?'var(--text)':'white', fontWeight:600, fontSize:'0.86rem', cursor:'pointer', fontFamily:'var(--font)' })
const success = { background:'#ECFDF5', border:'1px solid #A7F3D0', color:'#059669', padding:'10px 14px', borderRadius:8, fontSize:'0.85rem', marginBottom:12 }
const error = { background:'#FEF2F2', border:'1px solid #FECACA', color:'#DC2626', padding:'10px 14px', borderRadius:8, fontSize:'0.85rem', marginBottom:12 }

export default function MailTemplatesCard() {
  const [templates, setTemplates] = useState([])
  const [selected, setSelected] = useState('')
  const [form, setForm] = useState(null)
  const [preview, setPreview] = useState(null)
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')

  const load = async (key) => {
    const r = await api.get('/admin/mail-templates')
    const list = r.data.templates
    const current = list.find(t => t.key === key) || list[0]
    setTemplates(list)
    if (current) { setSelected(current.key); setForm(current.values) }
  }
  useEffect(() => { load().catch(() => setErr('Vorlagen konnten nicht geladen werden')) }, [])

  const template = templates.find(t => t.key === selected)
  const f = key => ({ value:form[key]||'', onChange:e=>setForm(p=>({...p,[key]:e.target.value})) })

  const select = key => {
    setSelected(key); setPreview(null); setMsg(''); setErr('')
    setForm(templates.find(t => t.key === key).values)
  }
  const save = async () => {
    setErr(''); setMsg('')
    try { await api.put(`/admin/mail-templates/${selected}`, form); await load(selected); setMsg('Gespeichert') }
    catch(e) { setErr(e.response?.data?.error||'Fehler') }
  }
  const reset = async () => {
    if (!window.confirm('Alle Änderungen an dieser Vorlage verwerfen und die Standardtexte wiederherstellen?')) return
    setErr(''); setMsg(''); setPreview(null)
    try { await api.delete(`/admin/mail-templates/${selected}`); await load(selected); setMsg('Standardtexte wiederhergestellt') }
    catch(e) { setErr(e.response?.data?.error||'Fehler') }
  }
  const showPreview = async () => {
    setErr('')
    try { const r = await api.post(`/admin/mail-templates/${selected}/preview`, form); setPreview(r.data) }
    catch(e) { setErr(e.response?.data?.error||'Fehler') }
  }

  if (!form || !template) return <div>{err&&<div style={error}>{err}</div>}</div>

  return (
    <div>
      {err&&<div style={error}>{err}</div>}{msg&&<div style={success}>{msg}</div>}
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:14 }}>E-Mail-Texte</div>
        <label style={lbl}>Vorlage</label>
        <select style={inp} value={selected} onChange={e=>select(e.target.value)}>
          {templates.map(t => <option key={t.key} value={t.key}>{t.label}{t.customized?' (angepasst)':''}</option>)}
        </select>
        <div style={{ color:'var(--text-3)', fontSize:'0.82rem', marginBottom:14 }}>{template.description}</div>

        <label style={lbl}>Betreff</label><input style={inp} {...f('subject')} />
        <label style={lbl}>Überschrift</label><input style={inp} {...f('title')} />
        <label style={lbl}>Anrede</label><input style={inp} {...f('greeting')} />
        <label style={lbl}>Text</label><textarea style={{...inp, resize:'vertical'}} rows={6} {...f('body')} />
        <label style={lbl}>Eigener Zusatztext</label>
        <textarea style={{...inp, resize:'vertical'}} rows={3} {...f('extra')} placeholder="Erscheint unter dem Text, z. B. ein Hinweis Ihrer Firma" />
        <label style={lbl}>Button-Text</label><input style={inp} {...f('buttonText')} />
        <label style={lbl}>Fußzeile</label><textarea style={{...inp, resize:'vertical'}} rows={2} {...f('footer')} />

        <div style={{ padding:'8px 12px', background:'var(--surface-2)', borderRadius:8, fontSize:'0.82rem', color:'var(--text-3)', marginBottom:14 }}>
          Platzhalter: {template.variables.map(v => <code key={v} style={{ marginRight:8, color:'var(--primary)' }}>{`{{${v}}}`}</code>)}
          <div style={{ marginTop:4 }}>Jede Zeile wird ein eigener Absatz. Einfaches HTML wie &lt;strong&gt; ist erlaubt.</div>
        </div>

        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button style={btn()} onClick={save}>Speichern</button>
          <button style={btn('secondary')} onClick={showPreview}>Vorschau</button>
          <button style={btn('secondary')} onClick={reset} disabled={!template.customized}>Auf Standard zurücksetzen</button>
        </div>
      </div>

      {preview && (
        <div style={card}>
          <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:4 }}>Vorschau</div>
          <div style={{ color:'var(--text-3)', fontSize:'0.82rem', marginBottom:12 }}>Betreff: {preview.subject} (mit Beispieldaten)</div>
          <iframe title="E-Mail-Vorschau" sandbox="" srcDoc={preview.html} style={{ width:'100%', height:560, border:'1px solid var(--border)', borderRadius:8, background:'white' }} />
        </div>
      )}
    </div>
  )
}
