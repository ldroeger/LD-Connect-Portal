import React, { useState, useEffect, useRef } from 'react'
import api from '../utils/api.js'

// ── Kategorienamen ────────────────────────────────────────────────────────
const CATEGORY_NAMES = {
  'DOKU': 'Dokumente', 'doku': 'Dokumente',
  'UASM': 'Unterschriebene Dokumente', '_uasm': 'Unterschriebene Dokumente',
  'DRHST': 'Druckhistorie', 'drhst': 'Druckhistorie',
  'LOHNAB': 'Lohnabrechnung', 'lohnab': 'Lohnabrechnung',
  'VERTRAG': 'Verträge', 'vertrag': 'Verträge',
  'ZEUGNIS': 'Zeugnisse', 'zeugnis': 'Zeugnisse',
  'KRANKMELD': 'Krankmeldungen',
  'URLAUB': 'Urlaubsanträge',
  'SONSTIGES': 'Sonstiges',
}
const catName = (k) => CATEGORY_NAMES[k] || CATEGORY_NAMES[(k||'').toUpperCase()] || k || 'Allgemein'

// ── Datei-Icons ───────────────────────────────────────────────────────────
const FILE_ICONS = {
  'application/pdf': '📄',
  'image/jpeg': '🖼', 'image/png': '🖼', 'image/gif': '🖼', 'image/webp': '🖼',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-excel': '📊',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
}
const fileIcon = (mime) => FILE_ICONS[mime] || '📎'

// Welche Typen können inline angezeigt werden?
const canPreview = (mime) => {
  if (!mime) return false
  return mime.startsWith('image/') || mime === 'application/pdf'
}

const canViewOnline = (mime) => {
  if (!mime) return false
  return mime.startsWith('image/') ||
    mime === 'application/pdf' ||
    mime.includes('word') ||
    mime.includes('excel') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation')
}

const fmtSize = (b) => {
  if (!b) return ''
  const n = parseInt(b)
  if (n < 1024) return n + ' B'
  if (n < 1024*1024) return Math.round(n/1024) + ' KB'
  return Math.round(n/1024/1024*10)/10 + ' MB'
}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('de-DE', {day:'2-digit',month:'2-digit',year:'numeric'}) : '—'

const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']

// ── Vorschau-Modal ────────────────────────────────────────────────────────
function PreviewModal({ doc, onClose }) {
  const [url, setUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/documents/download/' + doc.id, { responseType: 'blob' })
      .then(r => {
        const blob = new Blob([r.data], { type: doc.mimeType || 'application/octet-stream' })
        setUrl(window.URL.createObjectURL(blob))
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
    return () => { if (url) window.URL.revokeObjectURL(url) }
  }, [doc.id])

  const isImage = doc.mimeType && doc.mimeType.startsWith('image/')
  const isPdf   = doc.mimeType === 'application/pdf'
  const isOffice = doc.mimeType && (doc.mimeType.includes('word') || doc.mimeType.includes('excel') || doc.mimeType.includes('spreadsheet'))

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--surface)', borderRadius:16,
        width:'min(900px,96vw)', height:'min(85vh,700px)', display:'flex', flexDirection:'column',
        boxShadow:'0 24px 64px rgba(0,0,0,0.5)', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'14px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:'0.95rem' }}>{doc.dateiname}</div>
            <div style={{ fontSize:'0.75rem', color:'var(--text-3)' }}>
              {fmtDate(doc.datum)} · {fmtSize(doc.fileSize)}
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {url && (
              <a href={url} download={doc.dateiname}
                style={{ padding:'7px 14px', borderRadius:8, background:'var(--primary)',
                  color:'white', textDecoration:'none', fontSize:'0.82rem', fontWeight:600 }}>
                ⬇ Download
              </a>
            )}
            <button onClick={onClose} style={{ padding:'7px 14px', borderRadius:8,
              border:'1px solid var(--border)', background:'var(--surface-2)',
              cursor:'pointer', fontFamily:'var(--font)', fontSize:'0.82rem' }}>
              ✕ Schließen
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex:1, overflow:'hidden', position:'relative' }}>
          {loading && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
              height:'100%', color:'var(--text-3)' }}>Lädt...</div>
          )}
          {error && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
              height:'100%', color:'var(--error)' }}>Fehler: {error}</div>
          )}
          {!loading && !error && url && (
            isImage ? (
              <img src={url} alt={doc.dateiname}
                style={{ width:'100%', height:'100%', objectFit:'contain' }} />
            ) : isPdf ? (
              <iframe src={url} style={{ width:'100%', height:'100%', border:'none' }}
                title={doc.dateiname} />
            ) : isOffice ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
                justifyContent:'center', height:'100%', gap:16 }}>
                <div style={{ fontSize:'3rem' }}>{fileIcon(doc.mimeType)}</div>
                <div style={{ fontWeight:600 }}>{doc.dateiname}</div>
                <p style={{ color:'var(--text-3)', fontSize:'0.85rem', textAlign:'center', maxWidth:400 }}>
                  Office-Dokumente können nicht direkt im Browser angezeigt werden.<br/>
                  Bitte laden Sie die Datei herunter.
                </p>
                <a href={url} download={doc.dateiname}
                  style={{ padding:'10px 24px', borderRadius:10, background:'var(--primary)',
                    color:'white', textDecoration:'none', fontWeight:600 }}>
                  ⬇ Herunterladen
                </a>
              </div>
            ) : null
          )}
        </div>
      </div>
    </div>
  )
}

