const express = require('express');
const router = express.Router();
const { adminMiddleware } = require('../middleware/auth');
const localDb = require('../db/localDb');

// Get all settings (admin only)
router.get('/settings', adminMiddleware, (req, res) => {
  const settings = localDb.getSettings();
  // Remove sensitive data
  delete settings.db_password;
  delete settings.smtp_password;
  res.json({ settings });
});

// Update settings
router.put('/settings', adminMiddleware, (req, res) => {
  try {
    const allowed = ['calendar_range_days', 'app_url', 'company_name', 'primary_color', 'logo_url',
      'db_host', 'db_port', 'db_name', 'db_user', 'db_encrypt', 'db_trust_cert',
      'smtp_host', 'smtp_port', 'smtp_user', 'smtp_from'];
    
    Object.entries(req.body).forEach(([key, value]) => {
      if (allowed.includes(key)) localDb.setSetting(key, value);
    });
    
    // Handle passwords separately
    if (req.body.db_password) localDb.setSetting('db_password', req.body.db_password);
    if (req.body.smtp_password) localDb.setSetting('smtp_password', req.body.smtp_password);

    // Reset DB pool when connection settings change
    if (['db_host', 'db_port', 'db_name', 'db_user', 'db_password'].some(k => req.body[k] !== undefined)) {
      require('../db/powerbirdDb').closePool().catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
