const express  = require('express')
const router   = express.Router()
const localDb  = require('../db/localDb')
const { authMiddleware } = require('../middleware/auth')
const calHelper = require('./calendar_write_helper')

const requireAuth = authMiddleware

// GET /api/sick - eigene Krankmeldungen (oder alle für Admin)
router.get('/', requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin' || req.user.role === 'vacation_approver'
    let rows
    if (isAdmin) {
      rows = localDb.db.prepare(`
        SELECT s.*, u.name as user_name, u.powerbird_id
        FROM sick_reports s
        LEFT JOIN users u ON s.user_id = u.id
        ORDER BY s.from_date DESC
      `).all()
    } else {
      rows = localDb.db.prepare(`
        SELECT s.*, u.name as user_name, u.powerbird_id
        FROM sick_reports s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.user_id = ?
        ORDER BY s.from_date DESC
      `).all(req.user.id)
    }
    res.json({ sick_reports: rows })
  } catch(e) {
    console.error('sick GET error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// POST /api/sick - neue Krankmeldung eintragen
router.post('/', requireAuth, async (req, res) => {
  try {
    const { from_date, to_date, note } = req.body
    if (!from_date || !to_date) return res.status(400).json({ error: 'Datum fehlt' })

    // In lokale DB eintragen
    const result = localDb.db.prepare(`
      INSERT INTO sick_reports (user_id, from_date, to_date, note, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(req.user.id, from_date, to_date, note || null)

    // In Powerbird HWTER eintragen (FehlzeitArt=33)
    if (req.user.powerbird_id) {
      try {
        const recno = await calHelper.krankmeldungEintragen({
          start: from_date,
          end: to_date,
          mitarbeiterKuerzel: req.user.powerbird_id,
          mitarbeiterNr: req.user.mitarbeiter_nr || 0,
          note: note || '',
          sickLfdNr: result.lastInsertRowid,
        })
        localDb.db.prepare('UPDATE sick_reports SET hwter_recno=? WHERE id=?')
          .run(recno, result.lastInsertRowid)
        console.log(`Krankmeldung #${result.lastInsertRowid} in HWTER als RecNo ${recno}`)
      } catch(e) {
        console.error('HWTER Krankmeldung Fehler (nicht fatal):', e.message)
      }
    }

    res.json({ ok: true, id: result.lastInsertRowid })
  } catch(e) {
    console.error('sick POST error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/sick/:id - Krankmeldung löschen
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const row = localDb.db.prepare('SELECT * FROM sick_reports WHERE id=?').get(req.params.id)
    if (!row) return res.status(404).json({ error: 'Nicht gefunden' })
    const isAdmin = req.user.role === 'admin'
    if (!isAdmin && row.user_id !== req.user.id)
      return res.status(403).json({ error: 'Kein Zugriff' })

    // In HWTER löschen
    if (row.hwter_recno) {
      try {
        const pbDb = require('../db/powerbirdDb')
        const pool = await pbDb.getPool()
        await pool.request()
          .input('recno', row.hwter_recno)
          .query('UPDATE HWTER SET Geloescht=1, TER_ModifyDate=GETDATE() WHERE RecNo=@recno')
      } catch(e) { console.error('HWTER delete Fehler:', e.message) }
    }

    localDb.db.prepare('DELETE FROM sick_reports WHERE id=?').run(req.params.id)
    res.json({ ok: true })
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
