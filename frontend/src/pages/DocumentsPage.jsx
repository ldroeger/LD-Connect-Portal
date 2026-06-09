import React, { useState, useEffect } from 'react'
import api from '../utils/api.js'

const FILE_ICONS = {
  'application/pdf': '📄',
  'image/jpeg': '🖼', 'image/png': '🖼', 'image/gif': '🖼', 'image/webp': '🖼',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-excel': '📊',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
}
const fileIcon = (mime) => FILE_ICONS[mime] || '📎'
const canPreview = (mime) => mime && (mime.startsWith('image/') || mime === 'application/pdf')
const fmtSize = (b) => { if (!b) return ''; const n=parseInt(b); if(n<1024) return n+' B'; if(n<1024*1024) return Math.round(n/1024)+' KB'; return Math.round(n/1024/1024*10)/10+' MB' }
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—'
const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']

function PreviewModal({ doc, onClose }) {
  const [url, setUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  useEffect(() => {
    let objUrl = null
    api.get('/documents/download/' + doc.id, { responseType: 'blob' })
      .then(r => { const blob = new Blob([r.data], { type: doc.mimeType || 'application/octet-stream' }); objUrl = window.URL.createObjectURL(blob); setUrl(objUrl); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
    return () => { if (objUrl) window.URL.revokeObjectURL(objUrl) }
  }, [doc.id])
  const isImage = doc.mimeType && doc.mimeType.startsWith('image/')
  const isPdf   = doc.mimeType === 'application/pdf'
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--surface)', borderRadius:16, width:'min(1000px,96vw)', height:'min(85vh,750px)', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(0,0,0,0.5)', overflow:'hidden' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div><div style={{ fontWeight:700, fontSize:'0.95rem' }}>{doc.dateiname}</div><div style={{ fontSize:'0.75rem', color:'var(--text-3)' }}>{fmtDate(doc.datum)} · {fmtSize(doc.fileSize)}</div></div>
          <div style={{ display:'flex', gap:8 }}>
            {url && <a href={url} download={doc.dateiname} style={{ padding:'7px 14px', borderRadius:8, background:'var(--primary)', color:'white', textDecoration:'none', fontSize:'0.82rem', fontWeight:600 }}>⬇ Download</a>}
            <button onClick={onClose} style={{ padding:'7px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface-2)', cursor:'pointer', fontFamily:'var(--font)', fontSize:'0.82rem' }}>✕</button>
          </div>
        </div>
        <div style={{ flex:1, overflow:'hidden', background:'#111' }}>
          {loading && <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#fff' }}>Lädt...</div>}
          {error   && <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#f87171' }}>Fehler: {error}</div>}
          {!loading && !error && url && (
            isImage ? <img src={url} alt={doc.dateiname} style={{ width:'100%', height:'100%', objectFit:'contain' }} />
            : isPdf  ? <iframe src={url} style={{ width:'100%', height:'100%', border:'none' }} title={doc.dateiname} />
            : <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:16, color:'white' }}>
                <div style={{ fontSize:'4rem' }}>{fileIcon(doc.mimeType)}</div>
                <a href={url} download={doc.dateiname} style={{ padding:'10px 24px', borderRadius:10, background:'var(--primary)', color:'white', textDecoration:'none', fontWeight:600 }}>⬇ Herunterladen</a>
              </div>
          )}
        </div>
      </div>
    </div>
  )
}

function GridTile({ doc, onPreview, onDownload, downloading, catName }) {
  return (
    <div onClick={() => canPreview(doc.mimeType) ? onPreview(doc) : onDownload(doc)}
      style={{ background:'var(--surface)', borderRadius:14, border:'1px solid var(--border)',
        padding:20, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center',
        gap:10, boxShadow:'var(--shadow)', transition:'transform 0.15s, box-shadow 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.15)' }}
      onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='var(--shadow)' }}>
      <div style={{ fontSize:'3.5rem', lineHeight:1 }}>{fileIcon(doc.mimeType)}</div>
      <div style={{ fontSize:'0.78rem', fontWeight:600, textAlign:'center', wordBreak:'break-word',
        overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical',
        color: canPreview(doc.mimeType) ? 'var(--primary)' : 'var(--text)', width:'100%' }}>
        {doc.dateiname}
      </div>
      <div style={{ fontSize:'0.7rem', color:'var(--text-3)', textAlign:'center', width:'100%' }}>
        <div style={{ fontWeight:500 }}>{catName(doc.kategorieKey || doc.kategorie)}</div>
        <div>{fmtDate(doc.datum)}</div>
        {doc.fileSize && <div>{fmtSize(doc.fileSize)}</div>}
      </div>
      <button onClick={e => { e.stopPropagation(); onDownload(doc) }} disabled={downloading === doc.id}
        style={{ width:'100%', padding:'6px 0', borderRadius:8, border:'none',
          background: downloading === doc.id ? 'var(--surface-2)' : 'var(--primary)',
          color: downloading === doc.id ? 'var(--text)' : 'white',
          fontSize:'0.78rem', fontWeight:600, cursor:'pointer' }}>
        {downloading === doc.id ? '⏳ Lädt...' : '⬇ Download'}
      </button>
    </div>
  )
}

