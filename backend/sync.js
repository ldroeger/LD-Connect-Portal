/**
 * sync.js - Powerbird Sync Job
 * Läuft im Hintergrund, prüft HWTER auf Änderungen und updated lokale DB
 */

const pbDb   = require('./db/powerbirdDb')
const localDb = require('./db/localDb')
const { sendPush, getTokensForUser } = require('./routes/push')

let syncTimer = null
let lastSync  = null
let syncLog   = []  // in-memory log der letzten Syncs

function addLog(msg, type = 'info') {
  const entry = { ts: new Date().toISOString(), msg, type }
  syncLog.unshift(entry)
  if (syncLog.length > 100) syncLog.pop()
  console.log(`[SYNC] ${entry.ts} ${msg}`)
}

function getIntervalMs() {
  const minutes = parseInt(localDb.getSetting('sync_interval_minutes') || '5')
  return Math.max(1, minutes) * 60 * 1000
}

// ── Urlaub: prüfe ob HWTER-Einträge sich geändert haben ──────────────────
async function syncVacation(pool) {
  // Alle offenen Urlaubsanträge aus lokaler DB
  const pending = localDb.db.prepare(
    "SELECT * FROM vacation_requests WHERE status = 'pending'"
  ).all()

  for (const vr of pending) {
    try {
      // In HWTER nach TER_UrlaubsantragLfdNr suchen
      const rows = await pool.request()
        .input('lfdnr', vr.id)
        .query(`SELECT RecNo, TER_FehlzeitArt, Geloescht
                FROM HWTER WHERE TER_UrlaubsantragLfdNr = @lfdnr`)

      if (!rows.recordset?.length) continue

      const row = rows.recordset[0]
      const art = row.TER_FehlzeitArt
      const del = row.Geloescht

      if (del === true || del === 1) {
        // Abgelehnt in Powerbird
        localDb.db.prepare(
          "UPDATE vacation_requests SET status='rejected', rejection_reason='In Powerbird abgelehnt', updated_at=datetime('now') WHERE id=?"
        ).run(vr.id)
        addLog(`Urlaub #${vr.id} (${vr.user_id}): in Powerbird abgelehnt → status=rejected`)
        // Push an Mitarbeiter
        try {
          const u = localDb.db.prepare('SELECT * FROM users WHERE id=?').get(vr.user_id)
          if (u) {
            const tokens = getTokensForUser(vr.user_id)
            await sendPush(tokens, 'Urlaubsantrag abgelehnt', `${new Date(vr.from_date).toLocaleDateString('de-DE')} – ${new Date(vr.to_date).toLocaleDateString('de-DE')}`)
          }
        } catch(e) { addLog(`Push-Fehler: ${e.message}`, 'warn') }

      } else if (art === 18 || art === 19) {
        // Genehmigt in Powerbird
        const approver = localDb.db.prepare("SELECT id FROM users WHERE role IN ('admin','vacation_approver') LIMIT 1").get()
        localDb.db.prepare(
          "UPDATE vacation_requests SET status='approved', approved_by=?, updated_at=datetime('now') WHERE id=?"
        ).run(approver?.id || null, vr.id)
        addLog(`Urlaub #${vr.id}: FehlzeitArt=${art} → status=approved`)
        try {
          const tokens = getTokensForUser(vr.user_id)
          await sendPush(tokens, 'Urlaub genehmigt ✓', `${new Date(vr.from_date).toLocaleDateString('de-DE')} – ${new Date(vr.to_date).toLocaleDateString('de-DE')}`)
        } catch(e) { addLog(`Push-Fehler: ${e.message}`, 'warn') }
      }
    } catch(e) {
      addLog(`Fehler bei Urlaub #${vr.id}: ${e.message}`, 'error')
    }
  }
}

