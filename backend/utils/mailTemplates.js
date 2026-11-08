const localDb = require('../db/localDb');

const AUTO_FOOTER = 'Diese E-Mail wurde automatisch vom Mitarbeiter-Portal versendet.';
const VACATION_VARS = ['name', 'firma', 'von', 'bis', 'tage'];

// Standardtexte. Platzhalter werden als {{name}} geschrieben, einfache HTML-Tags sind erlaubt.
const TEMPLATES = {
  password_reset: {
    label: 'Passwort zurücksetzen',
    description: 'Wird versendet, wenn ein Passwort-Reset angefordert wird.',
    variables: ['name', 'firma'],
    defaults: {
      subject: 'Passwort zurücksetzen – {{firma}}',
      title: 'Passwort zurücksetzen',
      greeting: 'Hallo {{name}},',
      body: 'Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.\nKlicken Sie auf den Button, um ein neues Passwort zu vergeben:',
      extra: '',
      buttonText: 'Passwort zurücksetzen',
      footer: 'Dieser Link ist <strong>2 Stunden</strong> gültig. Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.',
    },
  },
  invitation: {
    label: 'Einladung',
    description: 'Wird an neue Benutzer versendet.',
    variables: ['name', 'firma'],
    defaults: {
      subject: 'Einladung zum Mitarbeiter-Portal – {{firma}}',
      title: 'Willkommen bei {{firma}}',
      greeting: 'Hallo {{name}},',
      body: 'Sie wurden eingeladen, das <strong>{{firma}} Mitarbeiter-Portal</strong> zu nutzen.\nBitte legen Sie jetzt Ihr persönliches Passwort fest:',
      extra: '',
      buttonText: 'Passwort festlegen & anmelden',
      footer: 'Dieser Link ist <strong>7 Tage</strong> gültig. Falls Sie diese Einladung nicht erwartet haben, können Sie diese E-Mail ignorieren.',
    },
  },
  vacation_request: {
    label: 'Neuer Urlaubsantrag',
    description: 'Geht an alle Genehmiger, wenn ein Antrag gestellt wird.',
    variables: ['name', 'firma', 'mitarbeiter', 'von', 'bis', 'tage', 'begruendung', 'termine'],
    defaults: {
      subject: 'Urlaubsantrag von {{mitarbeiter}} – {{firma}}',
      title: 'Neuer Urlaubsantrag',
      greeting: 'Hallo {{name}},',
      body: '<strong>Mitarbeiter:</strong> {{mitarbeiter}}\n<strong>Zeitraum:</strong> {{von}} – {{bis}}\n<strong>Arbeitstage:</strong> {{tage}}\n{{begruendung}}\n{{termine}}',
      extra: '',
      buttonText: 'Antrag bearbeiten',
      footer: AUTO_FOOTER,
    },
  },
  vacation_approved: {
    label: 'Urlaub genehmigt',
    description: 'Geht an den Antragsteller nach der Genehmigung.',
    variables: VACATION_VARS,
    defaults: {
      subject: 'Urlaubsantrag genehmigt – {{firma}}',
      title: 'Urlaubsantrag genehmigt',
      greeting: 'Hallo {{name}},',
      body: 'Ihr Urlaubsantrag wurde <strong>genehmigt</strong>.\n<strong>Zeitraum:</strong> {{von}} – {{bis}}\n<strong>Arbeitstage:</strong> {{tage}}',
      extra: '',
      buttonText: 'Zum Portal',
      footer: AUTO_FOOTER,
    },
  },
  vacation_auto_approved: {
    label: 'Urlaub automatisch genehmigt',
    description: 'Geht an den Antragsteller, wenn der Urlaub in Powerbird eingetragen wurde.',
    variables: VACATION_VARS,
    defaults: {
      subject: 'Urlaubsantrag automatisch genehmigt – {{firma}}',
      title: 'Urlaubsantrag genehmigt',
      greeting: 'Hallo {{name}},',
      body: 'Ihr Urlaubsantrag wurde automatisch genehmigt, da der Urlaub in Powerbird eingetragen wurde.\n<strong>Zeitraum:</strong> {{von}} – {{bis}}\n<strong>Arbeitstage:</strong> {{tage}}',
      extra: '',
      buttonText: 'Zum Portal',
      footer: AUTO_FOOTER,
    },
  },
  vacation_rejected: {
    label: 'Urlaub abgelehnt',
    description: 'Geht an den Antragsteller nach der Ablehnung.',
    variables: ['name', 'firma', 'von', 'bis', 'grund', 'anhang'],
    defaults: {
      subject: 'Urlaubsantrag abgelehnt – {{firma}}',
      title: 'Urlaubsantrag abgelehnt',
      greeting: 'Hallo {{name}},',
      body: 'Ihr Urlaubsantrag wurde leider <strong>abgelehnt</strong>.\n<strong>Zeitraum:</strong> {{von}} – {{bis}}\n<strong>Grund:</strong> {{grund}}\n{{anhang}}',
      extra: '',
      buttonText: 'Zum Portal',
      footer: AUTO_FOOTER,
    },
  },
  email_changed_old: {
    label: 'E-Mail geändert (alte Adresse)',
    description: 'Hinweis an die bisherige Adresse, wenn die E-Mail-Adresse geändert wurde.',
    variables: ['name', 'firma', 'alte_email', 'neue_email'],
    defaults: {
      subject: 'Ihre E-Mail-Adresse wurde geändert',
      title: 'E-Mail-Adresse geändert',
      greeting: 'Hallo {{name}},',
      body: 'Ihre E-Mail-Adresse im {{firma}} Portal wurde geändert.\nAlte E-Mail-Adresse: <strong>{{alte_email}}</strong>\nNeue E-Mail-Adresse: <strong>{{neue_email}}</strong>\nFalls Sie diese Änderung nicht veranlasst haben, wenden Sie sich bitte sofort an Ihren Administrator.',
      extra: '',
      buttonText: '',
      footer: '{{firma}}',
    },
  },
  email_changed_new: {
    label: 'E-Mail geändert (neue Adresse)',
    description: 'Bestätigung an die neue Adresse, wenn die E-Mail-Adresse geändert wurde.',
    variables: ['name', 'firma', 'alte_email', 'neue_email'],
    defaults: {
      subject: 'E-Mail-Adresse bestätigt',
      title: 'E-Mail-Adresse geändert',
      greeting: 'Hallo {{name}},',
      body: 'Ihre E-Mail-Adresse im {{firma}} Portal wurde auf diese Adresse geändert.\nAlte E-Mail-Adresse: <strong>{{alte_email}}</strong>\nNeue E-Mail-Adresse: <strong>{{neue_email}}</strong>\nFalls Sie diese Änderung nicht veranlasst haben, wenden Sie sich bitte sofort an Ihren Administrator.',
      extra: '',
      buttonText: '',
      footer: '{{firma}}',
    },
  },
};

