import React, { useState, useEffect } from 'react'
import api from '../utils/api.js'

const STATUS_CFG = {
  lager:      { bg: '#dcfce7', border: '#86efac', color: '#15803d', dot: '#22c55e', label: 'Im Lager' },
  reserviert: { bg: '#fef9c3', border: '#fde047', color: '#854d0e', dot: '#eab308', label: 'Reserviert' },
  verliehen:  { bg: '#fee2e2', border: '#fca5a5', color: '#991b1b', dot: '#ef4444', label: 'Verliehen' },
  defekt:     { bg: '#f3e8ff', border: '#d8b4fe', color: '#6b21a8', dot: '#a855f7', label: 'Defekt' },
}

const fmtTime = d => { const t = new Date(d); return `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}` }
const fmtDate = d => new Date(d).toLocaleDateString('de-DE', { weekday:'short', day:'2-digit', month:'2-digit', year:'numeric' })

function MiniCalendar({ events }) {
  const [month, setMonth] = useState(() => {
    const upcoming = events.find(e => new Date(e.start) >= new Date())
    return upcoming ? new Date(upcoming.start) : new Date()
  })

  const year = month.getFullYear()
  const mon  = month.getMonth()
  const first = new Date(year, mon, 1)
  const last  = new Date(year, mon + 1, 0)
  const startDow = (first.getDay() + 6) % 7
  const days = []
  for (let i = 0; i < startDow; i++) days.push(null)
  for (let i = 1; i <= last.getDate(); i++) days.push(new Date(year, mon, i))

  const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
  const DAYS = ['Mo','Di','Mi','Do','Fr','Sa','So']

  const getEventForDay = (d) => d && events.filter(e => {
    const es = new Date(e.start)
    const ee = new Date(e.end || e.start)
    const dStr = d.toDateString()
    return es.toDateString() === dStr || (es <= d && ee >= d)
  })

  return (
    <div>
      {/* Month nav */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <button onClick={() => setMonth(new Date(year, mon-1, 1))} style={{ border:'1px solid var(--border)', background:'var(--surface-2)', borderRadius:6, padding:'4px 10px', cursor:'pointer', color:'var(--text)', fontSize:16 }}>‹</button>
        <span style={{ fontWeight:700, color:'var(--text)' }}>{MONTHS[mon]} {year}</span>
        <button onClick={() => setMonth(new Date(year, mon+1, 1))} style={{ border:'1px solid var(--border)', background:'var(--surface-2)', borderRadius:6, padding:'4px 10px', cursor:'pointer', color:'var(--text)', fontSize:16 }}>›</button>
      </div>
      {/* Day headers */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
        {DAYS.map(d => <div key={d} style={{ textAlign:'center', fontSize:'0.7rem', fontWeight:700, color:'var(--text-3)', padding:'2px 0' }}>{d}</div>)}
      </div>
      {/* Day cells */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
        {days.map((d, i) => {
          if (!d) return <div key={i} />
          const dayEvents = getEventForDay(d)
          const isToday = d.toDateString() === new Date().toDateString()
          const hasEvents = dayEvents.length > 0
          return (
            <div key={i} style={{ textAlign:'center', padding:'4px 2px', borderRadius:6, background: isToday ? 'var(--primary)' : hasEvents ? 'var(--primary-light)' : 'transparent', position:'relative' }}>
              <span style={{ fontSize:'0.8rem', fontWeight: isToday||hasEvents?'700':'400', color: isToday?'#fff':'var(--text)' }}>{d.getDate()}</span>
              {hasEvents && !isToday && (
                <div style={{ display:'flex', justifyContent:'center', gap:2, marginTop:1 }}>
                  {dayEvents.slice(0,2).map((e,j) => (
                    <div key={j} style={{ width:4, height:4, borderRadius:'50%', background: e.color || 'var(--primary)' }} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {/* Event list for this month */}
      <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:6 }}>
        {events.filter(e => {
          const d = new Date(e.start)
          return d.getFullYear() === year && d.getMonth() === mon
        }).map((e, i) => (
          <div key={i} style={{ display:'flex', gap:0, borderRadius:8, overflow:'hidden', border:`1px solid ${e.color}44` }}>
            <div style={{ width:3, background: e.color, flexShrink:0 }} />
            <div style={{ padding:'6px 10px', flex:1, background: e.color+'11' }}>
              <div style={{ fontWeight:600, fontSize:'0.85rem', color:'var(--text)' }}>{e.label}</div>
              <div style={{ fontSize:'0.75rem', color:'var(--text-3)', marginTop:2 }}>
                {e.allDay ? fmtDate(e.start) : `${fmtDate(e.start)} · ${fmtTime(e.start)} – ${fmtTime(e.end)}`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ToolDetailPopup({ tool, onClose }) {
  const [events, setEvents] = useState(null)
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)

  useEffect(() => {
    if (!tool) return
    setEvents(null)
    setShowCalendar(false)
    // Load events
    const internNr = tool.internNr || tool.intern_nr
    if (!internNr) return
    setLoadingEvents(true)
    api.get(`/calendar/tools/${internNr}/events`)
      .then(r => setEvents(r.data.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false))
  }, [tool])

  if (!tool) return null

  const cfg = STATUS_CFG[tool.status] || STATUS_CFG.lager
  const imgUrl = tool.bild ? `/api/tools/image?path=${encodeURIComponent(tool.bild)}` : null
  const hasEvents = events && events.length > 0

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ background:'var(--surface)', borderRadius:20, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
          <h3 style={{ margin:0, fontSize:'1rem', color:'var(--text)' }}>Werkzeug-Details</h3>
          <button onClick={onClose} style={{ border:'none', background:'var(--surface-2)', borderRadius:8, padding:'4px 10px', cursor:'pointer', color:'var(--text)', fontSize:'1.1rem' }}>✕</button>
        </div>

        <div style={{ padding:20 }}>
          {/* Image */}
          {imgUrl ? (
            <div style={{ width:'100%', height:200, borderRadius:12, overflow:'hidden', background:'var(--surface-2)', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <img src={imgUrl} alt={tool.bezeichnung} style={{ width:'100%', height:'100%', objectFit:'contain' }}
                onError={e => { e.target.parentElement.innerHTML = '<div style="font-size:48px">🔧</div>' }} />
            </div>
          ) : (
            <div style={{ width:'100%', height:140, borderRadius:12, background:'var(--surface-2)', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'center', fontSize:56 }}>🔧</div>
          )}

          {/* Name + Nr */}
          <h2 style={{ margin:'0 0 6px', fontSize:'1.2rem', color:'var(--text)' }}>{tool.bezeichnung}</h2>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, flexWrap:'wrap' }}>
            <span style={{ background:'var(--primary-light)', color:'var(--primary)', padding:'2px 10px', borderRadius:8, fontSize:'0.82rem', fontWeight:700 }}>🔧 {tool.nr || tool.internNr}</span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:cfg.bg, border:`1px solid ${cfg.border}`, color:cfg.color, borderRadius:20, padding:'3px 10px', fontSize:'0.78rem', fontWeight:700 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:cfg.dot }} />
              {cfg.label}
            </span>
          </div>

          {/* Calendar button */}
          {!showCalendar && (
            <button
              onClick={() => setShowCalendar(true)}
              disabled={loadingEvents || (events !== null && !hasEvents)}
              style={{ width:'100%', padding:'11px', borderRadius:12, border:'none', cursor: loadingEvents || (events !== null && !hasEvents) ? 'default' : 'pointer', fontWeight:600, fontSize:'0.95rem', marginTop:4,
                background: events !== null && !hasEvents ? 'var(--surface-2)' : 'var(--primary)',
                color: events !== null && !hasEvents ? 'var(--text-3)' : '#fff',
                opacity: loadingEvents ? 0.7 : 1
              }}
            >
              {loadingEvents ? '⏳ Lädt...' : hasEvents ? `📅 Kalender anzeigen (${events.length} Einträge)` : '📅 Keine Kalendereinträge'}
            </button>
          )}

          {/* Calendar */}
          {showCalendar && events && (
            <div style={{ marginTop:16, borderTop:'1px solid var(--border)', paddingTop:16 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <span style={{ fontWeight:700, color:'var(--text)' }}>📅 Kalendereinträge</span>
                <button onClick={() => setShowCalendar(false)} style={{ border:'1px solid var(--border)', background:'transparent', borderRadius:6, padding:'2px 8px', cursor:'pointer', color:'var(--text-3)', fontSize:'0.8rem' }}>Schließen</button>
              </div>
              <MiniCalendar events={events} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
