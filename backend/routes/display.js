const router = require('express').Router();
const { sendPush, getAllUserTokens, getTokensForFeature } = require('./push').router ? require('./push') : { sendPush: ()=>{}, getAllUserTokens: ()=>[], getTokensForFeature: ()=>[] };
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const localDb = require('../db/localDb');
const pbDb = require('../db/powerbirdDb');
const { v4: uuidv4 } = require('uuid');

// Init tables
localDb.db.exec(`
  CREATE TABLE IF NOT EXISTS display_screens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    show_appointments INTEGER DEFAULT 1,
    show_news INTEGER DEFAULT 1,
    show_todos INTEGER DEFAULT 1,
    show_all_users INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    theme TEXT DEFAULT 'dark',
    logo_url TEXT DEFAULT '',
    logo_height INTEGER DEFAULT 48,
    show_header_name INTEGER DEFAULT 1,
    show_footer INTEGER DEFAULT 1,
    touch_enabled INTEGER DEFAULT 0,
    font_size INTEGER DEFAULT 100,
    clock_size INTEGER DEFAULT 100,
    scroll_speed INTEGER DEFAULT 30,
    popup_auto_close INTEGER DEFAULT 30,
    created_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS display_news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT,
    author_id INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS display_todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    author_id INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS display_todo_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    completed_at INTEGER DEFAULT (unixepoch()),
    confirmed INTEGER DEFAULT 0,
    confirmed_by INTEGER,
    confirmed_at INTEGER,
    UNIQUE(todo_id, user_id)
  );
`);

// Migrations for existing DBs
try { localDb.db.exec("ALTER TABLE display_screens ADD COLUMN show_all_users INTEGER DEFAULT 0") } catch(e) {}
try { localDb.db.exec("ALTER TABLE display_screens ADD COLUMN theme TEXT DEFAULT 'dark'") } catch(e) {}
try { localDb.db.exec("ALTER TABLE display_screens ADD COLUMN logo_url TEXT DEFAULT ''") } catch(e) {}
try { localDb.db.exec("ALTER TABLE display_screens ADD COLUMN logo_height INTEGER DEFAULT 48") } catch(e) {}
try { localDb.db.exec("ALTER TABLE display_screens ADD COLUMN show_header_name INTEGER DEFAULT 1") } catch(e) {}
try { localDb.db.exec("ALTER TABLE display_screens ADD COLUMN show_footer INTEGER DEFAULT 1") } catch(e) {}
try { localDb.db.exec("ALTER TABLE display_screens ADD COLUMN touch_enabled INTEGER DEFAULT 0") } catch(e) {}
try { localDb.db.exec("ALTER TABLE display_screens ADD COLUMN font_size INTEGER DEFAULT 100") } catch(e) {}
try { localDb.db.exec("ALTER TABLE display_screens ADD COLUMN clock_size INTEGER DEFAULT 100") } catch(e) {}
try { localDb.db.exec("ALTER TABLE display_screens ADD COLUMN todo_archive_hours INTEGER DEFAULT 24") } catch(e) {}
try { localDb.db.exec("ALTER TABLE display_screens ADD COLUMN scroll_speed INTEGER DEFAULT 30") } catch(e) {}
try { localDb.db.exec("ALTER TABLE display_screens ADD COLUMN popup_auto_close INTEGER DEFAULT 30") } catch(e) {}

function canManageNews(user) {
  return user.role === 'admin' || !!user.feature_news_write;
}
function canManageTodos(user) {
  return user.role === 'admin' || !!user.feature_todos_create;
}
// Legacy alias
function canManageContent(user) {
  return canManageNews(user) || canManageTodos(user);
}

// ─── SCREENS ────────────────────────────────────────────────────────────────

router.get('/screens', adminMiddleware, (_req, res) => {
  const screens = localDb.db.prepare('SELECT * FROM display_screens ORDER BY created_at DESC').all()
  const displayIp = localDb.getSetting('display_ip') || localDb.getSetting('app_url') || 'http://localhost'
  const displayBase = displayIp.startsWith('http') ? displayIp.replace(/:\d+$/, '') : `http://${displayIp}`
  const displayUrl = `${displayBase}:8081`
  res.json({ screens: screens.map(s => ({ ...s, url: `${displayUrl}/display/${s.token}` })) })
})

