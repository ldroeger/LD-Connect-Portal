const router = require('express').Router()
const { authMiddleware } = require('../middleware/auth')
const localDb = require('../db/localDb')

// GET /api/tools/image?path=\\server\share\file.jpg
// Reads image directly via SMB2 protocol - no system mount needed
router.get('/image', async (req, res) => {
  try {
    const imgPath = req.query.path
    if (!imgPath) return res.status(400).json({ error: 'Kein Pfad' })

    const smbUser = localDb.getSetting('smb_user') || ''
    const smbPass = localDb.getSetting('smb_password') || ''
    const smbServer = localDb.getSetting('smb_server') || ''

    if (!smbUser || !smbPass || !smbServer) {
      return res.status(503).json({ error: 'SMB nicht konfiguriert' })
    }

    // Parse server and share from stored server setting
    // smbServer format: //192.168.13.20/Pictures or \\192.168.13.20\Pictures
    const normalized = smbServer.replace(/\\/g, '/').replace(/^\/\//, '')
    const parts = normalized.split('/')
    const host = parts[0]
    const share = parts[1] || ''

    // Get relative file path from the full UNC path
    // imgPath: \\192.168.13.20\Pictures\subfolder\file.jpg
    const normalizedImg = imgPath.replace(/\\/g, '/')
    const imgParts = normalizedImg.replace(/^\/\//, '').split('/')
    // imgParts[0]=server, imgParts[1]=share, rest=file path
    const filePath = imgParts.slice(2).join('\\')

    const SMB2 = require('@marsaud/smb2')
    const smb2Client = new SMB2({
      share: `\\\\${host}\\${share}`,
      domain: '',
      username: smbUser,
      password: smbPass,
      autoCloseTimeout: 5000,
    })

    smb2Client.readFile(filePath, (err, data) => {
      smb2Client.close()
      if (err) {
        console.error('SMB read error:', err.message)
        return res.status(404).json({ error: 'Bild nicht gefunden', detail: err.message })
      }

      const ext = filePath.split('.').pop().toLowerCase()
      const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }[ext] || 'image/jpeg'

      res.setHeader('Content-Type', mime)
      res.setHeader('Cache-Control', 'public, max-age=3600')
      res.send(data)
    })
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