const FIELDS = ['subject', 'title', 'greeting', 'body', 'extra', 'buttonText', 'footer'];
const settingKey = key => 'mail_template_' + key;

function getOverrides(key) {
  try {
    const parsed = JSON.parse(localDb.getSetting(settingKey(key)) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) { return {}; }
}

function getTemplate(key) {
  const tpl = TEMPLATES[key];
  if (!tpl) throw new Error('Unbekannte E-Mail-Vorlage: ' + key);
  const overrides = getOverrides(key);
  const merged = {};
  FIELDS.forEach(f => { merged[f] = typeof overrides[f] === 'string' ? overrides[f] : tpl.defaults[f]; });
  return merged;
}

function listTemplates() {
  return Object.keys(TEMPLATES).map(key => ({
    key,
    label: TEMPLATES[key].label,
    description: TEMPLATES[key].description,
    variables: TEMPLATES[key].variables,
    defaults: TEMPLATES[key].defaults,
    values: getTemplate(key),
    customized: Object.keys(getOverrides(key)).length > 0,
  }));
}

// Speichert nur Felder, die vom Standard abweichen
function saveTemplate(key, values) {
  const tpl = TEMPLATES[key];
  if (!tpl) throw new Error('Unbekannte E-Mail-Vorlage: ' + key);
  const overrides = {};
  FIELDS.forEach(f => {
    if (typeof values[f] === 'string' && values[f] !== tpl.defaults[f]) overrides[f] = values[f];
  });
  localDb.setSetting(settingKey(key), JSON.stringify(overrides));
}

function resetTemplate(key) {
  if (!TEMPLATES[key]) throw new Error('Unbekannte E-Mail-Vorlage: ' + key);
  localDb.setSetting(settingKey(key), '{}');
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Werte stammen teils von Benutzern und werden escaped; rawVars enthält fertiges HTML aus dem Backend
function fillPlaceholders(text, vars, rawVars) {
  return String(text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) => {
    if (rawVars && name in rawVars) return rawVars[name];
    return name in vars ? escapeHtml(vars[name]) : match;
  });
}

// Für den Betreff: kein HTML, daher ohne Escaping
function fillPlain(text, vars) {
  return String(text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) => (
    name in vars ? String(vars[name] == null ? '' : vars[name]) : match
  ));
}

module.exports = { TEMPLATES, FIELDS, getTemplate, listTemplates, saveTemplate, resetTemplate, escapeHtml, fillPlaceholders, fillPlain };
