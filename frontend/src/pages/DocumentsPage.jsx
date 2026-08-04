import React, { useState, useEffect, useRef } from 'react'
import api from '../utils/api.js'

const FILE_ICONS = {
  'application/pdf': '📄',
  'image/jpeg': '🖼', 'image/png': '🖼', 'image/gif': '🖼', 'image/webp': '🖼',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-excel': '📊',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
}
const fileIcon   = (mime) => FILE_ICONS[mime] || '📎'
const canPreview = (mime) => mime && (mime.startsWith('image/') || mime === 'application/pdf')
const fmtSize    = (b) => { if (!b) return ''; const n=parseInt(b); if(n<1024) return n+' B'; if(n<1024*1024) return Math.round(n/1024)+' KB'; return Math.round(n/1024/1024*10)/10+' MB' }
const fmtDate    = (d) => d ? new Date(d).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—'
const MONTHS     = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']

function PreviewModal({ doc, onClose }) {
  const [url, setUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let objUrl = null
    api.get('/documents/download/' + doc.id, { responseType: 'blob' })
      .then(r => { const blob = new Blob([r.data], { type: doc.mimeType || 'application/octet-stream' }); objUrl = window.URL.createObjectURL(blob); setUrl(objUrl); setLoading(false) })
      .catch(() => setLoading(false))
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
          {!loading && url && (isImage ? <img src={url} alt={doc.dateiname} style={{ width:'100%', height:'100%', objectFit:'contain' }} /> : isPdf ? <iframe src={url} style={{ width:'100%', height:'100%', border:'none' }} title={doc.dateiname} /> : <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}><a href={url} download={doc.dateiname} style={{ padding:'10px 24px', borderRadius:10, background:'var(--primary)', color:'white', textDecoration:'none', fontWeight:600 }}>⬇ Herunterladen</a></div>)}
        </div>
      </div>
    </div>
  )
}

function Tile({ icon, label, sub, onClick, isFolder, mimeType, onDownload, downloading }) {
  const [hov, setHov] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? 'var(--surface-2)' : 'var(--surface)', border:'1px solid '+(hov?'var(--primary)':'var(--border)'),
        borderRadius:12, padding:16, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:8, transition:'all 0.15s', boxShadow: hov?'0 4px 16px rgba(0,0,0,0.12)':'var(--shadow)' }}>
      <div style={{ fontSize: isFolder ? '3rem' : '2.5rem', lineHeight:1 }}>{icon}</div>
      <div style={{ fontSize:'0.78rem', fontWeight:600, textAlign:'center', color: isFolder?'var(--text)':canPreview(mimeType)?'var(--primary)':'var(--text)',
        overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', width:'100%', wordBreak:'break-word' }}>{label}</div>
      {sub && <div style={{ fontSize:'0.68rem', color:'var(--text-3)', textAlign:'center' }}>{sub}</div>}
      {!isFolder && onDownload && (
        <button onClick={e => { e.stopPropagation(); onDownload() }} disabled={downloading}
          style={{ width:'100%', padding:'4px 0', borderRadius:6, border:'none', background: downloading?'var(--surface-2)':'var(--primary)',
            color: downloading?'var(--text)':'white', fontSize:'0.72rem', fontWeight:600, cursor:'pointer' }}>
          {downloading ? '⏳' : '⬇'}
        </button>
      )}
    </div>
  )
}

