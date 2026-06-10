const router = require('express').Router()
const localDb = require('../db/localDb')

// GET /api/tools/image?path=\\server\share\file.jpg
router.get('/image', async (req, res) => {
  try {
    const imgPath = req.query.path
    if (!imgPath) return res.status(400).json({ error: 'Kein Pfad' })

    const smbUser   = localDb.getSetting('smb_user') || ''
    const smbPass   = localDb.getSetting('smb_password') || ''
    // smb_host + smb_server für Werkzeugbilder
    const smbHost   = localDb.getSetting('smb_host') || ''
    let smbServer   = localDb.getSetting('smb_server') || ''
    // Falls smb_server leer aber smb_host gesetzt: Fehler
    if (!smbServer && smbHost) {
      return res.status(503).json({ error: 'Werkzeug-Freigabe nicht konfiguriert (smb_server fehlt)' })
    }
    const smbDomain = localDb.getSetting('smb_domain') || 'WORKGROUP'

    if (!smbServer) return res.status(503).json({ error: 'SMB nicht konfiguriert' })

    // Parse host and share from smb_server: //192.168.13.20/Pictures
    const normalized = smbServer.replace(/\\/g, '/').replace(/^\/+/, '')
    const parts = normalized.split('/').filter(Boolean)
    const host  = parts[0]
    const share = parts[1] || ''

    if (!host || !share) return res.status(503).json({ error: 'SMB-Pfad ungueltig: ' + smbServer })

    // imgPath kann sein: \\192.168.13.20\Pictures\Powerbird\file.jpg
    // oder: \\server\share\unterordner\file.jpg
    // Wir extrahieren alles nach host/share als relativen Pfad
    const normalizedImg = imgPath.replace(/\\/g, '/')
    const cleanImg = normalizedImg.replace(/^\/+/, '')
    const imgParts = cleanImg.split('/').filter(Boolean)

    // Wenn imgParts[0] == host und imgParts[1] == share -> ab imgParts[2]
    let filePath
    if (imgParts.length >= 2 && imgParts[0].toLowerCase() === host.toLowerCase()) {
      filePath = imgParts.slice(2).join('\\')
    } else if (imgParts.length >= 1 && imgParts[0].toLowerCase() === share.toLowerCase()) {
      filePath = imgParts.slice(1).join('\\')
    } else {
      filePath = imgParts.join('\\')
    }

    if (!filePath) return res.status(400).json({ error: 'Leerer Dateipfad aus: ' + imgPath })
    console.log('SMB image request - server:', smbServer, 'host:', host, 'share:', share, 'file:', filePath)

    const SMB2 = require('@marsaud/smb2')
    const smb2Client = new SMB2({
      share: '\\\\' + host + '\\' + share,
      domain: smbDomain,
      username: smbUser,
      password: smbPass,
      autoCloseTimeout: 0,
    })

    smb2Client.readFile(filePath, (err, data) => {
      try { smb2Client.close() } catch(e2) {}
      if (err) {
        console.error('SMB image error:', err.message, 'path:', filePath)
        return res.status(404).json({ error: 'Bild nicht gefunden', detail: err.message })
      }
      const ext  = (filePath.split('.').pop() || '').toLowerCase()
      const mime = { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', gif:'image/gif', webp:'image/webp' }[ext] || 'image/jpeg'
      res.setHeader('Content-Type', mime)
      res.setHeader('Cache-Control', 'public, max-age=3600')
      res.send(data)
    })
  } catch(e) {
    console.error('SMB error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