// ── Krankmeldungen: nur extern eingetragene aus Powerbird spiegeln ─────────
async function syncKrank(pool) {
  // Nur Krankmeldungen die NICHT aus unserem Portal stammen (hwter_recno bereits bekannt = von uns)
  // Von uns eingetragene haben bereits einen lokalen Eintrag mit hwter_recno gesetzt
  const rows = await pool.request().query(`
    SELECT RecNo, Termin_ResourceName, Termin_Start, Termin_Ende
    FROM HWTER
    WHERE TER_FehlzeitArt = 33
      AND Geloescht = 0
      AND Termin_Start >= DATEADD(day, -90, GETDATE())
  `)
  if (!rows.recordset?.length) return

  let newCount = 0
  for (const r of rows.recordset) {
    // Prüfe ob bereits in lokaler DB (egal ob durch Portal oder Sync)
    const exists = localDb.db.prepare(
      'SELECT id FROM sick_reports WHERE hwter_recno = ?'
    ).get(r.RecNo)
    if (exists) continue

    // Prüfe ob es einen lokalen Eintrag ohne hwter_recno gibt der zeitlich passt
    // (eingetragen aber hwter_recno noch nicht gesetzt weil async)
    const user = localDb.db.prepare('SELECT id FROM users WHERE powerbird_id = ?').get(r.Termin_ResourceName)
    if (!user) continue

    const fromDate = new Date(r.Termin_Start).toISOString().split('T')[0]
    const toDate   = new Date(r.Termin_Ende).toISOString().split('T')[0]

    const matchLocal = localDb.db.prepare(
      'SELECT id FROM sick_reports WHERE user_id=? AND from_date=? AND to_date=?'
    ).get(user.id, fromDate, toDate)

    if (matchLocal) {
      // hwter_recno nachtragen
      localDb.db.prepare('UPDATE sick_reports SET hwter_recno=? WHERE id=?').run(r.RecNo, matchLocal.id)
      continue
    }

    // Wirklich neu (extern in Powerbird eingetragen)
    try {
      localDb.db.prepare(`
        INSERT OR IGNORE INTO sick_reports (user_id, hwter_recno, from_date, to_date, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(user.id, r.RecNo, fromDate, toDate)
      newCount++
    } catch(e) {
      addLog(`Krankmeldung Insert-Fehler: ${e.message}`, 'warn')
    }
  }
  if (newCount > 0) addLog(`Krankmeldungen: ${newCount} neue aus Powerbird synchronisiert`)
}

// ── Termine: Statistik wie viele Termine heute/morgen existieren ──────────
async function syncTermine(pool) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const r = await pool.request().input('today', today).query(`
      SELECT COUNT(*) AS cnt FROM HWTER
      WHERE CAST(Termin_Start AS DATE) >= @today
        AND Geloescht = 0
        AND Termin_ResourceArt = 'Mitarbeiter'
    `)
    const cnt = r.recordset[0]?.cnt || 0
    localDb.setSetting('sync_termine_count', cnt)
    localDb.setSetting('sync_last_termine_check', new Date().toISOString())
  } catch(e) {
    addLog(`Termine-Check Fehler: ${e.message}`, 'warn')
  }
}

// ── Haupt-Sync-Funktion ───────────────────────────────────────────────────
async function runSync() {
  const enabled = localDb.getSetting('sync_enabled')
  if (enabled === 'false') {
    addLog('Sync deaktiviert - überspringe')
    return
  }

  addLog('Sync gestartet...')
  lastSync = new Date()

  try {
    const pool = await pbDb.getPool()

    await syncVacation(pool)
    await syncKrank(pool)
    await syncTermine(pool)

    localDb.setSetting('sync_last_run', lastSync.toISOString())
    localDb.setSetting('sync_last_status', 'ok')
    addLog('Sync abgeschlossen ✓')
  } catch(e) {
    addLog(`Sync Fehler: ${e.message}`, 'error')
    localDb.setSetting('sync_last_status', 'error: ' + e.message)
  }
}

// ── Timer-Steuerung ───────────────────────────────────────────────────────
function startSync() {
  if (syncTimer) clearInterval(syncTimer)
  const ms = getIntervalMs()
  addLog(`Sync-Job gestartet (Intervall: ${ms/60000} Minuten)`)
  syncTimer = setInterval(runSync, ms)
  // Sofort beim Start einmal laufen
  setTimeout(runSync, 5000)
}

function restartSync() {
  addLog('Sync-Job neu gestartet (Intervall geändert)')
  startSync()
}

function getStatus() {
  return {
    enabled:          localDb.getSetting('sync_enabled') !== 'false',
    intervalMinutes:  parseInt(localDb.getSetting('sync_interval_minutes') || '5'),
    lastRun:          localDb.getSetting('sync_last_run') || null,
    lastStatus:       localDb.getSetting('sync_last_status') || null,
    lastTermineCount: parseInt(localDb.getSetting('sync_termine_count') || '0'),
    log:              syncLog.slice(0, 20),
  }
}

module.exports = { startSync, restartSync, runSync, getStatus }
