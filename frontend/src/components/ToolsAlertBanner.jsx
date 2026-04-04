import React, { useState, useEffect } from 'react'
import api from '../utils/api.js'

export default function ToolsAlertBanner() {
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    api.get('/calendar/tools-alerts')
      .then(r => setAlerts(r.data.alerts || []))
      .catch(() => {})
  }, [])

  if (!alerts.length) return null

  return (
    <div style={{
      background: '#fef3c7', border: '1px solid #f59e0b',
      borderRadius: 12, padding: '12px 16px', marginBottom: 20,
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>⚠️</span>
      <div>
        <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 4, fontSize: '0.9rem' }}>
          Werkzeug bald benötigt!
        </div>
        {alerts.map((a, i) => {
          const start = new Date(a.start)
          const now = new Date()
          const diffH = Math.round((start - now) / 36e5)
          const diffText = diffH < 24 ? `in ${diffH} Stunden` : `in ${Math.round(diffH/24)} Tag${Math.round(diffH/24) !== 1 ? 'en' : ''}`
          const dateStr = start.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
          const timeStr = start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
          return (
            <div key={i} style={{ fontSize: '0.85rem', color: '#78350f', marginTop: i > 0 ? 4 : 0 }}>
              🔧 <strong>{a.bezeichnung}</strong> — Reservierung {diffText} ({dateStr} {timeStr} Uhr)
              {a.label && a.label !== a.bezeichnung && <span style={{ color: '#92400e' }}> · {a.label}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
