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
         LTRIM(RTRIM(ISNULL(w.WZV_WZNr,'')))      AS WZNr,
         LTRIM(RTRIM(ISNULL(w.Bezeichnung,'')))    AS Bezeichnung,
         LTRIM(RTRIM(ISNULL(w.WZV_WZNr_1,'')))    AS WZNr_Intern,
         w.WZV_Zustand                              AS ZustandNr,
         w.WZV_Status,
         CONVERT(varchar(10), w.Verleih_AusgabeAm, 120) AS AusgabeAm,
         CONVERT(varchar(10), w.Verleih_RueckgabeAm, 120) AS RueckgabeAm,
         LTRIM(RTRIM(ISNULL(CAST(w.Info AS NVARCHAR(MAX)),''))) AS Info,
         LTRIM(RTRIM(ISNULL(w.WZV_Bilddatei,''))) AS Bilddatei
       FROM ELWZV w
       WHERE LTRIM(RTRIM(ISNULL(w.Verleih_AnMitarb,''))) = @uid
         AND (w.Verleih_RueckgabeAm IS NULL OR w.Verleih_RueckgabeAm >= GETDATE())
         AND ISNULL(w.WZV_Zustand, 0) <> 4
       ORDER BY w.Bezeichnung ASC`,
      { uid: req.user.powerbird_id }
    )
    res.json({ tools: r.recordset.map(w => {
      // 0=Im Lager, 1=Verliehen Mitarb, 2=Defekt, 3=Verliehen Kunde/Lief, 4=Ausgemustert
      const zNr = w.ZustandNr
      const toolStatus = zNr === 2 ? 'defekt' : zNr === 1 || zNr === 3 ? 'verliehen' : 'lager'
      return {
        recno:       w.RecNo,
        nr:          w.WZNr,
        bezeichnung: w.Bezeichnung,
        zustand:     w.ZustandNr,
        status:      toolStatus,
        ausgabe:     w.AusgabeAm,
        rueckgabe:   w.RueckgabeAm,
        info:        w.Info,
        bild:        w.Bilddatei || null,
      }
    }) })
  } catch(e) { res.status(500).json({ error: e.message }) }
})


// GET /api/calendar/tools-alerts - Werkzeug-Reservierungen in den nächsten 2 Tagen
router.get('/tools-alerts', authMiddleware, async (req, res) => {
  try {
    // Get tools assigned to this user
    const toolsResult = await pbDb.query(
      `SELECT
         LTRIM(RTRIM(ISNULL(w.Intern_Nr,'')))   AS InternNr,
         LTRIM(RTRIM(ISNULL(w.WZV_WZNr,'')))    AS WZNr,
         LTRIM(RTRIM(ISNULL(w.Bezeichnung,'')))  AS Bezeichnung,
         LTRIM(RTRIM(ISNULL(w.LAN,'')))          AS LAN
       FROM ELWZV w
       WHERE LTRIM(RTRIM(ISNULL(w.Verleih_AnMitarb,''))) = @uid
         AND (w.Verleih_RueckgabeAm IS NULL OR w.Verleih_RueckgabeAm >= GETDATE())`,
      { uid: req.user.powerbird_id }
    )

    if (!toolsResult.recordset.length) return res.json({ alerts: [] })

    // Build list of ResourceName values: Intern_Nr + '-' + LAN = '100000-LSP500A'
    // and ResourceName_1 values: Intern_Nr + LAN = '100000LSP500A'
    const tools = toolsResult.recordset.filter(w => w.InternNr)
    if (!tools.length) return res.json({ alerts: [] })

    // Use LIKE conditions for each tool
    const likeConditions = tools.map((_, i) =>
      `LTRIM(RTRIM(ISNULL(h.Termin_ResourceName,''))) LIKE @nr${i}`
    ).join(' OR ')

    const params = { uid: req.user.powerbird_id }
    tools.forEach((w, i) => {
      // Match '100000-LSP500A' - starts with InternNr
      params[`nr${i}`] = w.InternNr + '%'
    })

    const alertsResult = await pbDb.query(
      `SELECT
         LTRIM(RTRIM(ISNULL(h.Termin_ResourceName,'')))   AS ResourceName,
         LTRIM(RTRIM(ISNULL(h.Termin_ResourceName_1,''))) AS ResourceName1,
         CONVERT(varchar(19), h.Termin_Start, 120) AS TerminStart,
         CONVERT(varchar(19), h.Termin_Ende, 120)  AS TerminEnde,
         LTRIM(RTRIM(ISNULL(h.Termin_Label,'')))   AS Label
       FROM HWTER h
       WHERE h.Termin_ResourceArt = 'Werkzeuge'
         AND (${likeConditions})
         AND h.Termin_Start >= GETDATE()
         AND h.Termin_Start <= DATEADD(day, 2, GETDATE())
         AND ISNULL(h.Geloescht, 0) = 0
         -- Nicht anzeigen wenn der Mitarbeiter selbst an dem Tag einen Termin hat
         AND NOT EXISTS (
           SELECT 1 FROM HWTER m
           WHERE m.Termin_ResourceArt = 'Mitarbeiter'
             AND LTRIM(RTRIM(ISNULL(m.Termin_ResourceName,''))) = @uid
             AND CONVERT(date, m.Termin_Start) = CONVERT(date, h.Termin_Start)
             AND ISNULL(m.Geloescht, 0) = 0
         )
       ORDER BY h.Termin_Start ASC`,
      params
    )

    const alerts = alertsResult.recordset.map(h => {
      const tool = tools.find(w => h.ResourceName.startsWith(w.InternNr))
      return {
        bezeichnung: tool ? tool.Bezeichnung : h.ResourceName,
        nr:          tool ? tool.WZNr : h.ResourceName1,
        start:       h.TerminStart,
        ende:        h.TerminEnde,
        label:       h.Label,
      }
    })

    res.json({ alerts })
  } catch(e) {
    console.error('tools-alerts error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// GET /api/calendar/tools-search?q=... - Werkzeug Volltext-Suche
router.get('/tools-search', authMiddleware, async (req, res) => {
  try {
    const q = (req.query.q || '').trim()

    const result = await pbDb.query(
      `SELECT TOP 500
         w.RecNo,
         LTRIM(RTRIM(ISNULL(w.LAN,'')))          AS LAN,
         LTRIM(RTRIM(ISNULL(w.Intern_Nr,'')))     AS InternNr,
         LTRIM(RTRIM(ISNULL(w.Bezeichnung,'')))   AS Bezeichnung,
         LTRIM(RTRIM(ISNULL(w.WZV_WZNr,'')))      AS WZNr,
         LTRIM(RTRIM(ISNULL(w.WZV_WZNr_1,'')))    AS WZNr1,
         LTRIM(RTRIM(ISNULL(w.WZV_Lagerort,'')))  AS Lagerort,
         LTRIM(RTRIM(ISNULL(w.WZV_Zustand,'')))   AS Zustand,
         LTRIM(RTRIM(ISNULL(w.WZV_Bilddatei,''))) AS Bilddatei,
         w.WZV_Status,
         -- Verleih an Mitarbeiter
         LTRIM(RTRIM(ISNULL(w.Verleih_AnMitarb,'')))    AS VerliehAnMitarb,
         LTRIM(RTRIM(ISNULL(w.MitgenommenVon,'')))       AS MitgenommenVon,
         ISNULL(
           (SELECT TOP 1
              LTRIM(RTRIM(ISNULL(m.Adresse_Vorname,'')))
              + CASE WHEN LTRIM(RTRIM(ISNULL(m.Adresse_Nachname,''))) != '' THEN ' ' + LTRIM(RTRIM(m.Adresse_Nachname)) ELSE '' END
            FROM ELMIT m WHERE LTRIM(RTRIM(ISNULL(m.Mitarbeiter_Nr,''))) = LTRIM(RTRIM(ISNULL(w.Verleih_AnMitarb,'')))),
           ''
         ) AS MitarbName,
         ISNULL(
           (SELECT TOP 1
              LTRIM(RTRIM(ISNULL(m.Adresse_Vorname,'')))
              + CASE WHEN LTRIM(RTRIM(ISNULL(m.Adresse_Nachname,''))) != '' THEN ' ' + LTRIM(RTRIM(m.Adresse_Nachname)) ELSE '' END
            FROM ELMIT m WHERE LTRIM(RTRIM(ISNULL(m.Mitarbeiter_Nr,''))) = LTRIM(RTRIM(ISNULL(w.MitgenommenVon,'')))),
           ''
         ) AS MitgenommenName,
         CONVERT(varchar(10), w.Verleih_AusgabeAm, 120)  AS AusgabeAm,
         CONVERT(varchar(10), w.Verleih_RueckgabeAm, 120) AS RueckgabeAm,
         -- Verleih Typ: 1=Kunde, 2=Mitarbeiter, 3=Lieferant
         w.WZV_VerliehenAnADR AS VerleihTyp,
         -- Kundenname wenn Typ=1
         CASE WHEN w.WZV_VerliehenAnADR = 1 THEN
           ISNULL((SELECT TOP 1
             LTRIM(RTRIM(ISNULL(k.Adresse_Name1,'')))
             + CASE WHEN LTRIM(RTRIM(ISNULL(k.Adresse_Name2,''))) != '' THEN ' ' + LTRIM(RTRIM(k.Adresse_Name2)) ELSE '' END
           FROM ELKUN k WHERE LTRIM(RTRIM(k.Kunde_KundenNr)) = LTRIM(RTRIM(ISNULL(w.Verleih_AnMitarb,'')))), '')
         ELSE '' END AS KundenName,
         -- Lieferantenname wenn Typ=3
         CASE WHEN w.WZV_VerliehenAnADR = 3 THEN
           ISNULL((SELECT TOP 1
             LTRIM(RTRIM(ISNULL(l.Lieferant_Name1,'')))
             + CASE WHEN LTRIM(RTRIM(ISNULL(l.Lieferant_Name2,''))) != '' THEN ' ' + LTRIM(RTRIM(l.Lieferant_Name2)) ELSE '' END
           FROM ELLIF l WHERE LTRIM(RTRIM(l.Lieferant_LiefNr)) = LTRIM(RTRIM(ISNULL(w.Verleih_AnMitarb,'')))), '')
         ELSE '' END AS LiefName,
         -- Nächste Reservierung aus HWTER
         (SELECT TOP 1 CONVERT(varchar(19), h.Termin_Start, 120)
          FROM HWTER h
          WHERE h.Termin_ResourceArt = 'Werkzeuge'
            AND LTRIM(RTRIM(ISNULL(h.Termin_ResourceName,''))) LIKE CONVERT(varchar,w.Intern_Nr) + '%'
            AND h.Termin_Start >= GETDATE()
            AND ISNULL(h.Geloescht,0) = 0
          ORDER BY h.Termin_Start ASC) AS NaechsteReservierung,
         -- Aktueller Termin (läuft gerade)
         (SELECT TOP 1 LTRIM(RTRIM(ISNULL(h.Termin_Label,'')))
          FROM HWTER h
          WHERE h.Termin_ResourceArt = 'Werkzeuge'
            AND LTRIM(RTRIM(ISNULL(h.Termin_ResourceName,''))) LIKE CONVERT(varchar,w.Intern_Nr) + '%'
            AND h.Termin_Start <= GETDATE()
            AND h.Termin_Ende >= GETDATE()
            AND ISNULL(h.Geloescht,0) = 0
          ORDER BY h.Termin_Start ASC) AS AktuellerTerminLabel
       FROM ELWZV w
       WHERE
         -- Ausgemusterte Geräte (Zustand=4) ausblenden
         ISNULL(w.WZV_Zustand, 0) <> 4
         AND (@q = '' OR
           LTRIM(RTRIM(ISNULL(w.Bezeichnung,'')))   LIKE '%' + @q + '%'
           OR LTRIM(RTRIM(ISNULL(w.LAN,'')))         LIKE '%' + @q + '%'
           OR LTRIM(RTRIM(ISNULL(w.WZV_WZNr,'')))    LIKE '%' + @q + '%'
           OR LTRIM(RTRIM(ISNULL(w.Intern_Nr,'')))    LIKE '%' + @q + '%'
           OR LTRIM(RTRIM(ISNULL(w.SerienNummer,''))) LIKE '%' + @q + '%'
           OR LTRIM(RTRIM(ISNULL(w.WZV_Lagerort,''))) LIKE '%' + @q + '%'
         )
       ORDER BY w.Bezeichnung ASC`,
      { q }
    )

    // Resolve Mieter-Name for items lent to address
    const tools = await Promise.all(result.recordset.map(async w => {
      let mieterName = ''
      const verleihTyp = w.VerleihTyp
      if (verleihTyp === 2 && w.VerliehAnMitarb) {
        // Mitarbeiter
        const portalUser = localDb.db.prepare('SELECT name FROM users WHERE powerbird_id = ? AND is_active = 1').get(w.VerliehAnMitarb)
        mieterName = portalUser ? portalUser.name : (w.MitarbName || w.VerliehAnMitarb)
      } else if (verleihTyp === 1) {
        // Kunde
        mieterName = w.KundenName || w.VerliehAnMitarb
      } else if (verleihTyp === 3) {
        // Lieferant
        mieterName = w.LiefName || w.VerliehAnMitarb
      } else if (w.VerliehAnMitarb && !verleihTyp) {
        // Fallback: Mitarbeiter ohne Typ
        const portalUser = localDb.db.prepare('SELECT name FROM users WHERE powerbird_id = ? AND is_active = 1').get(w.VerliehAnMitarb)
        mieterName = portalUser ? portalUser.name : (w.MitarbName || w.VerliehAnMitarb)
      } else if (w.MitgenommenVon) {
        const portalUser = localDb.db.prepare('SELECT name FROM users WHERE powerbird_id = ? AND is_active = 1').get(w.MitgenommenVon)
        mieterName = portalUser ? portalUser.name : (w.MitgenommenName || w.MitgenommenVon)
      }

      // Determine status
      const jetzt = new Date()
      const ausgabe = w.AusgabeAm ? new Date(w.AusgabeAm) : null
      const rueckgabe = w.RueckgabeAm ? new Date(w.RueckgabeAm) : null
      const naechste = w.NaechsteReservierung ? new Date(w.NaechsteReservierung) : null
      const diffDays = naechste ? (naechste - jetzt) / 864e5 : null

      // Status direkt aus WZV_Zustand:
      // 0=Im Lager, 1=Verliehen Mitarbeiter, 2=Defekt, 3=Verliehen Kunde/Lief, 4=Ausgemustert
      const zustandNr = w.ZustandNr ?? w.WZV_Zustand
      let status
      if (zustandNr === 2) {
        status = 'defekt'
      } else if (zustandNr === 1 || zustandNr === 3) {
        status = 'verliehen'
      } else if (diffDays !== null && diffDays <= 2) {
        status = 'reserviert'
      } else {
        status = 'lager'
      }

      return {
        recno:        w.RecNo,
        lan:          w.LAN,
        internNr:     w.InternNr,
        bezeichnung:  w.Bezeichnung,
        nr:           w.WZNr,
        lagerort:     w.Lagerort,
        zustand:      w.Zustand,
        bild:         w.Bilddatei || null,
        status,
        mieter:       mieterName,
        ausgabe:      w.AusgabeAm,
        rueckgabe:    w.RueckgabeAm,
        naechsteRes:  w.NaechsteReservierung,
        aktTermin:    w.AktuellerTerminLabel,
      }
    }))

    res.json({ tools })
  } catch(e) {
    console.error('tools-search error:', e.message)
    res.status(500).json({ error: e.message })
  }
})


module.exports = router;