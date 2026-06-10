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
const fileIcon  = (mime) => FILE_ICONS[mime] || '📎'
const canPreview = (mime) => mime && (mime.startsWith('image/') || mime === 'application/pdf')
const fmtSize   = (b) => { if (!b) return ''; const n=parseInt(b); if(n<1024) return n+' B'; if(n<1024*1024) return Math.round(n/1024)+' KB'; return Math.round(n/1024/1024*10)/10+' MB' }
const fmtDate   = (d) => d ? new Date(d).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—'
const MONTHS    = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']

// ── Vorschau-Modal ─────────────────────────────────────────────────────
function PreviewModal({ doc, onClose }) {
  const [url, setUrl]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  useEffect(() => {
    let objUrl = null
    api.get('/documents/download/' + doc.id, { responseType: 'blob' })
      .then(r => { const blob = new Blob([r.data], { type: doc.mimeType || 'application/octet-stream' }); objUrl = window.URL.createObjectURL(blob); setUrl(objUrl); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
    return () => { if (objUrl) window.URL.revokeObjectURL(objUrl) }
  }, [doc.id])
  const isImage = doc.mimeType?.startsWith('image/')
  const isPdf   = doc.mimeType === 'application/pdf'
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--surface)', borderRadius:16, width:'min(1000px,96vw)', height:'min(85vh,750px)', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(0,0,0,0.5)', overflow:'hidden' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div><div style={{ fontWeight:700 }}>{doc.dateiname}</div><div style={{ fontSize:'0.75rem', color:'var(--text-3)' }}>{fmtDate(doc.datum)} · {fmtSize(doc.fileSize)}</div></div>
          <div style={{ display:'flex', gap:8 }}>
            {url && <a href={url} download={doc.dateiname} style={{ padding:'7px 14px', borderRadius:8, background:'var(--primary)', color:'white', textDecoration:'none', fontSize:'0.82rem', fontWeight:600 }}>⬇ Download</a>}
            <button onClick={onClose} style={{ padding:'7px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface-2)', cursor:'pointer', fontFamily:'var(--font)' }}>✕</button>
          </div>
        </div>
        <div style={{ flex:1, overflow:'hidden', background:'#111' }}>
          {loading && <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#fff' }}>Lädt...</div>}
          {error   && <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#f87171' }}>{error}</div>}
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

// ── Explorer-Kachel ────────────────────────────────────────────────────
function Tile({ icon, label, sub, onClick, isFolder = false, mimeType, fileSize, onDownload, downloading }) {
  const [hov, setHov] = useState(false)
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? 'var(--surface-2)' : 'var(--surface)',
        border:'1px solid ' + (hov ? 'var(--primary)' : 'var(--border)'),
        borderRadius:12, padding:16, cursor:'pointer', display:'flex', flexDirection:'column',
        alignItems:'center', gap:8, transition:'all 0.15s', minWidth:0,
        boxShadow: hov ? '0 4px 16px rgba(0,0,0,0.12)' : 'var(--shadow)' }}>
      <div style={{ fontSize: isFolder ? '3rem' : '2.5rem', lineHeight:1 }}>{icon}</div>
      <div style={{ fontSize:'0.78rem', fontWeight:600, textAlign:'center', color: isFolder ? 'var(--text)' : canPreview(mimeType) ? 'var(--primary)' : 'var(--text)',
        overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', width:'100%', wordBreak:'break-word' }}>
        {label}
      </div>
      {sub && <div style={{ fontSize:'0.68rem', color:'var(--text-3)', textAlign:'center' }}>{sub}</div>}
      {!isFolder && onDownload && (
        <button onClick={e => { e.stopPropagation(); onDownload() }} disabled={downloading}
          style={{ width:'100%', padding:'4px 0', borderRadius:6, border:'none',
            background: downloading ? 'var(--surface-2)' : 'var(--primary)',
            color: downloading ? 'var(--text)' : 'white', fontSize:'0.72rem', fontWeight:600, cursor:'pointer' }}>
          {downloading ? '⏳' : '⬇'}
        </button>
      )}
    </div>
  )
}

// ── Haupt-Seite ────────────────────────────────────────────────────────
export default function DocumentsPage() {
  const [docs, setDocs]       = useState([])
  const [categories, setCategories] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [path, setPath]       = useState([]) // [{type:'cat',key}, {type:'year',key}, {type:'month',key}]
  const [downloading, setDownloading] = useState(null)
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    api.get('/documents').then(r => {
      setDocs(r.data.documents || [])
      setCategories(r.data.categories || {})
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const catName = (k) => categories[k] || categories[(k||'').toUpperCase()] || k || 'Allgemein'

  const download = async (doc) => {
    setDownloading(doc.id)
    try {
      const res = await api.get('/documents/download/' + doc.id, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href = url; a.download = doc.dateiname; a.click()
      window.URL.revokeObjectURL(url)
    } catch(err) { alert('Fehler: ' + (err.response?.data?.error || err.message)) }
    setDownloading(null)
  }

  // Gruppierung
  const grouped = {}
  docs.forEach(doc => {
    const cat   = doc.kategorieKey || doc.kategorie || ''
    const dt    = new Date(doc.datum || doc.angelegt)
    const year  = isNaN(dt) ? 'Unbekannt' : String(dt.getFullYear())
    const month = isNaN(dt) ? 'Unbekannt' : MONTHS[dt.getMonth()]
    if (!grouped[cat]) grouped[cat] = {}
    if (!grouped[cat][year]) grouped[cat][year] = {}
    if (!grouped[cat][year][month]) grouped[cat][year][month] = []
    grouped[cat][year][month].push(doc)
  })

  // Aktuelle Ebene
  const currentCat   = path.find(p => p.type === 'cat')?.key
  const currentYear  = path.find(p => p.type === 'year')?.key
  const currentMonth = path.find(p => p.type === 'month')?.key

  const navigate = (type, key) => setPath(p => [...p, { type, key }])
  const goBack   = () => setPath(p => p.slice(0, -1))
  const goHome   = () => setPath([])

  // Breadcrumb-Text
  const breadcrumb = ['Alle Dokumente', currentCat ? catName(currentCat) : null, currentYear, currentMonth].filter(Boolean)

  // Suchfilter
  const searchFiltered = search
    ? docs.filter(d => (d.dateiname||'').toLowerCase().includes(search.toLowerCase()) ||
        catName(d.kategorieKey||d.kategorie).toLowerCase().includes(search.toLowerCase()))
    : null

  // ── Was wird angezeigt? ──
  const renderContent = () => {
    // Suche aktiv → alle passenden Dateien als Kacheln
    if (searchFiltered) {
      if (searchFiltered.length === 0) return <div style={{ textAlign:'center', padding:40, color:'var(--text-3)' }}>Keine Treffer</div>
      return (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12 }}>
          {searchFiltered.map(doc => (
            <Tile key={doc.id} icon={fileIcon(doc.mimeType)} label={doc.dateiname}
              sub={fmtDate(doc.datum) + (doc.fileSize ? ' · ' + fmtSize(doc.fileSize) : '')}
              onClick={() => canPreview(doc.mimeType) ? setPreview(doc) : download(doc)}
              mimeType={doc.mimeType} fileSize={doc.fileSize}
              onDownload={() => download(doc)} downloading={downloading === doc.id} />
          ))}
        </div>
      )
    }

    // Ebene 0: Kategorien
    if (!currentCat) {
      const cats = Object.keys(grouped)
      if (cats.length === 0) return <div style={{ textAlign:'center', padding:40, color:'var(--text-3)' }}>Keine Dokumente vorhanden</div>
      return (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12 }}>
          {cats.sort((a,b) => catName(a).localeCompare(catName(b))).map(cat => {
            const count = Object.values(grouped[cat]).flatMap(m => Object.values(m)).flat().length
            return <Tile key={cat} icon="📁" label={catName(cat)} sub={count + ' Dokument' + (count!==1?'e':'')}
              onClick={() => navigate('cat', cat)} isFolder />
          })}
        </div>
      )
    }

    // Ebene 1: Jahre
    if (!currentYear) {
      const years = Object.keys(grouped[currentCat] || {})
      return (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12 }}>
          {years.sort((a,b) => parseInt(b)-parseInt(a)).map(year => {
            const count = Object.values(grouped[currentCat][year]).flat().length
            return <Tile key={year} icon="📅" label={year} sub={count + ' Dokument' + (count!==1?'e':'')}
              onClick={() => navigate('year', year)} isFolder />
          })}
        </div>
      )
    }

    // Ebene 2: Monate
    if (!currentMonth) {
      const months = Object.keys(grouped[currentCat]?.[currentYear] || {})
      return (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12 }}>
          {months.sort((a,b) => MONTHS.indexOf(b)-MONTHS.indexOf(a)).map(month => {
            const count = (grouped[currentCat][currentYear][month] || []).length
            return <Tile key={month} icon="📆" label={month} sub={count + ' Dokument' + (count!==1?'e':'')}
              onClick={() => navigate('month', month)} isFolder />
          })}
        </div>
      )
    }

    // Ebene 3: Dateien
    const files = grouped[currentCat]?.[currentYear]?.[currentMonth] || []
    return (
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12 }}>
        {files.map(doc => (
          <Tile key={doc.id} icon={fileIcon(doc.mimeType)} label={doc.dateiname}
            sub={fmtDate(doc.datum) + (doc.fileSize ? ' · ' + fmtSize(doc.fileSize) : '')}
            onClick={() => canPreview(doc.mimeType) ? setPreview(doc) : download(doc)}
            mimeType={doc.mimeType} fileSize={doc.fileSize}
            onDownload={() => download(doc)} downloading={downloading === doc.id} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ width:'100%' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:'1.3rem', fontWeight:800 }}>📁 Meine Dokumente</h1>
          <p style={{ color:'var(--text-3)', fontSize:'0.85rem', marginTop:2 }}>Dokumente aus Powerbird</p>
        </div>
      </div>

      {/* Suche */}
      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Dokumente suchen..."
        style={{ width:'100%', padding:'10px 14px', borderRadius:10, marginBottom:14,
          border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)',
          fontFamily:'var(--font)', fontSize:'0.9rem', boxSizing:'border-box' }} />

      {/* Navigation-Leiste */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px',
        background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10,
        marginBottom:16, flexWrap:'wrap' }}>
        {path.length > 0 && (
          <>
            <button onClick={goBack} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid var(--border)',
              background:'var(--surface-2)', cursor:'pointer', fontFamily:'var(--font)', fontSize:'0.82rem', fontWeight:600 }}>
              ← Zurück
            </button>
            <button onClick={goHome} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid var(--border)',
              background:'var(--surface-2)', cursor:'pointer', fontFamily:'var(--font)', fontSize:'0.82rem' }}>
              🏠 Alle
            </button>
          </>
        )}
        {breadcrumb.map((b, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ color:'var(--text-3)' }}>›</span>}
            <span style={{ fontSize:'0.84rem', fontWeight: i === breadcrumb.length-1 ? 700 : 400,
              color: i === breadcrumb.length-1 ? 'var(--text)' : 'var(--text-3)',
              cursor: i < breadcrumb.length-1 ? 'pointer' : 'default' }}
              onClick={() => { if (i < breadcrumb.length-1) setPath(path.slice(0, i)) }}>
              {b}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Inhalt */}
      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--text-3)' }}>Lädt...</div>
      ) : renderContent()}

      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
