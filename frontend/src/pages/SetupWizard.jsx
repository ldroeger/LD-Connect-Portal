import React, { useState } from 'react'
import api from '../utils/api.js'

const S = {
  wrap: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#EFF6FF 0%,#F8FAFC 100%)', padding:24 },
  card: { background:'white', borderRadius:20, boxShadow:'0 24px 64px rgba(0,0,0,0.13)', width:'100%', maxWidth:620, padding:40 },
  header: { textAlign:'center', marginBottom:28 },
  title: { fontSize:'1.5rem', fontWeight:800, color:'var(--text)', marginBottom:6 },
  subtitle: { color:'var(--text-3)', fontSize:'0.88rem' },
  steps: { display:'flex', marginBottom:28, position:'relative' },
  stepLine: { position:'absolute', top:16, left:'8%', right:'8%', height:2, background:'var(--border)', zIndex:0 },
  step: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:5, position:'relative', zIndex:1 },
  field: { marginBottom:14 },
  label: { display:'block', fontSize:'0.83rem', fontWeight:600, color:'var(--text)', marginBottom:5 },
  input: { width:'100%', padding:'10px 14px', borderRadius:8, border:'1px solid var(--border)', fontSize:'0.9rem', outline:'none', fontFamily:'var(--font)', boxSizing:'border-box' },
  row: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  actions: { display:'flex', gap:10, justifyContent:'flex-end', marginTop:24 },
  error: { background:'#FEF2F2', border:'1px solid #FECACA', color:'#DC2626', padding:'10px 14px', borderRadius:8, fontSize:'0.85rem', marginBottom:14 },
  success: { background:'#ECFDF5', border:'1px solid #A7F3D0', color:'#059669', padding:'10px 14px', borderRadius:8, fontSize:'0.85rem', marginBottom:14 },
  hint: { fontSize:'0.78rem', color:'var(--text-3)', marginTop:3 },
  info: { background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:8, padding:'10px 14px', marginTop:8, fontSize:'0.82rem', color:'#92400E' },
  infoBlue: { background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:'0.82rem', color:'#1D4ED8' },
  checkbox: { display:'flex', alignItems:'flex-start', gap:8, fontSize:'0.85rem', color:'var(--text)', cursor:'pointer', marginBottom:10 },
  sectionTitle: { fontWeight:700, fontSize:'0.9rem', color:'var(--text)', marginBottom:10, marginTop:16, paddingBottom:6, borderBottom:'1px solid var(--border)' },
  disclaimer: { background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:10, padding:'16px 18px', fontSize:'0.82rem', lineHeight:1.7, color:'#92400E', maxHeight:260, overflowY:'auto', marginBottom:14 },
}

const btn = (v='primary') => ({
  padding:'10px 22px', borderRadius:8, border:v==='secondary'?'1px solid var(--border)':'none',
  background:v==='primary'?'var(--primary)':v==='danger'?'#EF4444':'var(--surface-2)',
  color:v==='primary'||v==='danger'?'white':'var(--text)',
  fontWeight:600, fontSize:'0.88rem', cursor:'pointer', fontFamily:'var(--font)',
})

const circle = (active, done) => ({
  width:32, height:32, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
  fontWeight:700, fontSize:'0.8rem',
  background: done?'var(--success)':active?'var(--primary)':'var(--border)',
  color: done||active?'white':'var(--text-3)',
})