router.post('/screens', adminMiddleware, (req, res) => {
  const { name, show_appointments, show_news, show_todos, show_all_users, theme, logo_url, logo_height,
    show_header_name, show_footer, touch_enabled, font_size, clock_size, scroll_speed, popup_auto_close } = req.body
  if (!name) return res.status(400).json({ error: 'Name erforderlich' })
  const token = uuidv4().replace(/-/g, '')
  localDb.db.prepare(
    'INSERT INTO display_screens (name, token, show_appointments, show_news, show_todos, show_all_users, theme, logo_url, logo_height, show_header_name, show_footer, touch_enabled, font_size, clock_size, scroll_speed, popup_auto_close) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(name, token, show_appointments?1:0, show_news?1:0, show_todos?1:0, show_all_users?1:0, theme||'dark', logo_url||'', logo_height||48,
    show_header_name!==false?1:0, show_footer!==false?1:0, touch_enabled?1:0, font_size||100, clock_size||100, scroll_speed||30, popup_auto_close||30)
  const displayIp = localDb.getSetting('display_ip') || localDb.getSetting('app_url') || 'http://localhost'
  const displayBase = displayIp.startsWith('http') ? displayIp.replace(/:\d+$/, '') : `http://${displayIp}`
  const displayUrl = `${displayBase}:8081`
  res.json({ success: true, url: `${displayUrl}/display/${token}` })
})

router.put('/screens/:id', adminMiddleware, (req, res) => {
  const { name, show_appointments, show_news, show_todos, show_all_users, is_active, theme, logo_url, logo_height,
    show_header_name, show_footer, touch_enabled, font_size, clock_size, scroll_speed, popup_auto_close } = req.body
  if (!name) return res.status(400).json({ error: 'Name erforderlich' })
  localDb.db.prepare(
    'UPDATE display_screens SET name=?, show_appointments=?, show_news=?, show_todos=?, show_all_users=?, theme=?, logo_url=?, logo_height=?, show_header_name=?, show_footer=?, touch_enabled=?, font_size=?, clock_size=?, scroll_speed=?, popup_auto_close=? WHERE id=?'
  ).run(
    name, show_appointments?1:0, show_news?1:0, show_todos?1:0, show_all_users?1:0,
    theme||'dark', logo_url||'', logo_height||48,
    show_header_name!==false?1:0, show_footer!==false?1:0, touch_enabled?1:0,
    font_size||100, clock_size||100, scroll_speed||30, popup_auto_close||30,
    req.params.id
  )
  res.json({ success: true })
})

router.delete('/screens/:id', adminMiddleware, (req, res) => {
  localDb.db.prepare('DELETE FROM display_screens WHERE id=?').run(req.params.id)
  res.json({ success: true })
})

// ─── PUBLIC DISPLAY DATA ────────────────────────────────────────────────────

