// Lizenzprüfung gegen das Lizenzportal (siehe LIZENZ.md).
// Solange LICENSE_ENFORCE nicht "true" ist, wird nichts gesperrt – der Status wird nur angezeigt.
// Feature-Codes von LD Connect: calendar, hours, vacation, news, todos, documents, sick, manager, tools, display, app
const express = require('express');
const path = require('path');
const { LicenseClient, LicenseError } = require('../utils/license-client.cjs');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { version } = require('../package.json');

const PRODUCT_CODE = 'ld-connect';
// Fest für jede Installation; die Umgebungsvariablen überschreiben sie nur (z. B. für Tests)
const LICENSE_SERVER = 'https://lizenzen.lukasdroeger.de';
const LICENSE_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAWtLCXvhBUKDXiqIfw2e4CmmX7hu6ECNGl/XwhPGYrXg=\n-----END PUBLIC KEY-----\n';
const enforce = () => process.env.LICENSE_ENFORCE === 'true';

const license = new LicenseClient({
  product: PRODUCT_CODE,
  serverUrl: process.env.LICENSE_SERVER_URL || LICENSE_SERVER,
  stateFile: process.env.LICENSE_STATE_FILE || path.join(process.env.DATA_DIR || '/data', 'license.json'),
  publicKey: process.env.LICENSE_PUBLIC_KEY || LICENSE_PUBLIC_KEY,
  version,
  logger: { info: console.log, warn: console.warn },
});

async function startLicense() {
  license.onChange(s => console.log(`Lizenz: ${s.state}${s.reason ? ` (${s.reason})` : ''}${s.license ? ` – ${s.license.plan}` : ''}`));
  try {
    const s = await license.init();
    if (s.state !== 'valid') console.warn(`Keine gültige Lizenz (${s.reason || s.state})${enforce() ? '' : ' – wird nicht durchgesetzt'}`);
  } catch (e) {
    console.warn('Lizenzprüfung beim Start fehlgeschlagen:', e.message);
  }
}

// Darf die Funktion genutzt werden? Ohne Durchsetzung immer ja.
const licenseAllows = feature => !enforce() || license.hasFeature(feature);
// Grenzwert, z. B. licenseLimit('users'); undefined = unbegrenzt bzw. nicht durchgesetzt
const licenseLimit = name => (enforce() ? license.limit(name) : undefined);
// Middleware für Routen einer lizenzpflichtigen Funktion: router.use(requireFeature('tools'))
const requireFeature = feature => (req, res, next) =>
  licenseAllows(feature) ? next() : res.status(402).json({ error: `Diese Funktion ist in der Lizenz nicht enthalten (${feature})`, code: 'license_feature' });

function statusDto(s = license.status()) {
  const l = s.license;
  return {
    server: process.env.LICENSE_SERVER_URL || LICENSE_SERVER,
    enforce: enforce(),
    state: s.state,
    reason: s.reason || null,
    message: s.message || null,
    offline: !!s.offline,
    lastCheck: s.lastCheck || null,
    instanceId: s.instanceId,
    license: l ? {
      key: l.key, plan: l.plan, licensee: l.licensee, features: l.features, limits: l.limits,
      addons: l.addons || [], trial: l.trial, validUntil: l.validUntil, leaseUntil: l.leaseUntil,
    } : null,
  };
}

const router = express.Router();

const handle = fn => async (req, res) => {
  try {
    res.json(statusDto(await fn(req)));
  } catch (e) {
    if (e instanceof LicenseError) return res.status(400).json({ error: e.message, code: e.code });
    res.status(500).json({ error: e.message });
  }
};

// Status für alle angemeldeten Benutzer (z. B. um Module im Frontend auszublenden), Änderungen nur für Admins
router.get('/', authMiddleware, (_req, res) => res.json(statusDto()));
router.post('/activate', adminMiddleware, handle(req => license.activate(String(req.body?.key || ''))));
router.post('/refresh', adminMiddleware, handle(() => license.refresh()));
router.post('/offline', adminMiddleware, handle(async req => license.importOfflineToken(String(req.body?.token || ''))));
router.post('/deactivate', adminMiddleware, handle(async () => { await license.deactivate(); return license.status(); }));

module.exports = { router, license, startLicense, licenseAllows, licenseLimit, requireFeature };
