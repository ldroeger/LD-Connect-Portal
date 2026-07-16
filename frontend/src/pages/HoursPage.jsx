import React, { useState, useEffect } from 'react'
import api from '../utils/api.js'

const MONTH_NAMES = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']

export default function HoursPage() {
  const [year, setYear]       = useState(new Date().getFullYear())
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [days, setDays]       = useState([])
  const [daysLoading, setDaysLoading] = useState(false)

  // Einstellungen: welche Kacheln/Spalten anzeigen
  const [showIst, setShowIst]   = useState(true)
  const [showSoll, setShowSoll] = useState(true)
  const [showUeber, setShowUeber] = useState(true)
  const [showSollSpalte, setShowSollSpalte] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get('/hours/summary?year=' + year).then(r => {
      setData(r.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [year])

  const toggleMonth = async (monthNum) => {
    if (expanded === monthNum) { setExpanded(null); return }
    setExpanded(monthNum)
    setDaysLoading(true)
    try {
      const r = await api.get('/hours/days?year=' + year + '&month=' + monthNum)
      setDays(r.data.days || [])
    } catch(e) { setDays([]) }
    setDaysLoading(false)
  }

  const years = []
  for (let y = new Date().getFullYear(); y >= 2020; y--) years.push(y)

  const totalIst   = data?.months?.reduce((s,m) => s + (m.ist||0), 0) || 0
  const totalSoll  = data?.months?.reduce((s,m) => s + (m.soll||0), 0) || 0
  const totalSaldo = totalIst - totalSoll
  const hasUeber   = totalSaldo > 0

  const card = { background:'var(--surface)', borderRadius:14, border:'1px solid var(--border)',
    padding:'20px 28px', boxShadow:'var(--shadow)', textAlign:'center', flex:1 }

  return (
    <div style={{ width:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:'1.3rem', fontWeight:800 }}>⏱ Stundenkonto</h1>
          <p style={{ color:'var(--text-3)', fontSize:'0.85rem', marginTop:2 }}>Monatliche Auswertung aus Powerbird</p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <label style={{ fontSize:'0.85rem', fontWeight:600 }}>Jahr</label>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            style={{ padding:'7px 12px', borderRadius:8, border:'1px solid var(--border)',
              background:'var(--surface)', color:'var(--text)', fontFamily:'var(--font)', fontSize:'0.88rem' }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {/* Einstellungen-Button */}
          <div style={{ position:'relative' }}>
            <button onClick={() => setSettingsOpen(s => !s)}
              style={{ padding:'7px 12px', borderRadius:8, border:'1px solid var(--border)',
                background: settingsOpen ? 'var(--primary)' : 'var(--surface-2)',
                color: settingsOpen ? 'white' : 'var(--text)',
                cursor:'pointer', fontFamily:'var(--font)', fontSize:'0.82rem', fontWeight:600 }}>
              ⚙ Ansicht
            </button>
            {settingsOpen && (
              <div style={{ position:'absolute', right:0, top:40, background:'var(--surface)', border:'1px solid var(--border)',
                borderRadius:12, boxShadow:'0 8px 32px rgba(0,0,0,0.15)', padding:16, zIndex:100, minWidth:200 }}>
                <div style={{ fontWeight:700, fontSize:'0.85rem', marginBottom:10 }}>Kacheln anzeigen</div>
                {[['showIst','Ist-Stunden',showIst,setShowIst],['showSoll','Soll-Stunden',showSoll,setShowSoll],
                  ['showUeber','Überstunden-Saldo',showUeber,setShowUeber]].map(([k,l,v,s]) => (
                  <label key={k} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, fontSize:'0.85rem', cursor:'pointer' }}>
                    <input type="checkbox" checked={v} onChange={e => s(e.target.checked)} />
                    {l}
                  </label>
                ))}
                <div style={{ fontWeight:700, fontSize:'0.85rem', marginBottom:10, marginTop:12, borderTop:'1px solid var(--border)', paddingTop:10 }}>Spalten anzeigen</div>
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:'0.85rem', cursor:'pointer' }}>
                  <input type="checkbox" checked={showSollSpalte} onChange={e => setShowSollSpalte(e.target.checked)} />
                  Soll-Stunden Spalte
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Kacheln */}
      {(showIst || showSoll || (showUeber && hasUeber)) && (
        <div style={{ display:'flex', gap:16, marginBottom:24, flexWrap:'wrap' }}>
          {showIst && (
            <div style={card}>
              <div style={{ fontSize:'2rem', fontWeight:800, color:'var(--primary)' }}>{totalIst.toFixed(1)}h</div>
              <div style={{ color:'var(--text-3)', fontSize:'0.82rem', marginTop:4 }}>Ist {year}</div>
            </div>
          )}
          {showSoll && (
            <div style={card}>
              <div style={{ fontSize:'2rem', fontWeight:800, color:'var(--text)' }}>{totalSoll}h</div>
              <div style={{ color:'var(--text-3)', fontSize:'0.82rem', marginTop:4 }}>Soll {year}</div>
            </div>
          )}
          {showUeber && hasUeber && (
            <div style={card}>
              <div style={{ fontSize:'2rem', fontWeight:800, color: totalSaldo >= 0 ? '#10B981' : '#EF4444' }}>
                {totalSaldo >= 0 ? '+' : ''}{totalSaldo.toFixed(1)}h
              </div>
              <div style={{ color:'var(--text-3)', fontSize:'0.82rem', marginTop:4 }}>Überstunden {year}</div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--text-3)' }}>Lädt...</div>
      ) : !data?.months?.length ? (
        <div style={{ background:'var(--surface)', borderRadius:14, border:'1px solid var(--border)', padding:40, textAlign:'center', color:'var(--text-3)' }}>
          Keine Daten für {year}
        </div>
      ) : (
        <div style={{ background:'var(--surface)', borderRadius:14, border:'1px solid var(--border)', overflow:'hidden', boxShadow:'var(--shadow)' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:'0.9rem' }}>
            Monatsübersicht — Monat anklicken für Tagesdetails
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'var(--surface-2)', fontSize:'0.78rem', color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                <th style={{ padding:'10px 20px', textAlign:'left', fontWeight:600 }}>Monat</th>
                <th style={{ padding:'10px 16px', textAlign:'right', fontWeight:600 }}>Ist</th>
                {showSollSpalte && <th style={{ padding:'10px 16px', textAlign:'right', fontWeight:600 }}>Soll</th>}
                <th style={{ padding:'10px 16px', textAlign:'right', fontWeight:600 }}>Überstunden</th>
              </tr>
            </thead>
            <tbody>
              {data.months.map((m, i) => {
                const saldo = (m.ist || 0) - (m.soll || 0)
                const isExp = expanded === m.month
                return (
                  <React.Fragment key={m.month}>
                    <tr onClick={() => toggleMonth(m.month)}
                      style={{ borderTop:'1px solid var(--border)', cursor:'pointer',
                        background: isExp ? 'var(--primary-light,rgba(37,99,235,0.06))' : i%2===0?'transparent':'var(--surface-2)' }}>
                      <td style={{ padding:'12px 20px', fontWeight:600, fontSize:'0.9rem', color:'var(--primary)' }}>
                        {MONTH_NAMES[(m.month||1)-1]} {year} →
                      </td>
                      <td style={{ padding:'12px 16px', textAlign:'right', fontWeight:500 }}>{(m.ist||0).toFixed(2)}h</td>
                      {showSollSpalte && <td style={{ padding:'12px 16px', textAlign:'right', color:'var(--text-3)' }}>{m.soll||0}h</td>}
                      <td style={{ padding:'12px 16px', textAlign:'right', fontWeight:700,
                        color: saldo >= 0 ? '#10B981' : '#EF4444' }}>
                        {saldo >= 0 ? '+' : ''}{saldo.toFixed(1)}h
                      </td>
                    </tr>
                    {isExp && (
                      <tr>
                        <td colSpan={showSollSpalte ? 4 : 3} style={{ padding:0, background:'var(--surface)' }}>
                          {daysLoading ? (
                            <div style={{ padding:'16px 20px', color:'var(--text-3)', fontSize:'0.85rem' }}>Lädt...</div>
                          ) : days.length === 0 ? (
                            <div style={{ padding:'16px 20px', color:'var(--text-3)', fontSize:'0.85rem' }}>Keine Tagesdaten</div>
                          ) : (
                            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
                              <thead>
                                <tr style={{ background:'var(--surface-2)' }}>
                                  <th style={{ padding:'6px 28px', textAlign:'left', color:'var(--text-3)', fontWeight:600 }}>Tag</th>
                                  <th style={{ padding:'6px 16px', textAlign:'right', color:'var(--text-3)', fontWeight:600 }}>Beginn</th>
                                  <th style={{ padding:'6px 16px', textAlign:'right', color:'var(--text-3)', fontWeight:600 }}>Ende</th>
                                  <th style={{ padding:'6px 16px', textAlign:'right', color:'var(--text-3)', fontWeight:600 }}>Stunden</th>
                                </tr>
                              </thead>
                              <tbody>
                                {days.map((d,j) => (
                                  <tr key={j} style={{ borderTop:'1px solid var(--border)', background: j%2===0?'transparent':'var(--surface-2)' }}>
                                    <td style={{ padding:'6px 28px', color:'var(--text-2)' }}>
                                      {new Date(d.datum||d.date).toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'})}
                                    </td>
                                    <td style={{ padding:'6px 16px', textAlign:'right', color:'var(--text-3)' }}>{d.von||d.start||'—'}</td>
                                    <td style={{ padding:'6px 16px', textAlign:'right', color:'var(--text-3)' }}>{d.bis||d.end||'—'}</td>
                                    <td style={{ padding:'6px 16px', textAlign:'right', fontWeight:500 }}>{(d.stunden||d.hours||0).toFixed(2)}h</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
