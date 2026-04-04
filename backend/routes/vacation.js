const router = require('express').Router();
const { sendPush, getTokensForUser, getApproverTokens } = require('./push');
const { authMiddleware } = require('../middleware/auth');
const localDb = require('../db/localDb');
const pbDb = require('../db/powerbirdDb');
const mailer = require('../utils/mailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || '/data';
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

function canApprove(user) {
  return user.role === 'admin' || user.role === 'vacation_approver';
}

function workdays(from, to) {
  let count = 0;
  const cur = new Date(from);
  const end = new Date(to);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// Auto-approve: checks Powerbird for vacation entries matching pending requests
async function autoApprovePendingRequests(powerbird_id, user_id) {
  try {
    const pending = localDb.db.prepare(
      `SELECT * FROM vacation_requests WHERE user_id = ? AND status = 'pending'`
    ).all(user_id);
    if (pending.length === 0) return;

    // Get all vacation dates from Powerbird (entries with Urlaub label)
    const r = await pbDb.query(
      `SELECT Termin_Start, Termin_Ende FROM HWTER
       WHERE Termin_ResourceName = @uid
         AND (Geloescht IS NULL OR Geloescht = 0)
         AND Termin_Label LIKE '%Urlaub%'
       ORDER BY Termin_Start ASC`,
      { uid: powerbird_id }
    );

    // Build set of all vacation dates in Powerbird
    const pbDates = new Set();
    r.recordset.forEach(x => {
      const cur = new Date(x.Termin_Start);
      const end = new Date(x.Termin_Ende || x.Termin_Start);
      while (cur <= end) {
        pbDates.add(cur.toISOString().split('T')[0]);
        cur.setDate(cur.getDate() + 1);
      }
    });

    // Check each pending request
    for (const req of pending) {
      const cur = new Date(req.from_date);
      const end = new Date(req.to_date);
      let allFound = true;
      let hasWorkday = false;
      while (cur <= end) {
        const dow = cur.getDay();
        if (dow !== 0 && dow !== 6) {
          hasWorkday = true;
          if (!pbDates.has(cur.toISOString().split('T')[0])) {
            allFound = false;
            break;
          }
        }
        cur.setDate(cur.getDate() + 1);
      }
      if (allFound && hasWorkday) {
        localDb.db.prepare(
          `UPDATE vacation_requests SET status='approved', updated_at=unixepoch() WHERE id=?`
        ).run(req.id);
        // Notify user
        try {
          const user = localDb.db.prepare('SELECT * FROM users WHERE id=?').get(user_id);
          const company = localDb.getSetting('company_name') || 'Powerbird';
          await mailer.sendMail(user.email, `Urlaubsantrag automatisch genehmigt – ${company}`,
            `<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
            <div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;padding:40px">
              <h2 style="color:#10B981">Urlaubsantrag genehmigt</h2>
              <p>Hallo ${user.name},</p>
              <p>Ihr Urlaubsantrag wurde automatisch genehmigt, da der Urlaub in Powerbird eingetragen wurde.</p>
              <p><strong>Zeitraum:</strong> ${new Date(req.from_date).toLocaleDateString('de-DE')} – ${new Date(req.to_date).toLocaleDateString('de-DE')}</p>
              <p><strong>Arbeitstage:</strong> ${req.days}</p>
            </div></body>`
          );
          // Send push notification
          try {
            const tokens = getTokensForUser(user_id);
            await sendPush(tokens,
              'Urlaub automatisch genehmigt ✓',
              `Ihr Urlaub vom ${new Date(req.from_date).toLocaleDateString('de-DE')} – ${new Date(req.to_date).toLocaleDateString('de-DE')} wurde genehmigt.`
            );
          } catch(e) {}
        } catch(e) {}
        console.log(`Auto-approved vacation request ${req.id} for user ${user_id}`);
      }
    }
  } catch(e) {
    console.error('Auto-approve error:', e.message);
  }
}

// Urlaubsdaten aus LOURL
async function getUrlaubFromLOURL(powerbird_id, year) {
  try {
    const r = await pbDb.query(
      `SELECT URL_AnspruchGesamt, URL_RestanspruchVorjahr, URL_AnspruchLfdJahr,
              URL_UrlaubGenommen, URL_UrlaubGenehmigt, URL_UrlaubBeantragt,
              URL_UrlaubOffen, URL_UrlaubGeplant, URL_Verfall
       FROM LOURL
       WHERE URL_MitarbeiterNr = @uid AND URL_Jahr = @year
       ORDER BY URL_Periode DESC`,
      { uid: powerbird_id, year: parseInt(year) }
    );
    if (r.recordset.length === 0) return null;
    const row = r.recordset[0];
    return {
      anspruch:  row.URL_AnspruchGesamt,
      genommen:  row.URL_UrlaubGenommen,
      genehmigt: row.URL_UrlaubGenehmigt,
      beantragt: row.URL_UrlaubBeantragt,
      offen:     row.URL_UrlaubOffen,
      geplant:   row.URL_UrlaubGeplant,
      verfall:   row.URL_Verfall,
      vorjahr:   row.URL_RestanspruchVorjahr,
    };
  } catch(e) {
    console.error('LOURL error:', e.message);
    return null;
  }
}

// GET /api/vacation/stats
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const year = parseInt(req.query.year || new Date().getFullYear());
    const u = req.user;

    // Auto-approve pending requests that are now in Powerbird
    await autoApprovePendingRequests(u.powerbird_id, u.id);

    const lourl = await getUrlaubFromLOURL(u.powerbird_id, year);

    const pending = localDb.db.prepare(
      `SELECT COUNT(*) as cnt, SUM(days) as total_days
       FROM vacation_requests WHERE user_id = ? AND status = 'pending'`
    ).get(u.id);

    let eintraege = [];
    try {
      const r = await pbDb.query(
        `SELECT Termin_Start, Termin_Ende, Termin_Label FROM HWTER
         WHERE Termin_ResourceName = @uid
           AND YEAR(Termin_Start) = @year
           AND (Geloescht IS NULL OR Geloescht = 0)
           AND Termin_Label LIKE '%Urlaub%'
         ORDER BY Termin_Start ASC`,
        { uid: u.powerbird_id, year }
      );
      eintraege = r.recordset.map(x => ({ von: x.Termin_Start, bis: x.Termin_Ende, label: x.Termin_Label }));
    } catch(e) {}

    res.json({
      year,
      anspruch:       lourl?.anspruch  ?? null,
      vorjahr:        lourl?.vorjahr   ?? null,
      genehmigt_tage: lourl?.genehmigt ?? 0,
      genommen_tage:  lourl?.genommen  ?? 0,
      geplant_tage:   lourl?.geplant   ?? 0,
      offen_tage:     lourl?.offen     ?? null,
      verfall:        lourl?.verfall   ?? null,
      beantragt_tage: pending.total_days || 0,
      beantragt_anz:  pending.cnt        || 0,
      eintraege,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/vacation/requests
router.get('/requests', authMiddleware, (req, res) => {
  const reqs = localDb.db.prepare(
    `SELECT r.*, u.name as reviewer_name FROM vacation_requests r
     LEFT JOIN users u ON u.id = r.reviewed_by
     WHERE r.user_id = ? ORDER BY r.created_at DESC`
  ).all(req.user.id);
  res.json({ requests: reqs });
});

// GET /api/vacation/all
router.get('/all', authMiddleware, (req, res) => {
  if (!canApprove(req.user)) return res.status(403).json({ error: 'Keine Berechtigung' });
  const reqs = localDb.db.prepare(
    `SELECT r.*, u.name as user_name, u.email as user_email, u.powerbird_id
     FROM vacation_requests r JOIN users u ON u.id = r.user_id
     ORDER BY r.status ASC, r.from_date ASC`
  ).all();
  res.json({ requests: reqs });
});

// POST /api/vacation/request
router.post('/request', authMiddleware, async (req, res) => {
  try {
    const { from_date, to_date, reason } = req.body;
    if (!from_date || !to_date) return res.status(400).json({ error: 'Von- und Bis-Datum erforderlich' });
    if (new Date(from_date) > new Date(to_date)) return res.status(400).json({ error: 'Von-Datum muss vor Bis-Datum liegen' });
    const days = workdays(from_date, to_date);
    if (days === 0) return res.status(400).json({ error: 'Kein Werktag im gewählten Zeitraum' });

    const result = localDb.db.prepare(
      `INSERT INTO vacation_requests (user_id, from_date, to_date, days, reason) VALUES (?, ?, ?, ?, ?)`
    ).run(req.user.id, from_date, to_date, days, reason || null);

    let termine = [];
    try {
      const tr = await pbDb.query(
        `SELECT Termin_Label, TER_KurzinfoTermin, Termin_Start FROM HWTER
         WHERE Termin_ResourceName = @uid
           AND Termin_Start >= @from AND Termin_Start <= @to
           AND (Geloescht IS NULL OR Geloescht = 0)
         ORDER BY Termin_Start ASC`,
        { uid: req.user.powerbird_id, from: from_date, to: to_date + ' 23:59:59' }
      );
      termine = tr.recordset.map(t => ({ titel: t.Termin_Label || t.TER_KurzinfoTermin || '(Termin)', von: t.Termin_Start }));
    } catch(e) {}

    const approvers = localDb.db.prepare(
      `SELECT * FROM users WHERE (role='admin' OR role='vacation_approver') AND is_active=1`
    ).all();

    const appUrl = localDb.getSetting('app_url') || process.env.APP_URL || 'http://localhost';
    const company = localDb.getSetting('company_name') || 'Powerbird';
    const color = localDb.getSetting('primary_color') || '#2563EB';
    const termineHtml = termine.length > 0
      ? `<p><strong>Bestehende Termine:</strong></p><ul>${termine.map(t => `<li>${new Date(t.von).toLocaleDateString('de-DE')} – ${t.titel}</li>`).join('')}</ul>`
      : '<p>Keine bestehenden Termine im Zeitraum.</p>';

    for (const approver of approvers) {
      await mailer.sendMail(approver.email, `Urlaubsantrag von ${req.user.name} – ${company}`,
        `<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
        <div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;padding:40px">
          <h2 style="color:${color}">Neuer Urlaubsantrag</h2>
          <p><strong>Mitarbeiter:</strong> ${req.user.name}</p>
          <p><strong>Zeitraum:</strong> ${new Date(from_date).toLocaleDateString('de-DE')} – ${new Date(to_date).toLocaleDateString('de-DE')}</p>
          <p><strong>Arbeitstage:</strong> ${days}</p>
          ${reason ? `<p><strong>Begründung:</strong> ${reason}</p>` : ''}
          ${termineHtml}
          <a href="${appUrl}/vacation-approve" style="display:inline-block;background:${color};color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">Antrag bearbeiten</a>
        </div></body>`
      ).catch(() => {});
    }

    // Check auto-approve immediately after creation
    await autoApprovePendingRequests(req.user.powerbird_id, req.user.id);

    // Send push to approvers
    try {
      const approverTokens = getApproverTokens()
      await sendPush(approverTokens,
        'Neuer Urlaubsantrag',
        `${req.user.name}: ${new Date(from_date).toLocaleDateString('de-DE')} – ${new Date(to_date).toLocaleDateString('de-DE')} (${days} Tage)`
      )
    } catch(e) {}
    res.json({ success: true, id: result.lastInsertRowid, days });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/vacation/approve/:id
router.post('/approve/:id', authMiddleware, async (req, res) => {
  if (!canApprove(req.user)) return res.status(403).json({ error: 'Keine Berechtigung' });
  try {
    const vr = localDb.db.prepare('SELECT * FROM vacation_requests WHERE id=?').get(req.params.id);
    if (!vr) return res.status(404).json({ error: 'Antrag nicht gefunden' });
    localDb.db.prepare(
      `UPDATE vacation_requests SET status='approved', reviewed_by=?, reviewed_at=unixepoch(), updated_at=unixepoch() WHERE id=?`
    ).run(req.user.id, vr.id);
    const applicant = localDb.db.prepare('SELECT * FROM users WHERE id=?').get(vr.user_id);
    const company = localDb.getSetting('company_name') || 'Powerbird';
    mailer.sendMail(applicant.email, `Urlaubsantrag genehmigt – ${company}`,
      `<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
      <div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;padding:40px">
        <h2 style="color:#10B981">Urlaubsantrag genehmigt</h2>
        <p>Hallo ${applicant.name},</p>
        <p><strong>Zeitraum:</strong> ${new Date(vr.from_date).toLocaleDateString('de-DE')} – ${new Date(vr.to_date).toLocaleDateString('de-DE')}</p>
        <p><strong>Arbeitstage:</strong> ${vr.days}</p>
      </div></body>`
    ).catch(() => {});
    // Push to applicant
    try {
      const tokens = getTokensForUser(vr.user_id)
      await sendPush(tokens, 'Urlaub genehmigt ✓',
        `Ihr Urlaub vom ${new Date(vr.from_date).toLocaleDateString('de-DE')} – ${new Date(vr.to_date).toLocaleDateString('de-DE')} wurde genehmigt.`
      )
    } catch(e) {}
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/vacation/reject/:id
router.post('/reject/:id', authMiddleware, upload.single('file'), async (req, res) => {
  if (!canApprove(req.user)) return res.status(403).json({ error: 'Keine Berechtigung' });
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: 'Ablehnungsgrund erforderlich' });
    const vr = localDb.db.prepare('SELECT * FROM vacation_requests WHERE id=?').get(req.params.id);
    if (!vr) return res.status(404).json({ error: 'Antrag nicht gefunden' });
    const filePath = req.file ? req.file.filename : null;
    localDb.db.prepare(
      `UPDATE vacation_requests SET status='rejected', rejection_reason=?, rejection_file=?, reviewed_by=?, reviewed_at=unixepoch(), updated_at=unixepoch() WHERE id=?`
    ).run(reason, filePath, req.user.id, vr.id);
    const applicant = localDb.db.prepare('SELECT * FROM users WHERE id=?').get(vr.user_id);
    const company = localDb.getSetting('company_name') || 'Powerbird';
    const appUrl = localDb.getSetting('app_url') || process.env.APP_URL || 'http://localhost';
    await mailer.sendMail(applicant.email, `Urlaubsantrag abgelehnt – ${company}`,
      `<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
      <div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;padding:40px">
        <h2 style="color:#EF4444">Urlaubsantrag abgelehnt</h2>
        <p>Hallo ${applicant.name},</p>
        <p><strong>Zeitraum:</strong> ${new Date(vr.from_date).toLocaleDateString('de-DE')} – ${new Date(vr.to_date).toLocaleDateString('de-DE')}</p>
        <p><strong>Grund:</strong> ${reason}</p>
        ${filePath ? `<p>Anhang verfügbar unter: <a href="${appUrl}/vacation">Urlaubsplanung</a></p>` : ''}
      </div></body>`
    ).catch(() => {});
    // Push to applicant
    try {
      const tokens = getTokensForUser(vr.user_id)
      await sendPush(tokens, 'Urlaubsantrag abgelehnt',
        `Ihr Urlaub vom ${new Date(vr.from_date).toLocaleDateString('de-DE')} wurde abgelehnt: ${reason}`
      )
    } catch(e) {}
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/vacation/file/:filename
// Supports token as query param for direct browser download
router.get('/file/:filename', (req, res) => {
  // Auth: check Bearer header OR token query param
  const { authMiddleware } = require('../middleware/auth');
  const token = req.query.token;
  if (token) {
    const jwt = require('jsonwebtoken');
    const localDb = require('../db/localDb');
    const SECRET = process.env.JWT_SECRET || 'powerbird-secret-change-in-production';
    try {
      const { userId } = jwt.verify(token, SECRET);
      const user = localDb.db.prepare('SELECT * FROM users WHERE id=? AND is_active=1').get(userId);
      if (!user) return res.status(401).json({ error: 'Nicht authentifiziert' });
      const filePath = path.join(UPLOAD_DIR, req.params.filename);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Datei nicht gefunden' });
      return res.download(filePath);
    } catch(e) {
      return res.status(401).json({ error: 'Token ungültig' });
    }
  }
  // Fall back to normal auth middleware
  authMiddleware(req, res, () => {
    const filePath = path.join(UPLOAD_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Datei nicht gefunden' });
    res.download(filePath);
  });
});

module.exports = router;
// This accidentally appended - rewrite the file properly