router.get('/public/:token', async (req, res) => {
  const screen = localDb.db.prepare('SELECT * FROM display_screens WHERE token=? AND is_active=1').get(req.params.token)
  if (!screen) return res.status(404).json({ error: 'Bildschirm nicht gefunden' })

  const branding = {
    company_name: localDb.getSetting('company_name') || 'LD Connect',
    primary_color: localDb.getSetting('primary_color') || '#2563EB',
    logo_url: localDb.getSetting('logo_url') || '',
    cal_min_time: localDb.getSetting('cal_min_time') || '06:00',
    cal_max_time: localDb.getSetting('cal_max_time') || '22:00',
  }

  // Label colors
  const labelColors = {}
  try {
    localDb.db.prepare('SELECT name, color FROM labels').all().forEach(l => labelColors[l.name] = l.color)
  } catch(e) {}

  let appointments = []
  let allUsers = []

  if (screen.show_appointments) {
    try {
      const today = new Date().toISOString().split('T')[0]
      const users = localDb.db.prepare('SELECT * FROM users WHERE is_active=1 AND feature_calendar=1').all()
      allUsers = users.map(u => u.name)
      for (const user of users) {
        const r = await pbDb.query(
          `SELECT RecNo, TER_KurzinfoTermin, CONVERT(varchar(19),Termin_Start,120) AS Termin_Start, CONVERT(varchar(19),Termin_Ende,120) AS Termin_Ende, Termin_Length, Termin_Label, Preset, Termin_Color
           FROM HWTER
           WHERE Termin_ResourceName = @uid
             AND CAST(Termin_Start AS DATE) = @today
             AND (Geloescht IS NULL OR Geloescht = 0)
           ORDER BY Termin_Start ASC`,
          { uid: user.powerbird_id, today }
        )
        r.recordset.forEach(a => {
          appointments.push({
            recno: a.RecNo,
            user_name: user.name,
            title: a.Termin_Label || a.TER_KurzinfoTermin || '(Termin)',
            start: a.Termin_Start,
            end: a.Termin_Ende,
            allDay: a.Termin_Length >= 480,
            label: a.Preset,
            color: a.Termin_Color ? (() => { const n=a.Termin_Color; return '#'+((n&0xFF).toString(16).padStart(2,'0'))+((n>>8&0xFF).toString(16).padStart(2,'0'))+((n>>16&0xFF).toString(16).padStart(2,'0')) })() : labelColors[a.Preset] || null,
          })
        })
      }
      appointments.sort((a, b) => new Date(a.start) - new Date(b.start))
    } catch(e) { console.error('Display appointments error:', e.message) }
  }

  const news = screen.show_news
    ? localDb.db.prepare(`
        SELECT n.*, u.name as author_name FROM display_news n
        LEFT JOIN users u ON u.id = n.author_id
        WHERE n.is_active = 1 ORDER BY n.created_at DESC LIMIT 20
      `).all()
    : []

  const todos = screen.show_todos
    ? localDb.db.prepare(`
        SELECT t.*, u.name as author_name,
          (SELECT GROUP_CONCAT(us.name || '|' || datetime(tc.completed_at,'unixepoch','localtime') || '|' || tc.confirmed)
           FROM display_todo_completions tc JOIN users us ON us.id = tc.user_id
           WHERE tc.todo_id = t.id) as completions_raw
        FROM display_todos t
        LEFT JOIN users u ON u.id = t.author_id
        WHERE t.is_active = 1 ORDER BY t.created_at DESC LIMIT 20
      `).all().map(t => ({
        ...t,
        completions: t.completions_raw ? t.completions_raw.split(',').map(c => {
          const parts = c.split('|')
          return { name: parts[0], date: parts[1], confirmed: parts[2] === '1' }
        }) : []
      }))
    : []

  res.json({ screen, branding, appointments, allUsers, news, todos })
})

// ─── NEWS ───────────────────────────────────────────────────────────────────

router.get('/news', authMiddleware, (req, res) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.feature_news_read === 0)) return res.status(403).json({ error: 'Keine Berechtigung' })
  const news = localDb.db.prepare(
    'SELECT n.*, u.name as author_name FROM display_news n LEFT JOIN users u ON u.id=n.author_id ORDER BY n.created_at DESC'
  ).all()
  res.json({ news })
})

router.post('/news', authMiddleware, async (req, res) => {
  if (!canManageNews(req.user)) return res.status(403).json({ error: 'Keine Berechtigung' })
  const { title, content } = req.body
  if (!title) return res.status(400).json({ error: 'Titel erforderlich' })
  const r = localDb.db.prepare('INSERT INTO display_news (title, content, author_id) VALUES (?,?,?)').run(title, content||'', req.user.id)
  // Push to all users with news_read
  try {
    const tokens = getTokensForFeature('feature_news_read')
    await sendPush(tokens, '📰 Neue News', title, { screen: 'News', type: 'news', id: r.lastInsertRowid })
  } catch(e) {}
  res.json({ success: true, id: r.lastInsertRowid })
})

router.put('/news/:id', authMiddleware, (req, res) => {
  if (!canManageNews(req.user)) return res.status(403).json({ error: 'Keine Berechtigung' })
  const { title, content, is_active } = req.body
  localDb.db.prepare('UPDATE display_news SET title=COALESCE(?,title), content=COALESCE(?,content), is_active=COALESCE(?,is_active), updated_at=unixepoch() WHERE id=?')
    .run(title??null, content??null, is_active??null, req.params.id)
  res.json({ success: true })
})

router.delete('/news/:id', authMiddleware, (req, res) => {
  if (!canManageNews(req.user)) return res.status(403).json({ error: 'Keine Berechtigung' })
  localDb.db.prepare('DELETE FROM display_news WHERE id=?').run(req.params.id)
  res.json({ success: true })
})