export default function DocumentsPage() {
  const [docs, setDocs]       = useState([])
  const [categories, setCategories] = useState({})
  const [mode, setMode]       = useState('powerbird')
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [path, setPath]       = useState([])
  const [downloading, setDownloading] = useState(null)
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [uploadCat, setUploadCat] = useState('')
  const [uploadMonth, setUploadMonth] = useState('')
  const [uploadTargetUser, setUploadTargetUser] = useState('')
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [availCategories, setAvailCategories] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const fileRef = useRef()

  const load = () => {
    setLoading(true)
    api.get('/documents/categories').then(r => setAvailCategories(r.data.categories || [])).catch(() => {})
    api.get('/documents').then(r => {
      setDocs(r.data.documents || [])
      setCategories(r.data.categories || {})
      setMode(r.data.mode || 'powerbird')
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

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

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setUploadMsg('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('category', uploadCat || 'Allgemein')
    fd.append('month', uploadMonth)
    if (uploadTargetUser) fd.append('target_user_id', uploadTargetUser)
    try {
      await api.post('/documents/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setUploadMsg('✅ Hochgeladen')
      setUploadDialogOpen(false)
      load()
    } catch(err) { setUploadMsg('❌ ' + (err.response?.data?.error || err.message)) }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const loadUsers = async () => {
    if (allUsers.length > 0) return
    try {
      const r = await api.get('/users')
      setAllUsers(r.data.users || r.data || [])
    } catch(e) {}
  }

  const deleteDoc = async (doc) => {
    if (!window.confirm('Dokument wirklich löschen?')) return
    const localId = doc.id.replace('local_', '')
    try { await api.delete('/documents/local/' + localId); load() }
    catch(err) { alert('Fehler: ' + (err.response?.data?.error || err.message)) }
  }

  // Gruppierung für Explorer
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

  const currentCat   = path.find(p => p.type === 'cat')?.key
  const currentYear  = path.find(p => p.type === 'year')?.key
  const currentMonth = path.find(p => p.type === 'month')?.key
  const navigate     = (type, key) => setPath(p => [...p, { type, key }])
  const goBack       = () => setPath(p => p.slice(0, -1))
  const breadcrumb   = ['Alle Dokumente', currentCat ? catName(currentCat) : null, currentYear, currentMonth].filter(Boolean)

  const searchFiltered = search ? docs.filter(d =>
    (d.dateiname||'').toLowerCase().includes(search.toLowerCase()) ||
    catName(d.kategorieKey||d.kategorie).toLowerCase().includes(search.toLowerCase())
  ) : null

  const renderExplorer = () => {
    if (searchFiltered) {
      if (searchFiltered.length === 0) return <div style={{ textAlign:'center', padding:40, color:'var(--text-3)' }}>Keine Treffer</div>
      return <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12 }}>
        {searchFiltered.map(doc => <Tile key={doc.id} icon={fileIcon(doc.mimeType)} label={doc.dateiname}
          sub={fmtDate(doc.datum)} onClick={() => canPreview(doc.mimeType) ? setPreview(doc) : download(doc)}
          mimeType={doc.mimeType} onDownload={() => download(doc)} downloading={downloading === doc.id} />)}
      </div>
    }
    if (!currentCat) {
      const cats = Object.keys(grouped).sort((a,b) => catName(a).localeCompare(catName(b)))
      if (cats.length === 0 && mode !== 'local') return <div style={{ textAlign:'center', padding:40, color:'var(--text-3)' }}>Keine Dokumente vorhanden</div>
      return <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12 }}>
        {cats.map(cat => {
          const count = Object.values(grouped[cat]).flatMap(m => Object.values(m)).flat().length
          return <Tile key={cat} icon="📁" label={catName(cat)} sub={count+' Dok.'} onClick={() => navigate('cat', cat)} isFolder />
        })}
      </div>
    }
    if (!currentYear) {
      const years = Object.keys(grouped[currentCat]||{}).sort((a,b)=>parseInt(b)-parseInt(a))
      return <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12 }}>
        {years.map(year => { const count = Object.values(grouped[currentCat][year]).flat().length
          return <Tile key={year} icon="📅" label={year} sub={count+' Dok.'} onClick={() => navigate('year', year)} isFolder /> })}
      </div>
    }
    if (!currentMonth) {
      const months = Object.keys(grouped[currentCat]?.[currentYear]||{}).sort((a,b)=>MONTHS.indexOf(b)-MONTHS.indexOf(a))
      return <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12 }}>
        {months.map(month => { const count = (grouped[currentCat][currentYear][month]||[]).length
          return <Tile key={month} icon="📆" label={month} sub={count+' Dok.'} onClick={() => navigate('month', month)} isFolder /> })}
      </div>
    }
    const files = grouped[currentCat]?.[currentYear]?.[currentMonth] || []
    return <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12 }}>
      {files.map(doc => <Tile key={doc.id} icon={fileIcon(doc.mimeType)} label={doc.dateiname}
        sub={fmtDate(doc.datum)+(doc.fileSize?' · '+fmtSize(doc.fileSize):'')}
        onClick={() => canPreview(doc.mimeType) ? setPreview(doc) : download(doc)}
        mimeType={doc.mimeType} onDownload={() => download(doc)} downloading={downloading === doc.id} />)}
    </div>
  }

  const renderLocal = () => (
    <div>
      {/* Upload erfolgt über Dialog-Button oben */}
      <div style={{ background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)', padding:20, marginBottom:20 }}>
        <div style={{ fontWeight:700, fontSize:'0.95rem', marginBottom:12 }}>📤 Dokument hochladen</div>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div style={{ flex:1, minWidth:150 }}>
            <label style={{ fontSize:'0.8rem', fontWeight:600, display:'block', marginBottom:4 }}>Kategorie</label>
            <input value={uploadCat} onChange={e => setUploadCat(e.target.value)}
              placeholder="z.B. Lohnabrechnung" style={{ width:'100%', padding:'8px 12px', borderRadius:8,
                border:'1px solid var(--border)', background:'var(--surface)', fontFamily:'var(--font)',
                fontSize:'0.88rem', boxSizing:'border-box' }} />
          </div>
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.85rem', cursor:'pointer' }}>
            <input type="checkbox" checked={isPublicUpload} onChange={e => setIsPublicUpload(e.target.checked)} />
            Für alle sichtbar
          </label>
          <input ref={fileRef} type="file" onChange={handleUpload} disabled={uploading}
            style={{ padding:'7px 12px', borderRadius:8, border:'1px solid var(--border)',
              background:'var(--surface-2)', cursor:'pointer', fontSize:'0.85rem' }} />
        </div>
        {uploadMsg && <div style={{ marginTop:8, fontSize:'0.85rem', color: uploadMsg.startsWith('✅') ? 'var(--success)' : 'var(--error)' }}>{uploadMsg}</div>}
      </div>
      {/* Dateiliste */}
      {docs.length === 0 ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--text-3)' }}>Noch keine Dokumente hochgeladen</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12 }}>
          {docs.map(doc => (
            <div key={doc.id} style={{ background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)',
              padding:14, display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
              <div style={{ fontSize:'2.5rem' }}>{fileIcon(doc.mimeType)}</div>
              <div style={{ fontSize:'0.75rem', fontWeight:600, textAlign:'center', wordBreak:'break-word' }}>{doc.dateiname}</div>
              <div style={{ fontSize:'0.68rem', color:'var(--text-3)', textAlign:'center' }}>
                {doc.kategorieKey}{doc.isPublic ? ' · 🌐' : ' · 🔒'}
              </div>
              <div style={{ display:'flex', gap:6, width:'100%' }}>
                <button onClick={() => canPreview(doc.mimeType) ? setPreview(doc) : download(doc)}
                  style={{ flex:1, padding:'4px 0', borderRadius:6, border:'none', background:'var(--primary)',
                    color:'white', fontSize:'0.72rem', fontWeight:600, cursor:'pointer' }}>
                  {canPreview(doc.mimeType) ? '👁' : '⬇'}
                </button>
                <button onClick={() => deleteDoc(doc)}
                  style={{ padding:'4px 8px', borderRadius:6, border:'none', background:'#EF4444',
                    color:'white', fontSize:'0.72rem', cursor:'pointer' }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div style={{ width:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:'1.3rem', fontWeight:800 }}>📁 Dokumente</h1>
          <p style={{ color:'var(--text-3)', fontSize:'0.85rem', marginTop:2 }}>
            {mode === 'powerbird' ? 'Aus Powerbird' : mode === 'smb' ? 'Vom Netzlaufwerk' : 'Eigene Dokumente'}
          </p>
        </div>
      </div>

      {mode !== 'local' && (
        <>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Dokumente suchen..."
            style={{ width:'100%', padding:'10px 14px', borderRadius:10, marginBottom:14,
              border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)',
              fontFamily:'var(--font)', fontSize:'0.9rem', boxSizing:'border-box' }} />
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px',
            background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, marginBottom:16, flexWrap:'wrap' }}>
            {path.length > 0 && <>
              <button onClick={goBack} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid var(--border)', background:'var(--surface-2)', cursor:'pointer', fontFamily:'var(--font)', fontSize:'0.82rem', fontWeight:600 }}>← Zurück</button>
              <button onClick={() => setPath([])} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid var(--border)', background:'var(--surface-2)', cursor:'pointer', fontFamily:'var(--font)', fontSize:'0.82rem' }}>🏠 Alle</button>
            </>}
            {breadcrumb.map((b,i) => <React.Fragment key={i}>
              {i > 0 && <span style={{ color:'var(--text-3)' }}>›</span>}
              <span style={{ fontSize:'0.84rem', fontWeight: i===breadcrumb.length-1?700:400, color: i===breadcrumb.length-1?'var(--text)':'var(--text-3)' }}>{b}</span>
            </React.Fragment>)}
          </div>
        </>
      )}

      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--text-3)' }}>Lädt...</div>
      ) : mode === 'local' ? renderLocal() : renderExplorer()}


      {/* Upload-Dialog */}
      {uploadDialogOpen && (
        <div onClick={() => setUploadDialogOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'var(--surface)', borderRadius:16, width:'min(500px,96vw)', boxShadow:'0 24px 64px rgba(0,0,0,0.3)', overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontWeight:700, fontSize:'0.95rem' }}>📤 Dokument hochladen</div>
              <button onClick={() => setUploadDialogOpen(false)} style={{ border:'none', background:'none', fontSize:'1.2rem', cursor:'pointer', color:'var(--text-2)' }}>✕</button>
            </div>
            <div style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>
              {uploadMsg && <div style={{ padding:'8px 12px', borderRadius:8, fontSize:'0.85rem',
                background: uploadMsg.startsWith('✅') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                color: uploadMsg.startsWith('✅') ? 'var(--success)' : 'var(--error)' }}>{uploadMsg}</div>}

              <div>
                <label style={{ fontSize:'0.82rem', fontWeight:600, display:'block', marginBottom:5 }}>Für Mitarbeiter *</label>
                <select value={uploadTargetUser} onChange={e => setUploadTargetUser(e.target.value)}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)',
                    background:'var(--surface)', fontFamily:'var(--font)', fontSize:'0.88rem' }}>
                  <option value="">— Für mich selbst —</option>
                  {allUsers.filter(u => u.is_active !== 0).map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize:'0.82rem', fontWeight:600, display:'block', marginBottom:5 }}>Kategorie</label>
                {availCategories.length > 0 ? (
                  <select value={uploadCat} onChange={e => setUploadCat(e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)',
                      background:'var(--surface)', fontFamily:'var(--font)', fontSize:'0.88rem' }}>
                    <option value="">— Kategorie wählen —</option>
                    {availCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <input value={uploadCat} onChange={e => setUploadCat(e.target.value)}
                    placeholder="z.B. Lohnabrechnung"
                    style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)',
                      background:'var(--surface)', fontFamily:'var(--font)', fontSize:'0.88rem', boxSizing:'border-box' }} />
                )}
              </div>

              <div>
                <label style={{ fontSize:'0.82rem', fontWeight:600, display:'block', marginBottom:5 }}>Monat (optional)</label>
                <input type="month" value={uploadMonth} onChange={e => setUploadMonth(e.target.value)}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)',
                    background:'var(--surface)', fontFamily:'var(--font)', fontSize:'0.88rem', boxSizing:'border-box' }} />
                <div style={{ fontSize:'0.75rem', color:'var(--text-3)', marginTop:3 }}>Wird für die Sortierung nach Jahr/Monat verwendet</div>
              </div>

              <div>
                <label style={{ fontSize:'0.82rem', fontWeight:600, display:'block', marginBottom:5 }}>
                  Dateien *
                  <span style={{ fontWeight:400, color:'var(--text-3)', marginLeft:6, fontSize:'0.78rem' }}>
                    (mehrere auswählbar)
                  </span>
                </label>
                <input ref={fileRef} type="file" multiple onChange={handleUpload} disabled={uploading}
                  style={{ width:'100%', padding:'7px 0', fontSize:'0.85rem', cursor:'pointer' }} />
                <div style={{ fontSize:'0.75rem', color:'var(--text-3)', marginTop:3 }}>
                  Max. 20 Dateien, je max. 50 MB
                </div>
              </div>

              {uploading && <div style={{ textAlign:'center', color:'var(--text-3)' }}>⏳ Wird hochgeladen...</div>}
            </div>
          </div>
        </div>
      )}
      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
