/**
 * LD Connect – Schreibzugriff auf Powerbird HWTER
 * Termine anlegen, bearbeiten, löschen
 * Urlaub als Fehlzeit-Termin anlegen
 */

const express = require('express')
const router = express.Router()
const { getPbPool } = require('../db/powerbird')
const { requireAuth } = require('../middleware/auth')

// ─── HELFER ────────────────────────────────────────────────────

/**
 * Berechnet Termin_Length in Minuten
 */
function calcLength(start, end) {
  const s = new Date(start)
  const e = new Date(end)
  return Math.max(0, Math.round((e - s) / 60000))
}

/**
 * Baut das INSERT/UPDATE Objekt für HWTER
 */
function buildTerminRecord({ label, info = '', start, end, resourceName, color = 0, fehlzeitArt = 0, urlaubLfdNr = null, mitarbeiterNr = 0, ganzerTag = false }) {
  const length = ganzerTag
    ? 480 // Ganztag = 8h
    : calcLength(start, end)

  return {
    Termin_Start:        new Date(start),
    Termin_Ende:         ganzerTag ? new Date(start) : new Date(end),
    Termin_Length:       length,
    Termin_ResourceArt:  'Mitarbeiter',
    Termin_ResourceArt_1:'',
    Termin_ResourceName: resourceName,
    Termin_ResourceName_1:'',
    Termin_Label:        label || '',
    Termin_Info:         info || '',
    Termin_Color:        color,
    Termin_SerialRecNo:  0,
    Termin_SerialMode:   0,
    Termin_Serientyp:    0,
    AdrType:             0,
    AdrNr:               '',
    DocType:             0,
    DocNr:               '',
    Preset:              '',
    TER_FehlzeitArt:     fehlzeitArt,
    TER_UrlaubsantragLfdNr: urlaubLfdNr,
    EinsatzResId:        '',
    EinsatzResId_1:      '',
    EinsatzResName:      '',
    EinsatzResName_1:    '',
    KfzResId:            '',
    KfzResId_1:          '',
    KfzResName:          '',
    KfzResName_1:        '',
    TER_CreateDate:      new Date(),
    TER_CreateUser:      mitarbeiterNr,
    TER_ModifyDate:      new Date(),
    TER_ModifyUser:      mitarbeiterNr,
    InterneNr:           0,
    ErinnerungsIntervall:0,
    VorgangJN:           false,
    Geloescht:           false,
    OutlookId:           '',
    Version:             0,
    Status:              0,
    Lohnart:             '',
    Lohnart_1:           '',
    ZEF_Buchung:         0,
    Private:             false,
    MAfaktor:            1,
    LengthFromAbz:       false,
    TvTarTerminart:      '',
    TvTarTerminart_1:    '',
    TvTatTerminThema:    '',
    TvTatTerminThema_1:  '',
    TerminHerkunft:      0,
    AppointmentGUID:     '',
    WV_Nr:               '',
    TER_BestaetAutomJN:  false,
    TER_Versandart:      0,
    TER_EmpfaengerEMail: '',
    TER_EmpfaengerMobil: '',
    TER_OutlookAnzeige:  2,
    TER_BestaetStatus:   0,
    TER_EmpfaengerAnfrage:'',
    TER_VersandartAutom: 0,
    TER_KurzinfoTermin:  '',
    TER_Locked:          false,
  }
}

// ─── TERMIN ANLEGEN ────────────────────────────────────────────

/**
 * POST /api/calendar/termin
 * Body: { label, info, start, end, ganzerTag?, color? }
 */
