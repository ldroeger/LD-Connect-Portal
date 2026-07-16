const express  = require('express')
const router   = express.Router()
const { authMiddleware, adminMiddleware } = require('../middleware/auth')
const pbDb     = require('../db/powerbirdDb')
const localDb  = require('../db/localDb')
const multer   = require('multer')
const pathMod  = require('path')
const fs       = require('fs')

const getMode     = () => localDb.getSetting('doc_mode') || 'powerbird'
const getCategories = () => {
  const raw = localDb.getSetting('doc_categories') || ''
  return raw.split('\n').map(s => s.trim()).filter(Boolean)
}

// ── Lokale DB Tabelle ─────────────────────────────────────────────────────
try {
  localDb.db.exec(`
    CREATE TABLE IF NOT EXISTS local_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      target_user_id INTEGER,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT,
      file_size INTEGER,
      category TEXT DEFAULT 'Allgemein',
      month TEXT,
      is_public INTEGER DEFAULT 0,
      uploaded_at INTEGER DEFAULT (unixepoch())
    )
  `)
  try { localDb.db.exec('ALTER TABLE local_documents ADD COLUMN target_user_id INTEGER') } catch(e) {}
  try { localDb.db.exec('ALTER TABLE local_documents ADD COLUMN month TEXT') } catch(e) {}
} catch(e) {}

// ── Upload Storage ────────────────────────────────────────────────────────
const uploadDir = '/data/documents'
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = pathMod.join(uploadDir, req.user.id.toString())
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '_' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'))
  }
})
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } })

// ── Hilfsfunktion: SMB Verzeichnis lesen ─────────────────────────────────
function getSmbClient() {
  const rawServer = localDb.getSetting('doc_smb_server') || ''
  if (!rawServer) return null
  const cleaned = rawServer.replace(/\\/g, '/').replace(/^\/+/, '')
  const parts   = cleaned.split('/').filter(p => p.length > 0)
  const host    = parts[0]; const share = parts[1]; const basePath = parts.slice(2).join('\\')
  if (!host || !share) return null
  const SMB2 = require('@marsaud/smb2')
  const smb2 = new SMB2({
    share: '\\\\' + host + '\\' + share,
    domain:   localDb.getSetting('doc_smb_domain') || 'WORKGROUP',
    username: localDb.getSetting('doc_smb_user') || '',
    password: localDb.getSetting('doc_smb_password') || '',
    autoCloseTimeout: 0,
  })
  return { smb2, host, share, basePath }
}

function getMimeType(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  const map = { pdf:'application/pdf', jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png',
    gif:'image/gif', webp:'image/webp', doc:'application/msword',
    docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls:'application/vnd.ms-excel',
    xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  return map[ext] || 'application/octet-stream'
}

// ── GET /api/documents/categories ────────────────────────────────────────
router.get('/categories', authMiddleware, (req, res) => {
  res.json({ categories: getCategories() })
})

// ── GET /api/documents ────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.features && req.user.features.documents === false)
      return res.status(403).json({ error: 'Funktion nicht freigeschaltet' })

    const mode = getMode()
    const rights = localDb.getSetting('doc_user_rights') || 'own'
    // rights: 'own' = nur eigene, 'all' = alle MA, 'all_upload' = alle + kann hochladen

    if (mode === 'local') {
      let docs
      if (rights === 'own') {
        // Nur eigene oder an mich adressierte
        docs = localDb.db.prepare(`
          SELECT d.*, u.name as uploader_name, tu.name as target_name
          FROM local_documents d
          LEFT JOIN users u ON u.id = d.user_id
          LEFT JOIN users tu ON tu.id = d.target_user_id
          WHERE d.target_user_id = ? OR (d.target_user_id IS NULL AND d.user_id = ?)
          ORDER BY d.uploaded_at DESC
        `).all(req.user.id, req.user.id)
      } else {
        // Alle Dokumente sehen
        docs = localDb.db.prepare(`
          SELECT d.*, u.name as uploader_name, tu.name as target_name
          FROM local_documents d
          LEFT JOIN users u ON u.id = d.user_id
          LEFT JOIN users tu ON tu.id = d.target_user_id
          ORDER BY d.uploaded_at DESC
        `).all()
      }
      const documents = docs.map(d => ({
        id: 'local_' + d.id,
        dateiname: d.original_name,
        mimeType: d.mime_type,
        fileSize: d.file_size,
        kategorieKey: d.category,
        datum: new Date(d.uploaded_at * 1000).toISOString(),
        month: d.month,
        isPublic: d.is_public === 1,
        uploader: d.uploader_name,
        targetUser: d.target_name,
        localId: d.id,
        canDelete: d.user_id === req.user.id || req.user.role === 'admin',
      }))
      const cats = {}
      getCategories().forEach(c => { cats[c] = c })
      return res.json({ documents, categories: cats, mode: 'local', rights,
        canUpload: ['all_upload','own'].includes(rights) || req.user.role === 'admin' })
    }

    if (mode === 'smb') {
      const smbInfo = getSmbClient()
      if (!smbInfo) return res.json({ documents: [], categories: {}, mode: 'smb' })
      const { smb2, basePath } = smbInfo
      const useUserDirs = localDb.getSetting('doc_smb_user_dirs') === 'true'
      const kuerzel = req.user.powerbird_id || req.user.name || String(req.user.id)

      const readdir = (p) => new Promise((resolve, reject) => {
        smb2.readdir(p, (err, files) => { if (err) reject(err); else resolve(files || []) })
      })

      const documents = []
      try {
        if (useUserDirs) {
          // Eigenes Unterverzeichnis: basePath\KUERZEL\*
          const userPath = basePath ? basePath + '\\' + kuerzel : kuerzel
          const files = await readdir(userPath).catch(() => [])
          for (const file of files) {
            const filePath = userPath + '\\' + file
            documents.push({
              id: 'smb_' + Buffer.from(filePath).toString('base64'),
              dateiname: file, mimeType: getMimeType(file),
              kategorieKey: 'Meine Dokumente', datum: new Date().toISOString(), smbPath: filePath,
            })
          }
        } else {
          // Alle Dateien aus Basis-Verzeichnis
          const files = await readdir(basePath || '')
          for (const file of files) {
            const filePath = basePath ? basePath + '\\' + file : file
            documents.push({
              id: 'smb_' + Buffer.from(filePath).toString('base64'),
              dateiname: file, mimeType: getMimeType(file),
              kategorieKey: 'Netzlaufwerk', datum: new Date().toISOString(), smbPath: filePath,
            })
          }
        }
      } catch(e) { console.log('SMB readdir error:', e.message) }
      try { smb2.close() } catch(e) {}
      return res.json({ documents, categories: { 'Meine Dokumente':'Meine Dokumente', 'Netzlaufwerk':'Netzlaufwerk' }, mode: 'smb' })
    }

    // ── Powerbird-Modus ───────────────────────────────────────────────────
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
  } catch(e) { console.error('documents error:', e.message); res.status(500).json({ error: e.message }) }
})

