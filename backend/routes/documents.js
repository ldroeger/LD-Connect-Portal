const express  = require('express')
const router   = express.Router()
const { authMiddleware } = require('../middleware/auth')
const pbDb     = require('../db/powerbirdDb')
const localDb  = require('../db/localDb')

const requireAuth = authMiddleware

// GET /api/documents - eigene Dokumente abrufen
router.get('/', requireAuth, async (req, res) => {
  try {
    const kuerzel = req.user.powerbird_id
    if (!kuerzel) return res.json({ documents: [], categories: {} })

    const pool = await pbDb.getPool()

    // Dokumente
    const result = await pool.request()
      .input('kuerzel', kuerzel)
      .query(`
        SELECT
          d.ELDVD_LaufendeNr    AS id,
          d.ELDVD_Adresse       AS adresse,
          d.ELDVD_DateinameUser AS dateiname,
          d.ELDVD_MimeType      AS mimeType,
          d.ELDVD_FileSize      AS fileSize,
          d.ELDVD_Beschreibung  AS beschreibung,
          d.ELDVK_Kennzeichen   AS kategorieKey,
          d.ELDVD_DokumentDatum AS datum,
          d.ELDVD_AnlageDatum   AS angelegt
        FROM ELDVD d
        JOIN ELDVV v ON d.ELDVD_LaufendeNr = v.ELDVD_LaufendeNr
        WHERE v.ELDVV_TargetKey = @kuerzel
          AND v.ELDVV_ObjektTyp = 3
          AND d.ELDVD_LoeschDatum IS NULL
          AND v.ELDVV_IsDeactivated = 0
        ORDER BY d.ELDVD_AnlageDatum DESC
      `)

    // Kategorie-Namen aus Powerbird ELDVK Tabelle
    let categories = {}
    try {
      const catResult = await pool.request().query(`
        SELECT ELDVK_Kennzeichen, ELDVK_Bezeichnung
        FROM ELDVK
        WHERE ELDVK_Kennzeichen IS NOT NULL AND ELDVK_Bezeichnung IS NOT NULL
      `)
      catResult.recordset.forEach(r => {
        categories[r.ELDVK_Kennzeichen] = r.ELDVK_Bezeichnung
      })
    } catch(e) {
      // ELDVK existiert evtl nicht - Fallback auf Keys
      console.log('ELDVK nicht verfuegbar:', e.message)
    }

    res.json({ documents: result.recordset, categories })
  } catch(e) {
    console.error('documents GET error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// GET /api/documents/download/:id
router.get('/download/:id', requireAuth, async (req, res) => {
  try {
    const kuerzel = req.user.powerbird_id
    if (!kuerzel) return res.status(403).json({ error: 'Kein Powerbird-Kuerzel' })

    const pool = await pbDb.getPool()
    const result = await pool.request()
      .input('id', parseInt(req.params.id))
      .input('kuerzel', kuerzel)
      .query(`
        SELECT d.ELDVD_Adresse, d.ELDVD_DateinameUser, d.ELDVD_MimeType
        FROM ELDVD d
        JOIN ELDVV v ON d.ELDVD_LaufendeNr = v.ELDVD_LaufendeNr
        WHERE d.ELDVD_LaufendeNr = @id
          AND v.ELDVV_TargetKey = @kuerzel
          AND v.ELDVV_ObjektTyp = 3
      `)

    if (!result.recordset.length)
      return res.status(404).json({ error: 'Dokument nicht gefunden' })

    const doc = result.recordset[0]

    // SMB Config aus settings-Tabelle
    const smbServer = localDb.getSetting('smb_server') || ''
    if (!smbServer) return res.status(500).json({ error: 'SMB nicht konfiguriert. Bitte SMB in den Admin-Einstellungen konfigurieren.' })

    const parts = smbServer.replace(/\\\\/g, '\\').replace(/\/\//g, '\\').split('\\').filter(Boolean)
    const host  = parts[0] || ''
    const share = parts[1] || ''

    if (!host || !share) return res.status(500).json({ error: 'SMB-Pfad ungueltig: ' + smbServer })

    const SMB2     = require('@marsaud/smb2')
    const sharePath = '\\\\' + host + '\\' + share

    const smb2 = new SMB2({
      share:    sharePath,
      domain:   localDb.getSetting('smb_domain') || 'WORKGROUP',
      username: localDb.getSetting('smb_user') || '',
      password: localDb.getSetting('smb_password') || '',
    })

    // Adresse: \\MITARBEITER\\LD\\datei.pdf -> MITARBEITER\LD\datei.pdf
    const filePath = doc.ELDVD_Adresse.replace(/^\\+/, '').replace(/\\\\/g, '\\')

    smb2.readFile(filePath, function(err, data) {
      smb2.close()
      if (err) {
        console.error('SMB read error:', err.message, 'path:', filePath)
        return res.status(500).json({ error: 'Datei konnte nicht gelesen werden: ' + err.message })
      }
      const mime = doc.ELDVD_MimeType || 'application/octet-stream'
      res.setHeader('Content-Type', mime)
      res.setHeader('Content-Disposition', 'attachment; filename="' + (doc.ELDVD_DateinameUser || 'dokument') + '"')
      res.send(data)
    })
  } catch(e) {
    console.error('documents download error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