const STEP_LABELS = ['Bedingungen','Admin-Konto','Datenbank','Netzlaufwerk','Branding']

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  // Step 0: Disclaimer
  const [accepted, setAccepted] = useState({ disclaimer:false, terms:false })

  // Step 1: Admin
  const [admin, setAdmin] = useState({ name:'', email:'', password:'', pw2:'', powerbird_id:'' })

  // Step 2: DB
  const [db, setDb] = useState({ host:'', port:'1433', database:'Powerbird', user:'', password:'', encrypt:false, trust_cert:true })

  // Step 3: SMB
  const [smb, setSmb] = useState({ host:'', user:'Administrator', password:'', domain:'WORKGROUP', tool_share:'Pictures', doc_share:'Powerbird', doc_subpath:'PB/DATA/Dokumente' })
  const [testTool, setTestTool]   = useState('')
  const [testDoc, setTestDoc]     = useState('')

  // Step 4: Branding + SMTP
  const [brand, setBrand] = useState({ company_name:'', primary_color:'#2563EB', app_url:'', smtp_host:'', smtp_port:'587', smtp_user:'', smtp_password:'' })

  // ── Handlers ──────────────────────────────────────────────────────────
  const next = () => { setError(''); setMsg(''); setStep(s => s+1) }
  const back = () => { setError(''); setMsg(''); setStep(s => s-1) }

  const handleStep0 = () => {
    if (!accepted.disclaimer || !accepted.terms)
      return setError('Bitte alle Bedingungen akzeptieren um fortzufahren.')
    next()
  }

  const handleStep1 = async () => {
    if (!admin.name || !admin.email || !admin.password) return setError('Bitte alle Pflichtfelder ausfüllen')
    if (admin.password !== admin.pw2) return setError('Passwörter stimmen nicht überein')
    if (admin.password.length < 8) return setError('Passwort muss mindestens 8 Zeichen lang sein')
    setLoading(true); setError('')
    try { await api.post('/setup/admin', { name:admin.name, email:admin.email, password:admin.password, powerbird_id:admin.powerbird_id }); next() }
    catch(e) { setError(e.response?.data?.error || 'Fehler') }
    setLoading(false)
  }

  const handleTestDb = async () => {
    setLoading(true); setError(''); setMsg('')
    try { await api.post('/setup/test-database', db); setMsg('✓ Verbindung erfolgreich!') }
    catch(e) { setError(e.response?.data?.error || 'Verbindungsfehler') }
    setLoading(false)
  }

  const handleStep2 = async () => {
    if (!db.host || !db.database || !db.user) return setError('Server, Datenbank und Benutzer sind erforderlich')
    setLoading(true); setError('')
    try { await api.post('/setup/database', db); next() }
    catch(e) { setError(e.response?.data?.error || 'Fehler') }
    setLoading(false)
  }

  const testSmb = async (type) => {
    const setter = type === 'tool' ? setTestTool : setTestDoc
    const share  = type === 'tool' ? smb.tool_share : smb.doc_share
    if (!smb.host || !share) return setter('❌ Host und Freigabe erforderlich')
    setter('⏳ Verbinde...')
    try {
      const server = '//' + smb.host + '/' + share
      const r = await api.post('/admin/smb-test', { server, user: smb.user, password: smb.password, domain: smb.domain })
      setter(r.data.success ? '✅ Verbunden (' + (r.data.files||0) + ' Einträge)' : '❌ ' + r.data.error)
    } catch(e) { setter('❌ ' + (e.response?.data?.error || e.message)) }
  }

  const handleStep3 = async () => {
    setLoading(true); setError('')
    try {
      const toolServer = smb.host && smb.tool_share ? '//' + smb.host + '/' + smb.tool_share : ''
      const docServer  = smb.host && smb.doc_share  ? '//' + smb.host + '/' + smb.doc_share + (smb.doc_subpath ? '/' + smb.doc_subpath : '') : ''
      await api.put('/admin/settings', {
        smb_host: smb.host, smb_user: smb.user, smb_password: smb.password, smb_domain: smb.domain,
        smb_server: toolServer, doc_smb_server: docServer,
        doc_smb_user: smb.user, doc_smb_password: smb.password, doc_smb_domain: smb.domain,
      })
      next()
    } catch(e) { setError(e.response?.data?.error || 'Fehler') }
    setLoading(false)
  }

  const handleStep4 = async () => {
    setLoading(true); setError('')
    try {
      await api.post('/setup/branding', brand)
      onComplete()
    } catch(e) { setError(e.response?.data?.error || 'Fehler') }
    setLoading(false)
  }

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.header}>
          <div style={{ fontSize:'2.5rem', marginBottom:8 }}>🔧</div>
          <h1 style={S.title}>Einrichtungsassistent</h1>
          <p style={S.subtitle}>LD Connect Portal · Schritt {step+1} von {STEP_LABELS.length}</p>
        </div>

        {/* Schritte */}
        <div style={S.steps}>
          <div style={S.stepLine} />
          {STEP_LABELS.map((label, i) => (
            <div key={i} style={S.step}>
              <div style={circle(step===i, step>i)}>{step>i ? '✓' : i+1}</div>
              <span style={{ fontSize:'0.68rem', fontWeight:step===i?700:400, color:step===i?'var(--primary)':step>i?'var(--success)':'var(--text-3)', textAlign:'center' }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {error && <div style={S.error}>{error}</div>}
        {msg   && <div style={S.success}>{msg}</div>}

        {/* ── Schritt 0: Haftungsausschluss & Nutzungsbedingungen ── */}
        {step === 0 && (
          <div>
            <div style={S.sectionTitle}>⚠️ Haftungsausschluss</div>
            <div style={S.disclaimer}>
              <strong>HAFTUNGSAUSSCHLUSS — BITTE SORGFÄLTIG LESEN</strong><br/><br/>

              Diese Software (LD Connect Portal) wird von <strong>Lukas Dröger</strong> als privates Softwareprojekt entwickelt und bereitgestellt. Sie steht in keiner rechtlichen oder wirtschaftlichen Verbindung zur Herstellerfirma der Powerbird-Software.<br/><br/>

              <strong>1. Datenbankzugriff</strong><br/>
              Die Software greift lesend und schreibend auf die Powerbird-MSSQL-Datenbank zu. Lukas Dröger übernimmt <strong>keinerlei Haftung</strong> für Datenverluste, Datenbeschädigungen, fehlerhafte Synchronisationen, Systemausfälle oder sonstige Schäden, die durch den Einsatz dieser Software entstehen — unabhängig davon, ob diese vorhersehbar waren oder nicht.<br/><br/>

              <strong>2. Nutzung auf eigene Gefahr</strong><br/>
              Der Betrieb und die Nutzung der Software erfolgt <strong>ausschließlich auf eigene Gefahr</strong> des Betreibers. Es wird dringend empfohlen, vor Inbetriebnahme regelmäßige Datensicherungen (Backups) der Powerbird-Datenbank sowie der lokalen Portal-Datenbank einzurichten.<br/><br/>

              <strong>3. Keine Gewährleistung</strong><br/>
              Die Software wird „wie besehen" (AS IS) ohne jegliche ausdrückliche oder stillschweigende Gewährleistung bereitgestellt — insbesondere ohne Gewährleistung der Marktgängigkeit, der Eignung für einen bestimmten Zweck oder der Fehlerfreiheit.<br/><br/>

              <strong>4. Kein Support</strong><br/>
              Es besteht kein Anspruch auf Support, Fehlerbehebung, Updates oder Weiterentwicklung.<br/><br/>

              <strong>5. Haftungsbeschränkung</strong><br/>
              Die Haftung von Lukas Dröger ist, soweit gesetzlich zulässig, auf Vorsatz und grobe Fahrlässigkeit beschränkt. Eine Haftung für mittelbare Schäden, entgangenen Gewinn oder Folgeschäden ist ausgeschlossen.
            </div>

            <div style={S.sectionTitle}>📋 Nutzungsbedingungen</div>
            <div style={{ ...S.disclaimer, maxHeight:200 }}>
              <strong>Nutzungsbedingungen LD Connect Portal</strong><br/><br/>

              <strong>1. Geltungsbereich</strong><br/>
              Diese Nutzungsbedingungen gelten für die Nutzung des LD Connect Portals, bereitgestellt von Lukas Dröger (nachfolgend „Anbieter").<br/><br/>

              <strong>2. Nutzungsrecht</strong><br/>
              Der Anbieter räumt dem Betreiber ein nicht-exklusives, nicht übertragbares Recht zur Nutzung der Software für betriebliche Zwecke im eigenen Unternehmen ein.<br/><br/>

              <strong>3. Verbotene Nutzung</strong><br/>
              Untersagt ist: die Weitergabe, Vervielfältigung oder der kommerzielle Wiederverkauf der Software; die Nutzung für rechtswidrige Zwecke; der Versuch, Sicherheitsmechanismen zu umgehen.<br/><br/>

              <strong>4. Verantwortung des Betreibers</strong><br/>
              Der Betreiber ist allein verantwortlich für: die datenschutzkonforme Nutzung gemäß DSGVO; die Sicherheit der Zugangsdaten; die Einholung der erforderlichen Einwilligungen der Mitarbeiter; die Einhaltung des Betriebsverfassungsgesetzes beim Einsatz als Mitarbeiterportal.<br/><br/>

              <strong>5. Datenschutz (DSGVO)</strong><br/>
              Die Software verarbeitet personenbezogene Mitarbeiterdaten. Der Betreiber ist datenschutzrechtlich Verantwortlicher i.S.d. Art. 4 Nr. 7 DSGVO. Es obliegt dem Betreiber, eine Datenschutz-Folgenabschätzung durchzuführen und ggf. eine Betriebsvereinbarung abzuschließen.<br/><br/>

              <strong>6. Änderungen</strong><br/>
              Der Anbieter behält sich vor, diese Bedingungen jederzeit zu ändern. Die fortgesetzte Nutzung gilt als Zustimmung.<br/><br/>

              <strong>7. Anwendbares Recht</strong><br/>
              Es gilt deutsches Recht. Gerichtsstand ist, soweit gesetzlich zulässig, der Wohnort des Anbieters.
            </div>

            <div style={{ marginTop:16 }}>
              <label style={S.checkbox}>
                <input type="checkbox" checked={accepted.disclaimer} onChange={e => setAccepted(a=>({...a,disclaimer:e.target.checked}))} style={{ marginTop:2, flexShrink:0 }} />
                <span>Ich habe den <strong>Haftungsausschluss</strong> gelesen, verstanden und akzeptiere, dass die Nutzung auf eigene Gefahr erfolgt. Mir ist bewusst, dass keinerlei Haftung für Schäden an Powerbird oder Datenverluste übernommen wird.</span>
              </label>
              <label style={S.checkbox}>
                <input type="checkbox" checked={accepted.terms} onChange={e => setAccepted(a=>({...a,terms:e.target.checked}))} style={{ marginTop:2, flexShrink:0 }} />
                <span>Ich akzeptiere die <strong>Nutzungsbedingungen</strong> und werde die Software ausschließlich für betriebliche Zwecke im eigenen Unternehmen einsetzen.</span>
              </label>

            </div>

            <div style={S.actions}>
              <button style={btn()} onClick={handleStep0}>Akzeptieren & weiter →</button>
            </div>
          </div>
        )}

        {/* ── Schritt 1: Admin-Konto ── */}
        {step === 1 && (
          <div>
            <div style={S.infoBlue}>👤 Erstellen Sie das Administrator-Konto für das Portal.</div>
            <div style={S.field}><label style={S.label}>Name *</label><input style={S.input} value={admin.name} onChange={e=>setAdmin(a=>({...a,name:e.target.value}))} placeholder="Max Mustermann" /></div>
            <div style={S.field}><label style={S.label}>E-Mail *</label><input style={S.input} type="email" value={admin.email} onChange={e=>setAdmin(a=>({...a,email:e.target.value}))} placeholder="admin@firma.de" /></div>
            <div style={S.field}>
              <label style={S.label}>Powerbird-Kürzel</label>
              <input style={S.input} value={admin.powerbird_id} onChange={e=>setAdmin(a=>({...a,powerbird_id:e.target.value}))} placeholder="z.B. MM oder MM01" />
              <div style={S.hint}>Ihr Kürzel aus Powerbird (Termin_ResourceName / HWMIT)</div>
            </div>
            <div style={S.row}>
              <div style={S.field}><label style={S.label}>Passwort * (min. 8 Zeichen)</label><input style={S.input} type="password" value={admin.password} onChange={e=>setAdmin(a=>({...a,password:e.target.value}))} /></div>
              <div style={S.field}><label style={S.label}>Passwort wiederholen *</label><input style={S.input} type="password" value={admin.pw2} onChange={e=>setAdmin(a=>({...a,pw2:e.target.value}))} /></div>
            </div>
            <div style={S.actions}>
              <button style={btn('secondary')} onClick={back}>← Zurück</button>
              <button style={btn()} onClick={handleStep1} disabled={loading}>{loading?'Speichere…':'Weiter →'}</button>
            </div>
          </div>
        )}

        {/* ── Schritt 2: Datenbank ── */}
        {step === 2 && (
          <div>
            <div style={S.infoBlue}>🗄️ Verbindung zur Powerbird MSSQL-Datenbank.</div>
            <div style={S.row}>
              <div style={S.field}><label style={S.label}>SQL Server / Host *</label><input style={S.input} value={db.host} onChange={e=>setDb(d=>({...d,host:e.target.value}))} placeholder="192.168.1.100" /></div>
              <div style={S.field}><label style={S.label}>Port</label><input style={S.input} value={db.port} onChange={e=>setDb(d=>({...d,port:e.target.value}))} placeholder="1433" /></div>
            </div>
            <div style={S.field}><label style={S.label}>Datenbankname *</label><input style={S.input} value={db.database} onChange={e=>setDb(d=>({...d,database:e.target.value}))} placeholder="Powerbird" /></div>
            <div style={S.row}>
              <div style={S.field}><label style={S.label}>Benutzername *</label><input style={S.input} value={db.user} onChange={e=>setDb(d=>({...d,user:e.target.value}))} placeholder="Web" /></div>
              <div style={S.field}><label style={S.label}>Passwort</label><input style={S.input} type="password" value={db.password} onChange={e=>setDb(d=>({...d,password:e.target.value}))} /></div>
            </div>
            <label style={{...S.checkbox,marginTop:4}}><input type="checkbox" checked={db.trust_cert} onChange={e=>setDb(d=>({...d,trust_cert:e.target.checked}))} style={{marginTop:2}} /> Serverzertifikat vertrauen (lokal empfohlen)</label>
            <label style={S.checkbox}><input type="checkbox" checked={db.encrypt} onChange={e=>setDb(d=>({...d,encrypt:e.target.checked}))} style={{marginTop:2}} /> Verbindung verschlüsseln</label>
            <div style={S.info}>ℹ️ Empfohlen: SQL-Benutzer <code>Web</code> mit SELECT-Rechten + INSERT/UPDATE nur auf HWTER.</div>
            <div style={S.actions}>
              <button style={btn('secondary')} onClick={back}>← Zurück</button>
              <button style={btn('secondary')} onClick={handleTestDb} disabled={loading}>Verbindung testen</button>
              <button style={btn()} onClick={handleStep2} disabled={loading}>{loading?'Bitte warten…':'Weiter →'}</button>
            </div>
          </div>
        )}

        {/* ── Schritt 3: Netzlaufwerk ── */}
        {step === 3 && (
          <div>
            <div style={S.infoBlue}>📁 SMB-Netzlaufwerk für Werkzeugbilder und Mitarbeiter-Dokumente. <strong>Optional — kann auch später konfiguriert werden.</strong></div>
            <div style={S.sectionTitle}>🔑 Zugangsdaten (für alle Freigaben)</div>
            <div style={S.row}>
              <div style={S.field}><label style={S.label}>Server / Host</label><input style={S.input} value={smb.host} onChange={e=>setSmb(s=>({...s,host:e.target.value}))} placeholder="192.168.1.100" /></div>
              <div style={S.field}><label style={S.label}>Domain</label><input style={S.input} value={smb.domain} onChange={e=>setSmb(s=>({...s,domain:e.target.value}))} placeholder="WORKGROUP" /></div>
            </div>
            <div style={S.row}>
              <div style={S.field}><label style={S.label}>Benutzer</label><input style={S.input} value={smb.user} onChange={e=>setSmb(s=>({...s,user:e.target.value}))} placeholder="Administrator" /></div>
              <div style={S.field}><label style={S.label}>Passwort</label><input style={S.input} type="password" value={smb.password} onChange={e=>setSmb(s=>({...s,password:e.target.value}))} /></div>
            </div>

            <div style={S.sectionTitle}>🔧 Werkzeugbilder-Freigabe</div>
            <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
              <div style={{ flex:1 }}>
                <label style={S.label}>Freigabe-Name</label>
                <input style={{...S.input, marginBottom:0}} value={smb.tool_share} onChange={e=>setSmb(s=>({...s,tool_share:e.target.value}))} placeholder="Pictures" />
              </div>
              <button onClick={() => testSmb('tool')} style={{...btn('secondary'), whiteSpace:'nowrap', marginBottom:0}}>🔌 Testen</button>
            </div>
            {smb.host && smb.tool_share && <div style={S.hint}>Pfad: //{smb.host}/{smb.tool_share}</div>}
            {testTool && <div style={{ fontSize:'0.82rem', padding:'6px 10px', borderRadius:6, background:'#f3f4f6', marginTop:4 }}>{testTool}</div>}

            <div style={S.sectionTitle}>📁 Dokument-Freigabe</div>
            <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
              <div style={{ flex:1 }}>
                <label style={S.label}>Freigabe-Name</label>
                <input style={{...S.input, marginBottom:0}} value={smb.doc_share} onChange={e=>setSmb(s=>({...s,doc_share:e.target.value}))} placeholder="Powerbird" />
              </div>
              <button onClick={() => testSmb('doc')} style={{...btn('secondary'), whiteSpace:'nowrap', marginBottom:0}}>🔌 Testen</button>
            </div>
            {smb.host && smb.doc_share && <div style={S.hint}>Pfad: //{smb.host}/{smb.doc_share}</div>}
            {testDoc && <div style={{ fontSize:'0.82rem', padding:'6px 10px', borderRadius:6, background:'#f3f4f6', marginTop:4 }}>{testDoc}</div>}
            <div style={{ marginTop:8 }}>
              <label style={S.label}>Dokumenten-Unterverzeichnis (optional)</label>
              <input style={S.input} value={smb.doc_subpath} onChange={e=>setSmb(s=>({...s,doc_subpath:e.target.value}))} placeholder="PB/DATA/Dokumente" />
            </div>
            {smb.host && smb.doc_share && smb.doc_subpath && <div style={S.hint}>Vollpfad: //{smb.host}/{smb.doc_share}/{smb.doc_subpath}</div>}

            <div style={S.actions}>
              <button style={btn('secondary')} onClick={back}>← Zurück</button>
              <button style={{...btn('secondary')}} onClick={next}>Überspringen</button>
              <button style={btn()} onClick={handleStep3} disabled={loading}>{loading?'Speichere…':'Weiter →'}</button>
            </div>
          </div>
        )}

        {/* ── Schritt 4: Branding + SMTP ── */}
        {step === 4 && (
          <div>
            <div style={S.infoBlue}>🎨 Passen Sie das Portal an Ihr Unternehmen an.</div>
            <div style={S.row}>
              <div style={S.field}><label style={S.label}>Firmenname</label><input style={S.input} value={brand.company_name} onChange={e=>setBrand(b=>({...b,company_name:e.target.value}))} placeholder="Muster GmbH" /></div>
              <div style={S.field}>
                <label style={S.label}>Primärfarbe</label>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <input type="color" value={brand.primary_color} onChange={e=>setBrand(b=>({...b,primary_color:e.target.value}))} style={{ width:44, height:40, borderRadius:8, border:'1px solid var(--border)', cursor:'pointer', padding:2 }} />
                  <input style={{...S.input, fontFamily:'monospace', flex:1}} value={brand.primary_color} onChange={e=>setBrand(b=>({...b,primary_color:e.target.value}))} />
                </div>
              </div>
            </div>
            <div style={S.field}>
              <label style={S.label}>Portal-URL</label>
              <input style={S.input} value={brand.app_url} onChange={e=>setBrand(b=>({...b,app_url:e.target.value}))} placeholder="https://portal.meinefirma.de" />
              <div style={S.hint}>Wird für E-Mail-Links benötigt</div>
            </div>
            <div style={S.sectionTitle}>📧 E-Mail (für Einladungen & Passwort-Reset)</div>
            <div style={S.row}>
              <div style={S.field}><label style={S.label}>SMTP Server</label><input style={S.input} value={brand.smtp_host} onChange={e=>setBrand(b=>({...b,smtp_host:e.target.value}))} placeholder="smtp.office365.com" /></div>
              <div style={S.field}><label style={S.label}>SMTP Port</label><input style={S.input} value={brand.smtp_port} onChange={e=>setBrand(b=>({...b,smtp_port:e.target.value}))} placeholder="587" /></div>
            </div>
            <div style={S.row}>
              <div style={S.field}><label style={S.label}>SMTP Benutzer</label><input style={S.input} value={brand.smtp_user} onChange={e=>setBrand(b=>({...b,smtp_user:e.target.value}))} placeholder="portal@firma.de" /></div>
              <div style={S.field}><label style={S.label}>SMTP Passwort</label><input style={S.input} type="password" value={brand.smtp_password} onChange={e=>setBrand(b=>({...b,smtp_password:e.target.value}))} /></div>
            </div>
            <div style={S.actions}>
              <button style={btn('secondary')} onClick={back}>← Zurück</button>
              <button style={btn()} onClick={handleStep4} disabled={loading}>{loading?'Wird abgeschlossen…':'✓ Einrichtung abschließen'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
