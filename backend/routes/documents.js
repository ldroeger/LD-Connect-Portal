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
    mp4:'video/mp4', mov:'video/quicktime', avi:'video/x-msvideo', mkv:'video/x-matroska',
    mp3:'audio/mpeg', wav:'audio/wav', ogg:'audio/ogg', m4a:'audio/mp4',
    webm:'video/webm',
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
  // Für lokalen Modus: Powerbird-Kürzel
  if (user.powerbird_id) return user.powerbird_id
  if (user.name) return user.name.replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase().substring(0, 12)
  return String(user.id)
}

function getUserFolderName(user) {
  // Für SMB-Modus: vollständiger Name des Mitarbeiters
  // Ungültige Zeichen für Windows-Ordner entfernen: \ / : * ? " < > |
  if (user.name) return user.name.replace(/[\\/:*?"<>|]/g, '_').trim()
  if (user.powerbird_id) return user.powerbird_id
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
  limits: { fileSize: 100 * 1024 * 1024, files: 20 }
}).array('files', 20)

// Dateiname von Latin-1 nach UTF-8 konvertieren (multer-Bug mit Umlauten)
function fixFilename(name) {
  try {
    // Prüfen ob es Latin-1 encoded UTF-8 ist
    const buf = Buffer.from(name, 'latin1')
    const utf8 = buf.toString('utf8')
    // Wenn gültig und unterschiedlich → war falsch kodiert
    if (utf8 !== name && /[äöüÄÖÜß]/.test(utf8)) return utf8
  } catch(e) {}
  return name
}

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
  originalname = fixFilename(originalname)
  // Nur Windows-ungültige Zeichen entfernen, Umlaute und Sonderzeichen erlauben
  const safeCategory = (category || 'Allgemein').replace(/[\/:*?"<>|]/g, '_').trim()
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


// ── SMB Schreiben ─────────────────────────────────────────────────────────
function smbWriteFile(smb2, filePath, buffer) {
  return new Promise((resolve, reject) => {
    smb2.writeFile(filePath, buffer, (err) => {
      if (err) reject(err); else resolve()
    })
  })
}

function smbMkdir(smb2, dirPath) {
  return new Promise((resolve) => {
    smb2.mkdir(dirPath, (err) => { resolve() }) // Fehler ignorieren (existiert bereits)
  })
}

async function smbSaveFile(smb2, buffer, originalname, kuerzel, category, basePath) {
  originalname = fixFilename(originalname)
  // Nur Windows-ungültige Zeichen entfernen
  const safeCategory = (category || 'Allgemein').replace(/[\/:*?"<>|]/g, '_').trim()
  // Ordner anlegen: basePath\kuerzel und basePath\kuerzel\kategorie
  const kuerzelPath  = basePath ? basePath + '\\' + kuerzel : kuerzel
  const categoryPath = kuerzelPath + '\\' + safeCategory
  await smbMkdir(smb2, kuerzelPath)
  await smbMkdir(smb2, categoryPath)
  // Dateiname: Original behalten
  const filePath = categoryPath + '\\' + originalname
  await smbWriteFile(smb2, filePath, buffer)
  return filePath
}

// ── SMB Client ────────────────────────────────────────────────────────────
function getSmbClient() {
  // doc_smb_server hat Format: //host/share/subpath oder //host/share
  const rawServer = localDb.getSetting('doc_smb_server') || ''
  if (!rawServer) return null
  const cleaned = rawServer.replace(/\\/g, '/').replace(/^\/+/, '')
  const parts   = cleaned.split('/').filter(p => p.length > 0)
  // parts[0] = host, parts[1] = share, parts[2..] = basepath
  const serverHost = parts[0]
  const share      = parts[1]
  const basePath   = parts.slice(2).join('\\')
  if (!serverHost || !share) return null

  // Eigene Doc-Credentials wenn doc_smb_host gesetzt, sonst Werkzeug-Credentials
  const docHost  = localDb.getSetting('doc_smb_host') || ''
  const host     = docHost || serverHost

  const domain   = docHost ? (localDb.getSetting('doc_smb_domain')   || 'WORKGROUP')
                            : (localDb.getSetting('smb_domain')       || 'WORKGROUP')
  const username = docHost ? (localDb.getSetting('doc_smb_user')     || '')
                            : (localDb.getSetting('smb_user')         || '')
  const password = docHost ? (localDb.getSetting('doc_smb_password') || '')
                            : (localDb.getSetting('smb_password')     || '')

  const SMB2 = require('@marsaud/smb2')
  const smb2 = new SMB2({
    share: '\\\\' + host + '\\' + share,
    domain, username, password,
    autoCloseTimeout: 0,
  })
  return { smb2, host, share, basePath }
}



// POST /api/documents/create-folders - SMB-Ordner für alle Mitarbeiter anlegen
router.post('/create-folders', authMiddleware, async (req, res) => {
  try {
    const freshFeat = getUserFeatures(req.user.id)
    if (!freshFeat.docs_manage && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Keine Berechtigung' })

    const mode = getMode()
    const users = localDb.db.prepare("SELECT * FROM users WHERE is_active = 1").all()
    const results = []

    if (mode === 'smb') {
      const smbInfo = getSmbClient()
      if (!smbInfo) return res.status(500).json({ error: 'SMB nicht konfiguriert' })
      const { smb2, basePath } = smbInfo
      for (const u of users) {
        const folderName = getUserFolderName(u)
        const folderPath = basePath ? basePath + '\\' + folderName : folderName
        try {
          await smbMkdir(smb2, folderPath)
          results.push({ user: u.name, folder: folderName, ok: true })
        } catch(e) {
          results.push({ user: u.name, folder: folderName, ok: false, error: e.message })
        }
      }
      try { smb2.close() } catch(e) {}
    } else if (mode === 'local') {
      const baseDir = getBaseDir()
      for (const u of users) {
        const folderName = getUserKuerzel(u)
        const folderPath = pathMod.join(baseDir, folderName)
        try {
          if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true })
          results.push({ user: u.name, folder: folderName, ok: true })
        } catch(e) {
          results.push({ user: u.name, folder: folderName, ok: false, error: e.message })
        }
      }
    } else {
      return res.status(400).json({ error: 'Nur im SMB- oder Eigenständig-Modus verfügbar' })
    }

    res.json({ success: true, results })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// GET /api/documents/my-rights - Rechte frisch aus DB ohne Admin-Override
router.get('/my-rights', authMiddleware, (req, res) => {
  const mode = getMode()
  if (mode === 'powerbird') {
    return res.json({ canUpload: false, canUploadAll: false, canManage: false })
  }
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
      const kuerzel = getUserFolderName(req.user)

      // Hilfsfunktion: Verzeichnis lesen, gibt [] bei Fehler zurück
      const tryReaddir = (p) => new Promise((resolve) => {
        smb2.readdir(p || '', (err, files) => { resolve(err ? null : (files || [])) })
      })

      const documents = []
      const allCats   = {}

      try {
        // Struktur: basePath\KUERZEL\KATEGORIE\datei
        const userPath = basePath ? basePath + '\\' + kuerzel : kuerzel
        const catEntries = await tryReaddir(userPath)

        if (catEntries !== null) {
          // Eigenes Verzeichnis vorhanden → Kategorie-Ebene lesen
          for (const catName of catEntries) {
            const catPath  = userPath + '\\' + catName
            const catFiles = await tryReaddir(catPath)

            if (catFiles !== null) {
              // catName ist ein Ordner (Kategorie)
              allCats[catName] = catName
              for (const file of catFiles) {
                // Nur Dateien (nicht Unterordner)
                const filePath   = catPath + '\\' + file
                const innerCheck = await tryReaddir(filePath)
                if (innerCheck === null) {
                  // ist eine Datei
                  documents.push({
                    id:           'smb_' + Buffer.from(filePath).toString('base64'),
                    dateiname:    file,
                    mimeType:     getMimeType(file),
                    kategorieKey: catName,
                    datum:        new Date().toISOString(),
                    smbPath:      filePath,
                  })
                }
              }
            }
            // catName ist eine Datei direkt im KUERZEL-Ordner → ignorieren oder als Sonstiges
          }
        } else {
          // Kein eigenes Verzeichnis → Basispfad flach lesen als Fallback
          const rootFiles = await tryReaddir(basePath || '')
          if (rootFiles) {
            for (const file of rootFiles) {
              const filePath   = basePath ? basePath + '\\' + file : file
              const isDir      = await tryReaddir(filePath)
              if (isDir === null) {
                documents.push({
                  id:           'smb_' + Buffer.from(filePath).toString('base64'),
                  dateiname:    file,
                  mimeType:     getMimeType(file),
                  kategorieKey: 'Allgemein',
                  datum:        new Date().toISOString(),
                  smbPath:      filePath,
                })
              }
            }
          }
        }
      } catch(e) { console.log('SMB readdir error:', e.message) }
      try { smb2.close() } catch(e) {}

      // Konfigurierte Kategorien ergänzen
      getCategories().forEach(c => { allCats[c] = c })
      if (!Object.keys(allCats).length) allCats['Allgemein'] = 'Allgemein'

      return res.json({ documents, categories: allCats, mode: 'smb', canUpload, canUploadAll })
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
  const inline = req.query.inline === 'true'  // ?inline=true für Vorschau
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
      const fname = pathMod.basename(fsPath)
      const safeName = encodeURIComponent(fname)
      res.setHeader('Content-Type', getMimeType(fsPath))
      res.setHeader('Content-Disposition', (inline ? 'inline' : 'attachment') + '; filename="' + fname + '"; filename*=UTF-8\'\'' + safeName)
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
        const smbFname = pathMod.basename(smbPath)
        const safeSmbName = encodeURIComponent(smbFname)
        res.setHeader('Content-Type', getMimeType(smbPath))
        res.setHeader('Content-Disposition', (inline ? 'inline' : 'attachment') + '; filename="' + smbFname + '"; filename*=UTF-8\'\'' + safeSmbName)
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
      const pbFname   = doc.ELDVD_DateinameUser || 'dokument'
      const safePbName = encodeURIComponent(pbFname)
      res.setHeader('Content-Type', doc.ELDVD_MimeType || 'application/octet-stream')
      res.setHeader('Content-Disposition', (inline ? 'inline' : 'attachment') + '; filename="' + pbFname + '"; filename*=UTF-8\'\'' + safePbName)
      res.send(data)
    })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── POST /api/documents/upload ────────────────────────────────────────────
router.post('/upload', authMiddleware, uploadMiddleware, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'Keine Datei' })
    if (getMode() === 'powerbird') return res.status(403).json({ error: 'Upload im Powerbird-Modus nicht verfügbar' })

    const freshFeat    = getUserFeatures(req.user.id)
    const canUpload    = freshFeat.docs_upload || freshFeat.docs_upload_all
    if (!canUpload) return res.status(403).json({ error: 'Keine Upload-Berechtigung' })
    const canUploadAll = freshFeat.docs_upload_all
    const category     = req.body.category || 'Allgemein'
    const baseDir      = getBaseDir()

    // Ziel-User bestimmen
    const mode = getMode()
    let targetKuerzels = []
    if (canUploadAll && req.body.target_user_ids) {
      const ids = req.body.target_user_ids.split(',').map(s => s.trim()).filter(Boolean)
      for (const id of ids) {
        const u = localDb.db.prepare('SELECT * FROM users WHERE id = ?').get(parseInt(id))
        if (u) {
          // SMB: Ordner nach Name, Lokal: Kürzel
          targetKuerzels.push(mode === 'smb' ? getUserFolderName(u) : getUserKuerzel(u))
        }
      }
    }
    // Fallback: eigenes Verzeichnis
    if (targetKuerzels.length === 0) {
      targetKuerzels = [mode === 'smb' ? getUserFolderName(req.user) : getUserKuerzel(req.user)]
    }

    let count = 0

    if (mode === 'smb') {
      // SMB-Upload: direkt ins Netzlaufwerk schreiben
      const smbInfo = getSmbClient()
      if (!smbInfo) return res.status(500).json({ error: 'SMB nicht konfiguriert' })
      const { smb2, basePath } = smbInfo
      try {
        for (const kuerzel of targetKuerzels) {
          for (const file of req.files) {
            await smbSaveFile(smb2, file.buffer, file.originalname, kuerzel, category, basePath)
            count++
          }
        }
      } finally {
        try { smb2.close() } catch(e) {}
      }
    } else {
      // Lokaler Modus: ins Dateisystem schreiben
      for (const kuerzel of targetKuerzels) {
        for (const file of req.files) {
          saveFile(file.buffer, file.originalname, kuerzel, category, baseDir)
          count++
        }
      }
    }

    res.json({ success: true, count })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── DELETE /api/documents/local/:id (lokal) oder /api/documents/smb/:id ─
router.delete('/local/:id', authMiddleware, (req, res) => {
  try {
    if (getMode() === 'powerbird') return res.status(403).json({ error: 'Im Powerbird-Modus nicht verfügbar' })
    const freshFeatDel = getUserFeatures(req.user.id)
    const canDel = freshFeatDel.docs_manage || freshFeatDel.docs_upload || freshFeatDel.docs_upload_all

    const fsPath  = Buffer.from(req.params.id, 'base64').toString()
    const baseDir = getBaseDir()

    // Lokale Datei
    if (fsPath.startsWith(baseDir)) {
      if (!fs.existsSync(fsPath)) return res.status(404).json({ error: 'Nicht gefunden' })
      const kuerzel = getUserKuerzel(req.user)
      const isOwner = fsPath.includes(pathMod.sep + kuerzel + pathMod.sep)
      if (!isOwner && !freshFeatDel.docs_manage) return res.status(403).json({ error: 'Kein Zugriff' })
      fs.unlinkSync(fsPath)
      return res.json({ success: true })
    }

    return res.status(404).json({ error: 'Nicht gefunden' })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── DELETE /api/documents/smb/:id ─────────────────────────────────────────
router.delete('/smb/:id', authMiddleware, async (req, res) => {
  try {
    if (getMode() === 'powerbird') return res.status(403).json({ error: 'Im Powerbird-Modus nicht verfügbar' })
    const freshFeat = getUserFeatures(req.user.id)
    if (!freshFeat.docs_manage && !freshFeat.docs_upload && !freshFeat.docs_upload_all)
      return res.status(403).json({ error: 'Keine Berechtigung' })

    const smbPath = Buffer.from(req.params.id, 'base64').toString()
    console.log('[SMB DELETE] path:', JSON.stringify(smbPath))
    const smbInfo = getSmbClient()
    if (!smbInfo) return res.status(500).json({ error: 'SMB nicht konfiguriert' })
    const { smb2 } = smbInfo

    // Erst prüfen ob Datei existiert
    const exists = await new Promise(resolve => {
      smb2.exists(smbPath, (err, ex) => resolve(!err && ex))
    })
    console.log('[SMB DELETE] exists:', exists)

    if (!exists) {
      try { smb2.close() } catch(e) {}
      return res.status(404).json({ error: 'Datei nicht auf dem Server gefunden: ' + smbPath })
    }

    // unlink mit Timeout - STATUS_PENDING hängt manchmal
    const unlinkResult = await Promise.race([
      new Promise((resolve) => {
        smb2.unlink(smbPath, (err) => {
          if (err) {
            console.log('[SMB DELETE] unlink err:', err.code, err.message)
            resolve({ err })
          } else {
            resolve({ err: null })
          }
        })
      }),
      new Promise(resolve => setTimeout(() => resolve({ timeout: true }), 5000))
    ])

    console.log('[SMB DELETE] unlink result:', JSON.stringify(unlinkResult))

    // Nach dem Löschen prüfen ob Datei noch existiert
    const stillExists = await new Promise(resolve => {
      smb2.exists(smbPath, (err, ex) => resolve(!err && ex))
    })

    try { smb2.close() } catch(e) {}
    console.log('[SMB DELETE] still exists after unlink:', stillExists)

    if (stillExists) {
      return res.status(500).json({ error: 'Datei konnte nicht gelöscht werden' })
    }

    res.json({ success: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})


// GET /api/documents/manage/:userId - Dokumente eines anderen Users (für Admins/Manage-Rolle)
router.get('/manage/:userId', authMiddleware, async (req, res) => {
  try {
    if (getMode() === 'powerbird') return res.status(403).json({ error: 'Im Powerbird-Modus nicht verfügbar' })
    const freshFeatM = getUserFeatures(req.user.id)
    const canManage  = freshFeatM.docs_manage
    if (!canManage) return res.status(403).json({ error: 'Keine Berechtigung' })

    const targetUser = localDb.db.prepare('SELECT * FROM users WHERE id = ?').get(parseInt(req.params.userId))
    if (!targetUser) return res.status(404).json({ error: 'Benutzer nicht gefunden' })

    const mode    = getMode()
    const baseDir = getBaseDir()
    const kuerzel = mode === 'smb' ? getUserFolderName(targetUser) : getUserKuerzel(targetUser)

    if (mode === 'local') {
      const docs = readLocalDocs(baseDir, kuerzel, true)
      const cats = {}
      getCategories().forEach(c => { cats[c] = c })
      docs.forEach(d => { if (d.kategorieKey) cats[d.kategorieKey] = d.kategorieKey })
      return res.json({ documents: docs, categories: cats, mode: 'local', canUpload: true, canUploadAll: true })
    }

    if (mode === 'smb') {
      const smbInfo = getSmbClient()
      if (!smbInfo) return res.json({ documents: [], categories: {}, mode: 'smb', canUpload: true, canUploadAll: true })
      const { smb2, basePath } = smbInfo

      const tryReaddir = (p) => new Promise((resolve) => {
        smb2.readdir(p || '', (err, files) => { resolve(err ? null : (files || [])) })
      })

      const documents = []
      const allCats   = {}

      try {
        const userPath   = basePath ? basePath + '\\' + kuerzel : kuerzel
        const catEntries = await tryReaddir(userPath)

        if (catEntries !== null) {
          for (const catName of catEntries) {
            const catPath  = userPath + '\\' + catName
            const catFiles = await tryReaddir(catPath)
            if (catFiles !== null) {
              allCats[catName] = catName
              for (const file of catFiles) {
                const filePath   = catPath + '\\' + file
                const innerCheck = await tryReaddir(filePath)
                if (innerCheck === null) {
                  documents.push({
                    id:           'smb_' + Buffer.from(filePath).toString('base64'),
                    dateiname:    file,
                    mimeType:     getMimeType(file),
                    kategorieKey: catName,
                    datum:        new Date().toISOString(),
                    smbPath:      filePath,
                  })
                }
              }
            }
          }
        }
      } catch(e) { console.log('SMB manage readdir error:', e.message) }
      try { smb2.close() } catch(e) {}

      getCategories().forEach(c => { allCats[c] = c })
      return res.json({ documents, categories: allCats, mode: 'smb', canUpload: true, canUploadAll: true })
    }

    res.json({ documents: [], categories: {}, mode, canUpload: true, canUploadAll: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