router.post('/termin', requireAuth, async (req, res) => {
  const { label, info, start, end, ganzerTag = false, color = 0 } = req.body
  const user = req.user

  if (!label || !start) {
    return res.status(400).json({ error: 'label und start sind Pflichtfelder' })
  }
  if (!user.kuerzel) {
    return res.status(400).json({ error: 'Kein Mitarbeiter-Kürzel für diesen Benutzer hinterlegt' })
  }

  try {
    const pool = await getPbPool()
    const record = buildTerminRecord({
      label, info, start,
      end: end || start,
      resourceName: user.kuerzel,
      color,
      ganzerTag,
      mitarbeiterNr: user.mitarbeiter_nr || 0,
    })

    const cols = Object.keys(record).join(', ')
    const vals = Object.keys(record).map((_, i) => `@p${i}`).join(', ')
    const request = pool.request()
    Object.values(record).forEach((v, i) => request.input(`p${i}`, v))

    const result = await request.query(
      `INSERT INTO HWTER (${cols}) OUTPUT INSERTED.RecNo VALUES (${vals})`
    )
    const recno = result.recordset[0].RecNo
    res.json({ success: true, recno })
  } catch (e) {
    console.error('Termin anlegen Fehler:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ─── TERMIN BEARBEITEN ─────────────────────────────────────────

/**
 * PUT /api/calendar/termin/:recno
 * Body: { label, info, start, end, ganzerTag?, color? }
 */
router.put('/termin/:recno', requireAuth, async (req, res) => {
  const { recno } = req.params
  const { label, info, start, end, ganzerTag = false, color } = req.body
  const user = req.user

  if (!label || !start) {
    return res.status(400).json({ error: 'label und start sind Pflichtfelder' })
  }

  try {
    const pool = await getPbPool()

    // Prüfen ob Termin dem Mitarbeiter gehört
    const check = await pool.request()
      .input('recno', recno)
      .input('kuerzel', user.kuerzel)
      .query(`SELECT RecNo, Termin_ResourceName, TER_Locked FROM HWTER WHERE RecNo = @recno AND Geloescht = 0`)

    if (!check.recordset.length) {
      return res.status(404).json({ error: 'Termin nicht gefunden' })
    }

    const termin = check.recordset[0]
    if (termin.TER_Locked) {
      return res.status(403).json({ error: 'Termin ist gesperrt und kann nicht bearbeitet werden' })
    }
    // Nur eigene Termine bearbeiten (außer Admin)
    if (!user.is_admin && termin.Termin_ResourceName !== user.kuerzel) {
      return res.status(403).json({ error: 'Keine Berechtigung für diesen Termin' })
    }

    const length = ganzerTag ? 480 : calcLength(start, end || start)

    await pool.request()
      .input('recno',    recno)
      .input('label',    label)
      .input('info',     info || '')
      .input('start',    new Date(start))
      .input('ende',     ganzerTag ? new Date(start) : new Date(end || start))
      .input('length',   length)
      .input('color',    color ?? 0)
      .input('modDate',  new Date())
      .input('modUser',  user.mitarbeiter_nr || 0)
      .query(`
        UPDATE HWTER SET
          Termin_Label   = @label,
          Termin_Info    = @info,
          Termin_Start   = @start,
          Termin_Ende    = @ende,
          Termin_Length  = @length,
          Termin_Color   = @color,
          TER_ModifyDate = @modDate,
          TER_ModifyUser = @modUser
        WHERE RecNo = @recno AND Geloescht = 0
      `)

    res.json({ success: true })
  } catch (e) {
    console.error('Termin bearbeiten Fehler:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ─── TERMIN LÖSCHEN ────────────────────────────────────────────

/**
 * DELETE /api/calendar/termin/:recno
 */
router.delete('/termin/:recno', requireAuth, async (req, res) => {
  const { recno } = req.params
  const user = req.user

  try {
    const pool = await getPbPool()

    const check = await pool.request()
      .input('recno', recno)
      .query(`SELECT RecNo, Termin_ResourceName, TER_Locked, TER_FehlzeitArt FROM HWTER WHERE RecNo = @recno AND Geloescht = 0`)

    if (!check.recordset.length) {
      return res.status(404).json({ error: 'Termin nicht gefunden' })
    }

    const termin = check.recordset[0]
    if (termin.TER_Locked) {
      return res.status(403).json({ error: 'Termin ist gesperrt und kann nicht gelöscht werden' })
    }
    if (!user.is_admin && termin.Termin_ResourceName !== user.kuerzel) {
      return res.status(403).json({ error: 'Keine Berechtigung für diesen Termin' })
    }
    // Urlaubstermine nicht direkt löschen
    if (termin.TER_FehlzeitArt > 0 && !user.is_admin) {
      return res.status(403).json({ error: 'Urlaubstermine können nicht direkt gelöscht werden' })
    }

    // Soft-Delete
    await pool.request()
      .input('recno', recno)
      .input('modDate', new Date())
      .input('modUser', user.mitarbeiter_nr || 0)
      .query(`
        UPDATE HWTER SET
          Geloescht      = 1,
          TER_ModifyDate = @modDate,
          TER_ModifyUser = @modUser
        WHERE RecNo = @recno
      `)

    res.json({ success: true })
  } catch (e) {
    console.error('Termin löschen Fehler:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ─── URLAUB ALS TERMIN ─────────────────────────────────────────

/**
 * POST /api/calendar/urlaub-termin
 * Wird vom Urlaubsmodul aufgerufen wenn ein Antrag genehmigt wird
 * Body: { urlaubLfdNr, start, end, mitarbeiterKuerzel, mitarbeiterNr, fehlzeitArt? }
 *
 * TER_FehlzeitArt Werte aus Powerbird:
 *   17 = Jahresurlaub (häufigste)
 *   18 = weitere Urlaubsart
 *   19 = weitere Urlaubsart
 *   49 = weitere Fehlzeitart
 */
router.post('/urlaub-termin', requireAuth, async (req, res) => {
  const {
    urlaubLfdNr,
    start,
    end,
    mitarbeiterKuerzel,
    mitarbeiterNr,
    fehlzeitArt = 17, // Standard: Jahresurlaub
  } = req.body

  if (!start || !end || !mitarbeiterKuerzel) {
    return res.status(400).json({ error: 'start, end und mitarbeiterKuerzel sind Pflichtfelder' })
  }

  // Admins oder der Mitarbeiter selbst darf Urlaubstermine anlegen
  if (!req.user.is_admin && req.user.kuerzel !== mitarbeiterKuerzel) {
    return res.status(403).json({ error: 'Keine Berechtigung' })
  }

  try {
    const pool = await getPbPool()

    // Prüfen ob bereits ein Urlaubstermin für diesen Antrag existiert
    if (urlaubLfdNr) {
      const existing = await pool.request()
        .input('lfdnr', urlaubLfdNr)
        .query(`SELECT RecNo FROM HWTER WHERE TER_UrlaubsantragLfdNr = @lfdnr AND Geloescht = 0`)
      if (existing.recordset.length) {
        return res.json({ success: true, recno: existing.recordset[0].RecNo, existed: true })
      }
    }

    // Mehrtägiger Urlaub: für jeden Tag einen Eintrag ODER einen Gesamteintrag?
    // Powerbird nutzt typischerweise einen Eintrag für den gesamten Zeitraum
    const record = buildTerminRecord({
      label:          'Urlaub',
      info:           `Urlaubsantrag${urlaubLfdNr ? ` #${urlaubLfdNr}` : ''}`,
      start,
      end,
      resourceName:   mitarbeiterKuerzel,
      fehlzeitArt,
      urlaubLfdNr:    urlaubLfdNr || null,
      mitarbeiterNr:  mitarbeiterNr || req.user.mitarbeiter_nr || 0,
      ganzerTag:      true,
      color:          0,
    })

    // Bei mehrtägigem Urlaub: Länge = Tage × 480 Minuten
    const startDate = new Date(start)
    const endDate   = new Date(end)
    const days      = Math.max(1, Math.round((endDate - startDate) / 86400000) + 1)
    record.Termin_Length = days * 480

    const cols = Object.keys(record).join(', ')
    const vals = Object.keys(record).map((_, i) => `@p${i}`).join(', ')
    const request = pool.request()
    Object.values(record).forEach((v, i) => request.input(`p${i}`, v))

    const result = await request.query(
      `INSERT INTO HWTER (${cols}) OUTPUT INSERTED.RecNo VALUES (${vals})`
    )
    const recno = result.recordset[0].RecNo
    res.json({ success: true, recno })
  } catch (e) {
    console.error('Urlaubstermin anlegen Fehler:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ─── URLAUB TERMIN LÖSCHEN (bei Ablehnung/Stornierung) ─────────

/**
 * DELETE /api/calendar/urlaub-termin/:urlaubLfdNr
 */
router.delete('/urlaub-termin/:urlaubLfdNr', requireAuth, async (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Nur Admins dürfen Urlaubstermine löschen' })
  }
  try {
    const pool = await getPbPool()
    await pool.request()
      .input('lfdnr', req.params.urlaubLfdNr)
      .input('modDate', new Date())
      .input('modUser', req.user.mitarbeiter_nr || 0)
      .query(`
        UPDATE HWTER SET
          Geloescht      = 1,
          TER_ModifyDate = @modDate,
          TER_ModifyUser = @modUser
        WHERE TER_UrlaubsantragLfdNr = @lfdnr AND Geloescht = 0
      `)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
