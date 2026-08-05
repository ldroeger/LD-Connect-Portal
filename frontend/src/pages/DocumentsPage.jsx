import React, { useState, useEffect, useRef } from 'react'
import api from '../utils/api.js'
import { useAuth } from '../contexts/AuthContext.jsx'

const ICONS = {
  'application/pdf':'📄','image/jpeg':'🖼','image/png':'🖼','image/gif':'🖼','image/webp':'🖼',
  'application/msword':'📝','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'📝',
  'application/vnd.ms-excel':'📊','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'📊',
}
const fileIcon   = (m) => ICONS[m] || '📎'
const canPreview = (m) => m && (
  m.startsWith('image/') ||
  m === 'application/pdf' ||
  m === 'text/plain' ||
  m === 'text/csv' ||
  m === 'text/html' ||
  m.startsWith('video/') ||
  m.startsWith('audio/')
)
const fmtSize    = (b) => { if (!b) return ''; const n=parseInt(b); if(n<1024) return n+' B'; if(n<1048576) return Math.round(n/1024)+' KB'; return Math.round(n/1048576*10)/10+' MB' }
const fmtDate    = (d) => d ? new Date(d).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—'
const MONTHS     = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']


function TextPreview({ url }) {
  const [text, setText] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  React.useEffect(() => {
    fetch(url).then(r => r.text()).then(t => { setText(t); setLoading(false) }).catch(() => setLoading(false))
  }, [url])
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#fff'}}>Lädt...</div>
  return (
    <pre style={{width:'100%',height:'100%',overflow:'auto',padding:20,margin:0,color:'#e2e8f0',
      fontFamily:'monospace',fontSize:'0.85rem',lineHeight:1.6,background:'#1e1e1e',whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
      {text}
    </pre>
  )
}

function PreviewModal({ doc, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null)
  const [loading, setLoading]  = useState(true)
  const [error, setError]      = useState(null)

  const isImg   = doc.mimeType?.startsWith('image/')
  const isPdf   = doc.mimeType === 'application/pdf'
  const isText  = doc.mimeType === 'text/plain' || doc.mimeType === 'text/csv'
  const isVideo = doc.mimeType?.startsWith('video/')
  const isAudio = doc.mimeType?.startsWith('audio/')

  // Direkter API-URL mit Token im Header geht nicht per iframe/video src
  // Wir laden als Blob und erstellen Object-URL mit korrektem MIME-Type
  useEffect(() => {
    let u = null
    setLoading(true); setError(null)
    api.get('/documents/download/'+encodeURIComponent(doc.id)+'?inline=true', { responseType:'blob' })
      .then(r => {
        // MIME-Type aus Response-Header nehmen, nicht aus doc.mimeType
        const mime = r.headers['content-type'] || doc.mimeType || 'application/octet-stream'
        const blob = new Blob([r.data], { type: mime })
        u = URL.createObjectURL(blob)
        setBlobUrl(u)
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [doc.id])

  const url = blobUrl
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'var(--surface)',borderRadius:16,width:'min(1000px,96vw)',height:'min(85vh,750px)',display:'flex',flexDirection:'column',boxShadow:'0 24px 64px rgba(0,0,0,0.5)',overflow:'hidden'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 20px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
          <div><div style={{fontWeight:700}}>{doc.dateiname}</div><div style={{fontSize:'0.75rem',color:'var(--text-3)'}}>{fmtDate(doc.datum)} · {fmtSize(doc.fileSize)}</div></div>
          <div style={{display:'flex',gap:8}}>
            {url&&<a href={url} download={doc.dateiname} style={{padding:'7px 14px',borderRadius:8,background:'var(--primary)',color:'white',textDecoration:'none',fontSize:'0.82rem',fontWeight:600}}>⬇ Download</a>}
            <button onClick={onClose} style={{padding:'7px 14px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface-2)',cursor:'pointer',fontFamily:'var(--font)'}}>✕</button>
          </div>
        </div>
        <div style={{flex:1,overflow:'hidden',background:'#111'}}>
          {loading && (
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',flexDirection:'column',gap:12,color:'#fff'}}>
              <div style={{width:40,height:40,border:'3px solid rgba(255,255,255,0.3)',borderTop:'3px solid white',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
              <div>Lädt...</div>
            </div>
          )}
          {error && (
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#f87171',flexDirection:'column',gap:8}}>
              <div style={{fontSize:'2rem'}}>⚠️</div>
              <div>Fehler beim Laden: {error}</div>
            </div>
          )}
          {!loading && !error && url && (
            isImg   ? <img src={url} alt={doc.dateiname} style={{width:'100%',height:'100%',objectFit:'contain'}}/>
            : isPdf ? <iframe src={url} style={{width:'100%',height:'100%',border:'none'}} title={doc.dateiname}/>
            : isVideo ? <video src={url} controls autoPlay style={{width:'100%',height:'100%',background:'#000'}}/>
            : isAudio ? (
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',flexDirection:'column',gap:16}}>
                  <div style={{fontSize:'4rem'}}>🎵</div>
                  <div style={{color:'white',fontWeight:600}}>{doc.dateiname}</div>
                  <audio src={url} controls autoPlay style={{width:'80%'}}/>
                </div>
              )
            : isText  ? <TextPreview url={url}/>
            : <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%'}}>
                <a href={url} download={doc.dateiname} style={{padding:'10px 24px',borderRadius:10,background:'var(--primary)',color:'white',textDecoration:'none',fontWeight:600}}>⬇ Herunterladen</a>
              </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Tile({ icon, label, sub, onClick, isFolder, mimeType, onDownload, downloading, onDelete }) {
  const [hov, setHov] = useState(false)
  return (
    <div style={{position:'relative'}}>
      <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
        style={{background:hov?'var(--surface-2)':'var(--surface)',border:'1px solid '+(hov?'var(--primary)':'var(--border)'),
          borderRadius:12,padding:14,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:8,transition:'all 0.15s',boxShadow:hov?'0 4px 16px rgba(0,0,0,0.12)':'var(--shadow)'}}>
        <div style={{fontSize:isFolder?'2.8rem':'2.4rem',lineHeight:1}}>{icon}</div>
        <div style={{fontSize:'0.75rem',fontWeight:600,textAlign:'center',color:isFolder?'var(--text)':canPreview(mimeType)?'var(--primary)':'var(--text)',
          overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',width:'100%',wordBreak:'break-word'}}>{label}</div>
        {sub&&<div style={{fontSize:'0.67rem',color:'var(--text-3)',textAlign:'center'}}>{sub}</div>}
        {!isFolder&&onDownload&&(
          <button onClick={e=>{e.stopPropagation();onDownload()}} disabled={downloading}
            style={{width:'100%',padding:'4px 0',borderRadius:6,border:'none',background:downloading?'var(--surface-2)':'var(--primary)',
              color:downloading?'var(--text)':'white',fontSize:'0.72rem',fontWeight:600,cursor:'pointer'}}>
            {downloading?'⏳':'⬇'}
          </button>
        )}
      </div>
      {onDelete&&(
        <button onClick={e=>{e.stopPropagation();onDelete()}}
          style={{position:'absolute',top:5,right:5,width:20,height:20,borderRadius:'50%',border:'none',
            background:'#EF4444',color:'white',fontSize:'0.6rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>
          ✕
        </button>
      )}
    </div>
  )
}

function UploadDialog({ onClose, onDone, categories, canUploadAll, allUsers }) {
  const [cat, setCat]         = useState(categories[0]||'')
  const [targets, setTargets] = useState([])
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg]         = useState('')
  const fileRef = useRef()

  const toggleTarget = (id) => setTargets(p => p.includes(id)?p.filter(x=>x!==id):[...p,id])

  const doUpload = async (e) => {
    const files = Array.from(e.target.files||[])
    if (!files.length) return
    setUploading(true); setMsg('')
    const fd = new FormData()
    files.forEach(f=>fd.append('files',f))
    fd.append('category', cat||'Allgemein')
    if (canUploadAll && targets.length>0) fd.append('target_user_ids', targets.join(','))
    try {
      const r = await api.post('/documents/upload', fd, {headers:{'Content-Type':'multipart/form-data'}})
      setMsg('✅ '+(r.data.count||files.length)+' Datei(en) hochgeladen')
      setTimeout(()=>{ onDone(); onClose() }, 1400)
    } catch(err) { setMsg('❌ '+(err.response?.data?.error||err.message)) }
    setUploading(false)
    if (fileRef.current) fileRef.current.value=''
  }

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'var(--surface)',borderRadius:16,width:'min(500px,96vw)',boxShadow:'0 24px 64px rgba(0,0,0,0.3)',overflow:'hidden'}}>
        <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontWeight:700,fontSize:'0.95rem'}}>📤 Dokument hochladen</div>
          <button onClick={onClose} style={{border:'none',background:'none',fontSize:'1.2rem',cursor:'pointer',color:'var(--text-2)'}}>✕</button>
        </div>
        <div style={{padding:20,display:'flex',flexDirection:'column',gap:14}}>
          {msg&&<div style={{padding:'8px 12px',borderRadius:8,fontSize:'0.85rem',
            background:msg.startsWith('✅')?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.1)',
            color:msg.startsWith('✅')?'var(--success)':'var(--error)'}}>{msg}</div>}

          <div>
            <label style={{fontSize:'0.82rem',fontWeight:600,display:'block',marginBottom:5}}>Kategorie</label>
            {categories.length>0?(
              <select value={cat} onChange={e=>setCat(e.target.value)}
                style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface)',fontFamily:'var(--font)',fontSize:'0.88rem'}}>
                {categories.map(c=><option key={c} value={c}>{c}</option>)}
                <option value="Sonstiges">Sonstiges</option>
              </select>
            ):(
              <input value={cat} onChange={e=>setCat(e.target.value)} placeholder="z.B. Lohnabrechnung"
                style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface)',fontFamily:'var(--font)',fontSize:'0.88rem',boxSizing:'border-box'}}/>
            )}
          </div>

          {canUploadAll&&(
            <div>
              <label style={{fontSize:'0.82rem',fontWeight:600,display:'block',marginBottom:5}}>
                Für Mitarbeiter <span style={{fontWeight:400,color:'var(--text-3)',fontSize:'0.78rem'}}>(mehrere wählbar)</span>
              </label>
              <div style={{border:'1px solid var(--border)',borderRadius:8,maxHeight:180,overflowY:'auto',background:'var(--surface)'}}>
                <label style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderBottom:'1px solid var(--border)',cursor:'pointer',fontSize:'0.85rem'}}>
                  <input type="checkbox" checked={targets.length===0} onChange={()=>setTargets([])}/>
                  <span style={{fontStyle:'italic',color:'var(--text-3)'}}>— Für mich selbst —</span>
                </label>
                {allUsers.filter(u=>u.is_active!==0).map((u,i)=>(
                  <label key={u.id} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 12px',
                    borderTop:i>0?'1px solid var(--border)':'none',cursor:'pointer',fontSize:'0.85rem',
                    background:targets.includes(u.id)?'rgba(37,99,235,0.06)':'transparent'}}>
                    <input type="checkbox" checked={targets.includes(u.id)} onChange={()=>toggleTarget(u.id)}/>
                    {u.name}
                  </label>
                ))}
              </div>
              {targets.length>0&&<div style={{fontSize:'0.75rem',color:'var(--primary)',marginTop:4}}>{targets.length} Mitarbeiter ausgewählt</div>}
            </div>
          )}

          <div>
            <label style={{fontSize:'0.82rem',fontWeight:600,display:'block',marginBottom:5}}>
              Dateien * <span style={{fontWeight:400,color:'var(--text-3)',fontSize:'0.78rem'}}>(mehrere auswählbar)</span>
            </label>
            <input ref={fileRef} type="file" multiple onChange={doUpload} disabled={uploading}
              style={{width:'100%',padding:'7px 0',fontSize:'0.85rem',cursor:'pointer'}}/>
            <div style={{fontSize:'0.75rem',color:'var(--text-3)',marginTop:3}}>Max. 20 Dateien, je max. 50 MB</div>
          </div>
          {uploading&&<div style={{textAlign:'center',color:'var(--text-3)'}}>⏳ Wird hochgeladen...</div>}
        </div>
      </div>
    </div>
  )
}

export default function DocumentsPage() {
  const { user } = useAuth()
  const [docs, setDocs]           = useState([])
  const [cats, setCats]           = useState({})
  const [mode, setMode]           = useState('powerbird')
  const [canUpload, setCanUpload] = useState(false)
  const [canUploadAll, setCanUploadAll] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [path, setPath]           = useState([])
  const [downloading, setDownloading] = useState(null)
  const [preview, setPreview]     = useState(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [availCats, setAvailCats] = useState([])
  const [allUsers, setAllUsers]   = useState([])

  const load = () => {
    setLoading(true)
    api.get('/documents/categories').then(r=>setAvailCats(r.data.categories||[])).catch(()=>{})
    api.get('/documents').then(r=>{
      setDocs(r.data.documents||[])
      setCats(r.data.categories||{})
      setMode(r.data.mode||'powerbird')
      setCanUpload(r.data.canUpload===true)
      setCanUploadAll(r.data.canUploadAll===true)
      setLoading(false)
    }).catch(()=>setLoading(false))
  }

  const loadUsers = async () => {
    if (allUsers.length>0) return
    try { const r=await api.get('/users'); setAllUsers(r.data.users||r.data||[]) } catch(e){}
  }

  useEffect(()=>{ load() },[])

  const catName = (k) => cats[k]||cats[(k||'').toUpperCase()]||k||'Allgemein'

  const download = async (doc) => {
    setDownloading(doc.id)
    try {
      const res = await api.get('/documents/download/'+encodeURIComponent(doc.id),{responseType:'blob'})
      const url = URL.createObjectURL(new Blob([res.data]))
      const a=document.createElement('a'); a.href=url; a.download=doc.dateiname; a.click()
      URL.revokeObjectURL(url)
    } catch(err){ alert('Fehler: '+(err.response?.data?.error||err.message)) }
    setDownloading(null)
  }

  const deleteDoc = async (doc) => {
    if (!window.confirm('Dokument wirklich löschen?')) return
    const fsId = doc.id.replace('local_fs_','')
    try { await api.delete('/documents/local/'+encodeURIComponent(fsId)); load() }
    catch(err){ alert('Fehler: '+(err.response?.data?.error||err.message)) }
  }

  const canDelete = (doc) => {
    if (user?.role==='admin') return true
    if (!doc.kuerzel) return false
    return doc.kuerzel===(user?.powerbird_id||'')
  }

  // Gruppierung: Kategorie → Jahr → Monat
  const grouped = {}
  docs.forEach(doc=>{
    const cat  = doc.kategorieKey||doc.kategorie||''
    const dt   = new Date(doc.datum||doc.angelegt)
    const year = isNaN(dt)?'Unbekannt':String(dt.getFullYear())
    const mon  = isNaN(dt)?'Unbekannt':MONTHS[dt.getMonth()]
    if(!grouped[cat]) grouped[cat]={}
    if(!grouped[cat][year]) grouped[cat][year]={}
    if(!grouped[cat][year][mon]) grouped[cat][year][mon]=[]
    grouped[cat][year][mon].push(doc)
  })

  const currentCat  = path.find(p=>p.type==='cat')?.key
  const currentYear = path.find(p=>p.type==='year')?.key
  const currentMon  = path.find(p=>p.type==='month')?.key
  const nav  = (type,key) => setPath(p=>[...p,{type,key}])
  const back = () => setPath(p=>p.slice(0,-1))
  const home = () => setPath([])
  const bc   = ['Alle Dokumente',currentCat?catName(currentCat):null,currentYear,currentMon].filter(Boolean)

  const sf = search ? docs.filter(d=>
    (d.dateiname||'').toLowerCase().includes(search.toLowerCase())||
    catName(d.kategorieKey||d.kategorie).toLowerCase().includes(search.toLowerCase())
  ) : null

  const gridStyle = {display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:12}

  const renderContent = () => {
    if (sf) {
      if (!sf.length) return <div style={{textAlign:'center',padding:40,color:'var(--text-3)'}}>Keine Treffer</div>
      return <div style={gridStyle}>{sf.map(d=><Tile key={d.id} icon={fileIcon(d.mimeType)} label={d.dateiname} sub={fmtDate(d.datum)}
        onClick={()=>canPreview(d.mimeType)?setPreview(d):download(d)} mimeType={d.mimeType}
        onDownload={()=>download(d)} downloading={downloading===d.id}
        onDelete={canDelete(d)?()=>deleteDoc(d):null}/>)}</div>
    }
    if (!currentCat) {
      const cs = Object.keys(grouped).sort((a,b)=>catName(a).localeCompare(catName(b)))
      if (!cs.length) return (
        <div style={{background:'var(--surface)',borderRadius:14,border:'1px solid var(--border)',padding:48,textAlign:'center'}}>
          <div style={{fontSize:'3rem',marginBottom:12}}>📂</div>
          <div style={{fontWeight:600,marginBottom:6}}>Keine Dokumente vorhanden</div>
          <div style={{color:'var(--text-3)',fontSize:'0.85rem'}}>
            {canUpload?'Klicken Sie auf 📤 Hochladen um Dokumente hinzuzufügen.':'Es wurden noch keine Dokumente hinterlegt.'}
          </div>
        </div>
      )
      return <div style={gridStyle}>{cs.map(c=>{
        const count=Object.values(grouped[c]).flatMap(m=>Object.values(m)).flat().length
        return <Tile key={c} icon="📁" label={catName(c)} sub={count+' Dok.'} onClick={()=>nav('cat',c)} isFolder/>
      })}</div>
    }
    if (!currentYear) {
      const ys=Object.keys(grouped[currentCat]||{}).sort((a,b)=>parseInt(b)-parseInt(a))
      return <div style={gridStyle}>{ys.map(y=>{
        const count=Object.values(grouped[currentCat][y]).flat().length
        return <Tile key={y} icon="📅" label={y} sub={count+' Dok.'} onClick={()=>nav('year',y)} isFolder/>
      })}</div>
    }
    if (!currentMon) {
      const ms=Object.keys(grouped[currentCat]?.[currentYear]||{}).sort((a,b)=>MONTHS.indexOf(b)-MONTHS.indexOf(a))
      return <div style={gridStyle}>{ms.map(m=>{
        const count=(grouped[currentCat][currentYear][m]||[]).length
        return <Tile key={m} icon="📆" label={m} sub={count+' Dok.'} onClick={()=>nav('month',m)} isFolder/>
      })}</div>
    }
    const files=grouped[currentCat]?.[currentYear]?.[currentMon]||[]
    return <div style={gridStyle}>{files.map(d=><Tile key={d.id} icon={fileIcon(d.mimeType)} label={d.dateiname}
      sub={fmtDate(d.datum)+(d.fileSize?' · '+fmtSize(d.fileSize):'')}
      onClick={()=>canPreview(d.mimeType)?setPreview(d):download(d)} mimeType={d.mimeType}
      onDownload={()=>download(d)} downloading={downloading===d.id}
      onDelete={canDelete(d)?()=>deleteDoc(d):null}/>)}</div>
  }

  return (
    <div style={{width:'100%'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:'1.3rem',fontWeight:800}}>📁 Dokumente</h1>
          <p style={{color:'var(--text-3)',fontSize:'0.85rem',marginTop:2}}>
            {mode==='powerbird'?'Aus Powerbird':mode==='smb'?'Vom Netzlaufwerk':'Eigene Dokumente'}
          </p>
        </div>
        {canUpload&&(mode==='local'||mode==='smb')&&(
          <button onClick={()=>{ setUploadOpen(true); loadUsers() }}
            style={{padding:'9px 18px',borderRadius:8,border:'none',background:'var(--primary)',
              color:'white',fontWeight:600,fontSize:'0.88rem',cursor:'pointer',fontFamily:'var(--font)',flexShrink:0}}>
            📤 Hochladen
          </button>
        )}
      </div>

      <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Dokumente suchen..."
        style={{width:'100%',padding:'10px 14px',borderRadius:10,marginBottom:14,
          border:'1px solid var(--border)',background:'var(--surface)',color:'var(--text)',
          fontFamily:'var(--font)',fontSize:'0.9rem',boxSizing:'border-box'}}/>

      {path.length>0&&(
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',
          background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,marginBottom:16,flexWrap:'wrap'}}>
          <button onClick={back} style={{padding:'4px 10px',borderRadius:6,border:'1px solid var(--border)',background:'var(--surface-2)',cursor:'pointer',fontFamily:'var(--font)',fontSize:'0.82rem',fontWeight:600}}>← Zurück</button>
          <button onClick={home} style={{padding:'4px 10px',borderRadius:6,border:'1px solid var(--border)',background:'var(--surface-2)',cursor:'pointer',fontFamily:'var(--font)',fontSize:'0.82rem'}}>🏠 Alle</button>
          {bc.map((b,i)=><React.Fragment key={i}>
            {i>0&&<span style={{color:'var(--text-3)'}}>›</span>}
            <span style={{fontSize:'0.84rem',fontWeight:i===bc.length-1?700:400,color:i===bc.length-1?'var(--text)':'var(--text-3)'}}>{b}</span>
          </React.Fragment>)}
        </div>
      )}

      {loading?<div style={{textAlign:'center',padding:40,color:'var(--text-3)'}}>Lädt...</div>:renderContent()}

      {preview&&<PreviewModal doc={preview} onClose={()=>setPreview(null)}/>}

      {uploadOpen&&<UploadDialog onClose={()=>setUploadOpen(false)} onDone={load}
        categories={availCats} canUploadAll={canUploadAll} allUsers={allUsers}/>}
    </div>
  )
}
