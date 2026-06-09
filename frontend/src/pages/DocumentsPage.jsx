import React, { useState, useEffect } from 'react'
import api from '../utils/api.js'

const ICONS = {
  'application/pdf': '📄',
  'image/jpeg': '🖼️', 'image/png': '🖼️', 'image/gif': '🖼️',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-excel': '📊',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
}
const icon = (mime) => ICONS[mime] || '📎'

const fmtSize = (bytes) => {
  if (!bytes) return ''
  const b = parseInt(bytes)
  if (b < 1024) return b + ' B'
  if (b < 1024*1024) return Math.round(b/1024) + ' KB'
  return Math.round(b/1024/1024*10)/10 + ' MB'
}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—'

export default function DocumentsPage() {
  const [docs, setDocs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [downloading, setDownloading] = useState(null)

  useEffect(() => {
    api.get('/documents').then(r => {
      setDocs(r.data.documents || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const download = async (doc) => {
    setDownloading(doc.id)
    try {
      const res = await api.get(`/documents/download/${doc.id}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = doc.dateiname
      a.click()
      window.URL.revokeObjectURL(url)
    } catch(e) {
      alert('Fehler beim Download: ' + (e.response?.data?.error || e.message))
    }
    setDownloading(null)
  }

  const filtered = docs.filter(d =>
    !search || d.dateiname?.toLowerCase().includes(search.toLowerCase()) ||
    d.beschreibung?.toLowerCase().includes(search.toLowerCase()) ||
    d.kategorie?.toLowerCase().includes(search.toLowerCase())
  )

  // Nach Kategorie gruppieren
  const grouped = filtered.reduce((acc, d) => {
    const cat = d.kategorie || 'Allgemein'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(d)
    return acc
  }, {})

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>📁 Meine Dokumente</h1>
        <p style={{ color: 'var(--text-3)', fontSize: '0.85rem', marginTop: 2 }}>
          Dokumente die Ihnen in Powerbird hinterlegt wurden
        </p>
      </div>

      {/* Suche */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Dokumente suchen..."
          style={{ width: '100%', padding: '10px 14px', borderRadius: 10,
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text)', fontFamily: 'var(--font)', fontSize: '0.9rem',
            boxSizing: 'border-box' }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Lädt...</div>
      ) : docs.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)',
          padding: 40, textAlign: 'center', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📂</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Keine Dokumente vorhanden</div>
          <div style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>
            Dokumente werden in Powerbird bei Ihrem Mitarbeiterprofil hinterlegt.
          </div>
        </div>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <div key={category} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-3)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              {category} ({items.length})
            </div>
            <div style={{ background: 'var(--surface)', borderRadius: 14,
              border: '1px solid var(--border)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
              {items.map((doc, i) => (
                <div key={doc.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                  background: i % 2 === 0 ? 'transparent' : 'var(--surface-2)'
                }}>
                  <div style={{ fontSize: '1.8rem', flexShrink: 0 }}>{icon(doc.mimeType)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.dateiname}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>
                      {fmtDate(doc.datum)}
                      {doc.fileSize ? ' · ' + fmtSize(doc.fileSize) : ''}
                      {doc.beschreibung ? ' · ' + doc.beschreibung : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => download(doc)}
                    disabled={downloading === doc.id}
                    style={{ padding: '7px 16px', borderRadius: 8, border: 'none',
                      cursor: downloading === doc.id ? 'wait' : 'pointer',
                      background: 'var(--primary)', color: 'white',
                      fontFamily: 'var(--font)', fontWeight: 600, fontSize: '0.82rem',
                      flexShrink: 0, opacity: downloading === doc.id ? 0.7 : 1 }}>
                    {downloading === doc.id ? '⏳' : '⬇ Download'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
