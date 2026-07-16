const express  = require('express')
const router   = express.Router()
const { authMiddleware, adminMiddleware } = require('../middleware/auth')
const pbDb     = require('../db/powerbirdDb')
const localDb  = require('../db/localDb')
const multer   = require('multer')
const path     = require('path')
const fs       = require('fs')

// Dokument-Modus: 'powerbird' | 'smb' | 'local'
const getMode = () => localDb.getSetting('doc_mode') || 'powerbird'

// ── Local Upload Storage ──────────────────────────────────────────────────
const uploadDir = '/data/documents'
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(uploadDir, req.user.id.toString())
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true })
    cb(null, userDir)
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '_' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    cb(null, unique)
  }
})
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } })

// ── Lokale Dokument-Tabelle ───────────────────────────────────────────────
try {
  localDb.db.exec(`
    CREATE TABLE IF NOT EXISTS local_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT,
      file_size INTEGER,
      category TEXT DEFAULT 'Allgemein',
      is_public INTEGER DEFAULT 0,
      uploaded_at INTEGER DEFAULT (unixepoch())
    )
  `)
} catch(e) {}

// ── GET /api/documents ────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.features && req.user.features.documents === false)
      return res.status(403).json({ error: 'Funktion nicht freigeschaltet' })

    const mode = getMode()

    if (mode === 'local') {
      // Eigene + öffentliche Dokumente aus lokaler DB
      const docs = localDb.db.prepare(`
        SELECT d.*, u.name as uploader_name FROM local_documents d
        LEFT JOIN users u ON u.id = d.user_id
        WHERE d.user_id = ? OR d.is_public = 1
        ORDER BY d.uploaded_at DESC
      `).all(req.user.id)

      const documents = docs.map(d => ({
        id: 'local_' + d.id,
        dateiname: d.original_name,
        mimeType: d.mime_type,
        fileSize: d.file_size,
        kategorieKey: d.category,
        datum: new Date(d.uploaded_at * 1000).toISOString(),
        isPublic: d.is_public === 1,
        uploader: d.uploader_name,
        localId: d.id,
      }))
      return res.json({ documents, categories: {}, mode: 'local' })
    }

    if (mode === 'smb') {
      // SMB-Freigabe direkt lesen (ohne Powerbird)
      const rawServer = localDb.getSetting('doc_smb_server') || ''
      if (!rawServer) return res.json({ documents: [], categories: {}, mode: 'smb' })
      const cleaned  = rawServer.replace(/\\/g, '/').replace(/^\/+/, '')
      const parts    = cleaned.split('/').filter(p => p.length > 0)
      const host     = parts[0] || ''
      const share    = parts[1] || ''
      const basePath = parts.slice(2).join('\\')
      if (!host || !share) return res.json({ documents: [], categories: {}, mode: 'smb' })

      const SMB2 = require('@marsaud/smb2')
      const smb2 = new SMB2({
        share: '\\\\' + host + '\\' + share,
        domain:   localDb.getSetting('doc_smb_domain') || 'WORKGROUP',
        username: localDb.getSetting('doc_smb_user') || '',
        password: localDb.getSetting('doc_smb_password') || '',
        autoCloseTimeout: 0,
      })

      const readdir = (p) => new Promise((resolve, reject) => {
        smb2.readdir(p, (err, files) => { if (err) reject(err); else resolve(files) })
      })

      const documents = []
      try {
        const rootFiles = await readdir(basePath || '')
        for (const file of rootFiles) {
          const filePath = basePath ? basePath + '\\' + file : file
          documents.push({
            id: 'smb_' + Buffer.from(filePath).toString('base64'),
            dateiname: file,
            mimeType: getMimeType(file),
            kategorieKey: 'SMB',
            datum: new Date().toISOString(),
            smbPath: filePath,
          })
        }
      } catch(e) { console.log('SMB readdir error:', e.message) }
      try { smb2.close() } catch(e) {}

      return res.json({ documents, categories: { SMB: 'Netzlaufwerk' }, mode: 'smb' })
    }

    // ── Powerbird-Modus (Standard) ────────────────────────────────────────
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
      cats.recordset.forEach(r => {
        if (r.DVK_Kennzeichen) {
          categories[r.DVK_Kennzeichen] = r.DVK_Bezeichnung
          categories[r.DVK_Kennzeichen.toUpperCase()] = r.DVK_Bezeichnung
        }
      })
    } catch(e) {}
    res.json({ documents: result.recordset, categories, mode: 'powerbird' })

  } catch(e) { console.error('documents GET error:', e.message); res.status(500).json({ error: e.message }) }
})

