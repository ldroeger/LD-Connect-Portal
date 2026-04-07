# LD Connect Portal — Web-Applikation

Das **LD Connect Mitarbeiterportal** ist eine Web-App für Unternehmen die Powerbird ERP einsetzen. Mitarbeiter greifen über den Browser auf Kalender, Stunden, Urlaub und mehr zu.

## Features

- **Dashboard** — Tagesüberblick mit Terminen, Stundensaldo und Aufgaben
- **Kalender** — Vollständige Terminansicht mit Detailpopup (Kunde, Adresse, Navigation, Telefon)
- **Stundenkonto** — Monats- und Jahresübersicht mit Wochendetails
- **Urlaubsplanung** — Anträge stellen, genehmigen und verwalten
- **News** — Unternehmensnachrichten
- **Aufgaben** — Team-Aufgaben mit Erledigungsstatus
- **Werkzeug** — Zugewiesene Werkzeuge einsehen
- **Werkzeug suchen** — Volltext-Suche im Werkzeugbestand mit Status-Filter
- **Urlaubsgenehmigung** — Separate Ansicht für Genehmiger
- **Mitarbeiterbildschirm** — Öffentlicher Display-Modus für Bildschirme
- **Admin** — Benutzer- und Einstellungsverwaltung
- **Dark/Light Mode** — Automatisch nach Systemeinstellung

## Architektur

```
LD Connect Portal
├── Frontend (React + Vite)         → nginx Container
├── Backend (Node.js + Express)     → Node Container
├── Lokale DB (SQLite)              → Benutzer, Einstellungen, Labels
└── Powerbird DB (MSSQL)           → Read-only Verbindung
```

## Technischer Stack

| Komponente | Technologie |
|---|---|
| Frontend | React 18, Vite |
| Backend | Node.js 20, Express |
| Lokale DB | SQLite (better-sqlite3) |
| ERP-Anbindung | MSSQL (mssql) |
| Deployment | Docker Compose |
| Reverse Proxy | nginx |

## Voraussetzungen

- Docker & Docker Compose
- Netzwerkzugang zur Powerbird MSSQL-Datenbank
- Node.js 20+ (für lokale Entwicklung)

## Installation (Produktion)

```bash
# Repository klonen
git clone https://github.com/ldroeger/LD-Connect-Portal.git
cd LD-Connect-Portal

# Umgebungsvariablen konfigurieren
cp .env.example .env
# .env anpassen: DB-Verbindung, Port, etc.

# Starten
docker compose up -d --build

# Portal erreichbar unter:
# http://server-ip:80
```

## Update (Produktion)

```bash
cd /opt/LD-Connect-Portal
git fetch origin && git reset --hard origin/main
docker compose up -d --build
```

## Lokale Entwicklung

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (separates Terminal)
cd frontend
npm install
npm run dev
```

## Projektstruktur

```
LD-Connect-Portal/
├── backend/
│   ├── routes/
│   │   ├── auth.js          # Login, Token-Verwaltung
│   │   ├── calendar.js      # Termine, Stunden, Werkzeuge
│   │   ├── vacation.js      # Urlaub
│   │   ├── display.js       # News, Aufgaben, Mitarbeiterbildschirm
│   │   ├── users.js         # Benutzerverwaltung, Feature-Flags
│   │   └── branding.js      # Logo, Farben, Firmenname
│   ├── db/
│   │   └── localDb.js       # SQLite-Initialisierung & Migrations
│   └── server.js
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── DashboardPage.jsx
│       │   ├── CalendarPage.jsx
│       │   ├── HoursPage.jsx
│       │   ├── VacationPage.jsx
│       │   ├── NewsPage.jsx
│       │   ├── TodosPage.jsx
│       │   ├── ToolsPage.jsx
│       │   ├── ToolsSearchPage.jsx
│       │   └── ...
│       └── components/
│           ├── ApptDetailPopup.jsx   # Termin-Detail mit Navigation
│           ├── ToolDetailPopup.jsx   # Werkzeug-Detail mit Kalender
│           └── ...
└── docker-compose.yml
```

## Feature-Flags

Über die Admin-Oberfläche können pro Benutzer Features aktiviert/deaktiviert werden:

| Flag | Beschreibung |
|---|---|
| `feature_calendar` | Kalender anzeigen |
| `feature_hours` | Stundenkonto anzeigen |
| `feature_vacation` | Urlaubsplanung anzeigen |
| `feature_news_read` | News lesen |
| `feature_news_write` | News schreiben |
| `feature_todos_read` | Aufgaben lesen |
| `feature_todos_create` | Aufgaben erstellen |
| `feature_tools` | Mein Werkzeug anzeigen |
| `feature_tools_search` | Werkzeug suchen |
| `feature_show_verleih` | Verleih-Details anzeigen |

## Lizenz

Proprietär — Alle Rechte vorbehalten. Nur für den internen Einsatz mit Powerbird ERP.
