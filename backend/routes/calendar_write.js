/**
 * LD Connect – Schreibzugriff auf Powerbird HWTER
 *
 * Fehlzeit-Arten (TER_FehlzeitArt):
 *   17 = Urlaubsantrag gestellt (beantragt)
 *   18 = Urlaub genehmigt
 *   33 = Krankmeldung
 *    0 = normaler Termin
 */

const express = require('express')
const router  = express.Router()
const { authMiddleware: requireAuth } = require('../middleware/auth')

// ─── Powerbird Pool Helper ────────────────────────────────────────────────────
async function getPbPool() {
  const pbDb = require('../db/powerbirdDb')
  // powerbirdDb exports a query function and a pool getter
  if (typeof pbDb.getPool === 'function') return pbDb.getPool()
  // Otherwise create a wrapper that mimics mssql pool
  return {
    request: () => {
      const inputs = {}
      const req = {
        input: (name, val) => { inputs[name] = val; return req },
        query: async (sql) => pbDb.query(sql, inputs)
      }
      return req
    }
  }
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function calcLength(start, end) {
  return Math.max(0, Math.round((new Date(end) - new Date(start)) / 60000))
}

function buildRecord({ label, info='', start, end, resourceName, color=0,
                        fehlzeitArt=0, urlaubLfdNr=null, mitarbeiterNr=0, ganzerTag=false }) {
  const length = ganzerTag ? 480 : calcLength(start, end)
  return {
    Termin_Start:             new Date(start),
    Termin_Ende:              ganzerTag ? new Date(start) : new Date(end || start),
    Termin_Length:            length,
    Termin_ResourceArt:       'Mitarbeiter',
    Termin_ResourceArt_1:     'MITARBEITER',
    Termin_ResourceName:      resourceName,
    Termin_ResourceName_1:    resourceName,
    Termin_Label:             label || '',
    Termin_Info:              info || '',
    Termin_Color:             color,
    Termin_SerialRecNo:       0,
    Termin_SerialMode:        0,
    Termin_Serientyp:         0,
    AdrType:                  0,
    AdrNr:                    '',
    DocType:                  0,
    DocNr:                    '',
    Preset:                   '',
    TER_FehlzeitArt:          fehlzeitArt,
    TER_UrlaubsantragLfdNr:   urlaubLfdNr,
    EinsatzResId:             '',
    EinsatzResId_1:           '',
    EinsatzResName:           '',
    EinsatzResName_1:         '',
    KfzResId:                 '',
    KfzResId_1:               '',
    KfzResName:               '',
    KfzResName_1:             '',
    TER_CreateDate:           new Date(),
    TER_CreateUser:           mitarbeiterNr,
    TER_ModifyDate:           new Date(),
    TER_ModifyUser:           mitarbeiterNr,
    InterneNr:                0,
    ErinnerungsIntervall:     0,
    VorgangJN:                false,
    Geloescht:                false,
    OutlookId:                '',
    Version:                  0,
    Status:                   0,
    Lohnart:                  fehlzeitArt === 33 ? '97' : (fehlzeitArt > 0 ? '98' : ''),
    Lohnart_1:                fehlzeitArt === 33 ? '97' : (fehlzeitArt > 0 ? '98' : ''),
    ZEF_Buchung:              fehlzeitArt > 0 ? 1 : 0,
    Private:                  false,
    MAfaktor:                 1,
    LengthFromAbz:            false,
    TvTarTerminart:           '',
    TvTarTerminart_1:         '',
    TvTatTerminThema:         '',
    TvTatTerminThema_1:       '',
    TerminHerkunft:           0,
    AppointmentGUID:          '',
    WV_Nr:                    '',
    TER_BestaetAutomJN:       false,
    TER_Versandart:           0,
    TER_EmpfaengerEMail:      '',
    TER_EmpfaengerMobil:      '',
    TER_OutlookAnzeige:       2,
    TER_BestaetStatus:        0,
    TER_EmpfaengerAnfrage:    '',
    TER_VersandartAutom:      0,
    TER_KurzinfoTermin:       '',
    TER_Locked:               false,
  }
}

async function insertRecord(pool, record) {
  const cols = Object.keys(record).join(', ')
  const vals = Object.keys(record).map((_, i) => `@p${i}`).join(', ')
  const req  = pool.request()
  Object.values(record).forEach((v, i) => req.input(`p${i}`, v))
  // Use SCOPE_IDENTITY() instead of OUTPUT clause to avoid trigger conflict
  await req.query(`INSERT INTO HWTER (${cols}) VALUES (${vals})`)
  const idRes = await pool.request().query('SELECT CAST(SCOPE_IDENTITY() AS INT) AS RecNo')
  return idRes.recordset[0].RecNo
}

// ─── TERMIN ANLEGEN ───────────────────────────────────────────────────────────

router.post('/termin', requireAuth, async (req, res) => {
  const { label, info, start, end, ganzerTag=false, color=0 } = req.body
  const user = req.user
  if (!label || !start) return res.status(400).json({ error: 'label und start sind Pflichtfelder' })
  if (!user.powerbird_id) return res.status(400).json({ error: 'Kein Powerbird-Kürzel für diesen Benutzer hinterlegt' })
  try {
    const pool   = await getPbPool()
    const record = buildRecord({ label, info, start, end: end||start, resourceName: user.powerbird_id, color, ganzerTag, mitarbeiterNr: user.mitarbeiter_nr||0 })
    const recno  = await insertRecord(pool, record)
    res.json({ success:true, recno })
  } catch(e) {
    console.error('Termin anlegen:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ─── TERMIN BEARBEITEN ────────────────────────────────────────────────────────

router.put('/termin/:recno', requireAuth, async (req, res) => {
  const { label, info, start, end, ganzerTag=false, color } = req.body
  const user = req.user
  if (!label || !start) return res.status(400).json({ error: 'label und start sind Pflichtfelder' })
  try {
    const pool = await getPbPool()
    const check = await pool.request().input('recno', req.params.recno)
      .query('SELECT RecNo, Termin_ResourceName, TER_Locked, TER_FehlzeitArt FROM HWTER WHERE RecNo=@recno AND Geloescht=0')
    if (!check.recordset.length) return res.status(404).json({ error: 'Termin nicht gefunden' })
    const t = check.recordset[0]
    if (t.TER_Locked) return res.status(403).json({ error: 'Termin ist gesperrt' })
    if (!user.is_admin && t.Termin_ResourceName !== user.powerbird_id) return res.status(403).json({ error: 'Keine Berechtigung' })
    const length = ganzerTag ? 480 : calcLength(start, end||start)
    await pool.request()
      .input('recno',   req.params.recno)
      .input('label',   label)
      .input('info',    info||'')
      .input('start',   new Date(start))
      .input('ende',    ganzerTag ? new Date(start) : new Date(end||start))
      .input('length',  length)
      .input('color',   color??0)
      .input('modDate', new Date())
      .input('modUser', user.mitarbeiter_nr||0)
      .query(`UPDATE HWTER SET Termin_Label=@label, Termin_Info=@info, Termin_Start=@start, Termin_Ende=@ende, Termin_Length=@length, Termin_Color=@color, TER_ModifyDate=@modDate, TER_ModifyUser=@modUser WHERE RecNo=@recno AND Geloescht=0`)
    res.json({ success:true })
  } catch(e) {
    console.error('Termin bearbeiten:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ─── TERMIN LÖSCHEN ───────────────────────────────────────────────────────────

router.delete('/termin/:recno', requireAuth, async (req, res) => {
  const user = req.user
  try {
    const pool = await getPbPool()
    const check = await pool.request().input('recno', req.params.recno)
      .query('SELECT RecNo, Termin_ResourceName, TER_Locked, TER_FehlzeitArt FROM HWTER WHERE RecNo=@recno AND Geloescht=0')
    if (!check.recordset.length) return res.status(404).json({ error: 'Termin nicht gefunden' })
    const t = check.recordset[0]
    if (t.TER_Locked) return res.status(403).json({ error: 'Termin ist gesperrt' })
    if (!user.is_admin && t.Termin_ResourceName !== user.powerbird_id) return res.status(403).json({ error: 'Keine Berechtigung' })
    if (t.TER_FehlzeitArt > 0 && !user.is_admin) return res.status(403).json({ error: 'Fehlzeit-Termine können nur von Admins gelöscht werden' })
    await pool.request()
      .input('recno', req.params.recno).input('modDate', new Date()).input('modUser', user.mitarbeiter_nr||0)
      .query('UPDATE HWTER SET Geloescht=1, TER_ModifyDate=@modDate, TER_ModifyUser=@modUser WHERE RecNo=@recno')
    res.json({ success:true })
  } catch(e) {
    console.error('Termin löschen:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ─── URLAUBSANTRAG → Termin mit FehlzeitArt 17 (beantragt) ───────────────────
// Wird beim Stellen des Antrags aufgerufen

router.post('/urlaub-beantragen', requireAuth, async (req, res) => {
  const { urlaubLfdNr, start, end, mitarbeiterKuerzel, mitarbeiterNr } = req.body
  if (!start || !end || !mitarbeiterKuerzel) return res.status(400).json({ error: 'start, end, mitarbeiterKuerzel erforderlich' })
  if (!req.user.is_admin && req.user.powerbird_id !== mitarbeiterKuerzel) return res.status(403).json({ error: 'Keine Berechtigung' })
  try {
    const pool = await getPbPool()
    // Prüfen ob bereits ein Termin existiert
    if (urlaubLfdNr) {
      const ex = await pool.request().input('lfdnr', urlaubLfdNr)
        .query('SELECT RecNo FROM HWTER WHERE TER_UrlaubsantragLfdNr=@lfdnr AND Geloescht=0')
      if (ex.recordset.length) return res.json({ success:true, recno: ex.recordset[0].RecNo, existed:true })
    }
    const startD = new Date(start), endD = new Date(end)
    const days   = Math.max(1, Math.round((endD - startD) / 86400000) + 1)
    const record = buildRecord({
      label:         'Urlaub beantragt',
      info:          urlaubLfdNr ? `Urlaubsantrag #${urlaubLfdNr}` : 'Urlaubsantrag',
      start, end,
      resourceName:  mitarbeiterKuerzel,
      fehlzeitArt:   17,            // beantragt
      urlaubLfdNr:   urlaubLfdNr || null,
      mitarbeiterNr: mitarbeiterNr || req.user.mitarbeiter_nr || 0,
      ganzerTag:     true,
    })
    record.Termin_Length = days * 480
    const recno = await insertRecord(pool, record)
    res.json({ success:true, recno })
  } catch(e) {
    console.error('Urlaub beantragen:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ─── URLAUB GENEHMIGEN → FehlzeitArt 17→18 ───────────────────────────────────
// Wird von VacationApprovePage aufgerufen

router.post('/urlaub-termin', requireAuth, async (req, res) => {
  const { urlaubLfdNr, start, end, mitarbeiterKuerzel, mitarbeiterNr, fehlzeitArt } = req.body
  if (!start || !end || !mitarbeiterKuerzel) return res.status(400).json({ error: 'start, end, mitarbeiterKuerzel erforderlich' })
  if (!req.user.is_admin && req.user.powerbird_id !== mitarbeiterKuerzel) return res.status(403).json({ error: 'Keine Berechtigung' })
  try {
    const pool = await getPbPool()

    // Wenn bereits ein Antrag-Termin (FehlzeitArt=17) existiert → auf 18 (genehmigt) updaten
    if (urlaubLfdNr) {
      const ex = await pool.request().input('lfdnr', urlaubLfdNr)
        .query('SELECT RecNo, TER_FehlzeitArt FROM HWTER WHERE TER_UrlaubsantragLfdNr=@lfdnr AND Geloescht=0')
      if (ex.recordset.length) {
        await pool.request()
          .input('recno',   ex.recordset[0].RecNo)
          .input('modDate', new Date())
          .input('modUser', req.user.mitarbeiter_nr || 0)
          .query(`UPDATE HWTER SET
            TER_FehlzeitArt = 18,
            Termin_Label    = 'Urlaub',
            TER_ModifyDate  = @modDate,
            TER_ModifyUser  = @modUser
            WHERE RecNo = @recno`)
        return res.json({ success:true, recno: ex.recordset[0].RecNo, updated:true })
      }
    }

    // Kein Antrag-Termin vorhanden → neu anlegen direkt als genehmigt (18)
    const startD = new Date(start), endD = new Date(end)
    const days   = Math.max(1, Math.round((endD - startD) / 86400000) + 1)
    const record = buildRecord({
      label:         'Urlaub',
      info:          urlaubLfdNr ? `Urlaubsantrag #${urlaubLfdNr}` : 'Urlaub genehmigt',
      start, end,
      resourceName:  mitarbeiterKuerzel,
      fehlzeitArt:   18,            // genehmigt
      urlaubLfdNr:   urlaubLfdNr || null,
      mitarbeiterNr: mitarbeiterNr || req.user.mitarbeiter_nr || 0,
      ganzerTag:     true,
    })
    record.Termin_Length = days * 480
    const recno = await insertRecord(pool, record)
    res.json({ success:true, recno })
  } catch(e) {
    console.error('Urlaubstermin genehmigen:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ─── URLAUB ABLEHNEN → Termin löschen ────────────────────────────────────────

router.delete('/urlaub-termin/:urlaubLfdNr', requireAuth, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Nur Admins' })
  try {
    const pool = await getPbPool()
    await pool.request()
      .input('lfdnr',   req.params.urlaubLfdNr)
      .input('modDate', new Date())
      .input('modUser', req.user.mitarbeiter_nr || 0)
      .query('UPDATE HWTER SET Geloescht=1, TER_ModifyDate=@modDate, TER_ModifyUser=@modUser WHERE TER_UrlaubsantragLfdNr=@lfdnr AND Geloescht=0')
    res.json({ success:true })
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── KRANKMELDUNG → FehlzeitArt 33 ──────────────────────────────────────────

router.post('/krankmeldung', requireAuth, async (req, res) => {
  const { start, end, info='' } = req.body
  const user = req.user
  if (!start) return res.status(400).json({ error: 'Startdatum erforderlich' })
  if (!user.powerbird_id) return res.status(400).json({ error: 'Kein Powerbird-Kürzel für diesen Benutzer' })
  try {
    const pool   = await getPbPool()
    const endD   = end ? new Date(end) : new Date(start)
    const startD = new Date(start)
    const days   = Math.max(1, Math.round((endD - startD) / 86400000) + 1)
    const record = buildRecord({
      label:         'Krank',
      info:          info || 'Krankmeldung',
      start,
      end:           end || start,
      resourceName:  user.powerbird_id,
      fehlzeitArt:   33,            // Krankmeldung
      mitarbeiterNr: user.mitarbeiter_nr || 0,
      ganzerTag:     true,
    })
    record.Termin_Length = days * 480
    const recno = await insertRecord(pool, record)
    console.log(`Krankmeldung angelegt: RecNo=${recno}, Mitarbeiter=${user.powerbird_id}, ${start}–${end||start}`)
    res.json({ success:true, recno })
  } catch(e) {
    console.error('Krankmeldung:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ─── KRANKMELDUNG LÖSCHEN (Genesung) ─────────────────────────────────────────

router.delete('/krankmeldung/:recno', requireAuth, async (req, res) => {
  const user = req.user
  try {
    const pool  = await getPbPool()
    const check = await pool.request().input('recno', req.params.recno)
      .query('SELECT RecNo, Termin_ResourceName, TER_FehlzeitArt FROM HWTER WHERE RecNo=@recno AND Geloescht=0')
    if (!check.recordset.length) return res.status(404).json({ error: 'Termin nicht gefunden' })
    const t = check.recordset[0]
    if (t.TER_FehlzeitArt !== 33) return res.status(400).json({ error: 'Kein Krankheitstermin' })
    if (!user.is_admin && t.Termin_ResourceName !== user.powerbird_id) return res.status(403).json({ error: 'Keine Berechtigung' })
    await pool.request()
      .input('recno',   req.params.recno)
      .input('modDate', new Date())
      .input('modUser', user.mitarbeiter_nr || 0)
      .query('UPDATE HWTER SET Geloescht=1, TER_ModifyDate=@modDate, TER_ModifyUser=@modUser WHERE RecNo=@recno')
    res.json({ success:true })
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
