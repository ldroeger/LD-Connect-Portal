import React, { useState, useEffect } from "react"
import api from "../utils/api.js"

const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"]
const MONTHS_SHORT = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"]
const fmtH = h => `${Math.round(h*100)/100}h`
const fmtTime = d => { if (!d) return ""; const t = new Date(d); return `${String(t.getHours()).padStart(2,"0")}:${String(t.getMinutes()).padStart(2,"0")}` }
const fmtDate = d => { const t = new Date(d); return `${String(t.getDate()).padStart(2,"0")}.${String(t.getMonth()+1).padStart(2,"0")}.${t.getFullYear()}` }
const dayName = d => ["So","Mo","Di","Mi","Do","Fr","Sa"][new Date(d).getDay()]
const saldoColor = s => s >= 0 ? "var(--success)" : "var(--error)"
const artLabel = a => a === "P" ? "Projekt" : a === "K" ? "KDI" : ""
const artColor = a => a === "P" ? "#6366F1" : "#F59E0B"

const S = {
  card: { background:"var(--surface)", borderRadius:12, border:"1px solid var(--border)", padding:24, boxShadow:"var(--shadow)", marginBottom:20 },
  stats: { display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(150px,1fr))", gap:16, marginBottom:20 },
  stat: { background:"var(--surface)", borderRadius:12, border:"1px solid var(--border)", padding:18, boxShadow:"var(--shadow)", textAlign:"center" },
  statNum: (c) => ({ fontSize:"1.8rem", fontWeight:800, color:c||"var(--primary)", lineHeight:1 }),
  statLabel: { fontSize:"0.78rem", color:"var(--text-3)", marginTop:4 },
  th: { textAlign:"left", padding:"8px 12px", fontSize:"0.75rem", fontWeight:600, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:"0.06em", borderBottom:"1px solid var(--border)" },
  td: { padding:"9px 12px", fontSize:"0.86rem", borderBottom:"1px solid var(--border)", verticalAlign:"top" },
  back: { display:"inline-flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:8, border:"1px solid var(--border)", background:"var(--surface-2)", cursor:"pointer", fontSize:"0.85rem", fontWeight:500, marginBottom:16, fontFamily:"var(--font)" },
  badge: (c) => ({ display:"inline-block", padding:"2px 8px", borderRadius:10, fontSize:"0.75rem", fontWeight:600, background:(c||"#3B82F6")+"22", color:c||"#3B82F6", whiteSpace:"nowrap" }),
}

function JahresView({ year, setYear, onMonthClick }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const years = Array.from({length:5},(_,i)=>new Date().getFullYear()-2+i)

  useEffect(() => {
    setLoading(true); setError("")
    api.get(`/calendar/hours?year=${year}`)
      .then(r => { setData(r.data); setLoading(false) })
      .catch(e => { setError(e.response?.data?.error||"Fehler"); setLoading(false) })
  }, [year])

  return (
    <div>
      <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:20 }}>
        <label style={{ fontSize:"0.85rem", fontWeight:600 }}>Jahr</label>
        <select style={{ padding:"7px 12px", borderRadius:8, border:"1px solid var(--border)", fontFamily:"var(--font)", fontSize:"0.9rem" }} value={year} onChange={e=>setYear(+e.target.value)}>
          {years.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        {loading && <span style={{ color:"var(--text-3)", fontSize:"0.85rem" }}>Lädt...</span>}
      </div>
      {error && <div style={{ background:"rgba(239,68,68,0.12)",border:"1px solid #FECACA",color:"#DC2626",padding:"10px 14px",borderRadius:8,fontSize:"0.85rem",marginBottom:16 }}>{error}</div>}
      {data && <>
        <div style={S.stats}>
          <div style={S.stat}><div style={S.statNum()}>{fmtH(data.total_ist)}</div><div style={S.statLabel}>Ist {year}</div></div>
          <div style={S.stat}><div style={S.statNum("var(--text-2)")}>{fmtH(data.total_soll)}</div><div style={S.statLabel}>Soll {year}</div></div>
          <div style={S.stat}><div style={S.statNum(saldoColor(data.total_saldo))}>{data.total_saldo>=0?"+":""}{fmtH(data.total_saldo)}</div><div style={S.statLabel}>Saldo {year}</div></div>
        </div>
        <div style={S.card}>
          <div style={{ fontWeight:700, fontSize:"1rem", marginBottom:16 }}>Monatsübersicht – Monat anklicken für Tagesdetails</div>
          {data.months.length === 0
            ? <div style={{ color:"var(--text-3)", textAlign:"center", padding:"20px 0" }}>Keine Daten für {year}.</div>
            : <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr>
                  <th style={S.th}>Monat</th>
                  <th style={{ ...S.th, textAlign:"right" }}>Ist</th>
                  <th style={{ ...S.th, textAlign:"right" }}>Soll</th>
                  <th style={{ ...S.th, textAlign:"right" }}>Saldo</th>
                  <th style={S.th}>Auslastung</th>
                </tr></thead>
                <tbody>
                  {data.months.map((m,i) => {
                    const monatStr = String(m.monat)
                    const monatNum = parseInt(monatStr.slice(5,7)) || parseInt(monatStr.slice(4,6)) || (i+1)
                    const pct = m.soll > 0 ? Math.min(100,(m.ist/m.soll)*100) : 100
                    const sal = m.saldo || (m.ist - m.soll)
                    return (
                      <tr key={i} onClick={() => onMonthClick(monatNum)} style={{ cursor:"pointer" }}
                        onMouseEnter={e=>e.currentTarget.style.background="var(--primary-light)"}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <td style={{ ...S.td, fontWeight:600, color:"var(--primary)" }}>{MONTHS[monatNum-1]} {year} →</td>
                        <td style={{ ...S.td, textAlign:"right", fontFamily:"monospace" }}>{fmtH(m.ist)}</td>
                        <td style={{ ...S.td, textAlign:"right", fontFamily:"monospace", color:"var(--text-3)" }}>{fmtH(m.soll)}</td>
                        <td style={{ ...S.td, textAlign:"right", fontFamily:"monospace", fontWeight:600, color:saldoColor(sal) }}>{sal>=0?"+":""}{fmtH(Math.round(sal*10)/10)}</td>
                        <td style={S.td}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <div style={{ height:8, borderRadius:4, background:"var(--border)", overflow:"hidden", flex:1 }}>
                              <div style={{ height:8, borderRadius:4, background:pct>=100?"var(--success)":"var(--primary)", width:`${pct}%`, minWidth:pct>0?4:0 }} />
                            </div>
                            <span style={{ fontSize:"0.78rem", color:"var(--text-3)", width:36 }}>{Math.round(pct)}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>}
        </div>
      </>}
    </div>
  )
}

function MonatsView({ year, month, onBack }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [openDay, setOpenDay] = useState(null)

  useEffect(() => {
    setLoading(true); setError("")
    api.get(`/calendar/hours/detail?year=${year}&month=${month}`)
      .then(r => { setData(r.data); setLoading(false) })
      .catch(e => { setError(e.response?.data?.error||"Fehler"); setLoading(false) })
  }, [year, month])

  const byWeek = {}
  if (data) {
    data.tage.forEach(d => {
      const dt = new Date(d.tag)
      const jan1 = new Date(dt.getFullYear(), 0, 1)
      const kw = Math.ceil(((dt - jan1) / 86400000 + jan1.getDay() + 1) / 7)
      if (!byWeek[kw]) byWeek[kw] = []
      byWeek[kw].push(d)
    })
  }

  return (
    <div>
      <button style={S.back} onClick={onBack}>← {year} Jahresübersicht</button>
      <h2 style={{ fontSize:"1.2rem", fontWeight:700, marginBottom:4 }}>{MONTHS[month-1]} {year}</h2>
      {loading && <p style={{ color:"var(--text-3)", fontSize:"0.9rem", marginBottom:16 }}>Lädt...</p>}
      {error && <div style={{ background:"rgba(239,68,68,0.12)",border:"1px solid #FECACA",color:"#DC2626",padding:"10px 14px",borderRadius:8,fontSize:"0.85rem",marginBottom:16 }}>{error}</div>}
      {data && <>
        <div style={S.stats}>
          <div style={S.stat}><div style={S.statNum()}>{fmtH(data.total)}</div><div style={S.statLabel}>Gesamt {MONTHS_SHORT[month-1]}</div></div>
          <div style={S.stat}><div style={S.statNum("var(--text-2)")}>{data.tage.length}</div><div style={S.statLabel}>Arbeitstage</div></div>
          <div style={S.stat}><div style={S.statNum(data.saldo != null ? (data.saldo >= 0 ? "var(--success)" : "var(--error)") : "var(--text-2)")}>{data.saldo != null ? (data.saldo >= 0 ? "+" : "") + fmtH(data.saldo) : "–"}</div><div style={S.statLabel}>Stunden-Saldo</div></div>
        </div>

        {Object.keys(byWeek).length === 0
          ? <div style={S.card}><div style={{ color:"var(--text-3)", textAlign:"center", padding:"20px 0" }}>Keine Arbeitstage in {MONTHS[month-1]} {year}.</div></div>
          : Object.entries(byWeek).map(([kw, tage]) => (
            <div key={kw} style={S.card}>
              <div style={{ fontWeight:700, fontSize:"0.95rem", marginBottom:12, color:"var(--text-2)", display:"flex", justifyContent:"space-between" }}>
                <span>KW {kw}</span>
                <span style={{ fontFamily:"monospace", color:"var(--primary)" }}>{fmtH(tage.reduce((s,d)=>s+d.gesamt,0))} gesamt</span>
              </div>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr>
                  <th style={S.th}>Tag</th>
                  <th style={{ ...S.th, textAlign:"right" }}>Stunden</th>
                  <th style={S.th}>Details</th>
                </tr></thead>
                <tbody>
                  {tage.map((d) => (
                    <React.Fragment key={d.tag}>
                      <tr
                        style={{ cursor: d.eintraege.length > 0 ? "pointer" : "default", background: openDay===d.tag ? "var(--primary-light)" : "transparent" }}
                        onClick={() => d.eintraege.length > 0 && setOpenDay(openDay===d.tag ? null : d.tag)}
                        onMouseEnter={e=>{ if(d.eintraege.length > 0 && openDay!==d.tag) e.currentTarget.style.background="var(--surface-2)" }}
                        onMouseLeave={e=>{ if(openDay!==d.tag) e.currentTarget.style.background="transparent" }}>
                        <td style={{ ...S.td, fontWeight:600 }}>
                          <span style={{ color:"var(--text-3)", marginRight:8, fontSize:"0.82rem" }}>{dayName(d.tag)}</span>
                          {fmtDate(d.tag)}
                        </td>
                        <td style={{ ...S.td, textAlign:"right", fontFamily:"monospace", fontWeight:700, color: d.gesamt > 0 ? "var(--primary)" : "var(--text-3)" }}>
                          {d.gesamt > 0 ? fmtH(d.gesamt) : "–"}
                        </td>
                        <td style={{ ...S.td, color:"var(--text-3)", fontSize:"0.82rem" }}>
                          {d.eintraege.length > 0 ? `${d.eintraege.length} Buchung${d.eintraege.length!==1?"en":""} ${openDay===d.tag ? "▲" : "▼"}` : "Keine Buchungen"}
                        </td>
                      </tr>
                      {openDay === d.tag && d.eintraege.map((e, j) => (
                        <tr key={j} style={{ background:"var(--surface-2)" }}>
                          <td style={{ ...S.td, paddingLeft:32, fontSize:"0.83rem", color:"var(--text-2)", fontFamily:"monospace" }}>
                            {e.von && e.bis ? `${fmtTime(e.von)} – ${fmtTime(e.bis)}` : "–"}
                          </td>
                          <td style={{ ...S.td, textAlign:"right", fontFamily:"monospace", fontSize:"0.83rem", color:"var(--text-2)" }}>{fmtH(e.stunden)}</td>
                          <td style={{ ...S.td, fontSize:"0.83rem" }}>
                            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                              <div style={{ display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
                                {e.art && <span style={S.badge(artColor(e.art))}>{artLabel(e.art)}</span>}
                                {e.nr && <span style={{ fontFamily:"monospace", fontWeight:600, color:"var(--text)" }}>{e.nr}</span>}
                              </div>
                              {e.kunde && <div style={{ color:"var(--text)", fontWeight:500 }}>👤 {e.kunde}</div>}
                              {e.kommission && <div style={{ color:"var(--text-2)" }}>📋 {e.kommission}</div>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        }
      </>}
    </div>
  )
}

export default function HoursPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(null)

  return (
    <div style={{ maxWidth:1400 }}>
      <h1 style={{ fontSize:"1.3rem", fontWeight:700, marginBottom:4 }}>⏱ Stundenkonto</h1>
      <p style={{ color:"var(--text-3)", fontSize:"0.85rem", marginBottom:24 }}>
        {selectedMonth ? `${MONTHS[selectedMonth-1]} ${year} – Tagesdetails` : "Monatliche Auswertung aus Powerbird"}
      </p>
      {selectedMonth === null
        ? <JahresView year={year} setYear={y=>{setYear(y);setSelectedMonth(null)}} onMonthClick={m=>setSelectedMonth(m)} />
        : <MonatsView year={year} month={selectedMonth} onBack={()=>setSelectedMonth(null)} />
      }
    </div>
  )
}
