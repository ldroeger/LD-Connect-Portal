const jwt = require('jsonwebtoken');
const localDb = require('../db/localDb');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Bekannte Platzhalter-Secrets gelten als nicht gesetzt, sonst könnte jeder gültige Tokens erzeugen
const DEFAULT_SECRETS = ['', 'powerbird-secret-change-in-production', 'bitte-aendern-openssl-rand-hex-32'];

function loadJwtSecret() {
  const fromEnv = (process.env.JWT_SECRET || '').trim();
  if (!DEFAULT_SECRETS.includes(fromEnv)) return fromEnv;
  // Kein eigenes Secret gesetzt: zufälliges Secret einmalig erzeugen und im Datenverzeichnis ablegen
  const file = path.join(process.env.DATA_DIR || '/data', 'jwt_secret');
  try {
    const saved = fs.readFileSync(file, 'utf8').trim();
    if (saved.length >= 32) return saved;
  } catch(e) {}
  const secret = crypto.randomBytes(48).toString('hex');
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, secret, { mode: 0o600 });
    console.warn('[auth] JWT_SECRET nicht gesetzt - zufälliges Secret erzeugt in ' + file);
  } catch(e) {
    console.warn('[auth] JWT_SECRET nicht gesetzt und ' + file + ' nicht schreibbar - Secret gilt nur bis zum Neustart');
  }
  return secret;
}

const JWT_SECRET = loadJwtSecret();

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Nicht authentifiziert' });
  }
  verifyToken(header.slice(7), req, res, next);
}

// Für Links und <img>-Tags, die keinen Authorization-Header senden können: Token auch als ?token=
function authMiddlewareWithQueryToken(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return verifyToken(header.slice(7), req, res, next);
  if (typeof req.query.token === 'string' && req.query.token) return verifyToken(req.query.token, req, res, next);
  return res.status(401).json({ error: 'Nicht authentifiziert' });
}

function verifyToken(token, req, res, next) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Verify user still exists and is active
    const user = localDb.db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(decoded.userId);
    if (!user) return res.status(401).json({ error: 'Benutzer nicht gefunden' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token ungültig oder abgelaufen' });
  }
}

function adminMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Keine Administratorrechte' });
    }
    next();
  });
}

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '12h' });
}

module.exports = { authMiddleware, authMiddlewareWithQueryToken, adminMiddleware, generateToken, JWT_SECRET };
