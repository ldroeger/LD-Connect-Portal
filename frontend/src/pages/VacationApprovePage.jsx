import React, { useState, useEffect, useRef } from "react"
import api from "../utils/api.js"

const fmtDate = d => d ? new Date(d).toLocaleDateString('de-DE', {day:'2-digit',month:'2-digit',year:'numeric'}) : '–'
const STATUS_LABEL = { pending: translate(lang,'status_pending'), approved: translate(lang,'status_approved'), rejected: translate(lang,'status_rejected') }
const STATUS_COLOR = { pending: '#F59E0B', approved: '#10B981', rejected: '#EF4444' }

const S = {
  card: { background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)', padding:24, boxShadow:'var(--shadow)', marginBottom:16 },
  badge: (c) => ({ display:'inline-block', padding:'2px 10px', borderRadius:12, fontSize:'0.78rem', fontWeight:600, background:(c||'#3B82F6')+'22', color:c||'#3B82F6' }),
  btn: (v='primary') => ({ padding:'8px 18px', borderRadius:8, border:v==='secondary'?'1px solid var(--border)':'none', background:v==='primary'?'var(--primary)':v==='danger'?'#EF4444':'var(--surface-2)', color:v==='secondary'?'var(--text)':'white', fontWeight:600, fontSize:'0.85rem', cursor:'pointer', fontFamily:'var(--font)' }),
  input: { width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:'0.88rem', fontFamily:'var(--font)', outline:'none', boxSizing:'border-box' },
  label: { display:'block', fontSize:'0.82rem', fontWeight:600, color:'var(--text)', marginBottom:5 },
  success: { background:'#ECFDF5', border:'1px solid #A7F3D0', color:'#059669', padding:'10px 14px', borderRadius:8, fontSize:'0.85rem', marginBottom:12 },
  error: { background:'#FEF2F2', border:'1px solid #FECACA', color:'#DC2626', padding:'10px 14px', borderRadius:8, fontSize:'0.85rem', marginBottom:12 },
  modal: { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 },
  modalCard: { background:'var(--surface)', borderRadius:12, padding:28, maxWidth:480, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' },
}

function RejectModal({ request, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef()

  const submit = async () => {
    if (!reason.trim()) return setErr('Bitte einen Ablehnungsgrund angeben')
    setLoading(true); setErr('')
    try {
      const fd = new FormData()
      fd.append('reason', reason)
      if (file) fd.append('file', file)
      await api.post(`/vacation/reject/${request.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      onDone()
    } catch(e) { setErr(e.response?.data?.error || 'Fehler'); setLoading(false) }
  }

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.modalCard} onClick={e=>e.stopPropagation()}>
        <h3 style={{ fontWeight:700, fontSize:'1.1rem', marginBottom:16 }}>Urlaubsantrag ablehnen</h3>
        <p style={{ fontSize:'0.88rem', color:'var(--text-2)', marginBottom:16 }}>
          <strong>{request.user_name}</strong> – {new Date(request.from_date).toLocaleDateString('de-DE')} bis {new Date(request.to_date).toLocaleDateString('de-DE')} ({request.days} Tage)
        </p>
        {err && <div style={S.error}>{err}</div>}
        <div style={{ marginBottom:14 }}>
          <label style={S.label}>Ablehnungsgrund *</label>
          <textarea style={{ ...S.input, minHeight:100, resize:'vertical' }} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Bitte begründen Sie die Ablehnung..." autoFocus />
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={S.label}>Anhang (optional, max. 10 MB)</label>
          <input ref={fileRef} type="file" onChange={e=>setFile(e.target.files[0])} style={{ fontSize:'0.85rem' }} />
          {file && <div style={{ fontSize:'0.82rem', color:'var(--text-3)', marginTop:4 }}>{file.name}</div>}
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button style={S.btn('secondary')} onClick={onClose}>Abbrechen</button>
          <button style={S.btn('danger')} onClick={submit} disabled={loading}>
            {loading ? 'Wird gesendet...' : 'Ablehnen & E-Mail senden'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function VacationApprovePage() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [msg, setMsg] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null)

  const load = () => {
    setLoading(true)
    api.get('/vacation/all').then(r => { setRequests(r.data.requests); setLoading(false) }).catch(()=>setLoading(false))
  }
  useEffect(() => { load() }, [])

  const approve = async (id) => {
    setMsg('')
    try {
      await api.post(`/vacation/approve/${id}`)
      setMsg('Antrag genehmigt. Mitarbeiter wurde per E-Mail informiert.')
      load()
    } catch(e) { setMsg('Fehler: ' + (e.response?.data?.error || e.message)) }
  }

  const filtered = requests.filter(r => filter === 'all' || r.status === filter)

  const counts = {
    pending:  requests.filter(r=>r.status==='pending').length,
    approved: requests.filter(r=>r.status==='approved').length,
    rejected: requests.filter(r=>r.status==='rejected').length,
  }

  return (
    <div style={{ maxWidth:1400 }}>
      <h1 style={{ fontSize:'1.3rem', fontWeight:700, marginBottom:4 }}>✅ Urlaubsanträge</h1>
      <p style={{ color:'var(--text-3)', fontSize:'0.85rem', marginBottom:20 }}>Anträge genehmigen oder ablehnen</p>

      {msg && <div style={{ ...S.success, marginBottom:16 }}>{msg}</div>}

      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {[['pending',translate(lang,'status_pending')],['approved',translate(lang,'status_approved')],['rejected',translate(lang,'status_rejected')],['all','Alle']].map(([val,label]) => (
          <button key={val} onClick={()=>setFilter(val)} style={{
            padding:'7px 16px', borderRadius:8, border:'1px solid var(--border)', cursor:'pointer', fontFamily:'var(--font)', fontSize:'0.85rem', fontWeight:filter===val?600:400,
            background: filter===val ? 'var(--primary)' : 'var(--surface)', color: filter===val ? 'white' : 'var(--text)',
          }}>
            {label} {val!=='all' && counts[val]>0 && <span style={{ background:'rgba(255,255,255,0.3)', borderRadius:10, padding:'1px 6px', fontSize:'0.78rem' }}>{counts[val]}</span>}
          </button>
        ))}
      </div>

      {loading ? <div style={{ color:'var(--text-3)' }}>Lädt...</div>
        : filtered.length === 0 ? <div style={S.card}><div style={{ color:'var(--text-3)', textAlign:'center', padding:'20px 0' }}>Keine Anträge vorhanden.</div></div>
        : filtered.map(r => (
          <div key={r.id} style={S.card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:4 }}>
                  {r.user_name}
                  <span style={{ ...S.badge(STATUS_COLOR[r.status]), marginLeft:10 }}>{STATUS_LABEL[r.status]}</span>
                </div>
                <div style={{ fontSize:'0.88rem', color:'var(--text-2)', marginBottom:4 }}>
                  📅 {new Date(r.from_date).toLocaleDateString('de-DE')} – {new Date(r.to_date).toLocaleDateString('de-DE')}
                  <span style={{ fontFamily:'monospace', fontWeight:600, color:'var(--primary)', marginLeft:8 }}>{r.days} Arbeitstage</span>
                </div>
                {r.reason && <div style={{ fontSize:'0.85rem', color:'var(--text-3)' }}>Bemerkung: {r.reason}</div>}
                {r.status === 'rejected' && r.rejection_reason && (
                  <div style={{ fontSize:'0.85rem', color:'#DC2626', marginTop:4 }}>
                    Ablehnungsgrund: {r.rejection_reason}
                    {r.rejection_file && <a href={`/api/vacation/file/${r.rejection_file}?token=${localStorage.getItem("token")}`} style={{ marginLeft:8, color:'var(--primary)' }} target="_blank" rel="noreferrer">Anhang</a>}
                  </div>
                )}
                <div style={{ fontSize:'0.78rem', color:'var(--text-3)', marginTop:6 }}>
                  Gestellt am {new Date(r.created_at * 1000).toLocaleDateString('de-DE')}
                  {r.reviewer_name && ` · Bearbeitet von ${r.reviewer_name}`}
                </div>
              </div>
              {r.status === 'pending' && (
                <div style={{ display:'flex', gap:8 }}>
                  <button style={S.btn()} onClick={()=>approve(r.id)}>✓ Genehmigen</button>
                  <button style={S.btn('danger')} onClick={()=>setRejectTarget(r)}>✗ Ablehnen</button>
                </div>
              )}
            </div>
          </div>
        ))
      }

      {rejectTarget && (
        <RejectModal
          request={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onDone={() => { setRejectTarget(null); setMsg('Antrag abgelehnt. Mitarbeiter wurde per E-Mail informiert.'); load(); }}
        />
      )}
    </div>
  )
}
