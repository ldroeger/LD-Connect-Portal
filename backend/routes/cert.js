const router    = require('express').Router()
const { adminMiddleware } = require('../middleware/auth')
const localDb   = require('../db/localDb')
const fs        = require('fs')
const path      = require('path')
const { exec, execFile } = require('child_process')

const CERT_DIR      = '/data/certs'
const CADDYFILE_PATH = '/data/caddy/Caddyfile.dynamic'
const CADDYFILE_HOST = '/etc/caddy/Caddyfile'

if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR, { recursive: true })
if (!fs.existsSync('/data/caddy')) fs.mkdirSync('/data/caddy', { recursive: true })
// Initial Caddyfile anlegen falls nicht vorhanden
const initialCaddy = '/data/caddy/Caddyfile'
if (!fs.existsSync(initialCaddy)) {
  fs.writeFileSync(initialCaddy, buildCaddyfile())
  console.log('[cert] Initial Caddyfile erstellt:', initialCaddy)
}

function buildCaddyfile() {
  const domain   = localDb.getSetting('ssl_domain')   || ''
  const port     = localDb.getSetting('ssl_port')      || '443'
  const certFile = localDb.getSetting('ssl_cert_file') || ''
  const keyFile  = localDb.getSetting('ssl_key_file')  || ''
  const httpPort = localDb.getSetting('ssl_http_port') || '80'
  const httpsEnabled = certFile && keyFile && fs.existsSync(certFile) && fs.existsSync(keyFile)

  let cfg = `{
    auto_https off
}

`
  // HTTP
  cfg += `:${httpPort} {
    encode gzip
    request_body {
        max_size 200MB
    }
    reverse_proxy frontend:80
`
  if (httpsEnabled && domain) {
    cfg += `    redir https://${domain}:${port}{uri} permanent
`
  }
  cfg += `}

`

  // HTTPS
  if (httpsEnabled) {
    const host = domain ? `${domain}:${port}` : `:${port}`
    cfg += `${host} {
    encode gzip
    request_body {
        max_size 200MB
    }
    tls ${certFile} ${keyFile}
    reverse_proxy frontend:80
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        -Server
    }
}
`
  }

  return cfg
}

async function reloadCaddy() {
  const cfg = buildCaddyfile()
  // Caddyfile schreiben - wird von Caddy-Container über app-data Volume gelesen
  const outPath = '/data/caddy/Caddyfile'
  fs.writeFileSync(outPath, cfg)
  console.log('[cert] Caddyfile aktualisiert:', outPath)

  // Caddy neu starten via docker exec (Caddy Admin API ist deaktiviert)
  // Wir signalisieren Caddy via SIGUSR1 oder warten auf caddy reload
  return new Promise((resolve) => {
    // Kurz warten damit Caddy das File lesen kann
    setTimeout(resolve, 500)
  })
}

// GET /api/cert/status
router.get('/status', adminMiddleware, (req, res) => {
  const certFile = localDb.getSetting('ssl_cert_file') || ''
  const keyFile  = localDb.getSetting('ssl_key_file')  || ''
  const domain   = localDb.getSetting('ssl_domain')    || ''
  const port     = localDb.getSetting('ssl_port')      || '443'
  const httpPort = localDb.getSetting('ssl_http_port') || '80'

  let certInfo = null
  if (certFile && fs.existsSync(certFile)) {
    try {
      const out = require('child_process').execSync(
        `openssl x509 -in ${certFile} -noout -subject -enddate 2>/dev/null`
      ).toString()
      const expLine = out.match(/notAfter=(.+)/)
      const subjLine = out.match(/subject=(.+)/)
      certInfo = {
        expires: expLine ? expLine[1].trim() : null,
        subject: subjLine ? subjLine[1].trim() : null,
      }
    } catch(e) {}
  }

  res.json({
    httpsEnabled: !!(certFile && keyFile && fs.existsSync(certFile) && fs.existsSync(keyFile)),
    certFile, keyFile, domain, port, httpPort, certInfo
  })
})

// POST /api/cert/upload - Zertifikat hochladen
const multer = require('multer')
const certStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CERT_DIR),
  filename: (req, file, cb) => cb(null, file.fieldname + path.extname(file.originalname))
})
const certUpload = multer({ storage: certStorage, limits: { fileSize: 1024 * 1024 } })

router.post('/upload', adminMiddleware, certUpload.fields([
  { name: 'cert', maxCount: 1 },
  { name: 'key',  maxCount: 1 },
]), async (req, res) => {
  try {
    if (req.files.cert) localDb.setSetting('ssl_cert_file', path.join(CERT_DIR, 'cert' + path.extname(req.files.cert[0].originalname)))
    if (req.files.key)  localDb.setSetting('ssl_key_file',  path.join(CERT_DIR, 'key'  + path.extname(req.files.key[0].originalname)))
    if (req.body.domain)   localDb.setSetting('ssl_domain',   req.body.domain)
    if (req.body.port)     localDb.setSetting('ssl_port',     req.body.port)
    if (req.body.httpPort) localDb.setSetting('ssl_http_port', req.body.httpPort)
    await reloadCaddy()
    res.json({ success: true, message: 'Zertifikat gespeichert und Caddy neu geladen' })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// POST /api/cert/generate - Selbstsigniertes Zertifikat erstellen
router.post('/generate', adminMiddleware, async (req, res) => {
  try {
    const domain = req.body.domain || 'localhost'
    const days   = parseInt(req.body.days) || 3650
    const certOut = path.join(CERT_DIR, 'cert.pem')
    const keyOut  = path.join(CERT_DIR, 'key.pem')

    await new Promise((resolve, reject) => {
      execFile('openssl', [
        'req', '-x509', '-newkey', 'rsa:4096',
        '-keyout', keyOut,
        '-out', certOut,
        '-days', String(days),
        '-nodes',
        '-subj', `/CN=${domain}/O=LD Connect Portal/C=DE`,
        '-addext', `subjectAltName=DNS:${domain},DNS:localhost,IP:127.0.0.1`
      ], { timeout: 30000 }, (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message))
        else resolve()
      })
    })

    localDb.setSetting('ssl_cert_file', certOut)
    localDb.setSetting('ssl_key_file',  keyOut)
    localDb.setSetting('ssl_domain', domain)
    if (req.body.port)     localDb.setSetting('ssl_port',     req.body.port)
    if (req.body.httpPort) localDb.setSetting('ssl_http_port', req.body.httpPort)

    await reloadCaddy()
    res.json({ success: true, message: `Selbstsigniertes Zertifikat für ${domain} erstellt (${days} Tage)`, certFile: certOut })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/cert - HTTPS deaktivieren
router.delete('/', adminMiddleware, async (req, res) => {
  try {
    localDb.setSetting('ssl_cert_file', '')
    localDb.setSetting('ssl_key_file', '')
    await reloadCaddy()
    res.json({ success: true, message: 'HTTPS deaktiviert' })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// GET /api/cert/download-ca - Root-CA für selbstsigniertes Zertifikat
router.get('/download-cert', adminMiddleware, (req, res) => {
  const certFile = localDb.getSetting('ssl_cert_file') || ''
  if (!certFile || !fs.existsSync(certFile))
    return res.status(404).json({ error: 'Kein Zertifikat vorhanden' })
  res.download(certFile, 'ld-connect-portal.crt')
})

module.exports = router
