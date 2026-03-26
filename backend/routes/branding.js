const router = require('express').Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const localDb = require('../db/localDb');

router.get('/', (_req, res) => res.json({
  company_name:        localDb.getSetting('company_name')        || 'Powerbird',
  banner_height:       parseInt(localDb.getSetting('banner_height') || '48'),
  primary_color:       localDb.getSetting('primary_color')       || '#2563EB',
  logo_url:            localDb.getSetting('logo_url')            || '',
  logo_mode:           localDb.getSetting('logo_mode')           || 'icon',
  favicon_url:         localDb.getSetting('favicon_url')         || '',
  calendar_range_days: parseInt(localDb.getSetting('calendar_range_days') || '14'),
  scroll_to_time:      localDb.getSetting('scroll_to_time') || '08:00',
  cal_min_time:        localDb.getSetting('cal_min_time') || '06:00',
  cal_max_time:        localDb.getSetting('cal_max_time') || '22:00',
}));

router.get('/labels', authMiddleware, (_req, res) =>
  res.json({ labels: localDb.db.prepare('SELECT * FROM labels ORDER BY name').all() })
);

router.put('/labels', adminMiddleware, (req, res) => {
  try {
    const { labels } = req.body;
    if (!Array.isArray(labels)) return res.status(400).json({ error: 'Labels müssen ein Array sein' });
    const upsert = localDb.db.prepare('INSERT OR REPLACE INTO labels (name,color) VALUES (?,?)');
    localDb.db.transaction(ls => ls.forEach(l => upsert.run(l.name, l.color)))(labels);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/', adminMiddleware, (req, res) => {
  try {
    const { company_name, primary_color, logo_url, logo_mode, favicon_url, calendar_range_days } = req.body;
    if (company_name)            localDb.setSetting('company_name',        company_name);
    if (primary_color)           localDb.setSetting('primary_color',       primary_color);
    if (logo_url  !== undefined)  localDb.setSetting('logo_url',            logo_url);
    if (logo_mode !== undefined)  localDb.setSetting('logo_mode',           logo_mode);
    if (favicon_url !== undefined) localDb.setSetting('favicon_url',        favicon_url);
    if (req.body.banner_height)     localDb.setSetting('banner_height',      String(req.body.banner_height));
    if (req.body.scroll_to_time)    localDb.setSetting('scroll_to_time',    req.body.scroll_to_time);
    if (req.body.cal_min_time)      localDb.setSetting('cal_min_time',      req.body.cal_min_time);
    if (req.body.cal_max_time)      localDb.setSetting('cal_max_time',      req.body.cal_max_time);
    if (calendar_range_days)     localDb.setSetting('calendar_range_days', String(calendar_range_days));
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
