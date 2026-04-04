require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1); // Trust reverse proxy (nginx)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // needed for React
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https://exp.host"],
    }
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl) or same-network origins
    if (!origin) return callback(null, true);
    callback(null, true); // Allow all - restrict further via firewall/nginx
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Strict rate limit for auth endpoints
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: { error: 'Zu viele Anmeldeversuche. Bitte 15 Minuten warten.' },
  standardHeaders: true, legacyHeaders: false,
}));
app.use('/api/auth/forgot-password', rateLimit({
  windowMs: 60 * 60 * 1000, max: 5,
  message: { error: 'Zu viele Anfragen.' },
}));

// General rate limit
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

const db = require('./db/localDb');
db.initialize();

app.use('/api/setup',    require('./routes/setup'));
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/calendar', require('./routes/calendar'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/admin',    require('./routes/admin'));
app.use('/api/branding', require('./routes/branding'));
app.use('/api/vacation', require('./routes/vacation'));
app.use('/api/push',    require('./routes/push').router);
app.use('/api/display',  require('./routes/display'));
app.use('/api/upload',   require('./routes/upload'));
app.use('/api/tools',    require('./routes/smb-image'));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Appointment Reminder Cron ───────────────────────────────────────────────
const { sendPush } = require('./routes/push');
const pbDb = require('./db/powerbirdDb');

async function checkUpcomingAppointments() {
  try {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 60 * 1000);
    const in31 = new Date(now.getTime() + 31 * 60 * 1000);

    // Find appointments starting in ~30 minutes
    const r = await pbDb.query(
      `SELECT RecNo, Termin_Label, Termin_ResourceName, Termin_Start, TER_KurzinfoTermin
       FROM HWTER
       WHERE Termin_Start >= @from AND Termin_Start < @to
         AND Termin_ResourceName IS NOT NULL`,
      { from: in30.toISOString(), to: in31.toISOString() }
    );

    for (const appt of (r.recordset || [])) {
      // Find user by powerbird_id (Termin_ResourceName)
      const user = localDb.db.prepare(
        'SELECT id FROM users WHERE powerbird_id = ? AND is_active = 1'
      ).get(appt.Termin_ResourceName);
      if (!user) continue;

      const tokens = localDb.db.prepare(
        'SELECT token FROM push_tokens WHERE user_id = ?'
      ).all(user.id).map(r => r.token);

      const time = new Date(appt.Termin_Start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      await sendPush(
        tokens,
        `⏰ Termin in 30 Min`,
        `${appt.Termin_Label || appt.TER_KurzinfoTermin || 'Termin'} um ${time}`,
        { screen: 'Kalender', type: 'appointment', recno: appt.RecNo }
      );
    }
  } catch(e) {
    console.error('Appointment reminder error:', e.message);
  }
}

// Run every minute
setInterval(checkUpcomingAppointments, 60 * 1000);
// ─────────────────────────────────────────────────────────────────────────────

// Global error handler - don't leak internal errors
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message)
  res.status(500).json({ error: 'Interner Serverfehler' })
})

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`LD Connect Backend running on port ${PORT}`));
