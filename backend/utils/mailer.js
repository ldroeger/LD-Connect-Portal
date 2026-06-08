const nodemailer = require('nodemailer');
const localDb    = require('../db/localDb');

function getTransporter() {
  const host = localDb.getSetting('smtp_host');
  const port = parseInt(localDb.getSetting('smtp_port') || '587');
  const user = localDb.getSetting('smtp_user');
  const pass = localDb.getSetting('smtp_password');
  if (!host) { console.warn('SMTP nicht konfiguriert'); return null; }
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
    console.log(`[DEV] E-Mail nicht versendet. An: ${to}, Betreff: ${subject}`);
    return;
  }
  const from = localDb.getSetting('smtp_from') || localDb.getSetting('smtp_user');
  await transporter.sendMail({ from, to, subject, html });
}

// ── Gemeinsames HTML-Template ─────────────────────────────────────────────
function buildEmail({ company, primary, logoUrl, appUrl, title, greeting, lines, buttonText, buttonLink, footerNote }) {
  const logoHtml = logoUrl
    ? `<img src="${appUrl || ''}${logoUrl}" alt="${company}" style="max-height:60px;max-width:200px;object-fit:contain;margin-bottom:8px;" />`
    : `<div style="font-size:22px;font-weight:800;color:${primary};">${company}</div>`

  const linesHtml = lines.map(l =>
    l.startsWith('__hr') ? `<hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />`
    : `<p style="margin:8px 0;color:#374151;font-size:15px;line-height:1.6;">${l}</p>`
  ).join('
')

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:580px;" cellpadding="0" cellspacing="0">

        <!-- Header -->
        <tr><td style="background:${primary};border-radius:12px 12px 0 0;padding:28px 36px;text-align:center;">
          ${logoHtml}
          <div style="color:rgba(255,255,255,0.85);font-size:13px;margin-top:4px;">${company}</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:36px 36px 28px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
          <h2 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#111827;">${title}</h2>
          <p style="margin:0 0 16px;color:#374151;font-size:15px;">Hallo ${greeting},</p>
          ${linesHtml}

          ${buttonText && buttonLink ? `
          <!-- Button -->
          <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
            <tr><td style="border-radius:8px;background:${primary};">
              <a href="${buttonLink}"
                 target="_blank"
                 style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;background:${primary};font-family:'Segoe UI',Arial,sans-serif;">
                ${buttonText}
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">
            Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br/>
            <a href="${buttonLink}" style="color:${primary};word-break:break-all;">${buttonLink}</a>
          </p>
          ` : ''}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:20px 36px;text-align:center;">
          <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">${footerNote}</p>
          <p style="margin:8px 0 0;color:#d1d5db;font-size:11px;">${company} · Mitarbeiter-Portal</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function getBaseConfig() {
  return {
    company: localDb.getSetting('company_name') || 'LD Connect',
    primary: localDb.getSetting('primary_color') || '#2563EB',
    logoUrl: localDb.getSetting('logo_url') || '',
    appUrl:  localDb.getSetting('app_url') || '',
  }
}

// ── Passwort zurücksetzen ─────────────────────────────────────────────────
async function sendPasswordReset(email, name, link) {
  const { company, primary, logoUrl, appUrl } = getBaseConfig()
  const html = buildEmail({
    company, primary, logoUrl, appUrl,
    title: 'Passwort zurücksetzen',
    greeting: name,
    lines: [
      'Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts für das Mitarbeiter-Portal gestellt.',
      'Klicken Sie auf den Button, um ein neues Passwort zu vergeben:',
    ],
    buttonText: 'Passwort zurücksetzen',
    buttonLink: link,
    footerNote: 'Dieser Link ist <strong>2 Stunden</strong> gültig. Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren. Ihr Passwort bleibt unverändert.',
  })
  await sendMail(email, `Passwort zurücksetzen – ${company}`, html)
}

// ── Einladung ─────────────────────────────────────────────────────────────
async function sendInvitation(email, name, link) {
  const { company, primary, logoUrl, appUrl } = getBaseConfig()
  const html = buildEmail({
    company, primary, logoUrl, appUrl,
    title: `Willkommen bei ${company}`,
    greeting: name,
    lines: [
      `Sie wurden eingeladen, das <strong>${company} Mitarbeiter-Portal</strong> zu nutzen.`,
      'Bitte legen Sie jetzt Ihr persönliches Passwort fest, um sich anzumelden:',
    ],
    buttonText: 'Passwort festlegen & anmelden',
    buttonLink: link,
    footerNote: 'Dieser Link ist <strong>7 Tage</strong> gültig. Falls Sie diese Einladung nicht erwartet haben, können Sie diese E-Mail ignorieren.',
  })
  await sendMail(email, `Einladung zum Mitarbeiter-Portal – ${company}`, html)
}

// ── Urlaub: Antrag eingegangen (an Genehmiger) ────────────────────────────
async function sendVacationRequest(approverEmail, applicantName, from, to, days, appUrl) {
  const { company, primary, logoUrl } = getBaseConfig()
  const html = buildEmail({
    company, primary, logoUrl, appUrl,
    title: 'Neuer Urlaubsantrag',
    greeting: 'Administrator',
    lines: [
      `<strong>${applicantName}</strong> hat einen Urlaubsantrag gestellt:`,
      `📅 <strong>Zeitraum:</strong> ${from} – ${to} (${days} Tag${days !== 1 ? 'e' : ''})`,
      '__hr',
      'Bitte melden Sie sich im Portal an, um den Antrag zu genehmigen oder abzulehnen.',
    ],
    buttonText: 'Antrag prüfen',
    buttonLink: `${appUrl}/vacation-approve`,
    footerNote: 'Diese E-Mail wurde automatisch vom Mitarbeiter-Portal versendet.',
  })
  await sendMail(approverEmail, `Urlaubsantrag von ${applicantName} – ${company}`, html)
}

// ── Urlaub: genehmigt (an Mitarbeiter) ───────────────────────────────────
async function sendVacationApproved(email, name, from, to, days, appUrl) {
  const { company, primary, logoUrl } = getBaseConfig()
  const html = buildEmail({
    company, primary, logoUrl, appUrl,
    title: 'Urlaub genehmigt ✓',
    greeting: name,
    lines: [
      'Ihr Urlaubsantrag wurde <strong>genehmigt</strong>.',
      `📅 <strong>Zeitraum:</strong> ${from} – ${to} (${days} Tag${days !== 1 ? 'e' : ''})`,
      '__hr',
      'Schönen Urlaub! 🌴',
    ],
    buttonText: 'Zum Portal',
    buttonLink: `${appUrl}/vacation`,
    footerNote: 'Diese E-Mail wurde automatisch vom Mitarbeiter-Portal versendet.',
  })
  await sendMail(email, `Urlaub genehmigt – ${company}`, html)
}

// ── Urlaub: abgelehnt (an Mitarbeiter) ───────────────────────────────────
async function sendVacationRejected(email, name, from, to, reason, appUrl) {
  const { company, primary, logoUrl } = getBaseConfig()
  const html = buildEmail({
    company, primary, logoUrl, appUrl,
    title: 'Urlaubsantrag abgelehnt',
    greeting: name,
    lines: [
      'Ihr Urlaubsantrag wurde leider <strong>abgelehnt</strong>.',
      `📅 <strong>Zeitraum:</strong> ${from} – ${to}`,
      ...(reason ? [`💬 <strong>Begründung:</strong> ${reason}`] : []),
      '__hr',
      'Bei Fragen wenden Sie sich bitte direkt an Ihren Vorgesetzten.',
    ],
    buttonText: 'Zum Portal',
    buttonLink: `${appUrl}/vacation`,
    footerNote: 'Diese E-Mail wurde automatisch vom Mitarbeiter-Portal versendet.',
  })
  await sendMail(email, `Urlaubsantrag abgelehnt – ${company}`, html)
}

module.exports = { sendMail, sendInvitation, sendPasswordReset, sendVacationRequest, sendVacationApproved, sendVacationRejected, buildEmail, getBaseConfig }
