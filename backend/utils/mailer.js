const nodemailer = require('nodemailer');
const localDb    = require('../db/localDb');
const mailTemplates = require('./mailTemplates');

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
  let appUrl = localDb.getSetting('app_url') || process.env.APP_URL || '';
  if (appUrl && !appUrl.startsWith('http')) appUrl = 'https://' + appUrl;
  if (appUrl.endsWith('/')) appUrl = appUrl.slice(0, -1);
  const logoUrl = localDb.getSetting('logo_url') || '';
  // Logo als Base64 einbetten damit es in allen E-Mail-Clients angezeigt wird
  let logoBase64 = '';
  if (logoUrl) {
    try {
      const path = require('path');
      const fs   = require('fs');
      const DATA_DIR = process.env.DATA_DIR || '/data';
      const filename = path.basename(logoUrl.split('?')[0]);
      const filePath = path.join(DATA_DIR, 'logos', filename);
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filename).toLowerCase().replace('.', '');
        const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : 'image/' + ext;
        const data = fs.readFileSync(filePath).toString('base64');
        logoBase64 = 'data:' + mime + ';base64,' + data;
      }
    } catch(e) { console.log('Logo Base64 Fehler:', e.message); }
  }
  return {
    company: localDb.getSetting('company_name') || 'LD Connect',
    primary: localDb.getSetting('primary_color') || '#2563EB',
    logoUrl: logoBase64 || (appUrl + logoUrl),
    appUrl,
  };
}

function buildEmail(opts) {
  // Sicherstellen dass buttonLink eine saubere URL ist (kein Text angehängt)
  if (opts.buttonLink) opts.buttonLink = opts.buttonLink.trim();
  const { company, primary, logoUrl, appUrl, title, greeting, lines, buttonText, buttonLink, footerNote } = opts;

  const absLogoUrl = logoUrl && (logoUrl.startsWith('http') || logoUrl.startsWith('data:')) ? logoUrl : (appUrl || '') + logoUrl;
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
    + '<p style="margin:0 0 16px;color:#374151;font-size:15px;">' + greeting + '</p>'
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

// Baut Betreff und HTML aus einer Vorlage. opts: rawVars (fertiges HTML), buttonLink, template (ungespeicherte Texte für die Vorschau)
function renderTemplate(key, vars, opts) {
  const options = opts || {};
  const cfg = getBaseConfig();
  const tpl = options.template || mailTemplates.getTemplate(key);
  const allVars = Object.assign({ firma: cfg.company }, vars);
  const fill = text => mailTemplates.fillPlaceholders(text, allVars, options.rawVars);
  const toLines = text => fill(text).split('\n').map(l => l.trim()).filter(Boolean);

  const lines = toLines(tpl.body);
  const extraLines = toLines(tpl.extra);
  if (extraLines.length) lines.push('__hr', ...extraLines);

  let buttonLink = options.buttonLink || '';
  if (buttonLink.startsWith('/')) buttonLink = cfg.appUrl ? cfg.appUrl + buttonLink : '';

  const html = buildEmail({
    company: cfg.company, primary: cfg.primary, logoUrl: cfg.logoUrl, appUrl: cfg.appUrl,
    title: fill(tpl.title),
    greeting: fill(tpl.greeting),
    lines,
    buttonText: fill(tpl.buttonText).replace(/&(?!\w+;|#\d+;)/g, '&amp;'),
    buttonLink,
    footerNote: fill(tpl.footer),
  });
  return { subject: mailTemplates.fillPlain(tpl.subject, allVars), html };
}

async function sendTemplate(key, to, vars, opts) {
  const { subject, html } = renderTemplate(key, vars, opts);
  await sendMail(to, subject, html);
}

async function sendPasswordReset(email, name, link) {
  await sendTemplate('password_reset', email, { name }, { buttonLink: link });
}

async function sendInvitation(email, name, link) {
  await sendTemplate('invitation', email, { name }, { buttonLink: link });
}

module.exports = { escapeHtml: mailTemplates.escapeHtml, sendMail, sendTemplate, renderTemplate, sendInvitation, sendPasswordReset, buildEmail, getBaseConfig };
