import React, { useState, useEffect } from 'react'
import api from '../utils/api.js'
import ToolsAlertBanner from '../components/ToolsAlertBanner.jsx'

function ToolCard({ t, onClick, showImage }) {
  const imgUrl = t.bild ? `/api/tools/image?path=${encodeURIComponent(t.bild)}` : null

  return (
    <div
      onClick={() => onClick && onClick(t)}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column',
        transition: 'box-shadow 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; e.currentTarget.style.transform = 'translateY(-2px)' }}}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
    >
      {showImage && imgUrl && (
        <div style={{ width: '100%', height: 160, background: 'var(--surface-2)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={imgUrl} alt={t.bezeichnung}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onError={e => { e.target.parentElement.style.display = 'none' }} />
        </div>
      )}
      {showImage && !imgUrl && (
        <div style={{ width: '100%', height: 120, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
          🔧
        </div>
      )}
      <div style={{ padding: '12px 16px 8px' }}>
        <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>
          🔧 {t.nr || '–'}
        </span>
      </div>
      <div style={{ padding: '0 16px 12px', fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem', flex: 1 }}>
        {t.bezeichnung || '(ohne Bezeichnung)'}
      </div>
      {(t.ausgabe || t.rueckgabe) && (
        <div style={{ display: 'flex', gap: 24, padding: '8px 16px', borderTop: '1px solid var(--border)', fontSize: '0.78rem' }}>
          {t.ausgabe && <div><span style={{ color: 'var(--text-3)' }}>Ausgabe: </span><span style={{ color: 'var(--text-2)' }}>{t.ausgabe}</span></div>}
          {t.rueckgabe && <div><span style={{ color: 'var(--text-3)' }}>Rückgabe: </span><span style={{ color: 'var(--error)' }}>{t.rueckgabe}</span></div>}
        </div>
      )}
    </div>
  )
}

function ToolPopup({ tool, onClose }) {
  if (!tool) return null
  const imgUrl = tool.bild ? `/api/tools/image?path=${encodeURIComponent(tool.bild)}` : null

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: 24, maxHeight: '85vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 20px' }} />
        {imgUrl && (
          <div style={{ width: '100%', height: 220, marginBottom: 16, borderRadius: 12, overflow: 'hidden', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={imgUrl} alt={tool.bezeichnung}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={e => { e.target.parentElement.innerHTML = '<div style="font-size:48px">🔧</div>' }} />
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '3px 10px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700 }}>
            🔧 {tool.nr || '–'}
          </span>
        </div>
        <h3 style={{ margin: '0 0 12px', color: 'var(--text)', fontSize: '1.1rem' }}>{tool.bezeichnung}</h3>
        {(tool.ausgabe || tool.rueckgabe) && (
          <div style={{ display: 'flex', gap: 32, marginBottom: 12, fontSize: '0.88rem' }}>
            {tool.ausgabe && <div><div style={{ color: 'var(--text-3)', fontSize: '0.72rem', marginBottom: 2 }}>Ausgabe</div>{tool.ausgabe}</div>}
            {tool.rueckgabe && <div><div style={{ color: 'var(--text-3)', fontSize: '0.72rem', marginBottom: 2 }}>Rückgabe</div><span style={{ color: 'var(--error)' }}>{tool.rueckgabe}</span></div>}
          </div>
        )}
        {tool.info && <p style={{ color: 'var(--text-3)', fontSize: '0.88rem', margin: '0 0 16px' }}>{tool.info}</p>}
        <button onClick={onClose} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'var(--surface-2)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>
          Schließen
        </button>
      </div>
    </div>
  )
}

export default function ToolsPage() {
  const [tools, setTools] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    api.get('/calendar/tools')
      .then(r => setTools(r.data.tools || []))
      .catch(e => console.error(e))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <ToolsAlertBanner />
      <h2 style={{ marginBottom: 4 }}>🔧 Mein Werkzeug</h2>
      <p style={{ color: 'var(--text-3)', marginBottom: 24, fontSize: '0.88rem' }}>
        {tools.length} Werkzeug{tools.length !== 1 ? 'e' : ''} zugewiesen
      </p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Lädt...</div>
      ) : tools.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔧</div>
          <p style={{ color: 'var(--text-3)' }}>Kein Werkzeug zugewiesen</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 16
        }}>
          {tools.map((t, i) => (
            <ToolCard
              key={i}
              t={t}
              showImage={true}
              onClick={isMobile ? setSelected : null}
            />
          ))}
        </div>
      )}

      {isMobile && selected && <ToolPopup tool={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
