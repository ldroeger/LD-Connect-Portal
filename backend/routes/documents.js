const express  = require('express')
const router   = express.Router()
const { authMiddleware, adminMiddleware } = require('../middleware/auth')
const pbDb     = require('../db/powerbirdDb')
const localDb  = require('../db/localDb')
const multer   = require('multer')
const pathMod  = require('path')
const fs       = require('fs')

const getMode       = () => localDb.getSetting('doc_mode') || 'powerbird'
const getBaseDir    = () => localDb.getSetting('doc_local_basedir') || '/data/documents'
const getCategories = () => {
  const raw = localDb.getSetting('doc_categories') || ''
  return raw.split('\n').map(s => s.trim()).filter(Boolean)
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────
function getMimeType(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  const map = {
    pdf:'application/pdf', jpg:'image/jpeg', jpeg:'image/jpeg',
    png:'image/png', gif:'image/gif', webp:'image/webp',
    doc:'application/msword',
    docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls:'application/vnd.ms-excel',
    xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt:'text/plain', csv:'text/csv', zip:'application/zip',
  }
  return map[ext] || 'application/octet-stream'
}

function getUserKuerzel(user) {
  // Powerbird-Kürzel bevorzugen, sonst Name bereinigt, sonst ID
  if (user.powerbird_id) return user.powerbird_id
  if (user.name) return user.name.replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase().substring(0, 12)
  return String(user.id)
}

// ── Lokales Dateisystem: Verzeichnis lesen ────────────────────────────────
// Struktur: BASEDIR/KUERZEL/KATEGORIE/datei.xxx
function readLocalDocs(baseDir, kuerzel, isAdmin) {
  const docs = []
  const userDir = pathMod.join(baseDir, kuerzel)

  if (!fs.existsSync(userDir)) return docs

  const categories = fs.readdirSync(userDir, { withFileTypes: true })
    .filter(d => d.isDirectory())

  for (const catDir of categories) {
    const catPath = pathMod.join(userDir, catDir.name)
    const files   = fs.readdirSync(catPath, { withFileTypes: true })
      .filter(f => f.isFile() && !f.name.startsWith('.'))

    for (const file of files) {
      const filePath  = pathMod.join(catPath, file.name)
      const stat      = fs.statSync(filePath)
      docs.push({
        id:           'local_fs_' + Buffer.from(filePath).toString('base64'),
        dateiname:    file.name,
        mimeType:     getMimeType(file.name),
        fileSize:     stat.size,
        kategorieKey: catDir.name,
        datum:        stat.mtime.toISOString(),
        fsPath:       filePath,
        kuerzel:      kuerzel,
      })
    }
  }
  return docs
}

// ── Upload Storage: BASEDIR/KUERZEL/KATEGORIE/ ────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const baseDir  = getBaseDir()
    const kuerzel  = req.uploadKuerzel || getUserKuerzel(req.user)
    const category = (req.body.category || 'Allgemein').replace(/[^a-zA-Z0-9äöüÄÖÜß _-]/g, '_')
    const dir = pathMod.join(baseDir, kuerzel, category)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    // Originaldateinamen behalten, bei Kollision Timestamp voranstellen
    const dir      = pathMod.join(
      getBaseDir(),
      req.uploadKuerzel || getUserKuerzel(req.user),
      (req.body.category || 'Allgemein').replace(/[^a-zA-Z0-9äöüÄÖÜß _-]/g, '_')
    )
    const target = pathMod.join(dir, file.originalname)
    if (fs.existsSync(target)) {
      const ext  = pathMod.extname(file.originalname)
      const base = pathMod.basename(file.originalname, ext)
      cb(null, base + '_' + Date.now() + ext)
    } else {
      cb(null, file.originalname)
    }
  }
})
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024, files: 20 } })

