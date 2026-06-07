/**
 * calendar_write_helper.js
 * Shared HWTER write functions - used by vacation.js directly (no HTTP)
 */

const pbDb = require('../db/powerbirdDb')

async function getPbPool() {
  if (typeof pbDb.getPool === 'function') return pbDb.getPool()
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

function calcLength(start, end) {
  return Math.max(0, Math.round((new Date(end) - new Date(start)) / 60000))
}

function buildRecord({ label, info='', start, end, resourceName, fehlzeitArt=0, urlaubLfdNr=null, mitarbeiterNr=0 }) {
  const startD = new Date(start)
  const endD   = new Date(end || start)
  const days   = Math.max(1, Math.round((endD - startD) / 86400000) + 1)
  // Farben: 17=beantragt(blau), 18=genehmigt(grün), 33=krank(orange)
  const color = fehlzeitArt === 17 ? 9676257 : fehlzeitArt === 18 ? 2171337 : fehlzeitArt === 33 ? 8712441 : 0
  // Für Ganztag: Start/Ende auf 09:00/17:00 setzen
  startD.setHours(9, 0, 0, 0)
  endD.setHours(17, 0, 0, 0)
  return {
    Termin_Start: startD, Termin_Ende: endD, Termin_Length: days * 480,
    Termin_ResourceArt: 'Mitarbeiter', Termin_ResourceArt_1: 'MITARBEITER',
    Termin_ResourceName: resourceName, Termin_ResourceName_1: resourceName,
    Termin_Label: label, Termin_Info: info, Termin_Color: color,
    Termin_SerialRecNo: 0, Termin_SerialMode: 0, Termin_Serientyp: 0,
    AdrType: 0, AdrNr: '', DocType: 0, DocNr: '', Preset: '',
    TER_FehlzeitArt: fehlzeitArt, TER_UrlaubsantragLfdNr: urlaubLfdNr,
    EinsatzResId: '', EinsatzResId_1: '', EinsatzResName: '', EinsatzResName_1: '',
    KfzResId: '', KfzResId_1: '', KfzResName: '', KfzResName_1: '',
    TER_CreateDate: new Date(), TER_CreateUser: mitarbeiterNr,
    TER_ModifyDate: new Date(), TER_ModifyUser: mitarbeiterNr,
    InterneNr: 0, // wird nicht inserted ErinnerungsIntervall: 0, VorgangJN: false, Geloescht: false,
    OutlookId: '', Version: 0, Status: 0, Lohnart: '', Lohnart_1: '',
    ZEF_Buchung: 1, Private: false, MAfaktor: 1, LengthFromAbz: false,
    Lohnart: fehlzeitArt === 33 ? '97' : (fehlzeitArt > 0 ? '98' : ''),
    Lohnart_1: fehlzeitArt === 33 ? '97' : (fehlzeitArt > 0 ? '98' : ''),
    TvTarTerminart: '', TvTarTerminart_1: '', TvTatTerminThema: '', TvTatTerminThema_1: '',
    TerminHerkunft: 0, AppointmentGUID: '', WV_Nr: '',
    TER_BestaetAutomJN: false, TER_Versandart: 0,
    TER_EmpfaengerEMail: '', TER_EmpfaengerMobil: '',
    TER_OutlookAnzeige: 2, TER_BestaetStatus: 0, TER_EmpfaengerAnfrage: '',
    TER_VersandartAutom: 0, TER_KurzinfoTermin: '', TER_Locked: false,
  }
}

const { v4: uuidv4 } = (() => { try { return require('uuid') } catch { return { v4: () => require('crypto').randomUUID().replace(/-/g,'').toUpperCase() } } })()

async function insertRecord(record) {
  const pool = await getPbPool()
  // Freien negativen InterneNr-Wert holen (HKEY_17 unique, 0 ist oft belegt)
  const minRes = await pool.request().query('SELECT ISNULL(MIN(InterneNr), 0) AS minVal FROM HWTER')
  const tempInterneNr = Math.min(-1, (minRes.recordset[0].minVal || 0) - 1)
  const recordWithInterneNr = { ...record, InterneNr: tempInterneNr }
  const cols = Object.keys(recordWithInterneNr).join(', ')
  const vals = Object.keys(recordWithInterneNr).map((_, i) => `@p${i}`).join(', ')
  const req  = pool.request()
  Object.values(recordWithInterneNr).forEach((v, i) => req.input(`p${i}`, v))
  await req.query(`INSERT INTO HWTER (${cols}) VALUES (${vals})`)
  const idRes = await pool.request().query('SELECT CAST(SCOPE_IDENTITY() AS INT) AS RecNo')
  const recno = idRes.recordset[0].RecNo
  // UPDATE: InterneNr=RecNo + GUID + korrekte User-IDs
  const guid = require('crypto').randomUUID().replace(/-/g,'').toUpperCase()
  try {
    await pool.request()
      .input('recno', recno)
      .input('guid', guid)
      .query(`UPDATE HWTER SET
        InterneNr        = @recno,
        TER_CreateUser   = 1,
        TER_ModifyUser   = 1,
        AppointmentGUID  = @guid
        WHERE RecNo = @recno AND InterneNr IS NULL OR InterneNr = 0`)
  } catch(e) {
    // Trigger hat InterneNr möglicherweise selbst gesetzt - nur GUID updaten
    try {
      await pool.request()
        .input('recno', recno)
        .input('guid', guid)
        .query(`UPDATE HWTER SET AppointmentGUID=@guid, TER_CreateUser=1, TER_ModifyUser=1 WHERE RecNo=@recno`)
    } catch(e2) { console.log('GUID update failed (non-fatal):', e2.message) }
  }
  return recno
}

// Urlaubsantrag → FehlzeitArt 17
async function urlaubBeantragen({ urlaubLfdNr, start, end, mitarbeiterKuerzel, mitarbeiterNr=0 }) {
  const pool = await getPbPool()
  // Prüfen ob bereits vorhanden
  if (urlaubLfdNr) {
    const ex = await pool.request().input('lfdnr', urlaubLfdNr)
      .query('SELECT RecNo FROM HWTER WHERE TER_UrlaubsantragLfdNr=@lfdnr AND Geloescht=0')
    if (ex.recordset?.length) return ex.recordset[0].RecNo
  }
  const record = buildRecord({
    label: 'Urlaub beantragt',
    info: urlaubLfdNr ? `Urlaubsantrag #${urlaubLfdNr}` : 'Urlaubsantrag',
    start, end, resourceName: mitarbeiterKuerzel,
    fehlzeitArt: 17, urlaubLfdNr: urlaubLfdNr || null, mitarbeiterNr,
  })
  return insertRecord(record)
}

// Genehmigung → FehlzeitArt 17→18
async function urlaubGenehmigen({ urlaubLfdNr, start, end, mitarbeiterKuerzel, mitarbeiterNr=0 }) {
  const pool = await getPbPool()
  if (urlaubLfdNr) {
    const ex = await pool.request().input('lfdnr', urlaubLfdNr)
      .query('SELECT RecNo FROM HWTER WHERE TER_UrlaubsantragLfdNr=@lfdnr AND Geloescht=0')
    if (ex.recordset?.length) {
      await pool.request()
        .input('recno', ex.recordset[0].RecNo)
        .query(`UPDATE HWTER SET TER_FehlzeitArt=18, Termin_Label='Urlaub', TER_ModifyDate=GETDATE() WHERE RecNo=@recno`)
      return ex.recordset[0].RecNo
    }
  }
  // Kein Antrag-Termin → neu als 18 anlegen
  const record = buildRecord({
    label: 'Urlaub', info: urlaubLfdNr ? `Urlaubsantrag #${urlaubLfdNr}` : 'Urlaub genehmigt',
    start, end, resourceName: mitarbeiterKuerzel,
    fehlzeitArt: 18, urlaubLfdNr: urlaubLfdNr || null, mitarbeiterNr,
  })
  return insertRecord(record)
}

// Ablehnung → Termin löschen
async function urlaubAblehnen({ urlaubLfdNr }) {
  if (!urlaubLfdNr) return
  const pool = await getPbPool()
  await pool.request()
    .input('lfdnr', urlaubLfdNr)
    .query('UPDATE HWTER SET Geloescht=1, TER_ModifyDate=GETDATE() WHERE TER_UrlaubsantragLfdNr=@lfdnr AND Geloescht=0')
}

module.exports = { urlaubBeantragen, urlaubGenehmigen, urlaubAblehnen }
