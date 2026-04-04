import React, { useState, useEffect, useCallback, useRef } from 'react'
import ApptDetailPopup from '../components/ApptDetailPopup.jsx'
import { useParams } from 'react-router-dom'

const fmtTime = d => { if (!d) return ''; const t = new Date(d); return `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}` }

const THEMES = {
  dark:  { bg:'#0d1117', surface:'#161b27', surface2:'#1e2535', border:'#2d3748', text:'#f0f4f8', text2:'#a0aec0', text3:'#607090', header:'#0d1117', footer:'#090d13', badge:'#1e2535', success:'#10B981', warn:'#F59E0B' },
  light: { bg:'#f0f4f8', surface:'#ffffff', surface2:'#f7f9fc', border:'#d1dbe8', text:'#1a202c', text2:'#4a5568', text3:'#718096', header:'#ffffff', footer:'#e2e8f0', badge:'#eef2f7', success:'#059669', warn:'#D97706' },
  black: { bg:'#000000', surface:'#111111', surface2:'#1a1a1a', border:'#2a2a2a', text:'#ffffff', text2:'#cccccc', text3:'#666666', header:'#000000', footer:'#000000', badge:'#1a1a1a', success:'#10B981', warn:'#F59E0B' },
}

function getTC(hex) {
  if (!hex) return '#fff'
  const n = parseInt(hex.replace('#',''),16)
  return ((n>>16)*299+(n>>8&255)*587+(n&255)*114)/1000>128?'#000':'#fff'
}

function Clock({ T, cs }) {
  const [t, setT] = useState(new Date())
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i) }, [])
  const s = (cs||100)/100
  return (
    <div style={{ textAlign:'right' }}>
      <div style={{ fontSize:`${2.6*s}rem`, fontWeight:900, lineHeight:1, color:T.text, letterSpacing:'-0.02em' }}>
        {String(t.getHours()).padStart(2,'0')}:{String(t.getMinutes()).padStart(2,'0')}
      </div>
      <div style={{ fontSize:`${0.8*s}rem`, color:T.text3, marginTop:2 }}>
        {t.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}
      </div>
    </div>
  )
}

function Popup({ onClose, T, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }} onClick={onClose}>
      <div style={{ background:T.surface, borderRadius:16, padding:24, maxWidth:480, width:'92%', maxHeight:'85vh', overflow:'auto', border:`1px solid ${T.border}`, boxShadow:'0 24px 64px rgba(0,0,0,0.5)' }} onClick={e=>e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}


function AutoClosePopup({ seconds, onClose, children }) {
  const [count, setCount] = React.useState(seconds)
  React.useEffect(() => {
    setCount(seconds)
    const iv = setInterval(() => setCount(c => { if(c<=1){clearInterval(iv);onClose();return 0} return c-1 }), 1000)
    return () => clearInterval(iv)
  }, [seconds])
  // Clone child and inject countdown into onClose button - just render children with auto-close
  React.useEffect(() => {}, [count])
  return <>{children}</>
}