// ── GET /api/documents/download/:id ──────────────────────────────────────
router.get('/download/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.features && req.user.features.documents === false)
      return res.status(403).json({ error: 'Funktion nicht freigeschaltet' })
    const id = req.params.id

    if (id.startsWith('local_')) {
      const localId = parseInt(id.replace('local_', ''))
      const doc = localDb.db.prepare('SELECT * FROM local_documents WHERE id = ?').get(localId)
      if (!doc) return res.status(404).json({ error: 'Nicht gefunden' })
      const rights = localDb.getSetting('doc_user_rights') || 'own'
      if (rights === 'own' && doc.user_id !== req.user.id && doc.target_user_id !== req.user.id && req.user.role !== 'admin')
        return res.status(403).json({ error: 'Kein Zugriff' })
      const filePath = pathMod.join(uploadDir, doc.user_id.toString(), doc.filename)
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Datei nicht gefunden' })
      res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream')
      res.setHeader('Content-Disposition', 'attachment; filename="' + doc.original_name + '"')
      return fs.createReadStream(filePath).pipe(res)
    }

    if (id.startsWith('smb_')) {
      const smbPath = Buffer.from(id.replace('smb_', ''), 'base64').toString()
      const smbInfo = getSmbClient()
      if (!smbInfo) return res.status(500).json({ error: 'SMB nicht konfiguriert' })
      const { smb2 } = smbInfo
      smb2.readFile(smbPath, (err, data) => {
        try { smb2.close() } catch(e2) {}
        if (err) return res.status(500).json({ error: err.message })
        res.setHeader('Content-Type', getMimeType(smbPath))
        res.setHeader('Content-Disposition', 'attachment; filename="' + pathMod.basename(smbPath) + '"')
        res.send(data)
      })
      return
    }

    // Powerbird
    const kuerzel = req.user.powerbird_id
    if (!kuerzel) return res.status(403).json({ error: 'Kein Powerbird-Kuerzel' })
    const pool = await pbDb.getPool()
    const result = await pool.request().input('id', parseInt(id)).input('kuerzel', kuerzel)
      .query(`SELECT d.ELDVD_Adresse, d.ELDVD_DateinameUser, d.ELDVD_MimeType
        FROM ELDVD d JOIN ELDVV v ON d.ELDVD_LaufendeNr = v.ELDVD_LaufendeNr
        WHERE d.ELDVD_LaufendeNr = @id AND v.ELDVV_TargetKey = @kuerzel AND v.ELDVV_ObjektTyp = 3`)
    if (!result.recordset.length) return res.status(404).json({ error: 'Nicht gefunden' })
    const doc = result.recordset[0]
    const smbInfo = getSmbClient()
    if (!smbInfo) return res.status(500).json({ error: 'SMB nicht konfiguriert' })
    const { smb2, basePath } = smbInfo
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

// ── POST /api/documents/upload ────────────────────────────────────────────
router.post('/upload', authMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Keine Datei' })
    const rights = localDb.getSetting('doc_user_rights') || 'own'
    const canUpload = rights === 'own' || rights === 'all_upload' || req.user.role === 'admin'
    if (!canUpload) return res.status(403).json({ error: 'Keine Upload-Berechtigung' })

    const targetUserId = req.body.target_user_id ? parseInt(req.body.target_user_id) : req.user.id
    const category     = req.body.category || 'Allgemein'
    const month        = req.body.month || null
    const isPublic     = (rights === 'all' || rights === 'all_upload') ? 1 : 0

    localDb.db.prepare(`
      INSERT INTO local_documents (user_id, target_user_id, filename, original_name, mime_type, file_size, category, month, is_public)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, targetUserId, req.file.filename, req.file.originalname,
       req.file.mimetype, req.file.size, category, month, isPublic)

    res.json({ success: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── DELETE /api/documents/local/:id ──────────────────────────────────────
router.delete('/local/:id', authMiddleware, (req, res) => {
  try {
    const doc = localDb.db.prepare('SELECT * FROM local_documents WHERE id = ?').get(parseInt(req.params.id))
    if (!doc) return res.status(404).json({ error: 'Nicht gefunden' })
    if (doc.user_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Kein Zugriff' })
    const filePath = pathMod.join(uploadDir, doc.user_id.toString(), doc.filename)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    localDb.db.prepare('DELETE FROM local_documents WHERE id = ?').run(doc.id)
    res.json({ success: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