// ─── TODOS ──────────────────────────────────────────────────────────────────

router.get('/todos', authMiddleware, (req, res) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.feature_todos_read === 0)) return res.status(403).json({ error: 'Keine Berechtigung' })
  const todos = localDb.db.prepare(`
    SELECT t.*, u.name as author_name,
      (SELECT GROUP_CONCAT(us.name || '|' || datetime(tc.completed_at,'unixepoch','localtime') || '|' || tc.confirmed)
       FROM display_todo_completions tc JOIN users us ON us.id=tc.user_id WHERE tc.todo_id=t.id) as completions_raw
    FROM display_todos t LEFT JOIN users u ON u.id=t.author_id
    ORDER BY t.created_at DESC
  `).all()
  res.json({ todos: todos.map(t => ({
    ...t,
    completions: t.completions_raw ? t.completions_raw.split(',').map(c => {
      const parts = c.split('|')
      return { name: parts[0], date: parts[1], confirmed: parts[2] === '1' }
    }) : []
  }))})
})

router.post('/todos', authMiddleware, async (req, res) => {
  if (!canManageTodos(req.user)) return res.status(403).json({ error: 'Keine Berechtigung' })
  const { title, description } = req.body
  if (!title) return res.status(400).json({ error: 'Titel erforderlich' })
  const r = localDb.db.prepare('INSERT INTO display_todos (title, description, author_id) VALUES (?,?,?)').run(title, description||'', req.user.id)
  // Push to all users with todos_read
  try {
    const tokens = getTokensForFeature('feature_todos_read')
    await sendPush(tokens, '✅ Neue Aufgabe', title, { screen: 'Aufgaben', type: 'todo', id: r.lastInsertRowid })
  } catch(e) {}
  res.json({ success: true, id: r.lastInsertRowid })
})

router.put('/todos/:id', authMiddleware, (req, res) => {
  if (!canManageTodos(req.user)) return res.status(403).json({ error: 'Keine Berechtigung' })
  const { title, description, is_active } = req.body
  localDb.db.prepare('UPDATE display_todos SET title=COALESCE(?,title), description=COALESCE(?,description), is_active=COALESCE(?,is_active), updated_at=unixepoch() WHERE id=?')
    .run(title??null, description??null, is_active??null, req.params.id)
  res.json({ success: true })
})

router.delete('/todos/:id', authMiddleware, (req, res) => {
  if (!canManageTodos(req.user)) return res.status(403).json({ error: 'Keine Berechtigung' })
  localDb.db.prepare('DELETE FROM display_todos WHERE id=?').run(req.params.id)
  res.json({ success: true })
})

