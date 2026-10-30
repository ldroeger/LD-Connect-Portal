# Lizenzierung – LD Connect

LD Connect meldet sich beim **Lizenzportal** (Projekt `C:\Projekte\Lizenzen`) an und prüft seine Lizenz dort.
**Solange `LICENSE_ENFORCE` nicht `true` ist, wird nichts gesperrt** – bestehende Installationen laufen unverändert weiter,
der Status ist nur sichtbar.

Die Software fragt **ausgehend per HTTPS** bei `https://lizenzen.lukasdroeger.de` an – beim Kunden muss kein Port geöffnet werden.

| | |
|---|---|
| Produktcode | `ld-connect` |
| Dateien | `backend/routes/license.js` (Anbindung, API, Hilfsfunktionen) und `backend/utils/license-client.cjs` (SDK-Kopie) |
| Lizenzdatei | `$DATA_DIR/license.json` (Volume `app-data`) |
| API | `/api/license` – Status: jeder angemeldete Benutzer · Änderungen: Administratoren |

## Konfiguration

| Variable | Bedeutung |
|---|---|
| `LICENSE_SERVER_URL` | Nur zum Überschreiben (Tests). Fest eingebaut: `https://lizenzen.lukasdroeger.de` |
| `LICENSE_PUBLIC_KEY` | Nur zum Überschreiben (Tests). Der öffentliche Schlüssel des Lizenzportals (Schlüssel-ID `9784df7659343692`) ist fest eingebaut. |
| `LICENSE_ENFORCE` | `true` = Funktionen ohne gültige Lizenz sperren. Standard `false`. |

## Lizenz-Assistent

Die Lizenz wird in der Oberfläche über einen Assistenten eingetragen: Menü **Administration → Lizenz** (`/license`, nur Administratoren).
1. **Willkommen** – Status und Hinweise (ausgehende HTTPS-Verbindung, 14 Tage Offline-Toleranz)
2. **Lizenz eintragen** – Lizenzschlüssel (wird beim Tippen formatiert) oder Offline-Lizenz (Text oder Datei)
3. **Ergebnis** – Tarif, Lizenznehmer, Laufzeit, freigeschaltete Funktionen, Grenzen, Zusatzmodule; erneut prüfen oder Installation abmelden

Solange keine gültige Lizenz eingetragen ist, sehen Administratoren einen Hinweis mit Link zum Assistenten.

## Ablauf

1. Kunde kauft im Shop oder bekommt im Admin-Portal eine Lizenz – Schlüssel z. B. `LDCN-XXXXX-XXXXX-XXXXX-XXXXX`.
2. Administrator trägt den Schlüssel ein: `POST /api/license/activate` mit `key` (JSON).
3. Das Lizenzportal gibt ein **signiertes Token** (Ed25519) zurück; es wird in der Lizenzdatei gespeichert und bei jedem Start offline geprüft.
4. Alle 24 Stunden wird das Token erneuert. Ist das Lizenzportal nicht erreichbar, gilt es **14 Tage** weiter (Lease).
5. Widerruf, Sperre oder Ablauf im Portal wirken beim nächsten Abgleich.

| Endpunkt | Wirkung |
|---|---|
| `GET /api/license` | Status (JSON): `state` (`valid` / `unlicensed` / `invalid`), `reason`, Tarif, Funktionen, Grenzen, Zusatzmodule, Laufzeit |
| `POST /api/license/activate` | Lizenzschlüssel eintragen (`key`) |
| `POST /api/license/refresh` | Sofort beim Lizenzportal prüfen (z. B. nach Kauf eines Zusatzmoduls) |
| `POST /api/license/offline` | Offline-Lizenz aus dem Admin-Portal einspielen (`token`) – für Server ohne Internet |
| `POST /api/license/deactivate` | Installation abmelden, z. B. vor einem Serverumzug |

## Funktionen einzeln lizenzieren

Tarife und **Zusatzmodule** schalten Feature-Codes frei; die Software fragt nur den Code ab.
Codes von LD Connect: `calendar`, `hours`, `vacation`, `news`, `todos`, `documents`, `sick`, `manager`, `tools`, `display`, `app`
Grenzen: `users`

```js
const { licenseAllows, licenseLimit, requireFeature } = require('./license');

// ganze Route sperren (in server.js)
app.use('/api/display', requireFeature('display'), require('./routes/display'));

// einzelne Stelle
if (!licenseAllows('tools')) return res.status(402).json({ error: 'Werkzeugverwaltung ist nicht lizenziert' });
const maxUsers = licenseLimit('users'); // undefined = unbegrenzt
```

Im Frontend liefert `GET /api/license` die freigeschalteten `features` – damit lassen sich Menüpunkte zusätzlich zu den Benutzerrechten (`FeatureGate`) ausblenden.

Neue Codes legst du im Admin-Portal unter *Produkte & Tarife* an (Tarif oder Zusatzmodul) und fragst sie hier ab.
Ohne `LICENSE_ENFORCE=true` liefern alle Prüfungen „erlaubt“.

## SDK aktualisieren

Die Client-Bibliothek stammt aus dem Lizenzportal: `sdk/node/license-client.cjs → backend/utils/license-client.cjs` (dort `npm run build:sdk`).
