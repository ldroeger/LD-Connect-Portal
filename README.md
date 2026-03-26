# Powerbird Mitarbeiterportal

Eine Web-Anwendung für Mitarbeiter, die Kalender, Urlaubsplanung und Stundenverwaltung auf Basis der Powerbird-Datenbank von Hausmann & Wynen bereitstellt.

## Funktionen

- **📅 Kalender** – Eigene Termine aus Powerbird im Browser anzeigen (Woche/Monat/Tagesansicht)
- **🌴 Urlaubsplanung** – Urlaubstermine übersichtlich anzeigen und verwalten
- **⏱ Gebuchte Stunden** – Zeitauswertung nach Kategorien/Labels
- **👥 Benutzerverwaltung** – Mitarbeiter per E-Mail einladen, Powerbird-ID zuordnen
- **🎨 Branding** – Firmenname, Logo, Farbe und Label-Farben anpassen
- **🔐 Sicheres Login** – JWT-basiert, Passwort-Reset per E-Mail

## Schnellstart

### Voraussetzungen
- Docker & Docker Compose installiert
- Zugang zur Powerbird SQL Server Datenbank (schreibgeschützter Benutzer empfohlen)

### Installation

```bash
# 1. Repository klonen oder Dateien entpacken
cd powerbird-webapp

# 2. Umgebungsvariablen anpassen
cp .env.example .env
# .env öffnen und JWT_SECRET und APP_URL anpassen!

# 3. Docker-Container starten
docker-compose up -d

# 4. Im Browser öffnen
# http://localhost (oder konfigurierter Port)
```

Beim ersten Start wird automatisch der **Einrichtungsassistent** geöffnet.

---

## Einrichtungsassistent (3 Schritte)

### Schritt 1 – Admin-Konto
- Name, E-Mail und Passwort des ersten Administrators
- Optional: Powerbird-Benutzer-ID für eigene Kalenderansicht

### Schritt 2 – Datenbankverbindung
- SQL Server Adresse, Port, Datenbankname
- Benutzername und Passwort (lesender Zugriff ausreichend!)
- Test-Funktion vorhanden
- **Wichtig:** Die Powerbird-DB wird nur lesend verwendet

### Schritt 3 – Branding
- Firmenname und Primärfarbe
- Logo-URL (optional)
- Standard-Kalenderbereich in Tagen
- SMTP-Einstellungen für E-Mail-Versand

---

## Benutzerverwaltung

Benutzer werden im Admin-Bereich angelegt:
1. Name, E-Mail und **Powerbird-Benutzer-ID** eingeben
2. Benutzer erhält automatisch eine Einladungs-E-Mail
3. Benutzer klickt den Link und setzt sein Passwort
4. Passwort-Reset über "Passwort vergessen" auf der Login-Seite

### Powerbird-Benutzer-ID
Die ID entspricht dem Wert in der Spalte `Termin_ResourceName` in der Tabelle `HWTER`. Das können Zahlen, Buchstaben oder eine Kombination sein (z.B. `MM01`, `42`, `MUSTERMANN`).

---

## Datenbankstruktur (Powerbird)

Die App liest ausschließlich aus der Tabelle `HWTER`:

| Spalte | Verwendung |
|--------|-----------|
| `Termin_ID` | Eindeutige ID |
| `Termin_Betreff` | Titel des Termins |
| `Termin_Beginn` | Startzeit |
| `Termin_Ende` | Endzeit |
| `Termin_ResourceName` | **Benutzer-ID** (für Zuordnung) |
| `Termin_Beschreibung` | Notizen |
| `Termin_Ort` | Ort |
| `Termin_Label` | Kategorie (Farbe im Kalender) |
| `Termin_Status` | Status |
| `Termin_Ganztag` | Ganztägiger Termin (0/1) |

**Es werden keine Schreibvorgänge auf der Powerbird-Datenbank durchgeführt.**

---

## Konfiguration

### .env Datei
```env
PORT=80                    # Port der Web-App
APP_URL=http://meinserver  # URL für E-Mail-Links
JWT_SECRET=geheimes-secret # Zufälliger, langer String
```

### Datenpersistenz
Die App-eigenen Daten (Benutzer, Einstellungen, Label-Farben) werden in einem Docker-Volume (`app-data`) gespeichert:
- Pfad im Container: `/data/app.db` (SQLite)

---

## Architektur

```
┌─────────────────────────────────────────┐
│           Browser / Client              │
└───────────────────┬─────────────────────┘
                    │ HTTP
┌───────────────────▼─────────────────────┐
│         Nginx (Frontend + Proxy)        │
│  React SPA + /api/* → Backend           │
└───────────┬─────────────────────────────┘
            │
    ┌───────▼────────┐    ┌─────────────────────┐
    │ Node.js Backend│───►│  Powerbird SQL Server│
    │                │    │  (READ-ONLY)         │
    │  SQLite (lokal)│    └─────────────────────┘
    └────────────────┘
```

---

## Sicherheit

- Passwörter werden mit bcrypt (12 Runden) gehasht
- JWT-Tokens laufen nach 12 Stunden ab
- API Rate Limiting aktiv
- Powerbird-DB wird ausschließlich lesend abgefragt
- Einladungs-Tokens laufen nach 7 Tagen ab
- Passwort-Reset-Tokens laufen nach 2 Stunden ab

---

## Updates

```bash
# Neue Version deployen
docker-compose down
docker-compose pull  # falls Images aus Registry
docker-compose up -d --build
```

---

## Fehlersuche

### Backend-Logs anzeigen
```bash
docker-compose logs backend
```

### Datenbankverbindung testen
Im Admin-Bereich → Einstellungen → Datenbankverbindung

### Port bereits belegt
In `.env` den Port ändern:
```env
PORT=8080
```
