import { useState, useEffect } from 'react'
import api from '../utils/api.js'

/**
 * Popup zum Anlegen und Bearbeiten von Terminen
 * Öffnet sich entweder leer (neu) oder gefüllt (bearbeiten)
 */
export default function TerminEditPopup({ recno = null, prefillDate = null, onClose, onSaved }) {
  const [form, setForm] = useState({
    label:    '',
    info:     '',
    start:    '',
    end:      '',
    ganzerTag:false,
    color:    0,
  })
  const [loading, setLoading]   = useState(false)
  const [saving,  setSaving]    = useState(false)
  const [error,   setError]     = useState(null)

  // Farben passend zu Powerbird
  const COLORS = [
    { value: 0,       label: 'Standard',  hex: '#2563EB' },
    { value: 255,     label: 'Rot',       hex: '#ef4444' },
    { value: 65280,   label: 'Grün',      hex: '#22c55e' },
    { value: 16776960,label: 'Gelb',      hex: '#eab308' },
    { value: 16711680,label: 'Blau',      hex: '#3b82f6' },
    { value: 8388736, label: 'Lila',      hex: '#a855f7' },
    { value: 32768,   label: 'Dunkelgrün',hex: '#15803d' },
  ]

  useEffect(() => {
    if (recno) {
      // Bestehenden Termin laden
      setLoading(true)
      api.get(`/calendar/appointment/${recno}`)
        .then(r => {
          const d = r.data
          const startDt = d.start ? d.start.substring(0, 16) : ''
          const endDt   = d.end   ? d.end.substring(0, 16)   : startDt
          setForm({
            label:     d.title  || '',
            info:      d.info   || '',
            start:     startDt,
            end:       endDt,
            ganzerTag: d.allDay || false,
            color:     d.color  || 0,
          })
        })
        .catch(() => setError('Termin konnte nicht geladen werden'))
        .finally(() => setLoading(false))
    } else if (prefillDate) {
      // Neuer Termin mit vorbefülltem Datum
      const pad = n => String(n).padStart(2, '0')
      const d   = new Date(prefillDate)
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
      setForm(f => ({
        ...f,
        start: `${dateStr}T08:00`,
        end:   `${dateStr}T09:00`,
      }))
    }
  }, [recno, prefillDate])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.label.trim()) return setError('Titel ist Pflichtfeld')
    if (!form.start)         return setError('Startzeit ist Pflichtfeld')
    if (!form.ganzerTag && !form.end) return setError('Endzeit ist Pflichtfeld')

    setSaving(true)
    setError(null)
    try {
      if (recno) {
        await api.put(`/calendar/termin/${recno}`, form)
      } else {
        await api.post('/calendar/termin', form)
      }
      onSaved?.()
      onClose()
    } catch (e) {
      setError(e.response?.data?.error || 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!recno) return
    if (!window.confirm('Termin wirklich löschen?')) return
    setSaving(true)
    try {
      await api.delete(`/calendar/termin/${recno}`)
      onSaved?.()
      onClose()
    } catch (e) {
      setError(e.response?.data?.error || 'Löschen fehlgeschlagen')
      setSaving(false)
    }
  }

  const inp  = 'width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:0.9rem;outline:none;'
  const lab  = 'font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text3);margin-bottom:6px;display:block;'

  if (loading) return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background:'var(--surface)', borderRadius:16, padding:32, color:'var(--text2)' }}>Lädt…</div>
    </div>
  )

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:20, width:'100%', maxWidth:480, maxHeight:'90vh', overflow:'auto', boxShadow:'0 24px 64px rgba(0,0,0,0.5)' }}>

        {/* Header */}
        <div style={{ padding:'20px 24px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontFamily:'serif', fontSize:'1.3rem', fontWeight:700, color:'var(--text)' }}>
            {recno ? '✏️ Termin bearbeiten' : '➕ Neuer Termin'}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text3)', fontSize:'1.4rem', cursor:'pointer', lineHeight:1 }}>×</button>
        </div>

        <div style={{ padding:24, display:'flex', flexDirection:'column', gap:16 }}>

          {/* Titel */}
          <div>
            <label style={{ cssText: lab }}>Titel *</label>
            <input style={{ cssText: inp }} value={form.label} onChange={e => set('label', e.target.value)} placeholder="z.B. Kundentermin Müller GmbH" />
          </div>

          {/* Ganzer Tag Toggle */}
          <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', userSelect:'none' }}>
            <div onClick={() => set('ganzerTag', !form.ganzerTag)}
                 style={{ width:40, height:22, borderRadius:11, background: form.ganzerTag ? 'var(--primary)' : 'var(--border)', position:'relative', transition:'background 0.2s', cursor:'pointer' }}>
              <div style={{ position:'absolute', top:3, left: form.ganzerTag ? 21 : 3, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'left 0.2s' }} />
            </div>
            <span style={{ fontSize:'0.9rem', color:'var(--text2)' }}>Ganztägig</span>
          </label>

          {/* Datum / Zeit */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ cssText: lab }}>Start *</label>
              <input style={{ cssText: inp }} type={form.ganzerTag ? 'date' : 'datetime-local'} value={form.ganzerTag ? form.start?.substring(0,10) : form.start}
                     onChange={e => set('start', e.target.value)} />
            </div>
            {!form.ganzerTag && (
              <div>
                <label style={{ cssText: lab }}>Ende *</label>
                <input style={{ cssText: inp }} type="datetime-local" value={form.end}
                       onChange={e => set('end', e.target.value)} />
              </div>
            )}
          </div>

          {/* Notiz */}
          <div>
            <label style={{ cssText: lab }}>Notiz</label>
            <textarea style={{ cssText: inp + 'resize:vertical;min-height:80px;font-family:inherit;' }}
                      value={form.info} onChange={e => set('info', e.target.value)} placeholder="Optionale Notiz…" />
          </div>

          {/* Farbe */}
          <div>
            <label style={{ cssText: lab }}>Farbe</label>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {COLORS.map(c => (
                <div key={c.value} onClick={() => set('color', c.value)} title={c.label}
                     style={{ width:28, height:28, borderRadius:'50%', background:c.hex, cursor:'pointer', border: form.color === c.value ? '3px solid var(--text)' : '3px solid transparent', transition:'border 0.15s' }} />
              ))}
            </div>
          </div>

          {/* Fehler */}
          {error && (
            <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'10px 14px', color:'#ef4444', fontSize:'0.88rem' }}>
              {error}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display:'flex', gap:10, marginTop:4 }}>
            {recno && (
              <button onClick={handleDelete} disabled={saving}
                      style={{ padding:'10px 16px', borderRadius:10, border:'1px solid rgba(239,68,68,0.4)', background:'rgba(239,68,68,0.08)', color:'#ef4444', cursor:'pointer', fontSize:'0.88rem', fontWeight:600 }}>
                🗑 Löschen
              </button>
            )}
            <button onClick={onClose} disabled={saving}
                    style={{ flex:1, padding:'10px 16px', borderRadius:10, border:'1px solid var(--border)', background:'transparent', color:'var(--text2)', cursor:'pointer', fontSize:'0.88rem' }}>
              Abbrechen
            </button>
            <button onClick={handleSave} disabled={saving}
                    style={{ flex:2, padding:'10px 16px', borderRadius:10, border:'none', background:'var(--primary)', color:'#fff', cursor:'pointer', fontSize:'0.9rem', fontWeight:700, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Speichert…' : recno ? '✓ Speichern' : '➕ Anlegen'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
