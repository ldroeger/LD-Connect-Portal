const express = require('express')
const router  = express.Router()
const localDb = require('../db/localDb')
const pbDb    = require('../db/powerbirdDb')
const { authMiddleware, adminMiddleware } = require('../middleware/auth')

const requireAuth  = authMiddleware
const requireAdmin = adminMiddleware

// Hilfsfunktion: Zeitraum-Grenzen berechnen
function getPeriodRange(period, date) {
  const d = new Date(date)
  let from, to
  if (period === 'day') {
    from = date; to = date
  } else if (period === 'week') {
    const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay()||7) - 1))
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    from = mon.toISOString().split('T')[0]; to = sun.toISOString().split('T')[0]
  } else if (period === 'month') {
    from = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
    const last = new Date(d.getFullYear(), d.getMonth()+1, 0)
    to = last.toISOString().split('T')[0]
  } else { // year
    from = `${d.getFullYear()}-01-01`; to = `${d.getFullYear()}-12-31`
  }
  return { from, to }
}

// GET /api/manager/users - alle Mitarbeiter für Filter
router.get('/users', requireAuth, requireAdmin, (req, res) => {
  const users = localDb.db.prepare(
    "SELECT id, name, powerbird_id FROM users WHERE is_active=1 AND powerbird_id IS NOT NULL AND powerbird_id != '' ORDER BY name"
  ).all()
  res.json({ users })
})

// GET /api/manager/overview - Auswertung
router.get('/overview', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { period = 'month', date = new Date().toISOString().split('T')[0], user_id = 'all' } = req.query
    const { from, to } = getPeriodRange(period, date)

    // Alle relevanten User laden
    let users
    if (user_id === 'all') {
      users = localDb.db.prepare(
        "SELECT id, name, powerbird_id FROM users WHERE is_active=1 AND powerbird_id IS NOT NULL AND powerbird_id != '' ORDER BY name"
      ).all()
    } else {
      users = localDb.db.prepare(
        "SELECT id, name, powerbird_id FROM users WHERE id=?"
      ).all(user_id)
    }

    const pool = await pbDb.getPool()
    const rows = []

    for (const u of users) {
      // Urlaub genehmigt (FehlzeitArt 18+19) im Zeitraum
      const vacRes = await pool.request()
        .input('uid', u.powerbird_id).input('from', from).input('to', to)
        .query(`SELECT SUM(DATEDIFF(day, Termin_Start, Termin_Ende) + 1) AS days
                FROM HWTER WHERE Termin_ResourceName=@uid
                AND TER_FehlzeitArt IN (18,19) AND Geloescht=0
                AND CAST(Termin_Start AS DATE) <= @to AND CAST(Termin_Ende AS DATE) >= @from`)
      const vacation_days = vacRes.recordset[0]?.days || 0

      // Urlaub beantragt (FehlzeitArt 17)
      const pendRes = await pool.request()
        .input('uid', u.powerbird_id).input('from', from).input('to', to)
        .query(`SELECT SUM(DATEDIFF(day, Termin_Start, Termin_Ende) + 1) AS days
                FROM HWTER WHERE Termin_ResourceName=@uid
                AND TER_FehlzeitArt=17 AND Geloescht=0
                AND CAST(Termin_Start AS DATE) <= @to AND CAST(Termin_Ende AS DATE) >= @from`)
      const vacation_pending = pendRes.recordset[0]?.days || 0

      // Kranktage (FehlzeitArt 33) aus lokaler DB
      const sickRes = localDb.db.prepare(`
        SELECT SUM(julianday(MIN(to_date, ?)) - julianday(MAX(from_date, ?)) + 1) as days
        FROM sick_reports WHERE user_id=? AND from_date<=? AND to_date>=?
      `).get(to, from, u.id, to, from)
      const sick_days = Math.round(sickRes?.days || 0)

      // Termine (Kundendienst etc.) im Zeitraum aus Powerbird
      const apptRes = await pool.request()
        .input('uid', u.powerbird_id).input('from', from).input('to', to)
        .query(`SELECT COUNT(*) AS cnt FROM HWTER
                WHERE Termin_ResourceName=@uid AND Geloescht=0
                AND TER_FehlzeitArt=0
                AND CAST(Termin_Start AS DATE) >= @from AND CAST(Termin_Start AS DATE) <= @to`)
      const appointments = apptRes.recordset[0]?.cnt || 0

      // Stunden-Saldo aus lokaler DB (falls vorhanden)
      const hoursRes = await pool.request()
        .input('uid', u.powerbird_id).input('from', from).input('to', to)
        .query(`SELECT SUM(Termin_Length) AS mins FROM HWTER
                WHERE Termin_ResourceName=@uid AND Geloescht=0
                AND TER_FehlzeitArt=0
                AND CAST(Termin_Start AS DATE) >= @from AND CAST(Termin_Start AS DATE) <= @to`)
      const hours_worked = Math.round((hoursRes.recordset[0]?.mins || 0) / 60 * 10) / 10

      rows.push({
        user_id: u.id, name: u.name, powerbird_id: u.powerbird_id,
        vacation_days, vacation_pending, sick_days,
        appointments, hours_worked, saldo: null,
      })
    }

    res.json({ rows, from, to })
  } catch(e) {
    console.error('manager overview error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
