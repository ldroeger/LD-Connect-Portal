// ── Werkzeug-Cache Modul ──────────────────────────────────────────────────
// Speichert Werkzeugdaten in SQLite, synchronisiert alle 10 Minuten

const localDb = require('./db/localDb')
const pbDb    = require('./db/powerbirdDb')

// Tabellen anlegen
try {
  localDb.db.exec(`
    CREATE TABLE IF NOT EXISTS tools_cache (
      recno       TEXT PRIMARY KEY,
      data        TEXT NOT NULL,
      updated_at  INTEGER DEFAULT (unixepoch())
    )
  `)
  localDb.db.exec(`
    CREATE TABLE IF NOT EXISTS tools_cache_meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    )
  `)
} catch(e) {}

const CACHE_TTL_MINUTES = 10

function getLastSync() {
  const row = localDb.db.prepare("SELECT value FROM tools_cache_meta WHERE key='last_sync'").get()
  return row ? parseInt(row.value) : 0
}

function setLastSync() {
  localDb.db.prepare("INSERT OR REPLACE INTO tools_cache_meta (key,value) VALUES ('last_sync',?)").run(String(Date.now()))
}

function getCacheAge() {
  return Math.round((Date.now() - getLastSync()) / 1000 / 60)
}

function isCacheStale() {
  return getCacheAge() >= CACHE_TTL_MINUTES
}

async function syncTools() {
  try {
    const pool = await pbDb.getPool()
    const result = await pool.request().query(`
      SELECT
        CAST(w.RecNo AS VARCHAR) AS recno,
        LTRIM(RTRIM(ISNULL(w.LAN,'')))             AS LAN,
        LTRIM(RTRIM(ISNULL(w.Intern_Nr,'')))        AS InternNr,
        LTRIM(RTRIM(ISNULL(w.Bezeichnung,'')))      AS Bezeichnung,
        LTRIM(RTRIM(ISNULL(w.WZV_WZNr,'')))         AS WZNr,
        LTRIM(RTRIM(ISNULL(w.WZV_WZNr_1,'')))       AS WZNr1,
        LTRIM(RTRIM(ISNULL(w.WZV_Lagerort,'')))     AS Lagerort,
        LTRIM(RTRIM(ISNULL(w.WZV_Zustand,'')))      AS Zustand,
        LTRIM(RTRIM(ISNULL(w.WZV_Bilddatei,'')))    AS Bilddatei,
        w.WZV_Status                                 AS WZVStatus,
        CONVERT(varchar(10), w.WZV_DefektSeit, 120)      AS DefektSeit,
        CONVERT(varchar(10), w.WZV_AusgemustertAm, 120)  AS AusgemustertAm,
        LTRIM(RTRIM(ISNULL(w.Verleih_AnMitarb,'')))  AS VerliehAnMitarb,
        LTRIM(RTRIM(ISNULL(w.MitgenommenVon,'')))    AS MitgenommenVon,
        CONVERT(varchar(10), w.Verleih_AusgabeAm, 120)   AS AusgabeAm,
        CONVERT(varchar(10), w.Verleih_RueckgabeAm, 120) AS RueckgabeAm,
        w.WZV_VerliehenAnADR AS VerleihTyp,
        ISNULL((SELECT TOP 1
          LTRIM(RTRIM(ISNULL(m.Adresse_Vorname,'')))
          + CASE WHEN LTRIM(RTRIM(ISNULL(m.Adresse_Nachname,''))) != '' THEN ' ' + LTRIM(RTRIM(m.Adresse_Nachname)) ELSE '' END
          FROM ELMIT m WHERE LTRIM(RTRIM(ISNULL(m.Mitarbeiter_Nr,''))) = LTRIM(RTRIM(ISNULL(w.Verleih_AnMitarb,'')))), '') AS MitarbName,
        ISNULL((SELECT TOP 1
          LTRIM(RTRIM(ISNULL(m.Adresse_Vorname,'')))
          + CASE WHEN LTRIM(RTRIM(ISNULL(m.Adresse_Nachname,''))) != '' THEN ' ' + LTRIM(RTRIM(m.Adresse_Nachname)) ELSE '' END
          FROM ELMIT m WHERE LTRIM(RTRIM(ISNULL(m.Mitarbeiter_Nr,''))) = LTRIM(RTRIM(ISNULL(w.MitgenommenVon,'')))), '') AS MitgenommenName,
        CASE WHEN w.WZV_VerliehenAnADR = 1 THEN
          ISNULL((SELECT TOP 1 LTRIM(RTRIM(ISNULL(k.Adresse_Name1,'')))
            FROM ELKUN k WHERE LTRIM(RTRIM(k.Kunde_KundenNr)) = LTRIM(RTRIM(ISNULL(w.Verleih_AnMitarb,'')))), '')
        ELSE '' END AS KundenName,
        CASE WHEN w.WZV_VerliehenAnADR = 3 THEN
          ISNULL((SELECT TOP 1 LTRIM(RTRIM(ISNULL(l.Lieferant_Name1,'')))
            FROM ELLIF l WHERE LTRIM(RTRIM(l.Lieferant_LiefNr)) = LTRIM(RTRIM(ISNULL(w.Verleih_AnMitarb,'')))), '')
        ELSE '' END AS LiefName
      FROM ELWZV w
      WHERE ISNULL(w.WZV_AusgemustertAm, '') = ''
        AND w.WZV_Status != 4
      ORDER BY w.Bezeichnung ASC
    `)

    const stmt = localDb.db.prepare('INSERT OR REPLACE INTO tools_cache (recno, data, updated_at) VALUES (?,?,unixepoch())')
    const deleteAll = localDb.db.prepare('DELETE FROM tools_cache')
    const transaction = localDb.db.transaction((rows) => {
      deleteAll.run()
      for (const row of rows) {
        stmt.run(String(row.recno || row.RecNo), JSON.stringify(row))
      }
    })
    transaction(result.recordset)
    setLastSync()
    console.log(`[tools-cache] Sync: ${result.recordset.length} Werkzeuge gespeichert`)
    return result.recordset.length
  } catch(e) {
    console.error('[tools-cache] Sync-Fehler:', e.message)
    return 0
  }
}

function getAllFromCache() {
  return localDb.db.prepare('SELECT data FROM tools_cache ORDER BY rowid ASC').all()
    .map(r => JSON.parse(r.data))
}

function searchCache(q) {
  if (!q) return getAllFromCache()
  const lower = q.toLowerCase()
  return getAllFromCache().filter(w =>
    (w.Bezeichnung||'').toLowerCase().includes(lower) ||
    (w.InternNr||'').toLowerCase().includes(lower) ||
    (w.WZNr||'').toLowerCase().includes(lower) ||
    (w.WZNr1||'').toLowerCase().includes(lower) ||
    (w.LAN||'').toLowerCase().includes(lower) ||
    (w.Lagerort||'').toLowerCase().includes(lower)
  )
}

function getCacheCount() {
  return localDb.db.prepare('SELECT COUNT(*) as n FROM tools_cache').get().n
}

// Auto-Sync alle 10 Minuten
function startAutoSync() {
  // Initial sync beim Start
  syncTools().catch(e => console.error('[tools-cache] Initial sync error:', e.message))
  // Danach alle 10 Minuten
  setInterval(() => {
    syncTools().catch(e => console.error('[tools-cache] Auto-sync error:', e.message))
  }, CACHE_TTL_MINUTES * 60 * 1000)
}

module.exports = { syncTools, getAllFromCache, searchCache, isCacheStale, getCacheAge, getCacheCount, startAutoSync }
