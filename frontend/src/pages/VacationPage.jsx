import React, { useState, useEffect } from "react"
import api from "../utils/api.js"

const fmtDate = d => d ? new Date(d).toLocaleDateString('de-DE', {day:'2-digit',month:'2-digit',year:'numeric'}) : '–'
const STATUS_LABEL = { pending: translate(lang,'status_pending'), approved: translate(lang,'status_approved'), rejected: translate(lang,'status_rejected') }
const STATUS_COLOR = { pending: '#F59E0B', approved: '#10B981', rejected: '#EF4444' }

function workdays(f, t) {
  let c = 0; const cur = new Date(f); const end = new Date(t)
  while (cur <= end) { const d = cur.getDay(); if (d!==0&&d!==6) c++; cur.setDate(cur.getDate()+1) }
  return c
}

const card = { background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)', padding:20, boxShadow:'var(--shadow)', marginBottom:16 }
const lbl = { display:'block', fontSize:'0.85rem', fontWeight:600, color:'var(--text)', marginBottom:6 }
const inp = { width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:'0.9rem', fontFamily:'var(--font)', outline:'none', boxSizing:'border-box' }
const badge = (c) => ({ display:'inline-block', padding:'2px 10px', borderRadius:12, fontSize:'0.78rem', fontWeight:600, background:(c||'#3B82F6')+'22', color:c||'#3B82F6' })

