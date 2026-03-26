const router = require('express').Router();
const { adminMiddleware } = require('../middleware/auth');
const localDb = require('../db/localDb');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || '/data';
const LOGO_DIR = path.join(DATA_DIR, 'logos');
if (!fs.existsSync(LOGO_DIR)) fs.mkdirSync(LOGO_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, LOGO_DIR),
  filename: (req, file, cb) => {
    const type = req.params.type; // 'logo' or 'favicon'
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${type}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Nur Bilddateien erlaubt (PNG, JPG, SVG, ICO)'));
  },
});

// POST /api/upload/:type (logo or favicon)
router.post('/:type', adminMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    const type = req.params.type;
    const url = `/api/upload/serve/${req.file.filename}`;
    if (type === 'logo') localDb.setSetting('logo_url', url);
    if (type === 'favicon') localDb.setSetting('favicon_url', url);
    res.json({ success: true, url });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/upload/serve/:filename - serve uploaded files (public)
router.get('/serve/:filename', (req, res) => {
  const filePath = path.join(LOGO_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
  res.sendFile(filePath);
});

// DELETE /api/upload/:type
router.delete('/:type', adminMiddleware, (req, res) => {
  const type = req.params.type;
  const setting = type === 'logo' ? 'logo_url' : 'favicon_url';
  const current = localDb.getSetting(setting);
  if (current && current.startsWith('/api/upload/serve/')) {
    const filename = path.basename(current);
    const filePath = path.join(LOGO_DIR, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  localDb.setSetting(setting, '');
  res.json({ success: true });
});

module.exports = router;
