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
    console.log('[DEV] E-Mail nicht versendet. An: ' + to + ', Betreff: ' + subject);
    return;
  }
  const from = localDb.getSetting('smtp_from') || localDb.getSetting('smtp_user');
  // Plain-text Fallback damit Outlook nicht selbst konvertiert
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#[0-9]+;/g, '')
    .replace(/ {2,}/g, ' ').replace(/\n {2,}/g, '\n').trim();
  await transporter.sendMail({ from, to, subject, html, text });
}

function getBaseConfig() {
  let appUrl = localDb.getSetting('app_url') || '';
  if (appUrl && !appUrl.startsWith('http')) appUrl = 'https://' + appUrl;
  if (appUrl.endsWith('/')) appUrl = appUrl.slice(0, -1);
  return {
    company: localDb.getSetting('company_name') || 'LD Connect',
    primary: localDb.getSetting('primary_color') || '#2563EB',
    logoUrl: localDb.getSetting('logo_url') || '',
    appUrl,
  };
}

function buildEmail(opts) {
  // Sicherstellen dass buttonLink eine saubere URL ist (kein Text angehängt)
  if (opts.buttonLink) opts.buttonLink = opts.buttonLink.trim();
  const { company, primary, logoUrl, appUrl, title, greeting, lines, buttonText, buttonLink, footerNote } = opts;

  const absLogoUrl = logoUrl && logoUrl.startsWith('http') ? logoUrl : (appUrl || '') + logoUrl;
  const logoHtml = logoUrl
    ? '<img src="' + absLogoUrl + '" alt="' + company + '" style="max-height:60px;max-width:200px;object-fit:contain;margin-bottom:8px;" />'
    : '<div style="font-size:22px;font-weight:800;color:#ffffff;">' + company + '</div>';

  const linesHtml = lines.map(function(l) {
    if (l === '__hr') return '<hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />';
    return '<p style="margin:8px 0;color:#374151;font-size:15px;line-height:1.6;">' + l + '</p>';
  }).join('');

  const buttonHtml = (buttonText && buttonLink)
    ? '<!--[if mso]>'
      + '<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"'
      + ' href="' + buttonLink + '" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="10%" stroke="f" fillcolor="' + primary + '">'
      + '<w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">' + buttonText + '</center>'
      + '</v:roundrect><![endif]-->'
      + '<!--[if !mso]><!-->'
      + '<table cellpadding="0" cellspacing="0" style="margin:28px 0;">'
      + '<tr><td align="center" style="border-radius:8px;background:' + primary + ';">'
      + '<a href="' + buttonLink + '" target="_blank"'
      + ' style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:700;'
      + 'text-decoration:none;border-radius:8px;background:' + primary + ';'
      + 'font-family:Arial,sans-serif;mso-hide:all;">'
      + buttonText
      + '</a></td></tr></table>'
      + '<!--<![endif]-->'
      + '<p style="margin:8px 0;color:#6b7280;font-size:13px;">'
      + 'Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:</p>'
      + '<p style="margin:0 0 16px;font-size:12px;word-break:break-all;">'
      + '<a href="' + buttonLink + '" style="color:' + primary + ';">' + buttonLink + '</a></p>'
    : '';

  return '<!DOCTYPE html>'
    + '<html lang="de"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /><title>' + title + '</title></head>'
    + '<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;"><tr><td align="center">'
    + '<table width="100%" style="max-width:580px;" cellpadding="0" cellspacing="0">'
    + '<tr><td style="background:' + primary + ';border-radius:12px 12px 0 0;padding:28px 36px;text-align:center;">'
    + logoHtml
    + '<div style="color:rgba(255,255,255,0.85);font-size:13px;margin-top:4px;">' + company + '</div>'
    + '</td></tr>'
    + '<tr><td style="background:#ffffff;padding:36px 36px 28px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">'
    + '<h2 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#111827;">' + title + '</h2>'
    + '<p style="margin:0 0 16px;color:#374151;font-size:15px;">Hallo ' + greeting + ',</p>'
    + linesHtml
    + buttonHtml
    + '</td></tr>'
    + '<tr><td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:20px 36px;text-align:center;">'
    + '<p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">' + footerNote + '</p>'
    + '<p style="margin:8px 0 0;color:#d1d5db;font-size:11px;">' + company + ' &middot; Mitarbeiter-Portal</p>'
    + '</td></tr>'
    + '</table></td></tr></table>'
    + '</body></html>';
}

async function sendPasswordReset(email, name, link) {
  const cfg = getBaseConfig();
  const html = buildEmail({
    company: cfg.company, primary: cfg.primary, logoUrl: cfg.logoUrl, appUrl: cfg.appUrl,
    title: 'Passwort zur\u00fccksetzen',
    greeting: name,
    lines: [
      'Sie haben eine Anfrage zum Zur\u00fccksetzen Ihres Passworts gestellt.',
      'Klicken Sie auf den Button, um ein neues Passwort zu vergeben:',
    ],
    buttonText: 'Passwort zur\u00fccksetzen',
    buttonLink: link,
    footerNote: 'Dieser Link ist <strong>2 Stunden</strong> g\u00fcltig. Falls Sie diese Anfrage nicht gestellt haben, k\u00f6nnen Sie diese E-Mail ignorieren.',
  });
  await sendMail(email, 'Passwort zur\u00fccksetzen \u2013 ' + cfg.company, html);
}

