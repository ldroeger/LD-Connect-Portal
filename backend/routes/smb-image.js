const router = require('express').Router()
const { authMiddleware } = require('../middleware/auth')
const localDb = require('../db/localDb')
const fs = require('fs')
const path = require('path')

// GET /api/tools/image?path=\\server\share\file.jpg
router.get('/image', authMiddleware, (req, res) => {
  try {
    const imgPath = req.query.path
    if (!imgPath) return res.status(400).json({ error: 'Kein Pfad' })

    const smbMount = localDb.getSetting('smb_mount') || '/mnt/smb'

    // Convert UNC path \\server\share\sub\file.jpg to local path
    let localPath = imgPath
    if (imgPath.startsWith('\\\\') || imgPath.startsWith('//')) {
      const normalized = imgPath.replace(/\\/g, '/')
      // Remove leading // and server/share prefix
      const parts = normalized.replace(/^\/\//, '').split('/')
      // parts[0]=server, parts[1]=share, rest=relative path
      const relativePath = parts.slice(2).join('/')
      localPath = path.join(smbMount, relativePath)
    }

    // Security: prevent path traversal
    const resolved = path.resolve(localPath)
    const mountResolved = path.resolve(smbMount)
    if (!resolved.startsWith(mountResolved)) {
      return res.status(403).json({ error: 'Zugriff verweigert' })
    }

    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'Bild nicht gefunden' })
    }

    const ext = path.extname(resolved).toLowerCase()
    const mime = { '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.gif':'image/gif', '.webp':'image/webp' }[ext] || 'image/jpeg'

    res.setHeader('Content-Type', mime)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    fs.createReadStream(resolved).pipe(res)
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
