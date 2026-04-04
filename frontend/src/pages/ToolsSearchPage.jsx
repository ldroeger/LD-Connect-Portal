import React, { useState, useCallback } from 'react'
import api from '../utils/api.js'

const STATUS = {
  lager:     { label: 'Im Lager',   bg: '#dcfce7', border: '#86efac', text: '#15803d', dot: '#22c55e' },
  reserviert:{ label: 'Reserviert', bg: '#fef9c3', border: '#fde047', text: '#854d0e', dot: '#eab308' },
  verliehen: { label: 'Verliehen',  bg: '#fee2e2', border: '#fca5a5', text: '#991b1b', dot: '#ef4444' },
}

function StatusBadge({ status, mieter }) {
  const s = STATUS[status] || STATUS.lager
  const label = status === 'verliehen' && mieter ? `Verliehen an ${mieter}` : s.label
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: s.bg, border: `1px solid ${s.border}`,
      color: s.text, borderRadius: 20, padding: '3px 10px',
      fontSize: '0.78rem', fontWeight: 700,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {label}
    </span>
  )
}

function ToolRow({ t }) {
  const imgUrl = t.bild ? `/api/tools/image?path=${encodeURIComponent(t.bild)}` : null

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, overflow: 'hidden', display: 'flex',
      alignItems: 'stretch', gap: 0,
    }}>
      {/* Left color stripe */}
      <div style={{ width: 4, flexShrink: 0, background: STATUS[t.status]?.dot || '#22c55e' }} />

      {/* Image */}
      {imgUrl ? (
        <div style={{ width: 80, height: 80, flexShrink: 0, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <img src={imgUrl} alt={t.bezeichnung} style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onError={e => { e.target.parentElement.innerHTML = '<div style="font-size:28px;display:flex;align-items:center;justify-content:center;width:100%;height:100%">🔧</div>' }} />
        </div>
      ) : (
        <div style={{ width: 80, height: 80, flexShrink: 0, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🔧</div>
      )}

      {/* Content */}
      <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{t.bezeichnung}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', background: 'var(--surface-2)', padding: '1px 7px', borderRadius: 6, border: '1px solid var(--border)' }}>{t.nr || t.internNr}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <StatusBadge status={t.status} mieter={t.mieter} />
          {t.lagerort && t.status === 'lager' && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>📍 {t.lagerort}</span>
          )}
          {t.naechsteRes && t.status === 'reserviert' && (
            <span style={{ fontSize: '0.78rem', color: '#854d0e' }}>
              ab {new Date(t.naechsteRes).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })} {new Date(t.naechsteRes).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
            </span>
          )}
          {t.ausgabe && t.status === 'verliehen' && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>seit {t.ausgabe}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ToolsSearchPage() {
  const [query, setQuery] = useState('')
  const [tools, setTools] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const search = useCallback(async (q) => {
    if (!q.trim()) { setTools([]); setSearched(false); return }
    setLoading(true)
    try {
      const r = await api.get(`/calendar/tools-search?q=${encodeURIComponent(q)}`)
      setTools(r.data.tools || [])
      setSearched(true)
    } catch(e) {
      console.error(e)
    }
    setLoading(false)
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    clearTimeout(window._toolsSearchTimer)
    window._toolsSearchTimer = setTimeout(() => search(val), 350)
  }

  const counts = {
    lager: tools.filter(t => t.status === 'lager').length,
    reserviert: tools.filter(t => t.status === 'reserviert').length,
    verliehen: tools.filter(t => t.status === 'verliehen').length,
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 4 }}>🔍 Werkzeug suchen</h2>
      <p style={{ color: 'var(--text-3)', marginBottom: 20, fontSize: '0.88rem' }}>
        Suche nach Name, Nummer, Seriennummer oder Lagerort
      </p>

      {/* Search input */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: '1rem', pointerEvents: 'none' }}>🔍</span>
        <input
          value={query}
          onChange={handleChange}
          placeholder="z.B. LSP500, WZ010002, Beamer..."
          autoFocus
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '12px 16px 12px 42px',
            border: '1px solid var(--border)', borderRadius: 12,
            background: 'var(--surface)', color: 'var(--text)',
            fontSize: '1rem', outline: 'none',
            boxShadow: 'var(--shadow)',
          }}
        />
        {loading && (
          <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: 'var(--text-3)' }}>Suche...</span>
        )}
      </div>

      {/* Results */}
      {searched && !loading && (
        <>
          {tools.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>
              Keine Werkzeuge gefunden für „{query}"
            </div>
          ) : (
            <>
              {/* Summary */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-3)' }}>{tools.length} Ergebnis{tools.length !== 1 ? 'se' : ''}</span>
                {counts.lager > 0 && <span style={{ fontSize: '0.78rem', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', borderRadius: 10, padding: '1px 8px' }}>● {counts.lager} im Lager</span>}
                {counts.reserviert > 0 && <span style={{ fontSize: '0.78rem', background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047', borderRadius: 10, padding: '1px 8px' }}>● {counts.reserviert} reserviert</span>}
                {counts.verliehen > 0 && <span style={{ fontSize: '0.78rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 10, padding: '1px 8px' }}>● {counts.verliehen} verliehen</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tools.map((t, i) => <ToolRow key={i} t={t} />)}
              </div>
            </>
          )}
        </>
      )}

      {!searched && !loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔧</div>
          <div>Suchbegriff eingeben um Werkzeuge zu finden</div>
        </div>
      )}
    </div>
  )
}
