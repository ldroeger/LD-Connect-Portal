import React, { useState, useEffect, useRef } from 'react'
import api from '../utils/api.js'
import { useAuth } from '../contexts/AuthContext.jsx'

const ICONS = {
  'application/pdf':'📄','image/jpeg':'🖼','image/png':'🖼','image/gif':'🖼','image/webp':'🖼',
  'application/msword':'📝','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'📝',
  'application/vnd.ms-excel':'📊','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'📊',
}
const fileIcon   = (m) => ICONS[m] || '📎'
const canPreview = (m) => m && (m.startsWith('image/') || m === 'application/pdf')
const fmtSize    = (b) => { if (!b) return ''; const n=parseInt(b); if(n<1024) return n+' B'; if(n<1048576) return Math.round(n/1024)+' KB'; return Math.round(n/1048576*10)/10+' MB' }
const fmtDate    = (d) => d ? new Date(d).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—'
const MONTHS     = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']

function PreviewModal({ doc, onClose }) {
  const [url, setUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let u = null
    api.get('/documents/download/'+encodeURIComponent(doc.id)+'?inline=true',{responseType:'blob'})
      .then(r=>{ u=URL.createObjectURL(new Blob([r.data],{type:doc.mimeType||'application/octet-stream'})); setUrl(u); setLoading(false) })
      .catch(()=>setLoading(false))
    return ()=>{ if(u) URL.revokeObjectURL(u) }
  },[doc.id])
  const isImg = doc.mimeType?.startsWith('image/')
  const isPdf = doc.mimeType==='application/pdf'
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'var(--surface)',borderRadius:16,width:'min(1000px,96vw)',height:'min(85vh,750px)',display:'flex',flexDirection:'column',boxShadow:'0 24px 64px rgba(0,0,0,0.5)',overflow:'hidden'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 20px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
          <div><div style={{fontWeight:700}}>{doc.dateiname}</div><div style={{fontSize:'0.75rem',color:'var(--text-3)'}}>{fmtDate(doc.datum)}</div></div>
          <div style={{display:'flex',gap:8}}>
            {url&&<a href={url} download={doc.dateiname} style={{padding:'7px 14px',borderRadius:8,background:'var(--primary)',color:'white',textDecoration:'none',fontSize:'0.82rem',fontWeight:600}}>⬇ Download</a>}
            <button onClick={onClose} style={{padding:'7px 14px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface-2)',cursor:'pointer',fontFamily:'var(--font)'}}>✕</button>
          </div>
        </div>
        <div style={{flex:1,overflow:'hidden',background:'#111'}}>
          {loading&&<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#fff'}}>Lädt...</div>}
          {!loading&&url&&(isImg?<img src={url} alt={doc.dateiname} style={{width:'100%',height:'100%',objectFit:'contain'}}/>:isPdf?<iframe src={url} style={{width:'100%',height:'100%',border:'none'}} title={doc.dateiname}/>:<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%'}}><a href={url} download={doc.dateiname} style={{padding:'10px 24px',borderRadius:10,background:'var(--primary)',color:'white',textDecoration:'none',fontWeight:600}}>⬇ Herunterladen</a></div>)}
        </div>
      </div>
    </div>
  )
}

export default function DocumentsManagePage() {
  const { user } = useAuth()
  const [allUsers, setAllUsers]       = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [docs, setDocs]               = useState([])
  const [cats, setCats]               = useState({})
  const [availCats, setAvailCats]     = useState([])
  const [loading, setLoading]         = useState(false)
  const [path, setPath]               = useState([])
  const [downloading, setDownloading] = useState(null)
  const [preview, setPreview]         = useState(null)
  const [uploadCat, setUploadCat]     = useState('')
  const [uploading, setUploading]     = useState(false)
  const [uploadMsg, setUploadMsg]     = useState('')
  const fileRef = useRef()

  const [isAdmin, setIsAdmin] = React.useState(false)
  const [rightsLoading, setRightsLoading] = React.useState(true)

  useEffect(() => {
    api.get('/documents/my-rights').then(r => {
      setIsAdmin(r.data.canManage === true)
      setRightsLoading(false)
    }).catch(() => setRightsLoading(false))
    api.get('/users').then(r => setAllUsers(r.data.users||r.data||[])).catch(()=>{})
    api.get('/documents/categories').then(r => setAvailCats(r.data.categories||[])).catch(()=>{})
  }, [])

  const loadUserDocs = async (u) => {
    if (!u) return
    setLoading(true); setPath([]); setDocs([])
    try {
      const r = await api.get('/documents/manage/'+u.id)
      setDocs(r.data.documents||[])
      setCats(r.data.categories||{})
    } catch(e) { console.log(e) }
    setLoading(false)
  }

  const selectUser = (u) => { setSelectedUser(u); loadUserDocs(u) }

  const catName = (k) => cats[k]||k||'Allgemein'

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
    if (!window.confirm(doc.dateiname+' wirklich löschen?')) return
    const fsId = doc.id.replace('local_fs_','')
    try { await api.delete('/documents/local/'+encodeURIComponent(fsId)); loadUserDocs(selectedUser) }
    catch(err){ alert('Fehler: '+(err.response?.data?.error||err.message)) }
  }

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files||[])
    if (!files.length||!selectedUser) return
    setUploading(true); setUploadMsg('')
    const fd = new FormData()
    files.forEach(f=>fd.append('files',f))
    fd.append('category', uploadCat||'Allgemein')
    fd.append('target_user_ids', String(selectedUser.id))
    try {
      const r = await api.post('/documents/upload', fd, {headers:{'Content-Type':'multipart/form-data'}})
      setUploadMsg('✅ '+(r.data.count||files.length)+' Datei(en) hochgeladen')
      setTimeout(()=>setUploadMsg(''), 3000)
      loadUserDocs(selectedUser)
    } catch(err){ setUploadMsg('❌ '+(err.response?.data?.error||err.message)) }
    setUploading(false)
    if(fileRef.current) fileRef.current.value=''
  }

  // Gruppierung
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
  const bc   = [selectedUser?.name||'—',currentCat?catName(currentCat):null,currentYear,currentMon].filter(Boolean)
  const gridStyle = {display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:12}

  const renderFiles = () => {
    if (!currentCat) {
      const cs = Object.keys(grouped).sort((a,b)=>catName(a).localeCompare(catName(b)))
      if (!cs.length) return <div style={{textAlign:'center',padding:40,color:'var(--text-3)'}}>Keine Dokumente für diesen Mitarbeiter</div>
      return <div style={gridStyle}>{cs.map(c=>{
        const count=Object.values(grouped[c]).flatMap(m=>Object.values(m)).flat().length
        return (
          <div key={c} onClick={()=>nav('cat',c)}
            style={{background:'var(--surface)',borderRadius:12,border:'1px solid var(--border)',padding:14,cursor:'pointer',
              display:'flex',flexDirection:'column',alignItems:'center',gap:8,boxShadow:'var(--shadow)'}}>
            <div style={{fontSize:'2.8rem'}}>📁</div>
            <div style={{fontSize:'0.75rem',fontWeight:600,textAlign:'center'}}>{catName(c)}</div>
            <div style={{fontSize:'0.67rem',color:'var(--text-3)'}}>{count} Dok.</div>
          </div>
        )
      })}</div>
    }
    if (!currentYear) {
      const ys=Object.keys(grouped[currentCat]||{}).sort((a,b)=>parseInt(b)-parseInt(a))
      return <div style={gridStyle}>{ys.map(y=>{
        const count=Object.values(grouped[currentCat][y]).flat().length
        return <div key={y} onClick={()=>nav('year',y)} style={{background:'var(--surface)',borderRadius:12,border:'1px solid var(--border)',padding:14,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:8,boxShadow:'var(--shadow)'}}>
          <div style={{fontSize:'2.8rem'}}>📅</div><div style={{fontSize:'0.75rem',fontWeight:600,textAlign:'center'}}>{y}</div><div style={{fontSize:'0.67rem',color:'var(--text-3)'}}>{count} Dok.</div>
        </div>
      })}</div>
    }
    if (!currentMon) {
      const ms=Object.keys(grouped[currentCat]?.[currentYear]||{}).sort((a,b)=>MONTHS.indexOf(b)-MONTHS.indexOf(a))
      return <div style={gridStyle}>{ms.map(m=>{
        const count=(grouped[currentCat][currentYear][m]||[]).length
        return <div key={m} onClick={()=>nav('month',m)} style={{background:'var(--surface)',borderRadius:12,border:'1px solid var(--border)',padding:14,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:8,boxShadow:'var(--shadow)'}}>
          <div style={{fontSize:'2.8rem'}}>📆</div><div style={{fontSize:'0.75rem',fontWeight:600,textAlign:'center'}}>{m}</div><div style={{fontSize:'0.67rem',color:'var(--text-3)'}}>{count} Dok.</div>
        </div>
      })}</div>
    }
    const files=grouped[currentCat]?.[currentYear]?.[currentMon]||[]
    return <div style={gridStyle}>{files.map(doc=>(
      <div key={doc.id} style={{position:'relative'}}>
        <div onClick={()=>canPreview(doc.mimeType)?setPreview(doc):download(doc)}
          style={{background:'var(--surface)',borderRadius:12,border:'1px solid var(--border)',padding:14,cursor:'pointer',
            display:'flex',flexDirection:'column',alignItems:'center',gap:8,boxShadow:'var(--shadow)'}}>
          <div style={{fontSize:'2.4rem'}}>{fileIcon(doc.mimeType)}</div>
          <div style={{fontSize:'0.75rem',fontWeight:600,textAlign:'center',color:canPreview(doc.mimeType)?'var(--primary)':'var(--text)',
            overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',width:'100%',wordBreak:'break-word'}}>{doc.dateiname}</div>
          <div style={{fontSize:'0.67rem',color:'var(--text-3)',textAlign:'center'}}>{fmtDate(doc.datum)}{doc.fileSize?' · '+fmtSize(doc.fileSize):''}</div>
          <button onClick={e=>{e.stopPropagation();download(doc)}} disabled={downloading===doc.id}
            style={{width:'100%',padding:'4px 0',borderRadius:6,border:'none',background:downloading===doc.id?'var(--surface-2)':'var(--primary)',
              color:downloading===doc.id?'var(--text)':'white',fontSize:'0.72rem',fontWeight:600,cursor:'pointer'}}>
            {downloading===doc.id?'⏳':'⬇'}
          </button>
        </div>
        <button onClick={()=>deleteDoc(doc)}
          style={{position:'absolute',top:5,right:5,width:20,height:20,borderRadius:'50%',border:'none',
            background:'#EF4444',color:'white',fontSize:'0.6rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>
          ✕
        </button>
      </div>
    ))}</div>
  }

  if (rightsLoading) return <div style={{textAlign:'center',padding:60,color:'var(--text-3)'}}>Prüfe Berechtigungen...</div>
  if (!isAdmin) return (
    <div style={{textAlign:'center',padding:60}}><div style={{fontSize:'3rem'}}>🔒</div><div style={{fontWeight:600,marginTop:12}}>Kein Zugriff</div></div>
  )

  return (
    <div style={{width:'100%'}}>
      <div style={{marginBottom:20}}>
        <h1 style={{fontSize:'1.3rem',fontWeight:800}}>🗂 Dokumente verwalten</h1>
        <p style={{color:'var(--text-3)',fontSize:'0.85rem',marginTop:2}}>Dokumente anderer Mitarbeiter einsehen, hochladen und löschen</p>
      </div>

      {/* Mitarbeiter-Auswahl */}
      <div style={{background:'var(--surface)',borderRadius:14,border:'1px solid var(--border)',padding:20,marginBottom:20,boxShadow:'var(--shadow)'}}>
        <div style={{fontWeight:700,fontSize:'0.9rem',marginBottom:12}}>👤 Mitarbeiter auswählen</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
          {allUsers.filter(u=>u.is_active!==0).map(u=>(
            <button key={u.id} onClick={()=>selectUser(u)}
              style={{padding:'7px 16px',borderRadius:20,border:'2px solid '+(selectedUser?.id===u.id?'var(--primary)':'var(--border)'),
                background:selectedUser?.id===u.id?'var(--primary)':'var(--surface-2)',
                color:selectedUser?.id===u.id?'white':'var(--text)',cursor:'pointer',fontFamily:'var(--font)',fontWeight:600,fontSize:'0.84rem'}}>
              {u.name}
            </button>
          ))}
        </div>
      </div>

      {selectedUser&&(
        <>
          {/* Upload für ausgewählten Mitarbeiter */}
          <div style={{background:'var(--surface)',borderRadius:14,border:'1px solid var(--border)',padding:20,marginBottom:20,boxShadow:'var(--shadow)'}}>
            <div style={{fontWeight:700,fontSize:'0.9rem',marginBottom:12}}>📤 Dokumente hochladen für <span style={{color:'var(--primary)'}}>{selectedUser.name}</span></div>
            {uploadMsg&&<div style={{padding:'8px 12px',borderRadius:8,fontSize:'0.85rem',marginBottom:12,
              background:uploadMsg.startsWith('✅')?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.1)',
              color:uploadMsg.startsWith('✅')?'var(--success)':'var(--error)'}}>{uploadMsg}</div>}
            <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
              <div style={{minWidth:180}}>
                <label style={{fontSize:'0.8rem',fontWeight:600,display:'block',marginBottom:4}}>Kategorie</label>
                {availCats.length>0?(
                  <select value={uploadCat} onChange={e=>setUploadCat(e.target.value)}
                    style={{padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface)',fontFamily:'var(--font)',fontSize:'0.88rem'}}>
                    <option value="">— wählen —</option>
                    {availCats.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                ):(
                  <input value={uploadCat} onChange={e=>setUploadCat(e.target.value)} placeholder="z.B. Lohnabrechnung"
                    style={{padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface)',fontFamily:'var(--font)',fontSize:'0.88rem'}}/>
                )}
              </div>
              <div>
                <label style={{fontSize:'0.8rem',fontWeight:600,display:'block',marginBottom:4}}>Dateien (mehrere möglich)</label>
                <input ref={fileRef} type="file" multiple onChange={handleUpload} disabled={uploading}
                  style={{padding:'7px 0',fontSize:'0.85rem',cursor:'pointer'}}/>
              </div>
              {uploading&&<div style={{color:'var(--text-3)',fontSize:'0.85rem'}}>⏳ Lädt...</div>}
            </div>
          </div>

          {/* Breadcrumb Navigation */}
          {path.length>0&&(
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',
              background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,marginBottom:16,flexWrap:'wrap'}}>
              <button onClick={back} style={{padding:'4px 10px',borderRadius:6,border:'1px solid var(--border)',background:'var(--surface-2)',cursor:'pointer',fontFamily:'var(--font)',fontSize:'0.82rem',fontWeight:600}}>← Zurück</button>
              <button onClick={home} style={{padding:'4px 10px',borderRadius:6,border:'1px solid var(--border)',background:'var(--surface-2)',cursor:'pointer',fontFamily:'var(--font)',fontSize:'0.82rem'}}>🏠 Alle</button>
              {bc.map((b,i)=><React.Fragment key={i}>
                {i>0&&<span style={{color:'var(--text-3)'}}>›</span>}
                <span style={{fontSize:'0.84rem',fontWeight:i===bc.length-1?700:400}}>{b}</span>
              </React.Fragment>)}
            </div>
          )}

          {/* Dokument-Ansicht */}
          {loading?<div style={{textAlign:'center',padding:40,color:'var(--text-3)'}}>Lädt...</div>:renderFiles()}
        </>
      )}

      {!selectedUser&&(
        <div style={{textAlign:'center',padding:60,color:'var(--text-3)'}}>
          <div style={{fontSize:'3rem',marginBottom:12}}>👆</div>
          <div>Bitte oben einen Mitarbeiter auswählen</div>
        </div>
      )}

      {preview&&<PreviewModal doc={preview} onClose={()=>setPreview(null)}/>}
    </div>
  )
}
