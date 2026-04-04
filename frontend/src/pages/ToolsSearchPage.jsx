import React, { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../utils/api.js'
import { useAuth } from '../contexts/AuthContext.jsx'

const STATUS = {
  lager:     { label: 'Im Lager',   bg: '#dcfce7', border: '#86efac', text: '#15803d', dot: '#22c55e' },
  reserviert:{ label: 'Reserviert', bg: '#fef9c3', border: '#fde047', text: '#854d0e', dot: '#eab308' },
  verliehen: { label: 'Verliehen',  bg: '#fee2e2', border: '#fca5a5', text: '#991b1b', dot: '#ef4444' },
}

function StatusBadge({ status, mieter }) {
  const s = STATUS[status] || STATUS.lager
  const label = status === 'verliehen' && mieter ? `Verliehen an ${mieter}` : s.label
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6, background:s.bg, border:`1px solid ${s.border}`, color:s.text, borderRadius:20, padding:'3px 10px', fontSize:'0.78rem', fontWeight:700 }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:s.dot, flexShrink:0 }} />
      {label}
    </span>
  )
}

function ToolRow({ t, canSeeVerleih }) {
  const imgUrl = t.bild ? `/api/tools/image?path=${encodeURIComponent(t.bild)}` : null
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', display:'flex', alignItems:'stretch' }}>
      <div style={{ width:4, flexShrink:0, background:STATUS[t.status]?.dot || '#22c55e' }} />
      {imgUrl ? (
        <div style={{ width:80, height:80, flexShrink:0, background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
          <img src={imgUrl} alt={t.bezeichnung} style={{ width:'100%', height:'100%', objectFit:'contain' }}
            onError={e => { e.target.parentElement.innerHTML = '<div style="font-size:24px;display:flex;align-items:center;justify-content:center;width:100%;height:100%">🔧</div>' }} />
        </div>
      ) : (
        <div style={{ width:80, height:80, flexShrink:0, background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>🔧</div>
      )}
      <div style={{ flex:1, padding:'10px 16px', display:'flex', flexDirection:'column', justifyContent:'center', gap:4, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontWeight:700, fontSize:'0.92rem', color:'var(--text)' }}>{t.bezeichnung}</span>
          <span style={{ fontSize:'0.72rem', color:'var(--text-3)', background:'var(--surface-2)', padding:'1px 7px', borderRadius:6, border:'1px solid var(--border)' }}>{t.nr || t.internNr}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <StatusBadge status={t.status} mieter={canSeeVerleih ? t.mieter : null} />
          {t.lagerort && t.status === 'lager' && <span style={{ fontSize:'0.78rem', color:'var(--text-3)' }}>📍 {t.lagerort}</span>}
          {t.naechsteRes && t.status === 'reserviert' && (
            <span style={{ fontSize:'0.78rem', color:'#854d0e' }}>
              ab {new Date(t.naechsteRes).toLocaleDateString('de-DE', { weekday:'short', day:'2-digit', month:'2-digit' })} {new Date(t.naechsteRes).toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })} Uhr
            </span>
          )}
          {t.ausgabe && t.status === 'verliehen' && canSeeVerleih && <span style={{ fontSize:'0.78rem', color:'var(--text-3)' }}>seit {t.ausgabe}</span>}
        </div>
      </div>
    </div>
  )
}

export default function ToolsSearchPage() {
  const { user } = useAuth()
  const canSeeVerleih = user?.features?.show_verleih !== false
  const [query, setQuery] = useState('')
  const [allTools, setAllTools] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('name') // name | status | nr
  const [filterStatus, setFilterStatus] = useState('all') // all | lager | reserviert | verliehen

  const load = useCallback(async (q = '') => {
    setLoading(true)
    try {
      const r = await api.get(`/calendar/tools-search?q=${encodeURIComponent(q)}`)
      setAllTools(r.data.tools || [])
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { load('') }, [load])

  const handleSearch = (val) => {
    setQuery(val)
    clearTimeout(window._toolsSearchTimer)
    window._toolsSearchTimer = setTimeout(() => load(val), 350)
  }

  const displayed = useMemo(() => {
    let result = [...allTools]
    if (filterStatus !== 'all') result = result.filter(t => t.status === filterStatus)
    result.sort((a, b) => {
      if (sortBy === 'name') return a.bezeichnung.localeCompare(b.bezeichnung, 'de')
      if (sortBy === 'nr') return (a.nr || a.internNr).localeCompare(b.nr || b.internNr, 'de')
      if (sortBy === 'status') {
        const order = { verliehen: 0, reserviert: 1, lager: 2 }
        return (order[a.status] ?? 3) - (order[b.status] ?? 3)
      }
      return 0
    })
    return result
  }, [allTools, sortBy, filterStatus])

  const counts = {
    all: allTools.length,
    lager: allTools.filter(t => t.status === 'lager').length,
    reserviert: allTools.filter(t => t.status === 'reserviert').length,
    verliehen: allTools.filter(t => t.status === 'verliehen').length,
  }

  const filterBtn = (key, label, dot) => (
    <button onClick={() => setFilterStatus(key)} style={{
      padding:'5px 12px', borderRadius:20, border:'1px solid', cursor:'pointer', fontSize:'0.8rem', fontWeight:600,
      background: filterStatus === key ? (STATUS[key]?.bg || 'var(--primary-light)') : 'var(--surface-2)',
      color: filterStatus === key ? (STATUS[key]?.text || 'var(--primary)') : 'var(--text-3)',
      borderColor: filterStatus === key ? (STATUS[key]?.border || 'var(--primary)') : 'var(--border)',
      display:'flex', alignItems:'center', gap:5,
    }}>
      {dot && <span style={{ width:7, height:7, borderRadius:'50%', background:STATUS[key]?.dot, flexShrink:0 }} />}
      {label} {counts[key] > 0 && <span style={{ opacity:0.7 }}>({counts[key]})</span>}
    </button>
  )

  return (
    <div style={{ maxWidth:900, margin:'0 auto' }}>
      <h2 style={{ marginBottom:4 }}>🔍 Werkzeug suchen</h2>
      <p style={{ color:'var(--text-3)', marginBottom:16, fontSize:'0.88rem' }}>Suche nach Name, Nummer, Seriennummer oder Lagerort</p>

      {/* Search */}
      <div style={{ position:'relative', marginBottom:14 }}>
        <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>🔍</span>
        <input value={query} onChange={e => handleSearch(e.target.value)} placeholder="z.B. LSP500, WZ010002, Beamer..."
          autoFocus style={{ width:'100%', boxSizing:'border-box', padding:'11px 16px 11px 42px', border:'1px solid var(--border)', borderRadius:12, background:'var(--surface)', color:'var(--text)', fontSize:'0.95rem', outline:'none', boxShadow:'var(--shadow)' }} />
      </div>

      {/* Filter + Sort bar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, flexWrap:'wrap', justifyContent:'space-between' }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {filterBtn('all', 'Alle')}
          {filterBtn('lager', 'Im Lager', true)}
          {filterBtn('reserviert', 'Reserviert', true)}
          {filterBtn('verliehen', 'Verliehen', true)}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ padding:'5px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:'0.82rem', cursor:'pointer' }}>
          <option value="name">↕ Name</option>
          <option value="nr">↕ Nummer</option>
          <option value="status">↕ Status</option>
        </select>
      </div>

      {/* Results */}
      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--text-3)' }}>Lädt...</div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--text-3)' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🔧</div>
          <div>{query ? `Keine Werkzeuge gefunden für „${query}"` : 'Keine Werkzeuge vorhanden'}</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {displayed.map((t, i) => <ToolRow key={i} t={t} canSeeVerleih={canSeeVerleih} />)}
        </div>
      )}
    </div>
  )
}