// ── GET /api/documents/download/:id ──────────────────────────────────────
router.get('/download/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.features && req.user.features.documents === false)
      return res.status(403).json({ error: 'Funktion nicht freigeschaltet' })

    const id   = req.params.id
    const mode = getMode()

    // Lokaler Download
    if (id.startsWith('local_')) {
      const localId = parseInt(id.replace('local_', ''))
      const doc = localDb.db.prepare('SELECT * FROM local_documents WHERE id = ?').get(localId)
      if (!doc) return res.status(404).json({ error: 'Nicht gefunden' })
      if (doc.user_id !== req.user.id && doc.is_public !== 1)
        return res.status(403).json({ error: 'Kein Zugriff' })
      const filePath = path.join(uploadDir, doc.user_id.toString(), doc.filename)
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Datei nicht gefunden' })
      res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream')
      res.setHeader('Content-Disposition', 'attachment; filename="' + doc.original_name + '"')
      return fs.createReadStream(filePath).pipe(res)
    }

    // SMB-Download
    if (id.startsWith('smb_')) {
      const smbPath = Buffer.from(id.replace('smb_', ''), 'base64').toString()
      const rawServer = localDb.getSetting('doc_smb_server') || ''
      const cleaned  = rawServer.replace(/\\/g, '/').replace(/^\/+/, '')
      const parts    = cleaned.split('/').filter(p => p.length > 0)
      const host     = parts[0]; const share = parts[1]
      const SMB2 = require('@marsaud/smb2')
      const smb2 = new SMB2({
        share: '\\\\' + host + '\\' + share,
        domain:   localDb.getSetting('doc_smb_domain') || 'WORKGROUP',
        username: localDb.getSetting('doc_smb_user') || '',
        password: localDb.getSetting('doc_smb_password') || '',
        autoCloseTimeout: 0,
      })
      smb2.readFile(smbPath, (err, data) => {
        try { smb2.close() } catch(e2) {}
        if (err) return res.status(500).json({ error: err.message })
        res.setHeader('Content-Type', getMimeType(smbPath))
        res.setHeader('Content-Disposition', 'attachment; filename="' + path.basename(smbPath) + '"')
        res.send(data)
      })
      return
    }

    // Powerbird-Download
    const kuerzel = req.user.powerbird_id
    if (!kuerzel) return res.status(403).json({ error: 'Kein Powerbird-Kuerzel' })
    const pool = await pbDb.getPool()
    const result = await pool.request()
      .input('id', parseInt(id)).input('kuerzel', kuerzel)
      .query(`SELECT d.ELDVD_Adresse, d.ELDVD_DateinameUser, d.ELDVD_MimeType
        FROM ELDVD d JOIN ELDVV v ON d.ELDVD_LaufendeNr = v.ELDVD_LaufendeNr
        WHERE d.ELDVD_LaufendeNr = @id AND v.ELDVV_TargetKey = @kuerzel AND v.ELDVV_ObjektTyp = 3`)
    if (!result.recordset.length) return res.status(404).json({ error: 'Nicht gefunden' })
    const doc = result.recordset[0]
    const rawServer = localDb.getSetting('doc_smb_server') || ''
    const cleaned  = rawServer.replace(/\\/g, '/').replace(/^\/+/, '')
    const parts    = cleaned.split('/').filter(p => p.length > 0)
    const host     = parts[0]; const share = parts[1]; const basePath = parts.slice(2).join('\\')
    if (!host || !share) return res.status(500).json({ error: 'SMB nicht konfiguriert' })
    const SMB2 = require('@marsaud/smb2')
    const smb2 = new SMB2({
      share: '\\\\' + host + '\\' + share,
      domain:   localDb.getSetting('doc_smb_domain') || localDb.getSetting('smb_domain') || 'WORKGROUP',
      username: localDb.getSetting('doc_smb_user') || localDb.getSetting('smb_user') || '',
      password: localDb.getSetting('doc_smb_password') || localDb.getSetting('smb_password') || '',
      autoCloseTimeout: 0,
    })
    const relPath  = doc.ELDVD_Adresse.replace(/^[\\\/]+/, '').replace(/\\\\/g, '\\')
    const filePath = basePath ? basePath + '\\' + relPath : relPath
    smb2.readFile(filePath, (err, data) => {
      try { smb2.close() } catch(e2) {}
      if (err) return res.status(500).json({ error: err.message })
      res.setHeader('Content-Type', doc.ELDVD_MimeType || 'application/octet-stream')
      res.setHeader('Content-Disposition', 'attachment; filename="' + doc.ELDVD_DateinameUser + '"')
      res.send(data)
    })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── POST /api/documents/upload (Lokaler Modus) ───────────────────────────
router.post('/upload', authMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Keine Datei' })
    const isPublic = req.body.is_public === 'true' ? 1 : 0
    const category = req.body.category || 'Allgemein'
    const canUploadPublic = req.user.role === 'admin' || req.user.features?.docs_upload
    if (isPublic && !canUploadPublic) return res.status(403).json({ error: 'Keine Berechtigung für öffentliche Uploads' })

    const info = localDb.db.prepare(`
      INSERT INTO local_documents (user_id, filename, original_name, mime_type, file_size, category, is_public)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, category, isPublic)

    res.json({ success: true, id: 'local_' + info.lastInsertRowid })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── DELETE /api/documents/local/:id ──────────────────────────────────────
router.delete('/local/:id', authMiddleware, (req, res) => {
  try {
    const doc = localDb.db.prepare('SELECT * FROM local_documents WHERE id = ?').get(parseInt(req.params.id))
    if (!doc) return res.status(404).json({ error: 'Nicht gefunden' })
    if (doc.user_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Kein Zugriff' })
    const filePath = path.join(uploadDir, doc.user_id.toString(), doc.filename)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    localDb.db.prepare('DELETE FROM local_documents WHERE id = ?').run(doc.id)
    res.json({ success: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

function getMimeType(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  const map = { pdf:'application/pdf', jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png',
    gif:'image/gif', webp:'image/webp', doc:'application/msword',
    docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls:'application/vnd.ms-excel',
    xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  return map[ext] || 'application/octet-stream'
}

module.exports = router
