import React, { useEffect, useState } from 'react'
import api from '../utils/api.js'

export default function SyncSettingsCard() {
  const [status, setStatus]     = useState(null)
  const [interval, setInterval] = useState(5)
  const [enabled, setEnabled]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [running, setRunning]   = useState(false)

  const load = () => api.get('/admin/sync/status').then(r => {
    setStatus(r.data)
    setInterval(r.data.intervalMinutes)
    setEnabled(r.data.enabled)
  }).catch(() => {})

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t) }, [])

  const save = async () => {
    setSaving(true)
    await api.post('/admin/sync/settings', { enabled, intervalMinutes: interval }).catch(() => {})
    await load()
    setSaving(false)
  }

  const runNow = async () => {
    setRunning(true)
    await api.post('/admin/sync/run-now').catch(() => {})
    setTimeout(() => { load(); setRunning(false) }, 3000)
  }

  const logColor = { info: 'var(--text-3)', error: '#EF4444', warn: '#F59E0B' }

  return (
    <div style={{ background:'var(--surface)', borderRadius:14, border:'1px solid var(--border)', padding:24, boxShadow:'var(--shadow)', marginBottom:24 }}>
      <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
        🔄 Powerbird Sync
        {status && (
          <span style={{ fontSize:'0.75rem', fontWeight:500, padding:'2px 10px', borderRadius:10,
            background: status.lastStatus === 'ok' ? '#d1fae5' : '#fee2e2',
            color:       status.lastStatus === 'ok' ? '#065f46' : '#991b1b' }}>
            {status.lastStatus === 'ok' ? '✓ OK' : '⚠ Fehler'}
          </span>
        )}
      </div>

      <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:20 }}>
        {/* Aktivieren */}
        <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}
            style={{ width:16, height:16, cursor:'pointer' }} />
          <span style={{ fontWeight:600, fontSize:'0.9rem' }}>Sync aktiv</span>
        </label>

        {/* Intervall */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:'0.88rem', color:'var(--text-3)' }}>Intervall:</span>
          <input type="number" min="1" max="60" value={interval}
            onChange={e => setInterval(parseInt(e.target.value) || 5)}
            style={{ width:60, padding:'4px 8px', borderRadius:6, border:'1px solid var(--border)',
              background:'var(--surface-2)', color:'var(--text)', fontFamily:'var(--font)', fontSize:'0.9rem' }} />
          <span style={{ fontSize:'0.88rem', color:'var(--text-3)' }}>Minuten</span>
        </div>

        {/* Speichern */}
        <button onClick={save} disabled={saving}
          style={{ padding:'6px 16px', borderRadius:8, border:'none', cursor:'pointer',
            background:'var(--primary)', color:'white', fontFamily:'var(--font)', fontWeight:600, fontSize:'0.85rem' }}>
          {saving ? 'Speichern...' : 'Speichern'}
        </button>

        {/* Jetzt sync */}
        <button onClick={runNow} disabled={running}
          style={{ padding:'6px 16px', borderRadius:8, border:'1px solid var(--border)', cursor:'pointer',
            background:'var(--surface-2)', color:'var(--text)', fontFamily:'var(--font)', fontWeight:600, fontSize:'0.85rem' }}>
          {running ? '⏳ Läuft...' : '▶ Jetzt sync'}
        </button>
      </div>

      {/* Status-Infos */}
      {status && (
        <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:16, fontSize:'0.8rem', color:'var(--text-3)' }}>
          <span>Letzter Sync: {status.lastRun ? new Date(status.lastRun).toLocaleString('de-DE') : '—'}</span>
          <span>Aktive Termine (ab heute): {status.lastTermineCount}</span>
        </div>
      )}

      {/* Log */}
      {status?.log?.length > 0 && (
        <div style={{ background:'var(--surface-2)', borderRadius:8, padding:'10px 14px', maxHeight:200, overflowY:'auto' }}>
          <div style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--text-3)', marginBottom:6 }}>Sync-Log</div>
          {status.log.map((e, i) => (
            <div key={i} style={{ fontSize:'0.75rem', color: logColor[e.type] || 'var(--text-3)', marginBottom:2, fontFamily:'monospace' }}>
              {new Date(e.ts).toLocaleTimeString('de-DE')} {e.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