// ── SMB Client ────────────────────────────────────────────────────────────
function getSmbClient() {
  const rawServer = localDb.getSetting('doc_smb_server') || ''
  if (!rawServer) return null
  const cleaned = rawServer.replace(/\\/g, '/').replace(/^\/+/, '')
  const parts   = cleaned.split('/').filter(p => p.length > 0)
  const host = parts[0]; const share = parts[1]; const basePath = parts.slice(2).join('\\')
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

// ── GET /api/documents/categories ────────────────────────────────────────
router.get('/categories', authMiddleware, (req, res) => {
  const cats = getCategories()
  // Auch vorhandene Verzeichnisse einlesen
  const mode = getMode()
  if (mode === 'local') {
    const baseDir = getBaseDir()
    const kuerzel = getUserKuerzel(req.user)
    const userDir = pathMod.join(baseDir, kuerzel)
    if (fs.existsSync(userDir)) {
      const dirCats = fs.readdirSync(userDir, { withFileTypes: true })
        .filter(d => d.isDirectory()).map(d => d.name)
      const merged = [...new Set([...cats, ...dirCats])].sort()
      return res.json({ categories: merged })
    }
  }
  res.json({ categories: cats })
})

// ── GET /api/documents ────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.features && req.user.features.documents === false)
      return res.status(403).json({ error: 'Funktion nicht freigeschaltet' })

    const mode          = getMode()
    const rights        = localDb.getSetting('doc_user_rights') || 'own'
    const canUpload     = req.user.role === 'admin' || req.user.features?.docs_upload || req.user.features?.docs_upload_all
    const canUploadAll  = req.user.role === 'admin' || req.user.features?.docs_upload_all
    const isAdmin       = req.user.role === 'admin'

    if (mode === 'local') {
      const baseDir = getBaseDir()
      let docs = []

      if (rights === 'own') {
        // Nur eigenes Verzeichnis
        const kuerzel = getUserKuerzel(req.user)
        docs = readLocalDocs(baseDir, kuerzel, isAdmin)
      } else {
        // Alle Mitarbeiter-Verzeichnisse
        if (fs.existsSync(baseDir)) {
          const dirs = fs.readdirSync(baseDir, { withFileTypes: true }).filter(d => d.isDirectory())
          for (const dir of dirs) {
            docs.push(...readLocalDocs(baseDir, dir.name, isAdmin))
          }
        }
      }

      // Kategorien aus allen Verzeichnissen zusammenstellen
      const cats = {}
      const configCats = getCategories()
      configCats.forEach(c => { cats[c] = c })
      docs.forEach(d => { if (d.kategorieKey) cats[d.kategorieKey] = d.kategorieKey })

      return res.json({ documents: docs, categories: cats, mode: 'local', rights, canUpload, canUploadAll,
        baseDir: isAdmin ? baseDir : undefined })
    }

    if (mode === 'smb') {
      const smbInfo = getSmbClient()
      if (!smbInfo) return res.json({ documents: [], categories: {}, mode: 'smb', canUpload: false, canUploadAll: false })
      const { smb2, basePath } = smbInfo
      const useUserDirs = localDb.getSetting('doc_smb_user_dirs') === 'true'
      const kuerzel = getUserKuerzel(req.user)

      const readdir = (p) => new Promise((resolve, reject) => {
        smb2.readdir(p || '', (err, files) => { if (err) reject(err); else resolve(files || []) })
      })

      const documents = []
      try {
        if (useUserDirs) {
          // KUERZEL/KATEGORIE/datei - gleiche Struktur wie lokal
          const userPath = basePath ? basePath + '\\' + kuerzel : kuerzel
          let catDirs = []
          try { catDirs = await readdir(userPath) } catch(e) {}
          for (const catOrFile of catDirs) {
            const catPath = userPath + '\\' + catOrFile
            try {
              const files = await readdir(catPath)
              for (const file of files) {
                const filePath = catPath + '\\' + file
                documents.push({
                  id: 'smb_' + Buffer.from(filePath).toString('base64'),
                  dateiname: file, mimeType: getMimeType(file),
                  kategorieKey: catOrFile, datum: new Date().toISOString(), smbPath: filePath,
                })
              }
            } catch(e) {
              // Ist eine Datei, keine Unterordner
              documents.push({
                id: 'smb_' + Buffer.from(catPath).toString('base64'),
                dateiname: catOrFile, mimeType: getMimeType(catOrFile),
                kategorieKey: 'Netzlaufwerk', datum: new Date().toISOString(), smbPath: catPath,
              })
            }
          }
        } else {
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
      return res.json({ documents, categories: { Netzlaufwerk:'Netzlaufwerk' }, mode: 'smb', canUpload, canUploadAll })
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
    res.json({ documents: result.recordset, categories, mode: 'powerbird', canUpload: false, canUploadAll: false })
  } catch(e) { console.error('documents error:', e.message); res.status(500).json({ error: e.message }) }
})

// ── GET /api/documents/download/:id ──────────────────────────────────────
router.get('/download/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.features && req.user.features.documents === false)
      return res.status(403).json({ error: 'Funktion nicht freigeschaltet' })
    const id = req.params.id

    // Lokales Dateisystem
    if (id.startsWith('local_fs_')) {
      const fsPath = Buffer.from(id.replace('local_fs_', ''), 'base64').toString()
      if (!fs.existsSync(fsPath)) return res.status(404).json({ error: 'Datei nicht gefunden' })
      // Sicherheitscheck: Datei muss im Basis-Verzeichnis liegen
      const baseDir = getBaseDir()
      if (!fsPath.startsWith(baseDir)) return res.status(403).json({ error: 'Zugriff verweigert' })
      res.setHeader('Content-Type', getMimeType(fsPath))
      res.setHeader('Content-Disposition', 'attachment; filename="' + pathMod.basename(fsPath) + '"')
      return fs.createReadStream(fsPath).pipe(res)
    }

    // SMB
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
// Kürzel für Zielverzeichnis vor multer setzen
router.post('/upload', authMiddleware, (req, res, next) => {
  const canUpload = req.user.role === 'admin' || req.user.features?.docs_upload || req.user.features?.docs_upload_all
  if (!canUpload) return res.status(403).json({ error: 'Keine Upload-Berechtigung' })
  next()
}, (req, res, next) => {
  // Ziel-Kürzel setzen (wird von multer.destination genutzt)
  const canUploadAll = req.user.role === 'admin' || req.user.features?.docs_upload_all
  const targetIds    = req.body.target_user_ids ? req.body.target_user_ids.split(',').map(s => s.trim()).filter(Boolean) : []
  // Für den ersten Target-User das Kürzel setzen (mehrere werden in der upload-Schleife gesetzt)
  if (canUploadAll && targetIds.length > 0) {
    const targetUser = localDb.db.prepare('SELECT * FROM users WHERE id = ?').get(parseInt(targetIds[0]))
    if (targetUser) req.uploadKuerzel = getUserKuerzel(targetUser)
  }
  if (!req.uploadKuerzel) req.uploadKuerzel = getUserKuerzel(req.user)
  next()
}, upload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'Keine Datei' })

    const canUploadAll = req.user.role === 'admin' || req.user.features?.docs_upload_all
    const category     = (req.body.category || 'Allgemein').replace(/[^a-zA-Z0-9äöüÄÖÜß _-]/g, '_')
    const baseDir      = getBaseDir()
    let targetIds      = req.body.target_user_ids ? req.body.target_user_ids.split(',').map(s => s.trim()).filter(Boolean) : []

    if (!canUploadAll || targetIds.length === 0) {
      // Nur für sich selbst hochladen
      // Dateien sind bereits am richtigen Ort dank multer
      return res.json({ success: true, count: req.files.length })
    }

    // Für mehrere Personen: Dateien in die jeweiligen Verzeichnisse kopieren
    let count = 0
    for (const targetIdStr of targetIds) {
      const targetUser = localDb.db.prepare('SELECT * FROM users WHERE id = ?').get(parseInt(targetIdStr))
      if (!targetUser) continue
      const targetKuerzel = getUserKuerzel(targetUser)
      const targetDir     = pathMod.join(baseDir, targetKuerzel, category)
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })

      for (const file of req.files) {
        // Datei aus dem ersten Upload-Ziel in weitere Ziele kopieren
        const destPath = pathMod.join(targetDir, file.filename)
        if (file.path !== destPath) {
          fs.copyFileSync(file.path, destPath)
        }
        count++
      }
    }

    // Original-Dateien löschen wenn sie nicht im Ziel des ersten Users lagen
    // (multer hat sie im Verzeichnis des ersten Users gespeichert)
    res.json({ success: true, count })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── DELETE /api/documents/local/:id ──────────────────────────────────────
router.delete('/local/:id', authMiddleware, (req, res) => {
  try {
    const fsPath = Buffer.from(req.params.id, 'base64').toString()
    const baseDir = getBaseDir()
    if (!fsPath.startsWith(baseDir)) return res.status(403).json({ error: 'Zugriff verweigert' })
    if (!fs.existsSync(fsPath)) return res.status(404).json({ error: 'Nicht gefunden' })
    // Nur Admin oder Eigentümer (Kürzel im Pfad prüfen)
    const kuerzel = getUserKuerzel(req.user)
    const isOwner = fsPath.includes(pathMod.sep + kuerzel + pathMod.sep)
    if (!isOwner && req.user.role !== 'admin') return res.status(403).json({ error: 'Kein Zugriff' })
    fs.unlinkSync(fsPath)
    res.json({ success: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
