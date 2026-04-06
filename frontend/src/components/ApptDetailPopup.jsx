import React, { useState, useEffect } from 'react'

const fmtTime = d => {
  if (!d) return '';
  // Parse "2026-04-02 09:00:00" as local time (not UTC)
  const str = String(d).replace('T', ' ').replace('.000Z', '').replace('Z', '')
  const t = new Date(str)
  return `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`
}
const fmtDate = d => {
  const str = String(d).replace('T', ' ').replace('.000Z', '').replace('Z', '')
  return new Date(str).toLocaleDateString('de-DE', { weekday:'long', day:'2-digit', month:'long' })
}

function getTC(hex) {
  if (!hex) return '#fff'
  const n = parseInt(hex.replace('#',''),16)
  return ((n>>16)*299+(n>>8&255)*587+(n&255)*114)/1000>128?'#000':'#fff'
}

export default function ApptDetailPopup({ recno, labelColors = {}, label, termColor, screenToken, onClose, theme }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isDisplay = !!theme // display screen passes theme object

  useEffect(() => {
    if (!recno) return
    const token = localStorage.getItem('token')
    const url = isDisplay
      ? `/api/display/appt/${recno}?token=${encodeURIComponent(screenToken || '')}`
      : `/api/calendar/appointment/${recno}`
    const opts = (!isDisplay && token) ? { headers: { Authorization: `Bearer ${token}` } } : {}
    fetch(url, opts)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setDetail(d.detail || d); setLoading(false) })
      .catch(() => { setError('Fehler beim Laden'); setLoading(false) })
  }, [recno])

  const bg = theme?.surface || 'var(--surface)'
  const border = theme?.border || 'var(--border)'
  const textMain = theme?.text || 'var(--text)'
  const textSub = theme?.text2 || 'var(--text-2)'
  const textMuted = theme?.text3 || 'var(--text-3)'

  const color = termColor || labelColors[label] || (label ? '#6366F1' : 'var(--primary)')
  const tc = (termColor || labelColors[label]) ? getTC(termColor || labelColors[label]) : 'white'

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }} onClick={onClose}>
      <div style={{ background:bg, borderRadius:16, padding:24, maxWidth:440, width:'92%', border:`1px solid ${border}`, boxShadow:'0 24px 64px rgba(0,0,0,0.4)' }} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
          <div style={{ flex:1, marginRight:12 }}>
            {label && (
              <div style={{ display:'inline-block', padding:'3px 10px', borderRadius:20, background:color, color:tc, fontSize:'0.75rem', fontWeight:600, marginBottom:8 }}>
                {label}
              </div>
            )}
            <div style={{ fontWeight:800, fontSize:'1.05rem', color:textMain, lineHeight:1.3 }}>
              {loading ? 'Lädt...' : detail?.title || '(Termin)'}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:textMuted, fontSize:'1.4rem', cursor:'pointer', lineHeight:1, padding:0, flexShrink:0 }}>✕</button>
        </div>

        {loading && <div style={{ color:textMuted, textAlign:'center', padding:'20px 0' }}>⏳ Lädt...</div>}
        {error && <div style={{ color:'#EF4444', fontSize:'0.88rem' }}>{error}</div>}

        {detail && !loading && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

            {/* Date/Time */}
            <InfoRow icon="🕐" label="Zeit" value={detail.allDay ? `${fmtDate(detail.start)} – Ganztag` : `${fmtDate(detail.start)}, ${fmtTime(detail.start)} – ${fmtTime(detail.end)}`} textSub={textSub} textMuted={textMuted} />

            {/* Info/Notes */}
            {detail.info && (
              <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                <span style={{ fontSize:'1rem', width:22, textAlign:'center', marginTop:2 }}>📝</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'0.72rem', color:textMuted }}>Notiz</div>
                  <div style={{ fontSize:'0.88rem', color:textSub, lineHeight:1.6 }}>
                    {detail.info.split('\r\n').join('\n').split('\n').filter(l => l.trim()).map((line, i) => (
                      <div key={i} style={{ marginBottom: line.startsWith('-') && line.endsWith('-') ? 4 : 2, fontWeight: line.startsWith('-') && line.endsWith('-') ? 600 : 400, color: line.startsWith('-') && line.endsWith('-') ? textSub : textSub }}>
                        {line.startsWith('-') && line.endsWith('-') ? '● ' + line.replace(/^-\s*/, '').replace(/\s*-$/, '') : line}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Customer */}
            {detail.kunde && <InfoRow icon="🏢" label="Kunde" value={detail.kunde} textSub={textSub} textMuted={textMuted} />}

            {/* KDI/Project Nr */}
            {detail.kdi_nr && <InfoRow icon="🔢" label="KDI-Nummer" value={detail.kdi_nr} textSub={textSub} textMuted={textMuted} mono />}
            {detail.kommission && <InfoRow icon="📋" label="Kommission" value={detail.kommission} textSub={textSub} textMuted={textMuted} />}

            {/* Address */}
            {detail.adresse && (
              <div>
                <InfoRow icon="📍" label="Adresse" value={detail.adresse} textSub={textSub} textMuted={textMuted} />
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(detail.adresse)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display:'flex', alignItems:'center', gap:8, marginTop:6, padding:'10px 14px', borderRadius:10, background:'var(--primary)', color:'#fff', textDecoration:'none', fontWeight:600, fontSize:'0.9rem' }}
                >
                  🗺 Navigation starten
                </a>
              </div>
            )}

            {/* Mobile */}
            {detail.mobil && (
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <span style={{ fontSize:'1rem', width:22, textAlign:'center' }}>📱</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'0.72rem', color:textMuted }}>Mobil</div>
                  <a href={`tel:${detail.mobil}`} style={{ fontSize:'0.9rem', color:'#3B82F6', textDecoration:'none', fontWeight:500 }}>{detail.mobil}</a>
                </div>
              </div>
            )}

            {/* Phone */}
            {detail.telefon && (
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <span style={{ fontSize:'1rem', width:22, textAlign:'center' }}>📞</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'0.72rem', color:textMuted }}>Telefon</div>
                  <a href={`tel:${detail.telefon}`} style={{ fontSize:'0.9rem', color:'#3B82F6', textDecoration:'none', fontWeight:500 }}>{detail.telefon}</a>
                </div>
              </div>
            )}

            {/* Email */}
            {detail.email && (
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <span style={{ fontSize:'1rem', width:22, textAlign:'center' }}>✉️</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'0.72rem', color:textMuted }}>E-Mail</div>
                  <a href={`mailto:${detail.email}`} style={{ fontSize:'0.9rem', color:'#3B82F6', textDecoration:'none', fontWeight:500 }}>{detail.email}</a>
                </div>
              </div>
            )}

            {/* Fallback message if no contact data */}
            {!detail.kunde && !detail.kdi_nr && !detail.adresse && !detail.telefon && !detail.email && !detail.info && (
              <div style={{ color:textMuted, fontSize:'0.85rem', textAlign:'center', padding:'8px 0' }}>
                Keine weiteren Details verfügbar
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value, textSub, textMuted, mono }) {
  return (
    <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
      <span style={{ fontSize:'1rem', width:22, textAlign:'center', marginTop:2 }}>{icon}</span>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:'0.72rem', color:textMuted }}>{label}</div>
        <div style={{ fontSize:'0.9rem', color:textSub, fontFamily:mono?'monospace':'inherit', fontWeight:500 }}>{value}</div>
      </div>
    </div>
  )
}
