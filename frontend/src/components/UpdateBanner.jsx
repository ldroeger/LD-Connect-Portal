import React, { useState, useEffect } from 'react'
import api from '../utils/api.js'

const DISMISS_KEY = 'update_banner_dismissed'

export default function UpdateBanner() {
  const [info, setInfo] = useState(null)
  const [showNotes, setShowNotes] = useState(false)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY))

  useEffect(() => {
    api.get('/admin/update-check')
      .then(r => setInfo(r.data))
      .catch(() => {})
  }, [])

  if (!info?.updateAvailable || dismissed === info.latest) return null

  const dismiss = () => { localStorage.setItem(DISMISS_KEY, info.latest); setDismissed(info.latest) }

  return (
    <div style={{
      background: '#dbeafe', border: '1px solid #3b82f6',
      borderRadius: 12, padding: '12px 16px', marginBottom: 20,
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>⬆️</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: '#1e3a8a', marginBottom: 4, fontSize: '0.9rem' }}>
          Update verfügbar: Version {info.latest} (installiert: {info.current})
        </div>
        <div style={{ fontSize: '0.85rem', color: '#1e40af' }}>
          Auf dem Server einspielen mit <code>git reset --hard origin/main &amp;&amp; docker compose up -d --build</code>
        </div>
        <div style={{ fontSize: '0.85rem', marginTop: 6, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {info.notes && <span style={{ color: '#1d4ed8', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setShowNotes(s => !s)}>
            {showNotes ? 'Änderungen ausblenden' : 'Änderungen anzeigen'}
          </span>}
          {info.url && <a href={info.url} target="_blank" rel="noopener noreferrer" style={{ color: '#1d4ed8' }}>Release auf GitHub</a>}
        </div>
        {showNotes && <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: '#1e3a8a', margin: '8px 0 0', fontFamily: 'inherit' }}>{info.notes}</pre>}
      </div>
      <button onClick={dismiss} title="Für diese Version ausblenden"
        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#1e40af', fontSize: '1rem', padding: 2 }}>✕</button>
    </div>
  )
}
