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
  return {
    Termin_Start: startD, Termin_Ende: endD, Termin_Length: days * 480,
    Termin_ResourceArt: 'Mitarbeiter', Termin_ResourceArt_1: '',
    Termin_ResourceName: resourceName, Termin_ResourceName_1: '',
    Termin_Label: label, Termin_Info: info, Termin_Color: 0,
    Termin_SerialRecNo: 0, Termin_SerialMode: 0, Termin_Serientyp: 0,
    AdrType: 0, AdrNr: '', DocType: 0, DocNr: '', Preset: '',
    TER_FehlzeitArt: fehlzeitArt, TER_UrlaubsantragLfdNr: urlaubLfdNr,
    EinsatzResId: '', EinsatzResId_1: '', EinsatzResName: '', EinsatzResName_1: '',
    KfzResId: '', KfzResId_1: '', KfzResName: '', KfzResName_1: '',
    TER_CreateDate: new Date(), TER_CreateUser: mitarbeiterNr,
    TER_ModifyDate: new Date(), TER_ModifyUser: mitarbeiterNr,
    InterneNr: 0, ErinnerungsIntervall: 0, VorgangJN: false, Geloescht: false,
    OutlookId: '', Version: 0, Status: 0, Lohnart: '', Lohnart_1: '',
    ZEF_Buchung: 0, Private: false, MAfaktor: 1, LengthFromAbz: false,
    TvTarTerminart: '', TvTarTerminart_1: '', TvTatTerminThema: '', TvTatTerminThema_1: '',
    TerminHerkunft: 0, AppointmentGUID: '', WV_Nr: '',
    TER_BestaetAutomJN: false, TER_Versandart: 0,
    TER_EmpfaengerEMail: '', TER_EmpfaengerMobil: '',
    TER_OutlookAnzeige: 2, TER_BestaetStatus: 0, TER_EmpfaengerAnfrage: '',
    TER_VersandartAutom: 0, TER_KurzinfoTermin: '', TER_Locked: false,
  }
}

async function insertRecord(record) {
  const pool = await getPbPool()
  const cols = Object.keys(record).join(', ')
  const vals = Object.keys(record).map((_, i) => `@p${i}`).join(', ')
  const req  = pool.request()
  Object.values(record).forEach((v, i) => req.input(`p${i}`, v))
  await req.query(`INSERT INTO HWTER (${cols}) VALUES (${vals})`)
  const idRes = await pool.request().query('SELECT CAST(SCOPE_IDENTITY() AS INT) AS RecNo')
  return idRes.recordset[0].RecNo
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