function WeekPopupLarge({ name, weekData, T, primary, screen, onClose }) {
  const autoClose = screen?.popup_auto_close || 30
  const [countdown, setCountdown] = React.useState(autoClose)

  React.useEffect(() => {
    setCountdown(autoClose)
    const iv = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(iv); onClose(); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [autoClose])

  const DAYS = ['Mo','Di','Mi','Do','Fr','Sa','So']

  // Time range from branding settings (passed via screen or defaults)
  const minHour = parseInt((screen?.cal_min_time || '06:00').split(':')[0])
  const maxHour = parseInt((screen?.cal_max_time || '22:00').split(':')[0])
  const totalHours = maxHour - minHour
  const PX_PER_HOUR = 60
  const timelineHeight = totalHours * PX_PER_HOUR

  const getTopPct = (dateStr) => {
    const d = new Date(dateStr)
    const mins = (d.getHours() - minHour) * 60 + d.getMinutes()
    return Math.max(0, (mins / 60) * PX_PER_HOUR)
  }
  const getHeightPct = (startStr, endStr) => {
    const s = new Date(startStr), e = new Date(endStr)
    const mins = (e - s) / 60000
    return Math.max(PX_PER_HOUR * 0.5, (mins / 60) * PX_PER_HOUR)
  }

  const hours = Array.from({ length: totalHours + 1 }, (_, i) => minHour + i)
  const now = new Date()
  const nowTop = getTopPct(now)

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }} onClick={onClose}>
      <div style={{ background:T.surface, borderRadius:20, padding:'20px 24px', width:'85vw', maxHeight:'88vh', display:'flex', flexDirection:'column', border:`1px solid ${T.border}`, boxShadow:'0 24px 64px rgba(0,0,0,0.5)' }} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexShrink:0 }}>
          <div style={{ fontWeight:800, fontSize:'1.2rem', color:T.text }}>📅 {name} – Diese Woche</div>
          <button onClick={onClose} style={{ background:T.surface2, border:`1px solid ${T.border}`, borderRadius:10, color:T.text2, cursor:'pointer', padding:'8px 16px', fontSize:'0.9rem', fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
            <span>✕ Schließen</span>
            <span style={{ background:T.border, borderRadius:20, padding:'2px 10px', fontSize:'0.85rem', color:T.text3, fontVariantNumeric:'tabular-nums' }}>{countdown}s</span>
          </button>
        </div>

        {!weekData
          ? <div style={{ color:T.text3, textAlign:'center', padding:60 }}>Lädt...</div>
          : weekData.error
          ? <div style={{ color:'#EF4444', textAlign:'center', padding:60 }}>Fehler beim Laden</div>
          : (
            <div style={{ flex:1, overflow:'auto' }}>
              {/* Day headers */}
              <div style={{ display:'grid', gridTemplateColumns:`48px repeat(7, 1fr)`, gap:0, marginBottom:4 }}>
                <div />
                {DAYS.map((d, i) => {
                  const isToday = now.getDay() === (i === 6 ? 0 : i + 1)
                  return (
                    <div key={i} style={{ textAlign:'center', fontWeight:700, fontSize:'0.8rem', color:isToday?primary:T.text3, textTransform:'uppercase', letterSpacing:'0.05em', padding:'4px 0', borderRadius:8, background:isToday?primary+'18':'transparent' }}>
                      {d}
                    </div>
                  )
                })}
              </div>

              {/* Timeline grid */}
              <div style={{ display:'grid', gridTemplateColumns:`48px repeat(7, 1fr)`, gap:0, position:'relative' }}>

                {/* Hour labels */}
                <div style={{ position:'relative', height:timelineHeight }}>
                  {hours.map(h => (
                    <div key={h} style={{ position:'absolute', top:(h - minHour) * PX_PER_HOUR - 8, right:4, fontSize:'0.68rem', color:T.text3, whiteSpace:'nowrap' }}>
                      {String(h).padStart(2,'0')}:00
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {DAYS.map((d, i) => {
                  const dayAppts = (weekData.appointments||[]).filter(a => {
                    const dw = new Date(a.start).getDay()
                    return (dw===0?6:dw-1)===i
                  })
                  const isToday = now.getDay() === (i === 6 ? 0 : i + 1)

                  return (
                    <div key={i} style={{ position:'relative', height:timelineHeight, borderLeft:`1px solid ${T.border}`, background:isToday?primary+'08':'transparent' }}>
                      {/* Hour lines */}
                      {hours.map(h => (
                        <div key={h} style={{ position:'absolute', top:(h-minHour)*PX_PER_HOUR, left:0, right:0, borderTop:`1px solid ${T.border}`, opacity:0.5 }} />
                      ))}

                      {/* Current time line */}
                      {isToday && now.getHours() >= minHour && now.getHours() < maxHour && (
                        <div style={{ position:'absolute', top:nowTop, left:0, right:0, height:2, background:primary, zIndex:2 }}>
                          <div style={{ position:'absolute', left:-4, top:-4, width:10, height:10, borderRadius:'50%', background:primary }} />
                        </div>
                      )}

                      {/* Appointments */}
                      {dayAppts.map((a, j) => {
                        if (a.allDay) return (
                          <div key={j} style={{ position:'absolute', top:2, left:2, right:2, padding:'3px 6px', borderRadius:6, background:a.color||primary, zIndex:1 }}>
                            <div style={{ fontSize:'0.72rem', fontWeight:600, color:getTC(a.color||primary) }}>{a.title}</div>
                            <div style={{ fontSize:'0.65rem', color:getTC(a.color||primary), opacity:0.85 }}>Ganztag</div>
                          </div>
                        )
                        const top = getTopPct(a.start)
                        const height = getHeightPct(a.start, a.end)
                        return (
                          <div key={j} style={{ position:'absolute', top, left:2, right:2, height, padding:'3px 6px', borderRadius:6, background:a.color||primary, zIndex:1, overflow:'hidden' }}>
                            <div style={{ fontSize:'0.72rem', fontWeight:600, color:getTC(a.color||primary), lineHeight:1.2 }}>{a.title}</div>
                            <div style={{ fontSize:'0.65rem', color:getTC(a.color||primary), opacity:0.85 }}>{fmtTime(a.start)} – {fmtTime(a.end)}</div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        }
      </div>
    </div>
  )
}

export default function DisplayScreen() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [popup, setPopup] = useState(null)
  const [weekData, setWeekData] = useState(null)
  const [todoUsers, setTodoUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState('')
  const [completing, setCompleting] = useState(false)
  const leftRef = useRef(null)
  const rightRef = useRef(null)
  const newsRef = useRef(null)
  const todosRef = useRef(null)

  const load = useCallback((silent = false) => {
    fetch(`/api/display/public/${token}`)
      .then(r=>r.json())
      .then(d => {
        if(d.error) { if(!silent) setError(d.error) }
        else setData(d)
      })
      .catch(() => { if(!silent) setError('Verbindungsfehler') })
  }, [token])

  useEffect(() => {
    load()
    const iv = setInterval(() => load(true), 60000)
    return () => clearInterval(iv)
  }, [load])

  useEffect(() => {
    if (data) fetch('/api/display/todos/auto-archive', { method:'POST' }).catch(()=>{})
  }, [data?.screen?.id])

  if (error) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0d1117', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:'3rem' }}>⚠️</div>
      <div style={{ color:'#8899bb' }}>{error}</div>
    </div>
  )
  if (!data) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0d1117' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid #2a3350', borderTopColor:'#3B82F6', animation:'spin 0.8s linear infinite' }} />
    </div>
  )

  const { screen, branding, appointments=[], allUsers=[], news=[], todos=[] } = data
  const primary = branding.primary_color || '#2563EB'
  const T = THEMES[screen.theme || 'dark']
  const touch = !!screen.touch_enabled
  const fs = (screen.font_size || 100) / 100
  const scrollSpeed = screen.scroll_speed || 30
  const autoScroll = !touch

  // Determine layout
  const hasLeft = !!screen.show_news || !!screen.show_todos
  const hasRight = !!screen.show_appointments

  // Group by user
  const byUser = {}
  appointments.forEach(a => { if(!byUser[a.user_name]) byUser[a.user_name]=[]; byUser[a.user_name].push(a) })
  const displayUsers = !!screen.show_all_users
    ? [...new Set([...Object.keys(byUser), ...allUsers])]
    : Object.keys(byUser)

  const logoUrl = screen.logo_url || branding.logo_url
  const logoH = screen.logo_height || 48
  const showHeader = logoUrl || screen.show_header_name

  // Week popup load
  const openWeek = async (name) => {
    if (!touch) return
    setPopup({ type:'week', name })
    setWeekData(null)
    try {
      const wr = await fetch(`/api/display/public/${token}/week/${encodeURIComponent(name)}`)
      const d = await wr.json()
      setWeekData(d)
    } catch(e) { setWeekData({ error: true }) }
  }

  const openTodo = (todo) => {
    if (!touch) return
    setPopup({ type:'todo', todo })
    setSelectedUser('')
    setTodoUsers(allUsers.length > 0 ? allUsers : displayUsers)
  }

  const completeTodo = async () => {
    if (!selectedUser) return
    setCompleting(true)
    try {
      const r = await fetch(`/api/display/public/${token}/todos/${popup.todo.id}/complete`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ user_name: selectedUser })
      })
      const d = await r.json()
      if (d.success) { load(); setPopup(null) }
    } catch(e) {}
    setCompleting(false)
  }

  const DAYS = ['Mo','Di','Mi','Do','Fr','Sa','So']

  return (
    <div style={{ height:'100vh', background:T.bg, color:T.text, fontFamily:'system-ui,sans-serif', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0} @keyframes spin{to{transform:rotate(360deg)}} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:${T.border};border-radius:2px}`}</style>

      {/* Header */}
      {showHeader ? (
        <div style={{ background:T.header, borderBottom:`1px solid ${T.border}`, padding:'10px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {logoUrl && <img src={logoUrl} alt="" style={{ height:`${logoH}px`, maxWidth:200, objectFit:'contain' }} />}
            {!!screen.show_header_name && (
              <div>
                <div style={{ fontSize:`${1.1*fs}rem`, fontWeight:800, color:primary }}>{branding.company_name}</div>
                <div style={{ fontSize:`${0.75*fs}rem`, color:T.text3 }}>{screen.name}</div>
              </div>
            )}
          </div>
          <Clock T={T} cs={screen.clock_size} />
        </div>
      ) : (
        <div style={{ background:T.header, borderBottom:`1px solid ${T.border}`, padding:'6px 24px', display:'flex', justifyContent:'flex-end', flexShrink:0 }}>
          <Clock T={T} cs={screen.clock_size} />
        </div>
      )}

      {/* Body - dynamic grid */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns: hasLeft && hasRight ? '320px 1fr' : '1fr', overflow:'hidden' }}>

        {/* LEFT: News + Todos */}
        {hasLeft && (
          <div style={{ borderRight: hasRight ? `1px solid ${T.border}` : 'none', display:'flex', flexDirection:'column', overflow:'hidden' }}>

            {!!screen.show_news && (
              <div ref={newsRef} style={{ flex: screen.show_todos ? '1' : '1 1 100%', overflow:'hidden', padding:14, borderBottom: screen.show_todos ? `1px solid ${T.border}` : 'none', position:'relative' }}>
                <AutoScroller enabled={autoScroll} speed={scrollSpeed}>
                  <div style={{ fontSize:`${0.7*fs}rem`, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:T.success, marginBottom:10 }}>📰 News</div>
                  {news.length === 0
                    ? <div style={{ color:T.text3, fontSize:`${0.82*fs}rem`, textAlign:'center', padding:20 }}>Keine News</div>
                    : news.map(n => (
                      <div key={n.id} style={{ padding:'10px 12px', background:T.surface, borderRadius:8, marginBottom:8, borderLeft:`3px solid ${T.success}` }}>
                        <div style={{ fontWeight:700, fontSize:`${0.88*fs}rem`, color:T.text, marginBottom:3 }}>{n.title}</div>
                        {n.content && <div style={{ fontSize:`${0.78*fs}rem`, color:T.text2, lineHeight:1.5 }}>{n.content}</div>}
                        <div style={{ fontSize:`${0.68*fs}rem`, color:T.text3, marginTop:5 }}>{n.author_name} · {new Date(n.created_at*1000).toLocaleDateString('de-DE')}</div>
                      </div>
                    ))
                  }
                </AutoScroller>
              </div>
            )}

            {!!screen.show_todos && (
              <div style={{ flex:'1', overflow:'hidden', padding:14 }}>
                <AutoScroller enabled={autoScroll} speed={scrollSpeed}>
                  <div style={{ fontSize:`${0.7*fs}rem`, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:T.warn, marginBottom:10 }}>✅ Zu erledigen</div>
                  {todos.length === 0
                    ? <div style={{ color:T.text3, fontSize:`${0.82*fs}rem`, textAlign:'center', padding:20 }}>Nichts zu erledigen</div>
                    : todos.map(t => (
                      <div key={t.id}
                        onClick={() => openTodo(t)}
                        style={{ padding:'10px 12px', background:T.surface, borderRadius:8, marginBottom:8, borderLeft:`3px solid ${T.warn}`, cursor:touch?'pointer':'default' }}
                        onMouseEnter={e=>{ if(touch) e.currentTarget.style.opacity='0.8' }}
                        onMouseLeave={e=>{ if(touch) e.currentTarget.style.opacity='1' }}>
                        <div style={{ fontWeight:700, fontSize:`${0.88*fs}rem`, color:T.text, display:'flex', justifyContent:'space-between' }}>
                          <span>{t.title}</span>
                          {touch && <span style={{ fontSize:`${0.7*fs}rem`, color:T.text3 }}>→</span>}
                        </div>
                        {t.description && <div style={{ fontSize:`${0.78*fs}rem`, color:T.text2, marginTop:3 }}>{t.description}</div>}
                        {t.completions?.length > 0 && (
                          <div style={{ marginTop:6, display:'flex', flexDirection:'column', gap:3 }}>
                            {t.completions.map((c,i) => (
                              <div key={i} style={{ fontSize:`${0.72*fs}rem`, display:'flex', alignItems:'center', gap:5, padding:'3px 8px', background:'rgba(16,185,129,0.12)', borderRadius:5 }}>
                                <span style={{ color:T.success, fontWeight:700 }}>✓</span>
                                <span style={{ color:T.text, fontWeight:600 }}>{c.name}</span>
                                <span style={{ color:T.text3 }}>· {c.date}</span>
                                {c.confirmed && <span style={{ color:'#6366F1' }}>· ✓</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  }
                </AutoScroller>
              </div>
            )}
          </div>
        )}

        {/* RIGHT: Appointments */}
        {hasRight && (
          <div style={{ overflow:'hidden', padding:16 }}>
            <AutoScroller enabled={autoScroll} speed={scrollSpeed}>
              <div style={{ fontSize:`${0.7*fs}rem`, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:primary, marginBottom:14 }}>📅 Termine heute</div>
              {displayUsers.length === 0
                ? <div style={{ color:T.text3, textAlign:'center', padding:'60px 0', fontSize:`${1*fs}rem` }}>🎉 Keine Termine heute</div>
                : (
                  <div style={{ display:'grid', gridTemplateColumns: hasLeft ? 'repeat(auto-fill,minmax(220px,1fr))' : 'repeat(auto-fill,minmax(240px,1fr))', gap:10 }}>
                    {displayUsers.map(name => {
                      const appts = byUser[name] || []
                      const initials = name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()
                      return (
                        <div key={name} style={{ background:T.surface, borderRadius:12, border:`1px solid ${T.border}`, overflow:'hidden' }}>
                          <div
                            onClick={() => openWeek(name)}
                            style={{ padding:'10px 12px', borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', gap:8, cursor:touch?'pointer':'default', background:T.surface2 }}
                            onMouseEnter={e=>{ if(touch) e.currentTarget.style.opacity='0.75' }}
                            onMouseLeave={e=>{ if(touch) e.currentTarget.style.opacity='1' }}>
                            <div style={{ width:32, height:32, borderRadius:'50%', background:primary, display:'flex', alignItems:'center', justifyContent:'center', color:getTC(primary), fontWeight:700, fontSize:`${0.8*fs}rem`, flexShrink:0 }}>
                              {initials}
                            </div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontWeight:700, fontSize:`${0.88*fs}rem`, color:T.text }}>{name}</div>
                              <div style={{ fontSize:`${0.7*fs}rem`, color:T.text3 }}>{appts.length} Termin{appts.length!==1?'e':''}{touch?' · Woche →':''}</div>
                            </div>
                          </div>
                          <div style={{ padding:'8px', display:'flex', flexDirection:'column', gap:5 }}>
                            {appts.length === 0
                              ? <div style={{ padding:'8px', color:T.text3, fontSize:`${0.78*fs}rem`, textAlign:'center' }}>Keine Termine</div>
                              : appts.map((a,i) => {
                                const bg = a.color || primary
                                const tc = getTC(bg)
                                return (
                                  <div key={i}
                                    onClick={() => touch && setPopup({ type:'appt', appt:a })}
                                    style={{ padding:'7px 10px', background:bg, borderRadius:7, cursor:touch?'pointer':'default' }}
                                    onMouseEnter={e=>{ if(touch) e.currentTarget.style.opacity='0.8' }}
                                    onMouseLeave={e=>{ if(touch) e.currentTarget.style.opacity='1' }}>
                                    <div style={{ fontWeight:600, fontSize:`${0.82*fs}rem`, color:tc }}>{a.title}</div>
                                    <div style={{ fontSize:`${0.7*fs}rem`, color:tc, opacity:0.85, marginTop:2 }}>
                                      {a.allDay?'Ganztag':`${fmtTime(a.start)} – ${fmtTime(a.end)}`}
                                    </div>
                                  </div>
                                )
                              })
                            }
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              }
            </AutoScroller>
          </div>
        )}
      </div>

      {/* Footer */}
      {!!screen.show_footer && (
        <div style={{ padding:'5px 20px', background:T.footer, borderTop:`1px solid ${T.border}`, fontSize:`${0.68*fs}rem`, color:T.text3, display:'flex', justifyContent:'space-between', flexShrink:0 }}>
          <span>LD Connect Mitarbeiterportal</span>
          <span>Aktualisierung alle 60 Sekunden</span>
        </div>
      )}

      {/* Popups */}
      {popup?.type === 'appt' && (
        <AutoClosePopup seconds={screen?.popup_auto_close||30} onClose={() => setPopup(null)}>
          <ApptDetailPopup
            recno={popup.appt.recno}
            label={popup.appt.label}
            screenToken={token}
            labelColors={(() => { const m={}; appointments.forEach(a=>{ if(a.label&&a.color) m[a.label]=a.color }); return m })()}
            onClose={() => setPopup(null)}
            theme={T}
          />
        </AutoClosePopup>
      )}

      {popup?.type === 'week' && (
        <WeekPopupLarge
          name={popup.name}
          weekData={weekData}
          T={T}
          primary={primary}
          screen={{...screen, cal_min_time: data?.branding?.cal_min_time, cal_max_time: data?.branding?.cal_max_time}}
          onClose={() => setPopup(null)}
        />
      )}

      {popup?.type === 'todo' && (
        <Popup onClose={() => setPopup(null)} T={T}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <div style={{ fontWeight:800, fontSize:'1.05rem', color:T.text }}>✅ Aufgabe erledigt</div>
            <button onClick={() => setPopup(null)} style={{ background:'none', border:'none', color:T.text3, fontSize:'1.3rem', cursor:'pointer' }}>✕</button>
          </div>
          <div style={{ color:T.text2, fontSize:'0.9rem', marginBottom:18 }}>{popup.todo.title}</div>
          <div style={{ fontWeight:600, fontSize:'0.82rem', color:T.text3, marginBottom:10 }}>Wer hat es erledigt?</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16, maxHeight:220, overflow:'auto' }}>
            {todoUsers.map(u => (
              <div key={u} onClick={() => setSelectedUser(u)}
                style={{ padding:'10px 14px', borderRadius:10, border:`2px solid ${selectedUser===u?primary:T.border}`, background:selectedUser===u?primary+'22':T.surface2, cursor:'pointer', color:T.text, fontWeight:selectedUser===u?700:400, transition:'all 0.12s' }}>
                {selectedUser===u?'✓ ':''}{u}
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={completeTodo} disabled={!selectedUser||completing}
              style={{ flex:1, padding:'12px', borderRadius:10, border:'none', background:selectedUser?primary:'#444', color:selectedUser?getTC(primary):'#888', fontWeight:700, fontSize:'0.9rem', cursor:selectedUser?'pointer':'not-allowed', transition:'all 0.15s' }}>
              {completing?'Speichern...':'Als erledigt markieren'}
            </button>
            <button onClick={() => setPopup(null)} style={{ padding:'12px 16px', borderRadius:10, border:`1px solid ${T.border}`, background:'none', color:T.text2, cursor:'pointer' }}>✕</button>
          </div>
        </Popup>
      )}
    </div>
  )
}

// Auto-scroll wrapper component
function AutoScroller({ enabled, speed, children }) {
  const ref = useRef(null)
  useAutoScroll(ref, enabled, speed)
  return (
    <div ref={ref} style={{ height:'100%', overflow: enabled ? 'hidden' : 'auto' }}>
      {children}
    </div>
  )
}

function useAutoScroll(ref, enabled, speed) {
  useEffect(() => {
    if (!enabled || !ref.current) return
    const el = ref.current
    if (el.scrollHeight <= el.clientHeight) return
    let pos = 0, dir = 1, raf, paused = false
    const px = (speed || 30) / 60
    const step = () => {
      if (!paused) {
        pos += dir * px
        const max = el.scrollHeight - el.clientHeight
        if (pos >= max) { pos = max; dir = -1; paused = true; setTimeout(() => { paused = false }, 3000) }
        if (pos <= 0) { pos = 0; dir = 1; paused = true; setTimeout(() => { paused = false }, 3000) }
        el.scrollTop = pos
      }
      raf = requestAnimationFrame(step)
    }
    const timer = setTimeout(() => { raf = requestAnimationFrame(step) }, 2000)
    return () => { clearTimeout(timer); cancelAnimationFrame(raf) }
  }, [enabled, speed, ref.current?.scrollHeight])
}