function StatCard({ value, label, color, sub }) {
  return (
    <div style={{ background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)', padding:'16px 12px', boxShadow:'var(--shadow)', textAlign:'center' }}>
      <div style={{ fontSize:'1.8rem', fontWeight:800, color:color||'var(--primary)', lineHeight:1 }}>
        {value ?? '–'}
      </div>
      <div style={{ fontSize:'0.75rem', color:'var(--text-3)', marginTop:4 }}>{label}</div>
      {sub && <div style={{ fontSize:'0.72rem', color:'var(--text-3)', marginTop:2 }}>{sub}</div>}
    </div>
  )
}

export default function VacationPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [stats, setStats] = useState(null)
  const [requests, setRequests] = useState([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const years = Array.from({length:3},(_,i)=>new Date().getFullYear()-1+i)
  const days = from && to && new Date(from) <= new Date(to) ? workdays(from, to) : 0

  const loadStats = () => {
    api.get(`/vacation/stats?year=${year}`).then(r=>setStats(r.data)).catch(()=>{})
  }
  const loadRequests = () => {
    api.get('/vacation/requests').then(r=>setRequests(r.data.requests)).catch(()=>{})
  }

  useEffect(() => { loadStats() }, [year])
  useEffect(() => { loadRequests() }, [])

  const submit = async () => {
    setErr(''); setMsg('')
    if (!from || !to) return setErr('Bitte Von- und Bis-Datum wählen')
    if (days === 0) return setErr('Kein Werktag im gewählten Zeitraum')
    setLoading(true)
    try {
      await api.post('/vacation/request', { from_date: from, to_date: to, reason })
      setMsg(`Urlaubsantrag für ${days} Arbeitstag${days!==1?'e':''} gestellt. Genehmiger wurden informiert.`)
      setFrom(''); setTo(''); setReason('')
      loadStats(); loadRequests()
    } catch(e) { setErr(e.response?.data?.error || 'Fehler') }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth:1200 }}>
      <h1 style={{ fontSize:'1.2rem', fontWeight:700, marginBottom:4 }}>🌴 Urlaubsplanung</h1>
      

      {/* Jahr */}
      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:16 }}>
        <label style={{ fontSize:'0.85rem', fontWeight:600 }}>Jahr</label>
        <select style={{ padding:'7px 12px', borderRadius:8, border:'1px solid var(--border)', fontFamily:'var(--font)', fontSize:'0.9rem' }} value={year} onChange={e=>setYear(+e.target.value)}>
          {years.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Kacheln aus LOURL */}
      {stats && (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:12, marginBottom:12 }} className="stats-grid-vacation">
            <StatCard value={stats.anspruch} label="Urlaubsanspruch" color="var(--primary)" sub={stats.vorjahr ? `+${stats.vorjahr} Vorjahr` : null} />
            <StatCard value={stats.genehmigt_tage} label="Genehmigt" color="#10B981" />
            <StatCard value={stats.genommen_tage} label="Genommen" color="#6366F1" />
            <StatCard value={stats.offen_tage ?? '–'} label="Noch offen" color={stats.offen_tage > 0 ? '#F59E0B' : '#94A3B8'} />
          </div>
          {(stats.beantragt_tage > 0 || stats.geplant_tage > 0) && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px,1fr))", gap:12, marginBottom:20 }}>
              {stats.beantragt_tage > 0 && <StatCard value={stats.beantragt_tage} label={`Beantragt (${stats.beantragt_anz})`} color="#F59E0B" />}
              {stats.geplant_tage > 0 && <StatCard value={stats.geplant_tage} label="Geplant" color="#94A3B8" />}
              {stats.verfall && <StatCard value={stats.verfall} label="Verfall" color="#EF4444" />}
            </div>
          )}

          {/* Einträge aus Kalender */}
          {stats.eintraege && stats.eintraege.length > 0 && (
            <div style={card}>
              <div style={{ fontWeight:700, fontSize:'0.95rem', marginBottom:12 }}>Urlaubseinträge in Powerbird {year}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {stats.eintraege.map((e,i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'var(--surface-2)', borderRadius:8, fontSize:'0.85rem' }}>
                    <div>
                      <span style={{ fontWeight:500 }}>{fmtDate(e.von)}</span>
                      {e.bis && e.bis !== e.von && <span style={{ color:'var(--text-3)' }}> – {fmtDate(e.bis)}</span>}
                    </div>
                    <span style={{ fontSize:'0.78rem', color:'var(--text-3)' }}>{e.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Antrag stellen */}
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:14 }}>Neuen Urlaubsantrag stellen</div>
        {err && <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', color:'#DC2626', padding:'10px 14px', borderRadius:8, fontSize:'0.85rem', marginBottom:12 }}>{err}</div>}
        {msg && <div style={{ background:'#ECFDF5', border:'1px solid #A7F3D0', color:'#059669', padding:'10px 14px', borderRadius:8, fontSize:'0.85rem', marginBottom:12 }}>{msg}</div>}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }} className="form-row">
          <div><label style={lbl}>Von *</label><input style={inp} type="date" value={from} onChange={e=>setFrom(e.target.value)} /></div>
          <div><label style={lbl}>Bis *</label><input style={inp} type="date" value={to} onChange={e=>setTo(e.target.value)} /></div>
        </div>
        {days > 0 && <div style={{ fontSize:'0.85rem', color:'var(--primary)', fontWeight:600, margin:'8px 0' }}>{days} Arbeitstag{days!==1?'e':''}</div>}
        <div style={{ marginTop:10 }}>
          <label style={lbl}>Bemerkung (optional)</label>
          <textarea style={{ ...inp, minHeight:70, resize:'vertical' }} value={reason} onChange={e=>setReason(e.target.value)} placeholder="z.B. Familienurlaub..." />
        </div>
        <button style={{ marginTop:14, padding:'10px 24px', borderRadius:8, border:'none', background:'var(--primary)', color:'white', fontWeight:600, fontSize:'0.9rem', cursor:'pointer', fontFamily:'var(--font)', width:'100%' }}
          onClick={submit} disabled={loading || days===0}>
          {loading ? 'Wird gesendet...' : 'Urlaubsantrag stellen'}
        </button>
      </div>

      {/* Meine Anträge */}
      {requests.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:14 }}>Meine Urlaubsanträge</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {requests.map(r => (
              <div key={r.id} style={{ padding:'12px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface-2)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:6 }}>
                  <div style={{ fontWeight:600, fontSize:'0.88rem' }}>
                    {fmtDate(r.from_date)} – {fmtDate(r.to_date)}
                    <span style={{ fontFamily:'monospace', color:'var(--primary)', marginLeft:8 }}>{r.days}d</span>
                  </div>
                  <span style={badge(STATUS_COLOR[r.status])}>{STATUS_LABEL[r.status]}</span>
                </div>
                {r.reason && <div style={{ fontSize:'0.82rem', color:'var(--text-3)', marginTop:4 }}>{r.reason}</div>}
                {r.status === 'rejected' && r.rejection_reason && (
                  <div style={{ fontSize:'0.82rem', color:'#DC2626', marginTop:6, padding:'6px 10px', background:'rgba(239,68,68,0.15)', borderRadius:6 }}>
                    Abgelehnt: {r.rejection_reason}
                    {r.rejection_file && <a href={`/api/vacation/file/${r.rejection_file}?token=${localStorage.getItem("token")}`} style={{ marginLeft:8, color:'var(--primary)' }} target="_blank" rel="noreferrer">Anhang</a>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