async function sendInvitation(email, name, link) {
  const cfg = getBaseConfig();
  const html = buildEmail({
    company: cfg.company, primary: cfg.primary, logoUrl: cfg.logoUrl, appUrl: cfg.appUrl,
    title: 'Willkommen bei ' + cfg.company,
    greeting: name,
    lines: [
      'Sie wurden eingeladen, das <strong>' + cfg.company + ' Mitarbeiter-Portal</strong> zu nutzen.',
      'Bitte legen Sie jetzt Ihr pers\u00f6nliches Passwort fest:',
    ],
    buttonText: 'Passwort festlegen &amp; anmelden',
    buttonLink: link,
    footerNote: 'Dieser Link ist <strong>7 Tage</strong> g\u00fcltig. Falls Sie diese Einladung nicht erwartet haben, k\u00f6nnen Sie diese E-Mail ignorieren.',
  });
  await sendMail(email, 'Einladung zum Mitarbeiter-Portal \u2013 ' + cfg.company, html);
}

async function sendVacationRequest(approverEmail, applicantName, from, to, days, appUrl) {
  const cfg = getBaseConfig();
  const url = appUrl || cfg.appUrl;
  const html = buildEmail({
    company: cfg.company, primary: cfg.primary, logoUrl: cfg.logoUrl, appUrl: url,
    title: 'Neuer Urlaubsantrag',
    greeting: 'Administrator',
    lines: [
      '<strong>' + applicantName + '</strong> hat einen Urlaubsantrag gestellt:',
      '&#128197; <strong>Zeitraum:</strong> ' + from + ' \u2013 ' + to + ' (' + days + ' Tag' + (days !== 1 ? 'e' : '') + ')',
      '__hr',
      'Bitte melden Sie sich im Portal an, um den Antrag zu genehmigen oder abzulehnen.',
    ],
    buttonText: 'Antrag pr\u00fcfen',
    buttonLink: url + '/vacation-approve',
    footerNote: 'Diese E-Mail wurde automatisch vom Mitarbeiter-Portal versendet.',
  });
  await sendMail(approverEmail, 'Urlaubsantrag von ' + applicantName + ' \u2013 ' + cfg.company, html);
}

async function sendVacationApproved(email, name, from, to, days, appUrl) {
  const cfg = getBaseConfig();
  const url = appUrl || cfg.appUrl;
  const html = buildEmail({
    company: cfg.company, primary: cfg.primary, logoUrl: cfg.logoUrl, appUrl: url,
    title: 'Urlaub genehmigt \u2713',
    greeting: name,
    lines: [
      'Ihr Urlaubsantrag wurde <strong>genehmigt</strong>.',
      '&#128197; <strong>Zeitraum:</strong> ' + from + ' \u2013 ' + to + ' (' + days + ' Tag' + (days !== 1 ? 'e' : '') + ')',
      '__hr',
      'Sch\u00f6nen Urlaub! &#127804;',
    ],
    buttonText: 'Zum Portal',
    buttonLink: url + '/vacation',
    footerNote: 'Diese E-Mail wurde automatisch vom Mitarbeiter-Portal versendet.',
  });
  await sendMail(email, 'Urlaub genehmigt \u2013 ' + cfg.company, html);
}

async function sendVacationRejected(email, name, from, to, reason, appUrl) {
  const cfg = getBaseConfig();
  const url = appUrl || cfg.appUrl;
  const lines = [
    'Ihr Urlaubsantrag wurde leider <strong>abgelehnt</strong>.',
    '&#128197; <strong>Zeitraum:</strong> ' + from + ' \u2013 ' + to,
  ];
  if (reason) lines.push('&#128172; <strong>Begr\u00fcndung:</strong> ' + reason);
  lines.push('__hr');
  lines.push('Bei Fragen wenden Sie sich bitte direkt an Ihren Vorgesetzten.');
  const html = buildEmail({
    company: cfg.company, primary: cfg.primary, logoUrl: cfg.logoUrl, appUrl: url,
    title: 'Urlaubsantrag abgelehnt',
    greeting: name,
    lines: lines,
    buttonText: 'Zum Portal',
    buttonLink: url + '/vacation',
    footerNote: 'Diese E-Mail wurde automatisch vom Mitarbeiter-Portal versendet.',
  });
  await sendMail(email, 'Urlaubsantrag abgelehnt \u2013 ' + cfg.company, html);
}

module.exports = { sendMail, sendInvitation, sendPasswordReset, sendVacationRequest, sendVacationApproved, sendVacationRejected, buildEmail, getBaseConfig };
