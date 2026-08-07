import React, { useState, useEffect, useRef } from 'react'
import api from '../utils/api.js'

export default function CertPage() {
  const [status, setStatus]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg]         = useState('')
  const [msgOk, setMsgOk]     = useState(true)

  // Upload
  const [domain, setDomain]   = useState('')
  const [port, setPort]       = useState('443')
  const [httpPort, setHttpPort] = useState('80')
  const [uploading, setUploading] = useState(false)
  const certRef = useRef()
  const keyRef  = useRef()

  // Generieren
  const [genDomain, setGenDomain] = useState('')
  const [genDays, setGenDays]     = useState('3650')
  const [genPort, setGenPort]     = useState('443')
  const [generating, setGenerating] = useState(false)

  const load = () => {
    setLoading(true)
    api.get('/cert/status').then(r => {
      setStatus(r.data)
      setDomain(r.data.domain || '')
      setPort(r.data.port || '443')
      setHttpPort(r.data.httpPort || '80')
      setGenDomain(r.data.domain || '')
      setGenPort(r.data.port || '443')
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const showMsg = (text, ok=true) => { setMsg(text); setMsgOk(ok); setTimeout(() => setMsg(''), 5000) }

  const handleUpload = async () => {
    const certFile = certRef.current?.files?.[0]
    const keyFile  = keyRef.current?.files?.[0]
    if (!certFile || !keyFile) return showMsg('Bitte Zertifikat und Schlüssel auswählen', false)
    setUploading(true)
    const fd = new FormData()
    fd.append('cert', certFile)
    fd.append('key', keyFile)
    fd.append('domain', domain)
    fd.append('port', port)
    fd.append('httpPort', httpPort)
    try {
      await api.post('/cert/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      showMsg('✅ Zertifikat hochgeladen und HTTPS aktiviert')
      load()
    } catch(e) { showMsg('❌ ' + (e.response?.data?.error || e.message), false) }
    setUploading(false)
  }

  const handleGenerate = async () => {
    if (!genDomain) return showMsg('Bitte Domain/IP eingeben', false)
    setGenerating(true)
    try {
      const r = await api.post('/cert/generate', { domain: genDomain, days: genDays, port: genPort, httpPort })
      showMsg('✅ ' + r.data.message)
      load()
    } catch(e) { showMsg('❌ ' + (e.response?.data?.error || e.message), false) }
    setGenerating(false)
  }

  const handleDisable = async () => {
    if (!window.confirm('HTTPS wirklich deaktivieren?')) return
    try {
      await api.delete('/cert')
      showMsg('✅ HTTPS deaktiviert')
      load()
    } catch(e) { showMsg('❌ ' + (e.response?.data?.error || e.message), false) }
  }

  const downloadCert = () => {
    const a = document.createElement('a')
    a.href = '/api/cert/download-cert'
    a.download = 'ld-connect-portal.crt'
    a.click()
  }

  const card = { background:'var(--surface)', borderRadius:14, border:'1px solid var(--border)', padding:24, boxShadow:'var(--shadow)', marginBottom:20 }
  const inp  = { width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontFamily:'var(--font)', fontSize:'0.88rem', boxSizing:'border-box', marginBottom:10 }
  const lbl  = { fontSize:'0.8rem', fontWeight:600, display:'block', marginBottom:4, color:'var(--text-2)' }
  const btn  = (color='var(--primary)') => ({ padding:'9px 20px', borderRadius:8, border:'none', background:color, color:'white', fontWeight:600, fontSize:'0.88rem', cursor:'pointer', fontFamily:'var(--font)' })

  if (loading) return <div style={{textAlign:'center',padding:40,color:'var(--text-3)'}}>Lädt...</div>

  return (
    <div style={{width:'100%', maxWidth:700}}>
      <h1 style={{fontSize:'1.3rem',fontWeight:800,marginBottom:4}}>🔒 SSL / HTTPS Zertifikat</h1>
      <p style={{color:'var(--text-3)',fontSize:'0.85rem',marginBottom:20}}>HTTPS-Zertifikat für das Portal konfigurieren</p>

      {msg && (
        <div style={{padding:'10px 16px',borderRadius:10,marginBottom:16,fontSize:'0.88rem',
          background: msgOk ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          color: msgOk ? 'var(--success)' : 'var(--error)',
          border: '1px solid ' + (msgOk ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)')}}>
          {msg}
        </div>
      )}

      {/* Status */}
      <div style={card}>
        <div style={{fontWeight:700,fontSize:'0.95rem',marginBottom:12}}>Status</div>
        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
          <div style={{padding:'6px 14px',borderRadius:20,fontWeight:600,fontSize:'0.85rem',
            background: status?.httpsEnabled ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
            color: status?.httpsEnabled ? 'var(--success)' : 'var(--error)'}}>
            {status?.httpsEnabled ? '🔒 HTTPS aktiv' : '🔓 Nur HTTP'}
          </div>
          {status?.httpsEnabled && (
            <>
              <span style={{fontSize:'0.82rem',color:'var(--text-3)'}}>
                Port {status.port} (HTTPS) · Port {status.httpPort} (HTTP)
              </span>
              {status.domain && <span style={{fontSize:'0.82rem',color:'var(--text-3)'}}>Domain: {status.domain}</span>}
            </>
          )}
        </div>
        {status?.certInfo && (
          <div style={{marginTop:12,padding:'10px 14px',background:'var(--surface-2)',borderRadius:8,fontSize:'0.82rem'}}>
            <div style={{color:'var(--text-3)',marginBottom:3}}>{status.certInfo.subject}</div>
            <div style={{color: new Date(status.certInfo.expires) < new Date() ? 'var(--error)' : 'var(--text-2)'}}>
              Gültig bis: {status.certInfo.expires}
            </div>
          </div>
        )}
        {status?.httpsEnabled && (
          <div style={{display:'flex',gap:8,marginTop:12}}>
            <button onClick={downloadCert} style={{...btn('#0ea5e9'),fontSize:'0.82rem',padding:'7px 14px'}}>
              ⬇ Zertifikat herunterladen
            </button>
            <button onClick={handleDisable} style={{...btn('#EF4444'),fontSize:'0.82rem',padding:'7px 14px'}}>
              🔓 HTTPS deaktivieren
            </button>
          </div>
        )}
      </div>

      {/* Port-Konfiguration */}
      <div style={card}>
        <div style={{fontWeight:700,fontSize:'0.95rem',marginBottom:4}}>Port-Konfiguration</div>
        <div style={{fontSize:'0.82rem',color:'var(--text-3)',marginBottom:14}}>
          Wird für Upload und Selbstgenerierung verwendet
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div>
            <label style={lbl}>HTTP-Port</label>
            <input style={inp} value={httpPort} onChange={e=>setHttpPort(e.target.value)} placeholder="80"/>
          </div>
          <div>
            <label style={lbl}>HTTPS-Port</label>
            <input style={inp} value={port} onChange={e=>setPort(e.target.value)} placeholder="443"/>
          </div>
        </div>
        <div style={{fontSize:'0.78rem',color:'var(--text-3)'}}>
          Intern: HTTP auf Port 80, HTTPS auf Port 443. Extern kann Caddy beliebige Ports nutzen.
        </div>
      </div>

      {/* Zertifikat hochladen */}
      <div style={card}>
        <div style={{fontWeight:700,fontSize:'0.95rem',marginBottom:4}}>📤 Eigenes Zertifikat hochladen</div>
        <div style={{fontSize:'0.82rem',color:'var(--text-3)',marginBottom:14}}>
          PEM-Format (.pem, .crt, .key). z.B. von Let's Encrypt, Comodo, DigiCert etc.
        </div>
        <label style={lbl}>Domain (optional, z.B. portal.firma.de)</label>
        <input style={inp} value={domain} onChange={e=>setDomain(e.target.value)} placeholder="portal.firma.de"/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
          <div>
            <label style={lbl}>Zertifikat (.crt / .pem) *</label>
            <input ref={certRef} type="file" accept=".pem,.crt,.cer" style={{width:'100%',fontSize:'0.85rem'}}/>
          </div>
          <div>
            <label style={lbl}>Privater Schlüssel (.key / .pem) *</label>
            <input ref={keyRef} type="file" accept=".pem,.key" style={{width:'100%',fontSize:'0.85rem'}}/>
          </div>
        </div>
        <button onClick={handleUpload} disabled={uploading} style={btn()}>
          {uploading ? '⏳ Wird hochgeladen...' : '📤 Zertifikat hochladen & HTTPS aktivieren'}
        </button>
      </div>

      {/* Selbstsigniertes Zertifikat */}
      <div style={card}>
        <div style={{fontWeight:700,fontSize:'0.95rem',marginBottom:4}}>🔧 Selbstsigniertes Zertifikat erstellen</div>
        <div style={{background:'rgba(234,179,8,0.1)',border:'1px solid rgba(234,179,8,0.3)',borderRadius:8,padding:'10px 14px',fontSize:'0.82rem',color:'#92400E',marginBottom:14}}>
          ⚠️ Browser zeigen eine Sicherheitswarnung. Das Zertifikat muss auf jedem Gerät einmalig als vertrauenswürdig markiert oder installiert werden.
          Nach dem Erstellen kann es heruntergeladen und auf Firmengeräten installiert werden.
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div>
            <label style={lbl}>Domain oder IP-Adresse *</label>
            <input style={inp} value={genDomain} onChange={e=>setGenDomain(e.target.value)} placeholder="192.168.1.100 oder portal.firma.de"/>
          </div>
          <div>
            <label style={lbl}>Gültigkeitsdauer (Tage)</label>
            <select style={{...inp,marginBottom:0}} value={genDays} onChange={e=>setGenDays(e.target.value)}>
              <option value="365">1 Jahr</option>
              <option value="1095">3 Jahre</option>
              <option value="3650">10 Jahre</option>
            </select>
          </div>
        </div>
        <button onClick={handleGenerate} disabled={generating} style={{...btn('#8B5CF6'),marginTop:4}}>
          {generating ? '⏳ Wird erstellt...' : '🔧 Selbstsigniertes Zertifikat erstellen'}
        </button>
      </div>

      <div style={{fontSize:'0.78rem',color:'var(--text-3)',lineHeight:1.6}}>
        <strong>Hinweis:</strong> Nach Änderungen wird Caddy automatisch neu geladen. 
        Das Portal ist kurz (ca. 2-3 Sekunden) nicht erreichbar.
        Bei Port-Änderungen muss docker-compose.yml manuell angepasst werden.
      </div>
    </div>
  )
}