router.post('/todos/:id/complete', authMiddleware, (req, res) => {
  try {
    localDb.db.prepare('INSERT OR IGNORE INTO display_todo_completions (todo_id, user_id) VALUES (?,?)').run(req.params.id, req.user.id)
    res.json({ success: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.post('/todos/:id/confirm', authMiddleware, (req, res) => {
  if (!canManageTodos(req.user)) return res.status(403).json({ error: 'Keine Berechtigung' })
  localDb.db.prepare('UPDATE display_todos SET is_active=0, updated_at=unixepoch() WHERE id=?').run(req.params.id)
  localDb.db.prepare('UPDATE display_todo_completions SET confirmed=1, confirmed_by=?, confirmed_at=unixepoch() WHERE todo_id=?').run(req.user.id, req.params.id)
  res.json({ success: true })
})

// Public appointment detail - requires valid screen token
router.get('/appt/:recno', async (req, res) => {
  const screenToken = req.query.token || req.headers['x-screen-token']
  if (!screenToken) return res.status(401).json({ error: 'Screen-Token erforderlich' })
  const screen = localDb.db.prepare('SELECT id FROM display_screens WHERE token=? AND is_active=1').get(screenToken)
  if (!screen) return res.status(403).json({ error: 'Ungültiger Screen-Token' })
  try {
    const settings = {
      show_address:  localDb.getSetting('appt_show_address')  !== '0',
      show_kdi:      localDb.getSetting('appt_show_kdi')      !== '0',
      show_customer: localDb.getSetting('appt_show_customer') !== '0',
      show_phone:    localDb.getSetting('appt_show_phone')    !== '0',
      show_email:    localDb.getSetting('appt_show_email')    !== '0',
    }
    const r = await pbDb.query(
      `SELECT h.RecNo, h.TER_KurzinfoTermin, CONVERT(varchar(19),h.Termin_Start,120) AS Termin_Start, CONVERT(varchar(19),h.Termin_Ende,120) AS Termin_Ende,
              h.Termin_Length, h.Termin_Label, h.Preset, h.Termin_Info,
              h.AdrType, h.AdrNr, h.DocType, h.DocNr, h.Termin_Color,
              k.Kunde_Name1                    AS KDI_Kunde,
              k.Dokument_Nummer                AS KDI_Nr,
              k.Kommission_Bezeichng           AS KDI_Kommission,
              k.Kunde_Strasse                  AS KDI_Strasse,
              k.Kunde_Postleitzahl             AS KDI_PLZ,
              k.Kunde_Ort                      AS KDI_Ort,
              k.DOK_KunTelefonnummer           AS KDI_Telefon,
              k.DOK_KunMobilnummer             AS KDI_Mobil,
              COALESCE(k.Kdi_BesuchEMail, k.Kdi_RechEMail, k.KDI_APOrt_EMail) AS KDI_Email,
              p.Kunde_Name1        AS PRJ_Kunde,
              p.Dokument_Nummer    AS PRJ_Nr,
              p.Kommission_Bezeichng AS PRJ_Kommission
       FROM HWTER h
       LEFT JOIN ELKDI k
              ON h.DocType = 3
             AND LTRIM(RTRIM(CAST(h.DocNr AS NVARCHAR(50)))) = LTRIM(RTRIM(k.Dokument_Nummer)) COLLATE DATABASE_DEFAULT
       LEFT JOIN ELPRJ p
              ON h.DocType = 2
             AND LTRIM(RTRIM(CAST(h.DocNr AS NVARCHAR(50)))) = LTRIM(RTRIM(p.Dokument_Nummer)) COLLATE DATABASE_DEFAULT
       WHERE h.RecNo = @recno`,
      { recno: req.params.recno }
    )
    if (!r.recordset.length) return res.status(404).json({ error: 'Nicht gefunden' })
    const x = r.recordset[0]
    const detail = {
      title: x.Termin_Label || x.TER_KurzinfoTermin || '(Termin)',
      info: x.Termin_Info, start: x.Termin_Start, end: x.Termin_Ende,
      allDay: x.Termin_Length >= 480, label: x.Preset,
    }
    const docNr = x.DocNr ? String(x.DocNr).trim() : null
    if (settings.show_kdi && docNr) {
      detail.kdi_nr = docNr
      const kom = x.KDI_Kommission || x.PRJ_Kommission
      if (kom) detail.kommission = String(kom).trim()
    }
    const kundeRaw = x.KDI_Kunde || x.PRJ_Kunde
    if (settings.show_customer && kundeRaw) detail.kunde = String(kundeRaw).trim()
    if (settings.show_address && (x.KDI_Strasse || x.KDI_Ort)) {
      detail.adresse = [x.KDI_Strasse, [x.KDI_PLZ, x.KDI_Ort].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null
    }
    if (settings.show_phone) {
      detail.telefon = x.KDI_Telefon || x.KDI_Mobil || null
      if (x.KDI_Telefon && x.KDI_Mobil && x.KDI_Telefon !== x.KDI_Mobil) detail.mobil = x.KDI_Mobil
    }
    if (settings.show_email && x.KDI_Email) detail.email = x.KDI_Email.trim()
    res.json(detail)
  } catch(e) {
    // Fallback
    try {
      const r2 = await pbDb.query(`SELECT RecNo,TER_KurzinfoTermin,Termin_Start,Termin_Ende,Termin_Length,Termin_Label,Preset,Termin_Info FROM HWTER WHERE RecNo=@recno`,{recno:req.params.recno})
      if (!r2.recordset.length) return res.status(404).json({ error: 'Nicht gefunden' })
      const x = r2.recordset[0]
      res.json({ title:x.Termin_Label||x.TER_KurzinfoTermin||'(Termin)', info:x.Termin_Info, start:x.Termin_Start, end:x.Termin_Ende, allDay:x.Termin_Length>=480, label:x.Preset })
    } catch(e2) { res.status(500).json({ error: e2.message }) }
  }
})

// Auto-archive completed todos - only from localhost
router.post('/todos/auto-archive', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || ''
  const isInternal = ip === '127.0.0.1' || ip === '::1' || ip.startsWith('172.') || ip.startsWith('192.168.')
  if (!isInternal) return res.status(403).json({ error: 'Nur intern erreichbar' })
  try {
    const hours = parseInt(localDb.getSetting('todo_archive_hours') || '24')
    const cutoff = Math.floor(Date.now()/1000) - (hours * 3600)
    // Archive todos where all completions are older than cutoff
    const todos = localDb.db.prepare('SELECT id FROM display_todos WHERE is_active=1').all()
    for (const todo of todos) {
      const completions = localDb.db.prepare('SELECT completed_at FROM display_todo_completions WHERE todo_id=?').all(todo.id)
      if (completions.length > 0 && completions.every(c => c.completed_at < cutoff)) {
        localDb.db.prepare('UPDATE display_todos SET is_active=0 WHERE id=?').run(todo.id)
        localDb.db.prepare('UPDATE display_todo_completions SET confirmed=1 WHERE todo_id=?').run(todo.id)
      }
    }
    res.json({ success: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// Get week appointments for a user (touch mode)
router.get('/public/:token/week/:userId', async (req, res) => {
  const screen = localDb.db.prepare('SELECT * FROM display_screens WHERE token=? AND is_active=1').get(req.params.token)
  if (!screen || !screen.touch_enabled) return res.status(403).json({ error: 'Touch nicht aktiviert' })
  // Accept both numeric ID and name
  let user = localDb.db.prepare('SELECT * FROM users WHERE id=?').get(req.params.userId)
  if (!user) user = localDb.db.prepare('SELECT * FROM users WHERE name=?').get(req.params.userId)
  if (!user) return res.status(404).json({ error: 'User nicht gefunden: ' + req.params.userId })
  try {
    const now = new Date()
    const mon = new Date(now); mon.setDate(now.getDate() - now.getDay() + 1)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    const from = mon.toISOString().split('T')[0]
    const to = sun.toISOString().split('T')[0]
    const r = await pbDb.query(
      `SELECT TER_KurzinfoTermin, CONVERT(varchar(19),Termin_Start,120) AS Termin_Start, CONVERT(varchar(19),Termin_Ende,120) AS Termin_Ende, Termin_Length, Termin_Label, Preset
       FROM HWTER WHERE Termin_ResourceName=@uid
         AND CAST(Termin_Start AS DATE) BETWEEN @from AND @to
         AND (Geloescht IS NULL OR Geloescht=0)
       ORDER BY Termin_Start ASC`,
      { uid: user.powerbird_id, from, to }
    )
    const labelColors = {}
    localDb.db.prepare('SELECT name, color FROM labels').all().forEach(l => labelColors[l.name] = l.color)
    res.json({ user: user.name, from, to, appointments: r.recordset.map(a => ({
      title: a.Termin_Label || a.TER_KurzinfoTermin || '(Termin)',
      start: a.Termin_Start, end: a.Termin_Ende,
      allDay: a.Termin_Length >= 480, label: a.Preset,
      color: labelColors[a.Preset] || null,
    }))})
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// Complete todo via touch (no auth - uses screen token)
router.post('/public/:token/todos/:todoId/complete', async (req, res) => {
  const screen = localDb.db.prepare('SELECT * FROM display_screens WHERE token=? AND is_active=1').get(req.params.token)
  if (!screen || !screen.touch_enabled) return res.status(403).json({ error: 'Touch nicht aktiviert' })
  const { user_name } = req.body
  if (!user_name) return res.status(400).json({ error: 'Name erforderlich' })
  try {
    // Find or create a virtual completion record by name
    const existing = localDb.db.prepare(
      "SELECT id FROM display_todo_completions WHERE todo_id=? AND user_id=(SELECT id FROM users WHERE name=? LIMIT 1)"
    ).get(req.params.todoId, user_name)
    if (!existing) {
      const user = localDb.db.prepare('SELECT id FROM users WHERE name=? LIMIT 1').get(user_name)
      if (!user) return res.status(404).json({ error: 'Mitarbeiter nicht gefunden' })
      localDb.db.prepare('INSERT OR IGNORE INTO display_todo_completions (todo_id, user_id) VALUES (?,?)').run(req.params.todoId, user.id)
    }
    res.json({ success: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

module.exports = router;
