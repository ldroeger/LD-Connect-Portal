const router = require('express').Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const pbDb    = require('../db/powerbirdDb');
const localDb = require('../db/localDb');

function autoColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#F97316','#84CC16','#EC4899','#6366F1'][Math.abs(h) % 10];
}

function isAllDay(start, length) {
  if (!start || !length) return false;
  const d = new Date(start);
  return d.getHours() === 0 && d.getMinutes() === 0 && length >= 480;
}

router.get('/appointments', authMiddleware, async (req, res) => {
  try {
    const days = parseInt(localDb.getSetting('calendar_range_days') || '14');
    const from = req.query.from ? new Date(req.query.from) : new Date();
    const to   = req.query.to   ? new Date(req.query.to)   : new Date(Date.now() + days * 86400000);
    const f = from.toISOString().split('T')[0];
    const t = to.toISOString().split('T')[0];
    const r = await pbDb.query(
      `SELECT RecNo, TER_KurzinfoTermin,
         CONVERT(varchar(19), Termin_Start, 120) AS Termin_Start,
         CONVERT(varchar(19), Termin_Ende, 120) AS Termin_Ende, Termin_Length,
              Termin_ResourceName, Termin_Info, Termin_Label, Preset, Status, TER_FehlzeitArt, Termin_Color
       FROM HWTER
       WHERE Termin_ResourceName = @uid
         AND Termin_Start >= @from AND Termin_Start <= @to
         AND (Geloescht IS NULL OR Geloescht = 0)
       ORDER BY Termin_Start ASC`,
      { uid: req.user.powerbird_id, from: f, to: t + ' 23:59:59' }
    );
    res.json({ appointments: r.recordset.map(x => ({
      id: x.RecNo,
      title: x.Termin_Label || x.TER_KurzinfoTermin || '(kein Betreff)',
      start: x.Termin_Start, end: x.Termin_Ende, duration: x.Termin_Length,
      description: x.Termin_Info, label: x.Preset, status: x.Status,
      termColor: x.Termin_Color ? (() => { const n=x.Termin_Color; return '#'+((n&0xFF).toString(16).padStart(2,'0'))+((n>>8&0xFF).toString(16).padStart(2,'0'))+((n>>16&0xFF).toString(16).padStart(2,'0')) })() : null,
      allDay: isAllDay(x.Termin_Start, x.Termin_Length),
    }))});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/labels', authMiddleware, async (req, res) => {
  try {
    const r = await pbDb.query(
      `SELECT DISTINCT Preset FROM HWTER WHERE Preset IS NOT NULL AND Preset != '' ORDER BY Preset`
    );
    const saved = {};
    localDb.db.prepare('SELECT * FROM labels').all().forEach(l => saved[l.name] = l.color);
    res.json({ labels: r.recordset.map(x => x.Preset).filter(Boolean).map(n => ({ name: n, color: saved[n] || autoColor(n) })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/vacation', authMiddleware, async (req, res) => {
  try {
    const year = parseInt(req.query.year || new Date().getFullYear());
    const r = await pbDb.query(
      `SELECT RecNo, TER_KurzinfoTermin,
         CONVERT(varchar(19), Termin_Start, 120) AS Termin_Start,
         CONVERT(varchar(19), Termin_Ende, 120) AS Termin_Ende, Termin_Length, Termin_Label, Preset, TER_FehlzeitArt
       FROM HWTER
       WHERE Termin_ResourceName = @uid AND YEAR(Termin_Start) = @year
         AND (Geloescht IS NULL OR Geloescht = 0)
         AND (Termin_Label LIKE '%Urlaub%' OR Termin_Label LIKE '%Ferien%' OR
              Termin_Label LIKE '%Abwesend%' OR TER_KurzinfoTermin LIKE '%Urlaub%' OR
              TER_KurzinfoTermin LIKE '%Ferien%' OR TER_FehlzeitArt IS NOT NULL)
       ORDER BY Termin_Start ASC`,
      { uid: req.user.powerbird_id, year }
    );
    res.json({ vacation: r.recordset.map(x => ({
      Termin_Betreff: x.Termin_Label || x.TER_KurzinfoTermin || '-',
      Termin_Beginn: x.Termin_Start, Termin_Ende: x.Termin_Ende,
      Termin_Label: x.Preset, Fehlzeit: x.TER_FehlzeitArt,
    }))});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/hours', authMiddleware, async (req, res) => {
  try {
    const year = String(req.query.year || new Date().getFullYear());
    const r = await pbDb.query(
      `SELECT ZKT_Monat, ZKT_StundenIst, ZKT_StundenSoll, ZKT_StundenSaldo, ZKT_StundenVortrag
       FROM LOZKT
       WHERE ZKT_MitarbeiterNr = @uid
         AND LEFT(CAST(ZKT_Monat AS VARCHAR(10)), 4) = @year
       ORDER BY ZKT_Monat ASC`,
      { uid: req.user.powerbird_id, year }
    );
    const totalIst  = r.recordset.reduce((s, x) => s + (x.ZKT_StundenIst  || 0), 0);
    const totalSoll = r.recordset.reduce((s, x) => s + (x.ZKT_StundenSoll || 0), 0);
    res.json({
      total_ist:   Math.round(totalIst  * 10) / 10,
      total_soll:  Math.round(totalSoll * 10) / 10,
      total_saldo: Math.round((totalIst - totalSoll) * 10) / 10,
      months: r.recordset.map(x => ({
        monat:   x.ZKT_Monat,
        ist:     x.ZKT_StundenIst   || 0,
        soll:    x.ZKT_StundenSoll  || 0,
        saldo:   x.ZKT_StundenSaldo || 0,
        vortrag: x.ZKT_StundenVortrag || 0,
      })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/hours/detail', authMiddleware, async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) return res.status(400).json({ error: 'year und month erforderlich' });
    const from = `${year}-${String(month).padStart(2,'0')}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const to = `${year}-${String(month).padStart(2,'0')}-${lastDay}`;

    const r = await pbDb.query(
      `SELECT
         CAST(z.Datum AS DATE)        AS Tag,
         z.ZeitAnzahl,
         CONVERT(varchar(19), z.ZeitVon, 120) AS ZeitVon,
         CONVERT(varchar(19), z.ZeitBis, 120) AS ZeitBis,
         z.ZeitText,
         z.Projekt_KDI_Nr AS Nr,
         z.Projekt_KDI_Art AS Art,
         z.ZEF_ProjektNr,
         z.ZEF_KDINr,
         z.MitInfo,
         -- Projektdaten
         LTRIM(RTRIM(ISNULL(CAST(p.Kommission_Bezeichng AS NVARCHAR(MAX)),''))) + CASE WHEN LTRIM(RTRIM(ISNULL(p.Kommission_Weiteres_1,''))) != '' THEN ' ' + LTRIM(RTRIM(CAST(p.Kommission_Weiteres AS NVARCHAR(MAX)))) ELSE '' END AS PRJ_Kommission,
         p.Kunde_Name1 AS PRJ_Kunde,
         -- KDI-Daten
         LTRIM(RTRIM(ISNULL(CAST(k.Kommission_Bezeichng AS NVARCHAR(MAX)),''))) + CASE WHEN LTRIM(RTRIM(ISNULL(k.Kommission_Weiteres_1,''))) != '' THEN ' ' + LTRIM(RTRIM(CAST(k.Kommission_Weiteres AS NVARCHAR(MAX)))) ELSE '' END AS KDI_Kommission,
         k.Kunde_Name1 AS KDI_Kunde
       FROM ELZEF z
       LEFT JOIN ELPRJ p
              ON z.Projekt_KDI_Art = 'P'
             AND p.Dokument_Nummer COLLATE DATABASE_DEFAULT = z.ZEF_ProjektNr COLLATE DATABASE_DEFAULT
       LEFT JOIN ELKDI k
              ON z.Projekt_KDI_Art = 'K'
             AND k.Dokument_Nummer COLLATE DATABASE_DEFAULT = z.ZEF_KDINr COLLATE DATABASE_DEFAULT
       WHERE z.MitarbeiterNr = @uid
         AND z.Datum >= @from AND z.Datum <= @to
         AND z.ZeitAnzahl > 0
         AND (z.ZEF_TerminStorno IS NULL OR z.ZEF_TerminStorno = 0) AND (z.ZEF_Storniert_JN IS NULL OR z.ZEF_Storniert_JN = 0)
       ORDER BY z.Datum ASC, z.ZeitVon ASC`,
      { uid: req.user.powerbird_id, from, to }
    );

    // Buchungen gruppieren
    const byDay = {};
    r.recordset.forEach(x => {
      const tag = x.Tag ? new Date(x.Tag).toISOString().split('T')[0] : null;
      if (!tag) return;
      if (!byDay[tag]) byDay[tag] = { tag, eintraege: [], gesamt: 0 };
      byDay[tag].gesamt += x.ZeitAnzahl || 0;
      byDay[tag].eintraege.push({
        stunden:    x.ZeitAnzahl,
        von:        x.ZeitVon,
        bis:        x.ZeitBis,
        art:        x.Art,
        nr:         x.Art === 'P' ? x.ZEF_ProjektNr : x.Art === 'K' ? x.ZEF_KDINr : null,
        kunde:      x.Art === 'P' ? x.PRJ_Kunde      : x.KDI_Kunde,
        kommission: x.Art === 'P' ? x.PRJ_Kommission : x.KDI_Kommission,
      });
    });

    // Alle Werktage des Monats generieren (Mo-Fr)
    const alleTage = [];
    const cursor = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endOfMonth = new Date(parseInt(year), parseInt(month), 0);
    while (cursor <= endOfMonth) {
      const dow = cursor.getDay();
      if (dow !== 0 && dow !== 6) { // kein Sa/So
        const tagStr = cursor.toISOString().split('T')[0];
        if (byDay[tagStr]) {
          alleTage.push({ ...byDay[tagStr], gesamt: Math.round(byDay[tagStr].gesamt * 100) / 100 });
        } else {
          alleTage.push({ tag: tagStr, eintraege: [], gesamt: 0 });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    // Saldo aus LOZKT holen
    const monatKey = `${year}-${String(month).padStart(2,'0')}`;
    let saldo = null;
    try {
      const sr = await pbDb.query(
        `SELECT ZKT_StundenSaldo, ZKT_StundenIst, ZKT_StundenSoll FROM LOZKT
         WHERE ZKT_MitarbeiterNr = @uid AND LEFT(CAST(ZKT_Monat AS VARCHAR(10)), 7) = @monat`,
        { uid: req.user.powerbird_id, monat: monatKey }
      );
      if (sr.recordset[0]) {
        const row = sr.recordset[0]
        saldo = Math.round(((row.ZKT_StundenIst||0) - (row.ZKT_StundenSoll||0)) * 100) / 100
        var soll = row.ZKT_StundenSoll || 0
      }
    } catch(e) { /* Saldo nicht verfügbar */ }

    const totalIst = Math.round(alleTage.reduce((s,d)=>s+d.gesamt,0)*100)/100
    res.json({ tage: alleTage, total: totalIst, saldo, soll: soll||0, year, month });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// GET /api/calendar/hwter-fields - discover available fields (admin only)
router.get('/hwter-fields', adminMiddleware, async (req, res) => {
  try {
    const r = await pbDb.query('SELECT TOP 1 * FROM HWTER')
    const fields = Object.keys(r.recordset[0] || {})
    res.json({ fields })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// GET /api/calendar/appointment/:recno - detail view with contact info
router.get('/appointment/:recno', authMiddleware, async (req, res) => {
  try {
    const settings = {
      show_address:  localDb.getSetting('appt_show_address')  !== '0',
      show_kdi:      localDb.getSetting('appt_show_kdi')      !== '0',
      show_customer: localDb.getSetting('appt_show_customer') !== '0',
      show_phone:    localDb.getSetting('appt_show_phone')    !== '0',
      show_email:    localDb.getSetting('appt_show_email')    !== '0',
    }

    const r = await pbDb.query(
      `SELECT h.RecNo, h.TER_KurzinfoTermin,
         CONVERT(varchar(19), h.Termin_Start, 120) AS Termin_Start,
         CONVERT(varchar(19), h.Termin_Ende, 120) AS Termin_Ende,
              h.Termin_Length, h.Termin_Label, h.Preset, h.Termin_Info,
              h.AdrType, h.AdrNr, h.DocType, h.DocNr, h.Termin_Color,
              -- ELKDI fields via DocNr join
              k.Kunde_Name1                    AS KDI_Kunde,
              k.Dokument_Nummer                AS KDI_Nr,
              k.Kommission_Bezeichng           AS KDI_Kommission,
              k.Kunde_Strasse                  AS KDI_Strasse,
              k.Kunde_Postleitzahl             AS KDI_PLZ,
              k.Kunde_Ort                      AS KDI_Ort,
              k.DOK_KunTelefonnummer           AS KDI_Telefon,
              k.DOK_KunMobilnummer             AS KDI_Mobil,
              COALESCE(k.Kdi_BesuchEMail, k.Kdi_RechEMail, k.KDI_APOrt_EMail) AS KDI_Email,
              p.Kunde_Name1        AS PRJ_Kunde,
              p.Dokument_Nummer    AS PRJ_Nr,
              p.Kommission_Bezeichng AS PRJ_Kommission,
              k.Kdi_AuftrBeschreibng           AS KDI_Beschreibung
       FROM HWTER h
       LEFT JOIN ELKDI k
              ON h.DocType = 3
             AND LTRIM(RTRIM(CAST(h.DocNr AS NVARCHAR(50)))) = LTRIM(RTRIM(k.Dokument_Nummer)) COLLATE DATABASE_DEFAULT
       LEFT JOIN ELPRJ p
              ON h.DocType = 2
             AND LTRIM(RTRIM(CAST(h.DocNr AS NVARCHAR(50)))) = LTRIM(RTRIM(p.Dokument_Nummer)) COLLATE DATABASE_DEFAULT
       WHERE h.RecNo = @recno`,
      { recno: req.params.recno }
    )

    if (!r.recordset.length) return res.status(404).json({ error: 'Termin nicht gefunden' })
    const x = r.recordset[0]

    const detail = {
      recno:    x.RecNo,
      title:    x.Termin_Label || x.TER_KurzinfoTermin || '(Termin)',
      info:     x.Termin_Info,
      start:    x.Termin_Start,
      end:      x.Termin_Ende,
      allDay:   x.Termin_Length >= 480,
      label:    x.Preset,
    }

    if (settings.show_kdi && x.KDI_Nr) {
      detail.kdi_nr = x.KDI_Nr.trim()
      if (x.KDI_Kommission) detail.kommission = x.KDI_Kommission.trim()
    }
    if (settings.show_customer && x.KDI_Kunde) {
      detail.kunde = x.KDI_Kunde.trim()
    }


    // Find colleagues on same site (same DocNr, same day)
    if (detail.kdi_nr && x.Termin_Start) {
      try {
        const dateStart = new Date(x.Termin_Start).toISOString().split('T')[0]
        const cr = await pbDb.query(
          `SELECT DISTINCT Termin_ResourceName
           FROM HWTER
           WHERE DocNr = @docnr
             AND CAST(Termin_Start AS DATE) = @date
             AND RecNo != @recno
             AND Termin_ResourceName IS NOT NULL
             AND Termin_ResourceName != ''`,
          { docnr: x.DocNr || detail.kdi_nr, date: dateStart, recno: x.RecNo }
        )
        if (cr.recordset.length > 0) {
          // Map Powerbird-ID to user name if exists in local DB
          detail.kollegen = cr.recordset.map(r => {
            const id = r.Termin_ResourceName
            if (!id) return null
            const user = localDb.db.prepare('SELECT name FROM users WHERE powerbird_id = ? AND is_active = 1').get(id)
            return user ? user.name : id
          }).filter(Boolean)
        }
      } catch(e) { /* ignore */ }
    }

    res.json({ detail, settings })
  } catch(e) {
    // Fallback without JOIN if columns don't exist
    try {
      const r2 = await pbDb.query(
        `SELECT RecNo, TER_KurzinfoTermin,
         CONVERT(varchar(19), Termin_Start, 120) AS Termin_Start,
         CONVERT(varchar(19), Termin_Ende, 120) AS Termin_Ende, Termin_Length, Termin_Label, Preset, Termin_Info
         FROM HWTER WHERE RecNo = @recno`,
        { recno: req.params.recno }
      )
      if (!r2.recordset.length) return res.status(404).json({ error: 'Nicht gefunden' })
      const x = r2.recordset[0]
      res.json({ detail: {
        recno: x.RecNo, title: x.Termin_Label||x.TER_KurzinfoTermin||'(Termin)',
        info: x.Termin_Info, start: x.Termin_Start, end: x.Termin_Ende,
        allDay: x.Termin_Length >= 480, label: x.Preset,
      }, settings: {}, fallback: true })
    } catch(e2) { res.status(500).json({ error: e2.message }) }
  }
})

// GET /api/calendar/appt-settings - what fields to show
router.get('/appt-settings', authMiddleware, (_req, res) => {
  res.json({
    show_address:  localDb.getSetting('appt_show_address')  !== '0',
    show_kdi:      localDb.getSetting('appt_show_kdi')      !== '0',
    show_customer: localDb.getSetting('appt_show_customer') !== '0',
    show_phone:    localDb.getSetting('appt_show_phone')    !== '0',
    show_email:    localDb.getSetting('appt_show_email')    !== '0',
  })
})

// PUT /api/calendar/appt-settings
router.put('/appt-settings', adminMiddleware, (req, res) => {
  const fields = ['show_address','show_kdi','show_customer','show_phone','show_email']
  fields.forEach(f => {
    if (req.body[f] !== undefined) localDb.setSetting(`appt_${f}`, req.body[f] ? '1' : '0')
  })
  res.json({ success: true })
})

// GET /api/calendar/tools - Mein Werkzeug
router.get('/tools', authMiddleware, async (req, res) => {
  try {
    const r = await pbDb.query(
      `SELECT
         w.RecNo,
         LTRIM(RTRIM(ISNULL(w.WZV_WZNr,'')))   AS WZNr,
         LTRIM(RTRIM(ISNULL(w.Bezeichnung,''))) AS Bezeichnung,
         LTRIM(RTRIM(ISNULL(w.WZV_WZNr_1,''))) AS WZNr_Intern,
         w.WZV_Status,
         CONVERT(varchar(10), w.Verleih_AusgabeAm, 120) AS AusgabeAm,
         CONVERT(varchar(10), w.Verleih_RueckgabeAm, 120) AS RueckgabeAm,
         LTRIM(RTRIM(ISNULL(CAST(w.Info AS NVARCHAR(MAX)),''))) AS Info,
         LTRIM(RTRIM(ISNULL(w.WZV_Bilddatei,''))) AS Bilddatei
       FROM ELWZV w
       WHERE LTRIM(RTRIM(ISNULL(w.Verleih_AnMitarb,''))) = @uid
         AND (w.Verleih_RueckgabeAm IS NULL OR w.Verleih_RueckgabeAm >= GETDATE())
       ORDER BY w.Bezeichnung ASC`,
      { uid: req.user.powerbird_id }
    )
    res.json({ tools: r.recordset.map(w => ({
      recno:      w.RecNo,
      nr:         w.WZNr,
      bezeichnung: w.Bezeichnung,
      status:     w.WZV_Status,
      ausgabe:    w.AusgabeAm,
      rueckgabe:  w.RueckgabeAm,
      info:       w.Info,
      bild:       w.Bilddatei || null,
    })) })
  } catch(e) { res.status(500).json({ error: e.message }) }
})


module.exports = router;