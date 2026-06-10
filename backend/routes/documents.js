const express  = require('express')
const router   = express.Router()
const { authMiddleware } = require('../middleware/auth')
const pbDb     = require('../db/powerbirdDb')
const localDb  = require('../db/localDb')
const path     = require('path')

const requireAuth = authMiddleware

// GET /api/documents - eigene Dokumente abrufen
router.get('/', requireAuth, async (req, res) => {
  try {
    // Feature-Check
    if (req.user.features && req.user.features.documents === false)
      return res.status(403).json({ error: 'Funktion nicht freigeschaltet' })
    const kuerzel = req.user.powerbird_id
    if (!kuerzel) return res.json({ documents: [] })

    const pool = await pbDb.getPool()
    const result = await pool.request()
      .input('kuerzel', kuerzel)
      .query(`
        SELECT
          d.ELDVD_LaufendeNr   AS id,
          d.ELDVD_Adresse      AS adresse,
          d.ELDVD_DateinameUser AS dateiname,
          d.ELDVD_MimeType     AS mimeType,
          d.ELDVD_FileSize     AS fileSize,
          d.ELDVD_Beschreibung AS beschreibung,
          d.ELDVK_Kennzeichen  AS kategorie,
          d.ELDVD_DokumentDatum AS datum,
          d.ELDVD_AnlageDatum  AS angelegt
        FROM ELDVD d
        JOIN ELDVV v ON d.ELDVD_LaufendeNr = v.ELDVD_LaufendeNr
        WHERE v.ELDVV_TargetKey = @kuerzel
          AND v.ELDVV_ObjektTyp = 3
          AND (d.ELDVD_LoeschDatum IS NULL)
          AND v.ELDVV_IsDeactivated = 0
        ORDER BY d.ELDVD_AnlageDatum DESC
      `)

    res.json({ documents: result.recordset })
  } catch(e) {
    console.error('documents GET error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// GET /api/documents/download/:id - Datei via SMB herunterladen
router.get('/download/:id', requireAuth, async (req, res) => {
  try {
    if (req.user.features && req.user.features.documents === false)
      return res.status(403).json({ error: 'Funktion nicht freigeschaltet' })
    const kuerzel = req.user.powerbird_id
    if (!kuerzel) return res.status(403).json({ error: 'Kein Powerbird-Kürzel' })

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

    // SMB-Pfad aus Settings + Adresse zusammenbauen
    const smbConfig = localDb.db.prepare(
      "SELECT * FROM smb_configs WHERE id=1"
    ).get()

    if (!smbConfig) return res.status(500).json({ error: 'SMB nicht konfiguriert' })

    // SMB2 Client verwenden
    const SMB2 = require('smb2')
    const smb2 = new SMB2({
      share:    '\\' + smbConfig.host + '\' + smbConfig.share,
      domain:   smbConfig.domain || '',
      username: smbConfig.username,
      password: smbConfig.password,
    })

    // Pfad normalisieren: \MITARBEITER\LD\datei.pdf -> MITARBEITER\LD\datei.pdf
    const filePath = doc.ELDVD_Adresse.replace(/^\\/,'').replace(/\\/g,'\\')

    smb2.readFile(filePath, (err, data) => {
      smb2.close()
      if (err) {
        console.error('SMB read error:', err.message)
        return res.status(500).json({ error: 'Datei konnte nicht gelesen werden: ' + err.message })
      }
      const mime = doc.ELDVD_MimeType || 'application/octet-stream'
      const filename = encodeURIComponent(doc.ELDVD_DateinameUser || 'dokument')
      res.setHeader('Content-Type', mime)
      res.setHeader('Content-Disposition', 'attachment; filename="' + doc.ELDVD_DateinameUser + '"')
      res.send(data)
    })
  } catch(e) {
    console.error('documents download error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
