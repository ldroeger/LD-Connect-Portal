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

function getUserFeatures(userId) {
  // Immer frisch aus DB lesen damit Änderungen sofort wirken
  const u = localDb.db.prepare('SELECT feature_docs_upload, feature_docs_upload_all, feature_docs_manage, feature_documents, role FROM users WHERE id = ?').get(userId)
  if (!u) return {}
  // NULL oder 0 = kein Recht; nur explizit 1 = Recht vorhanden
  return {
    documents:       u.feature_documents       === 1,
    docs_upload:     u.feature_docs_upload     === 1,
    docs_upload_all: u.feature_docs_upload_all === 1,
    docs_manage:     u.feature_docs_manage     === 1,
    role:            u.role,
  }
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
// Memory Storage - Dateien werden nach dem Middleware-Stack manuell gespeichert
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 20 }  // 100MB pro Datei
}).array('files', 20)

const uploadMiddleware = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Datei zu groß (max. 100 MB pro Datei)' })
      if (err.code === 'LIMIT_FILE_COUNT') return res.status(413).json({ error: 'Zu viele Dateien (max. 20)' })
      return res.status(400).json({ error: err.message })
    }
    next()
  })
}

function saveFile(buffer, originalname, kuerzel, category, baseDir) {
  const safeCategory = (category || 'Allgemein').replace(/[^a-zA-Z0-9äöüÄÖÜß _-]/g, '_')
  const dir = pathMod.join(baseDir, kuerzel, safeCategory)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  let filename = originalname
  if (fs.existsSync(pathMod.join(dir, filename))) {
    const ext  = pathMod.extname(filename)
    const base = pathMod.basename(filename, ext)
    filename   = base + '_' + Date.now() + ext
  }
  fs.writeFileSync(pathMod.join(dir, filename), buffer)
  return filename
}

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


// GET /api/documents/my-rights - Rechte frisch aus DB ohne Admin-Override
router.get('/my-rights', authMiddleware, (req, res) => {
  const f = getUserFeatures(req.user.id)
  res.json({
    canUpload:    f.docs_upload || f.docs_upload_all,
    canUploadAll: f.docs_upload_all,
    canManage:    f.docs_manage,
  })
})

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
    const freshFeatures = getUserFeatures(req.user.id)
    const isAdmin       = req.user.role === 'admin' || freshFeatures.role === 'admin'
    const canUpload     = freshFeatures.docs_upload || freshFeatures.docs_upload_all
    const canUploadAll  = freshFeatures.docs_upload_all

    if (mode === 'local') {
      const baseDir  = getBaseDir()
      const kuerzel  = getUserKuerzel(req.user)
      const canManage = freshFeatures.docs_manage
      let docs = []

      // /documents zeigt IMMER nur das eigene Verzeichnis
      // Für andere Verzeichnisse → /documents-manage
      docs = readLocalDocs(baseDir, kuerzel, isAdmin)

      // Kategorien aus allen Verzeichnissen zusammenstellen
      const cats = {}
      getCategories().forEach(c => { cats[c] = c })
      docs.forEach(d => { if (d.kategorieKey) cats[d.kategorieKey] = d.kategorieKey })

      return res.json({ documents: docs, categories: cats, mode: 'local',
        canUpload, canUploadAll, canManage: canManage })
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
router.post('/upload', authMiddleware, uploadMiddleware, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'Keine Datei' })

    const freshFeat    = getUserFeatures(req.user.id)
    const canUpload    = freshFeat.docs_upload || freshFeat.docs_upload_all
    if (!canUpload) return res.status(403).json({ error: 'Keine Upload-Berechtigung' })
    const canUploadAll = freshFeat.docs_upload_all
    const category     = req.body.category || 'Allgemein'
    const baseDir      = getBaseDir()

    // Ziel-User bestimmen
    let targetKuerzels = []
    if (canUploadAll && req.body.target_user_ids) {
      const ids = req.body.target_user_ids.split(',').map(s => s.trim()).filter(Boolean)
      for (const id of ids) {
        const u = localDb.db.prepare('SELECT * FROM users WHERE id = ?').get(parseInt(id))
        if (u) targetKuerzels.push(getUserKuerzel(u))
      }
    }
    // Fallback: eigenes Verzeichnis
    if (targetKuerzels.length === 0) targetKuerzels = [getUserKuerzel(req.user)]

    let count = 0
    for (const kuerzel of targetKuerzels) {
      for (const file of req.files) {
        saveFile(file.buffer, file.originalname, kuerzel, category, baseDir)
        count++
      }
    }

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
    const freshFeatDel = getUserFeatures(req.user.id)
    if (!isOwner && !freshFeatDel.docs_manage) return res.status(403).json({ error: 'Kein Zugriff' })
    fs.unlinkSync(fsPath)
    res.json({ success: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})


// GET /api/documents/manage/:userId - Dokumente eines anderen Users (für Admins/Manage-Rolle)
router.get('/manage/:userId', authMiddleware, async (req, res) => {
  try {
    const freshFeatM = getUserFeatures(req.user.id)
    const canManage  = freshFeatM.docs_manage
    if (!canManage) return res.status(403).json({ error: 'Keine Berechtigung' })

    const targetUser = localDb.db.prepare('SELECT * FROM users WHERE id = ?').get(parseInt(req.params.userId))
    if (!targetUser) return res.status(404).json({ error: 'Benutzer nicht gefunden' })

    const mode    = getMode()
    const baseDir = getBaseDir()
    const kuerzel = getUserKuerzel(targetUser)

    if (mode === 'local') {
      const docs = readLocalDocs(baseDir, kuerzel, true)
      const cats = {}
      getCategories().forEach(c => { cats[c] = c })
      docs.forEach(d => { if (d.kategorieKey) cats[d.kategorieKey] = d.kategorieKey })
      return res.json({ documents: docs, categories: cats, mode: 'local' })
    }

    res.json({ documents: [], categories: {}, mode })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
