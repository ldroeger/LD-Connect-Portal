const nodemailer = require('nodemailer');
const localDb = require('../db/localDb');

function getTransporter() {
  const host = localDb.getSetting('smtp_host');
  const port = parseInt(localDb.getSetting('smtp_port') || '587');
  const user = localDb.getSetting('smtp_user');
  const pass = localDb.getSetting('smtp_password');

  if (!host) {
    console.warn('SMTP nicht konfiguriert - E-Mail wird nicht versendet');
    return null;
  }

  return nodemailer.createTransport({
    host, port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
    tls: { rejectUnauthorized: false },
  });
}

async function sendMail(to, subject, html) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[DEV] E-Mail nicht versendet (SMTP fehlt). An: ${to}, Betreff: ${subject}`);
    return;
  }
  const from = localDb.getSetting('smtp_from') || localDb.getSetting('smtp_user');
  await transporter.sendMail({ from, to, subject, html });
}

async function sendInvitation(email, name, link) {
  const company = localDb.getSetting('company_name') || 'Powerbird';
  const primary = localDb.getSetting('primary_color') || '#2563EB';
  
  await sendMail(email, `Einladung zu ${company} - Kalender Portal`, `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px;">
        <h2 style="color: ${primary};">${company} – Kalender Portal</h2>
        <p>Hallo ${name},</p>
        <p>Sie wurden eingeladen, das ${company} Mitarbeiter-Portal zu nutzen.</p>
        <p>Bitte klicken Sie auf den folgenden Link, um Ihr Passwort festzulegen:</p>
        <a href="${link}" style="display:inline-block;background:${primary};color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0;">
          Passwort festlegen
        </a>
        <p style="color: #888; font-size: 12px;">Dieser Link ist 7 Tage gültig. Falls Sie diese E-Mail nicht erwartet haben, können Sie sie ignorieren.</p>
      </div>
    </body>
    </html>
  `);
}

async function sendPasswordReset(email, name, link) {
  const company = localDb.getSetting('company_name') || 'Powerbird';
  const primary = localDb.getSetting('primary_color') || '#2563EB';

  await sendMail(email, `Passwort zurücksetzen – ${company}`, `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px;">
        <h2 style="color: ${primary};">${company} – Passwort zurücksetzen</h2>
        <p>Hallo ${name},</p>
        <p>Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.</p>
        <a href="${link}" style="display:inline-block;background:${primary};color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0;">
          Passwort zurücksetzen
        </a>
        <p style="color: #888; font-size: 12px;">Dieser Link ist 2 Stunden gültig. Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.</p>
      </div>
    </body>
    </html>
  `);
}

module.exports = { sendMail, sendInvitation, sendPasswordReset };