export default function DocumentsPage() {
  const [docs, setDocs]       = useState([])
  const [categories, setCategories] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [view, setView]       = useState('list')
  const [downloading, setDownloading] = useState(null)
  const [preview, setPreview] = useState(null)
  const [openCats, setOpenCats]   = useState({})
  const [openYears, setOpenYears] = useState({})

  useEffect(() => {
    api.get('/documents').then(r => {
      const d = r.data.documents || []
      setDocs(d)
      setCategories(r.data.categories || {})
      const cats = {}
      d.forEach(doc => { cats[doc.kategorieKey || doc.kategorie || ''] = true })
      setOpenCats(cats)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const catName = (k) => categories[k] || categories[(k||'').toUpperCase()] || k || 'Allgemein'

  const download = async (doc, e) => {
    if (e) e.stopPropagation()
    setDownloading(doc.id)
    try {
      const res = await api.get('/documents/download/' + doc.id, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href = url; a.download = doc.dateiname; a.click()
      window.URL.revokeObjectURL(url)
    } catch(err) { alert('Fehler: ' + (err.response?.data?.error || err.message)) }
    setDownloading(null)
  }

  const filtered = docs.filter(d =>
    !search ||
    (d.dateiname||'').toLowerCase().includes(search.toLowerCase()) ||
    (d.beschreibung||'').toLowerCase().includes(search.toLowerCase()) ||
    catName(d.kategorieKey||d.kategorie).toLowerCase().includes(search.toLowerCase())
  )

  const grouped = {}
  filtered.forEach(doc => {
    const cat   = doc.kategorieKey || doc.kategorie || ''
    const dt    = new Date(doc.datum || doc.angelegt)
    const year  = isNaN(dt) ? 'Unbekannt' : String(dt.getFullYear())
    const month = isNaN(dt) ? 'Unbekannt' : MONTHS[dt.getMonth()]
    if (!grouped[cat]) grouped[cat] = {}
    if (!grouped[cat][year]) grouped[cat][year] = {}
    if (!grouped[cat][year][month]) grouped[cat][year][month] = []
    grouped[cat][year][month].push(doc)
  })

  const toggleCat  = (k) => setOpenCats(p => ({ ...p, [k]: !p[k] }))
  const toggleYear = (k) => setOpenYears(p => ({ ...p, [k]: p[k] === false }))

  return (
    <div style={{ width:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:'1.3rem', fontWeight:800 }}>📁 Meine Dokumente</h1>
          <p style={{ color:'var(--text-3)', fontSize:'0.85rem', marginTop:2 }}>Dokumente die Ihnen in Powerbird hinterlegt wurden</p>
        </div>
        <div style={{ display:'flex', borderRadius:8, overflow:'hidden', border:'1px solid var(--border)', height:36 }}>
          {[['list','☰ Liste'],['grid','⊞ Kacheln']].map(([v,label]) => (
            <button key={v} onClick={() => setView(v)} style={{ padding:'0 14px', border:'none', cursor:'pointer',
              fontFamily:'var(--font)', fontSize:'0.82rem', fontWeight: view===v ? 700 : 400,
              background: view===v ? 'var(--primary)' : 'var(--surface-2)',
              color: view===v ? 'white' : 'var(--text)' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Dokumente suchen..."
        style={{ width:'100%', padding:'10px 14px', borderRadius:10, marginBottom:20,
          border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)',
          fontFamily:'var(--font)', fontSize:'0.9rem', boxSizing:'border-box' }} />

      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--text-3)' }}>Lädt...</div>
      ) : docs.length === 0 ? (
        <div style={{ background:'var(--surface)', borderRadius:14, border:'1px solid var(--border)', padding:40, textAlign:'center' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:12 }}>📂</div>
          <div style={{ fontWeight:600 }}>Keine Dokumente vorhanden</div>
        </div>
      ) : view === 'grid' ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:16 }}>
          {filtered.map(doc => (
            <GridTile key={doc.id} doc={doc} onPreview={setPreview}
              onDownload={download} downloading={downloading} catName={catName} />
          ))}
        </div>
      ) : (
        Object.entries(grouped).sort(([a],[b]) => catName(a).localeCompare(catName(b))).map(([cat, years]) => {
          const totalDocs = Object.values(years).flatMap(m => Object.values(m)).flat().length
          return (
            <div key={cat} style={{ marginBottom:16 }}>
              <div onClick={() => toggleCat(cat)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'10px 16px', borderRadius: openCats[cat] ? '10px 10px 0 0' : 10,
                background:'var(--primary)', color:'white', cursor:'pointer', userSelect:'none' }}>
                <span style={{ fontWeight:700 }}>{catName(cat)} <span style={{ fontWeight:400, fontSize:'0.8rem', opacity:0.8 }}>({totalDocs})</span></span>
                <span>{openCats[cat] ? '▲' : '▼'}</span>
              </div>
              {openCats[cat] && (
                <div style={{ background:'var(--surface)', borderRadius:'0 0 10px 10px', border:'1px solid var(--border)', borderTop:'none', overflow:'hidden' }}>
                  {Object.entries(years).sort(([a],[b]) => parseInt(b)-parseInt(a)).map(([year, months]) => {
                    const yearKey = cat+'_'+year
                    return (
                      <div key={year}>
                        <div onClick={() => toggleYear(yearKey)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                          padding:'8px 16px', background:'var(--surface-2)', cursor:'pointer', borderTop:'1px solid var(--border)', userSelect:'none' }}>
                          <span style={{ fontWeight:600, fontSize:'0.88rem' }}>📅 {year} <span style={{ fontWeight:400, color:'var(--text-3)', fontSize:'0.8rem' }}>({Object.values(months).flat().length})</span></span>
                          <span style={{ color:'var(--text-3)', fontSize:'0.8rem' }}>{openYears[yearKey] ? '▼' : '▲'}</span>
                        </div>
                        {!openYears[yearKey] && Object.entries(months).sort(([a],[b]) => MONTHS.indexOf(b)-MONTHS.indexOf(a)).map(([month, mdocs]) => (
                          <div key={month}>
                            <div style={{ padding:'6px 24px', fontSize:'0.75rem', fontWeight:600, color:'var(--text-3)',
                              background:'var(--surface)', borderTop:'1px solid var(--border)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                              {month} ({mdocs.length})
                            </div>
                            {mdocs.map((doc, i) => (
                              <div key={doc.id} onClick={() => canPreview(doc.mimeType) && setPreview(doc)}
                                style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px 12px 24px',
                                  borderTop:'1px solid var(--border)', background: i%2===0?'transparent':'var(--surface-2)',
                                  cursor: canPreview(doc.mimeType) ? 'pointer' : 'default' }}>
                                <div style={{ fontSize:'1.6rem', flexShrink:0 }}>{fileIcon(doc.mimeType)}</div>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ fontWeight:600, fontSize:'0.88rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                                    color: canPreview(doc.mimeType) ? 'var(--primary)' : 'var(--text)' }}>
                                    {doc.dateiname}
                                    {canPreview(doc.mimeType) && <span style={{ fontSize:'0.72rem', color:'var(--text-3)', marginLeft:8, fontWeight:400 }}>👁 Vorschau</span>}
                                  </div>
                                  <div style={{ fontSize:'0.73rem', color:'var(--text-3)', marginTop:2 }}>
                                    {fmtDate(doc.datum)}{doc.fileSize ? ' · '+fmtSize(doc.fileSize) : ''}{doc.beschreibung ? ' · '+doc.beschreibung : ''}
                                  </div>
                                </div>
                                <button onClick={e => download(doc,e)} disabled={downloading===doc.id}
                                  style={{ padding:'7px 14px', borderRadius:8, border:'none',
                                    cursor: downloading===doc.id?'wait':'pointer',
                                    background: downloading===doc.id?'var(--surface-2)':'var(--primary)',
                                    color: downloading===doc.id?'var(--text)':'white',
                                    fontFamily:'var(--font)', fontSize:'0.82rem', fontWeight:600, flexShrink:0 }}>
                                  {downloading===doc.id ? '⏳' : '⬇ Download'}
                                </button>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })
      )}
      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