// ── Hauptseite ────────────────────────────────────────────────────────────
export default function DocumentsPage() {
  const [docs, setDocs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [downloading, setDownloading] = useState(null)
  const [preview, setPreview]     = useState(null)
  const [openCats, setOpenCats]   = useState({})
  const [openYears, setOpenYears] = useState({})

  useEffect(() => {
    api.get('/documents').then(r => {
      const d = r.data.documents || []
      setDocs(d)
      // Alle Kategorien standardmäßig aufklappen
      const cats = {}
      d.forEach(doc => { cats[doc.kategorie || ''] = true })
      setOpenCats(cats)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const download = async (doc, e) => {
    e.stopPropagation()
    setDownloading(doc.id)
    try {
      const res = await api.get('/documents/download/' + doc.id, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url; a.download = doc.dateiname; a.click()
      window.URL.revokeObjectURL(url)
    } catch(err) {
      alert('Fehler beim Download: ' + (err.response?.data?.error || err.message))
    }
    setDownloading(null)
  }

  const filtered = docs.filter(d =>
    !search ||
    (d.dateiname || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.beschreibung || '').toLowerCase().includes(search.toLowerCase()) ||
    catName(d.kategorie).toLowerCase().includes(search.toLowerCase())
  )

  // Gruppierung: Kategorie → Jahr → Monat → Dokumente
  const grouped = {}
  filtered.forEach(doc => {
    const cat   = doc.kategorie || ''
    const dt    = new Date(doc.datum || doc.angelegt)
    const year  = dt.getFullYear() || 'Unbekannt'
    const month = isNaN(dt) ? 'Unbekannt' : MONTHS[dt.getMonth()]
    if (!grouped[cat]) grouped[cat] = {}
    if (!grouped[cat][year]) grouped[cat][year] = {}
    if (!grouped[cat][year][month]) grouped[cat][year][month] = []
    grouped[cat][year][month].push(doc)
  })

  const toggleCat  = (k) => setOpenCats(p => ({ ...p, [k]: !p[k] }))
  const toggleYear = (k) => setOpenYears(p => ({ ...p, [k]: !p[k] }))

  return (
    <div style={{ maxWidth:900 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:'1.3rem', fontWeight:800 }}>📁 Meine Dokumente</h1>
        <p style={{ color:'var(--text-3)', fontSize:'0.85rem', marginTop:2 }}>
          Dokumente die Ihnen in Powerbird hinterlegt wurden
        </p>
      </div>

      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Dokumente suchen..."
        style={{ width:'100%', padding:'10px 14px', borderRadius:10, marginBottom:20,
          border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)',
          fontFamily:'var(--font)', fontSize:'0.9rem', boxSizing:'border-box' }} />

      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--text-3)' }}>Lädt...</div>
      ) : docs.length === 0 ? (
        <div style={{ background:'var(--surface)', borderRadius:14, border:'1px solid var(--border)',
          padding:40, textAlign:'center', boxShadow:'var(--shadow)' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:12 }}>📂</div>
          <div style={{ fontWeight:600, marginBottom:4 }}>Keine Dokumente vorhanden</div>
          <div style={{ color:'var(--text-3)', fontSize:'0.85rem' }}>
            Dokumente werden in Powerbird bei Ihrem Mitarbeiterprofil hinterlegt.
          </div>
        </div>
      ) : (
        Object.entries(grouped).sort(([a],[b]) => catName(a).localeCompare(catName(b))).map(([cat, years]) => (
          <div key={cat} style={{ marginBottom:16 }}>

            {/* Kategorie-Header */}
            <div onClick={() => toggleCat(cat)} style={{ display:'flex', justifyContent:'space-between',
              alignItems:'center', padding:'10px 16px', borderRadius:openCats[cat] ? '10px 10px 0 0' : 10,
              background:'var(--primary)', color:'white', cursor:'pointer', userSelect:'none' }}>
              <span style={{ fontWeight:700 }}>
                {catName(cat)}
                <span style={{ fontWeight:400, fontSize:'0.8rem', marginLeft:8, opacity:0.8 }}>
                  ({Object.values(years).flatMap(m => Object.values(m)).flat().length} Dokumente)
                </span>
              </span>
              <span>{openCats[cat] ? '▲' : '▼'}</span>
            </div>

            {openCats[cat] && (
              <div style={{ background:'var(--surface)', borderRadius:'0 0 10px 10px',
                border:'1px solid var(--border)', borderTop:'none', overflow:'hidden' }}>

                {Object.entries(years).sort(([a],[b]) => b - a).map(([year, months]) => {
                  const yearKey = cat + '_' + year
                  const allDocs = Object.values(months).flat()
                  return (
                    <div key={year}>
                      {/* Jahr-Header */}
                      <div onClick={() => toggleYear(yearKey)}
                        style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                          padding:'8px 16px', background:'var(--surface-2)', cursor:'pointer',
                          borderTop:'1px solid var(--border)', userSelect:'none' }}>
                        <span style={{ fontWeight:600, fontSize:'0.88rem' }}>
                          📅 {year}
                          <span style={{ fontWeight:400, color:'var(--text-3)', marginLeft:8, fontSize:'0.8rem' }}>
                            ({allDocs.length})
                          </span>
                        </span>
                        <span style={{ color:'var(--text-3)', fontSize:'0.8rem' }}>
                          {openYears[yearKey] !== false ? '▲' : '▼'}
                        </span>
                      </div>

                      {openYears[yearKey] !== false && (
                        Object.entries(months).sort(([a],[b]) => MONTHS.indexOf(b) - MONTHS.indexOf(a)).map(([month, mdocs]) => (
                          <div key={month}>
                            {/* Monat-Label */}
                            <div style={{ padding:'6px 24px', fontSize:'0.75rem', fontWeight:600,
                              color:'var(--text-3)', background:'var(--surface)',
                              borderTop:'1px solid var(--border)', textTransform:'uppercase',
                              letterSpacing:'0.06em' }}>
                              {month} ({mdocs.length})
                            </div>

                            {/* Dokumente */}
                            {mdocs.map((doc, i) => (
                              <div key={doc.id} style={{ display:'flex', alignItems:'center', gap:12,
                                padding:'12px 16px 12px 24px',
                                borderTop:'1px solid var(--border)',
                                background: i%2===0 ? 'transparent' : 'var(--surface-2)',
                                cursor: canViewOnline(doc.mimeType) ? 'pointer' : 'default' }}
                                onClick={() => canViewOnline(doc.mimeType) && setPreview(doc)}>

                                <div style={{ fontSize:'1.6rem', flexShrink:0 }}>{fileIcon(doc.mimeType)}</div>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ fontWeight:600, fontSize:'0.88rem',
                                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                                    color: canViewOnline(doc.mimeType) ? 'var(--primary)' : 'var(--text)' }}>
                                    {doc.dateiname}
                                    {canViewOnline(doc.mimeType) &&
                                      <span style={{ fontSize:'0.72rem', color:'var(--text-3)',
                                        marginLeft:8, fontWeight:400 }}>👁 Vorschau</span>}
                                  </div>
                                  <div style={{ fontSize:'0.73rem', color:'var(--text-3)', marginTop:2 }}>
                                    {fmtDate(doc.datum)}
                                    {doc.fileSize ? ' · ' + fmtSize(doc.fileSize) : ''}
                                    {doc.beschreibung ? ' · ' + doc.beschreibung : ''}
                                  </div>
                                </div>

                                <button onClick={(e) => download(doc, e)}
                                  disabled={downloading === doc.id}
                                  style={{ padding:'6px 12px', borderRadius:8, border:'none',
                                    cursor: downloading === doc.id ? 'wait' : 'pointer',
                                    background:'var(--surface-2)', color:'var(--text)',
                                    fontFamily:'var(--font)', fontSize:'0.78rem', flexShrink:0,
                                    opacity: downloading === doc.id ? 0.7 : 1,
                                    border:'1px solid var(--border)' }}>
                                  {downloading === doc.id ? '⏳' : '⬇'}
                                </button>
                              </div>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))
      )}

      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
