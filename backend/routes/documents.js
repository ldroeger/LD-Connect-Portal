const express  = require('express')
const router   = express.Router()
const { authMiddleware } = require('../middleware/auth')
const pbDb     = require('../db/powerbirdDb')
const localDb  = require('../db/localDb')

router.get('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.features && req.user.features.documents === false)
      return res.status(403).json({ error: 'Funktion nicht freigeschaltet' })
    const kuerzel = req.user.powerbird_id
    if (!kuerzel) return res.json({ documents: [], categories: {} })
    const pool = await pbDb.getPool()
    const result = await pool.request().input('kuerzel', kuerzel).query(`
      SELECT d.ELDVD_LaufendeNr AS id, d.ELDVD_Adresse AS adresse,
        d.ELDVD_DateinameUser AS dateiname, d.ELDVD_MimeType AS mimeType,
        d.ELDVD_FileSize AS fileSize, d.ELDVD_Beschreibung AS beschreibung,
        d.ELDVK_Kennzeichen AS kategorieKey, d.ELDVD_DokumentDatum AS datum,
        d.ELDVD_AnlageDatum AS angelegt
      FROM ELDVD d JOIN ELDVV v ON d.ELDVD_LaufendeNr = v.ELDVD_LaufendeNr
      WHERE v.ELDVV_TargetKey = @kuerzel AND v.ELDVV_ObjektTyp = 3
        AND d.ELDVD_LoeschDatum IS NULL AND v.ELDVV_IsDeactivated = 0
      ORDER BY d.ELDVD_AnlageDatum DESC
    `)
    let categories = {}
    try {
      const cats = await pool.request().query("SELECT DVK_Kennzeichen, DVK_Bezeichnung FROM ELDVK WHERE DVK_Kennzeichen IS NOT NULL")
      cats.recordset.forEach(function(r) {
        if (r.DVK_Kennzeichen) {
          categories[r.DVK_Kennzeichen] = r.DVK_Bezeichnung
          categories[r.DVK_Kennzeichen.toUpperCase()] = r.DVK_Bezeichnung
        }
      })
    } catch(e) { console.log('ELDVK Fehler:', e.message) }
    res.json({ documents: result.recordset, categories: categories })
  } catch(e) { console.error('documents GET error:', e.message); res.status(500).json({ error: e.message }) }
})

router.get('/download/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.features && req.user.features.documents === false)
      return res.status(403).json({ error: 'Funktion nicht freigeschaltet' })
    const kuerzel = req.user.powerbird_id
    if (!kuerzel) return res.status(403).json({ error: 'Kein Powerbird-Kuerzel' })
    const pool = await pbDb.getPool()
    const result = await pool.request()
      .input('id', parseInt(req.params.id)).input('kuerzel', kuerzel)
      .query(`SELECT d.ELDVD_Adresse, d.ELDVD_DateinameUser, d.ELDVD_MimeType
        FROM ELDVD d JOIN ELDVV v ON d.ELDVD_LaufendeNr = v.ELDVD_LaufendeNr
        WHERE d.ELDVD_LaufendeNr = @id AND v.ELDVV_TargetKey = @kuerzel AND v.ELDVV_ObjektTyp = 3`)
    if (!result.recordset.length) return res.status(404).json({ error: 'Dokument nicht gefunden' })
    const doc = result.recordset[0]
    const rawServer = localDb.getSetting('doc_smb_server') || ''
    if (!rawServer) return res.status(500).json({ error: 'Dokument-Server nicht konfiguriert' })
    const cleaned  = rawServer.replace(/\\/g, '/').replace(/^\/+/, '')
    const parts    = cleaned.split('/').filter(function(p) { return p.length > 0 })
    const host     = parts[0] || ''
    const share    = parts[1] || ''
    const basePath = parts.slice(2).join('\\')
    if (!host || !share) return res.status(500).json({ error: 'Ungueltiger SMB-Pfad: ' + rawServer })
    const SMB2 = require('@marsaud/smb2')
    const smb2 = new SMB2({
      share:    '\\\\' + host + '\\' + share,
      domain:   localDb.getSetting('doc_smb_domain') || localDb.getSetting('smb_domain') || 'WORKGROUP',
      username: localDb.getSetting('doc_smb_user') || localDb.getSetting('smb_user') || '',
      password: localDb.getSetting('doc_smb_password') || localDb.getSetting('smb_password') || '',
      autoCloseTimeout: 0,
    })
    const relPath  = doc.ELDVD_Adresse.replace(/^[\\\/]+/, '').replace(/\\\\/g, '\\')
    const filePath = basePath ? basePath + '\\' + relPath : relPath
    console.log('SMB download:', host, share, 'base:', basePath, '->', filePath)
    smb2.readFile(filePath, function(err, data) {
      try { smb2.close() } catch(e2) {}
      if (err) { console.error('SMB read error:', err.message); return res.status(500).json({ error: 'Datei nicht lesbar: ' + err.message }) }
      const mime = doc.ELDVD_MimeType || 'application/octet-stream'
      res.setHeader('Content-Type', mime)
      res.setHeader('Content-Disposition', 'attachment; filename="' + (doc.ELDVD_DateinameUser || 'dokument') + '"')
      res.send(data)
    })
  } catch(e) { console.error('documents download error:', e.message); res.status(500).json({ error: e.message }) }
})

module.exports = router
