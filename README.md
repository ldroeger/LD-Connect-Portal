# LD Connect Mitarbeiterportal

Ein selbst gehostetes Mitarbeiterportal für **Powerbird ERP** (Hausmann Wynen). Ermöglicht Mitarbeitern den Zugriff auf Kalender, Urlaubsplanung, Stundenkonto und mehr — direkt aus Powerbird.

![License](https://img.shields.io/badge/license-MIT-blue)
![Docker](https://img.shields.io/badge/docker-ready-brightgreen)
![Platform](https://img.shields.io/badge/platform-web%20%7C%20iOS%20%7C%20Android-lightgrey)

---

## 📋 Features

### Mitarbeiter-Portal (Web)
| Feature | Beschreibung |
|---|---|
| 🏠 **Dashboard** | Übersicht mit Terminen, Stundensaldo, Urlaubsstatus und Schnellnavigation |
| 📅 **Kalender** | Termine direkt aus Powerbird mit originalen Terminfaben |
| 🌴 **Urlaubsplanung** | Urlaub beantragen, Status einsehen, automatische Genehmigung |
| ⏱ **Stundenkonto** | Zeiterfassung, Monats- und Jahresübersicht mit KDI/Projektdetails |
| 📰 **News** | Interne Neuigkeiten lesen und verwalten |
| ✅ **Aufgaben** | Aufgaben einsehen, als erledigt markieren |
| 📋 **Termindetails** | Kundenname, KDI-Nummer, Adresse, Telefon, E-Mail direkt im Popup |

### Mitarbeiterbildschirm (Display)
| Feature | Beschreibung |
|---|---|
| 🖥 **Bildschirm-Modus** | Öffentliche URL für TV-Bildschirme im Betrieb (Port 8081) |
| 📅 **Termine pro Mitarbeiter** | Heutige Termine als Kacheln mit Powerbird-Farben |
| 📰 **News & Aufgaben** | Linke Spalte mit aktuellen Neuigkeiten und offenen Aufgaben |
| 👆 **Touch-Modus** | Antippen für Termindetails, Wochenkalender, Aufgaben erledigen |
| 📆 **Wochenkalender** | Popup mit Zeitleiste (06:00–22:00) und automatischem Countdown |
| 🎨 **Themes** | Dunkel, Hell, Schwarz — pro Bildschirm einstellbar |
| 🔄 **Auto-Scroll** | Automatisches Scrollen bei langem Inhalt (Touch deaktiviert) |

### Administration
| Feature | Beschreibung |
|---|---|
| 👥 **Benutzerverwaltung** | Anlegen, Rollen, Feature-Flags pro Benutzer |
| 🔒 **Feature-Flags** | Kalender, Urlaub, Stunden, News lesen/schreiben, Aufgaben lesen/erstellen |
| 🎨 **Branding** | Logo, Primärfarbe, Firmenname, Favicon, Fallback-Terminfarben |
| 🌙 **Dark Mode** | Hell/Dunkel-Umschaltung pro Benutzer |
| 📅 **Termineinstellungen** | Wählbare Felder in der Detailansicht (Adresse, KDI, Telefon, E-Mail) |
| 📱 **Push-Benachrichtigungen** | Bei Urlaubsanträgen und Genehmigungen (iOS & Android) |

---

## 🚀 Schnellstart

### Voraussetzungen
- [Docker](https://www.docker.com/get-started) & Docker Compose
- Powerbird ERP mit SQL Server (read-only Zugang)
- Port **80** (Web-App) und **8081** (Bildschirme) erreichbar

### Installation

```bash
# 1. Repository klonen
git clone https://github.com/ldroeger/LD-Connect-Portal.git
cd LD-Connect-Portal

# 2. Docker Compose Plugin installieren (falls nicht vorhanden)
apt-get update && apt-get install -y docker-compose-plugin

# 3. Starten
docker compose up -d --build
```

Browser öffnen: `http://SERVER-IP` → Setup-Assistent startet automatisch.

> **Hinweis:** Neuere Docker-Versionen verwenden `docker compose` (ohne Bindestrich) statt `docker-compose`.

### Update

```bash
cd /opt/LD-Connect-Portal

# Neueste Version laden
git fetch origin
git reset --hard origin/main

# Container neu bauen und starten
docker compose up -d --build
```

### Erstinstallation auf einem Server (Linux)

```bash
# Docker installieren (falls nicht vorhanden)
curl -fsSL https://get.docker.com | sh

# Docker Compose Plugin installieren
apt-get install -y docker-compose-plugin

# Repository klonen
mkdir -p /opt
cd /opt
git clone https://github.com/ldroeger/LD-Connect-Portal.git
cd LD-Connect-Portal

# Starten
docker compose up -d --build
```

---

## ⚙️ Einrichtung

Der Setup-Assistent führt durch 3 Schritte:

1. **Admin-Account** — E-Mail und Passwort
2. **Powerbird SQL Server** — Host, Port, Datenbank, Benutzer, Passwort
3. **Branding** — Firmenname, Logo, Farben

Danach unter **Einstellungen → Verbindung & SMTP**:
- SMTP für E-Mail-Versand konfigurieren
- **Lokale IP für Bildschirme** eintragen (damit der Öffnen-Button die richtige URL generiert)

---

## 🗄️ Powerbird Datenbankzugriff

Die App benötigt **read-only** Zugriff auf folgende Tabellen:

| Tabelle | Inhalt |
|---|---|
| `HWTER` | Termine & Kalendereinträge |
| `ELZEF` | Zeiterfassung |
| `LOZKT` | Stundenkonto |
| `LOURL` | Urlaubskonto |
| `ELMIT` | Mitarbeiterstammdaten |
| `ELPRJ` | Projekte |
| `ELKDI` | KDI (Kundendienst) — für Termindetails |

SQL Server Benutzer anlegen:
```sql
CREATE LOGIN ld_connect WITH PASSWORD = 'IhrPasswort';
CREATE USER ld_connect FOR LOGIN ld_connect;
GRANT SELECT ON HWTER TO ld_connect;
GRANT SELECT ON ELZEF TO ld_connect;
GRANT SELECT ON LOZKT TO ld_connect;
GRANT SELECT ON LOURL TO ld_connect;
GRANT SELECT ON ELMIT TO ld_connect;
GRANT SELECT ON ELPRJ TO ld_connect;
GRANT SELECT ON ELKDI TO ld_connect;
```

---

## 🖥 Mitarbeiterbildschirm

Bildschirme sind ausschließlich über **Port 8081** erreichbar — nicht über Port 80.

**Einrichten:**
1. Unter **Einstellungen → Verbindung & SMTP** die lokale IP eintragen
2. Unter **Mitarbeiterbildschirm** einen neuen Bildschirm erstellen
3. Generierten Link auf dem TV-Browser öffnen

**Einstellungen pro Bildschirm:**
- Design: Dunkel / Hell / Schwarz
- Eigenes Logo + Größe
- Inhalte: Termine, News, Aufgaben
- Alle Mitarbeiter anzeigen (auch ohne Termine)
- Touch-Modus mit Popup-Countdown
- Schriftgröße, Uhrzeitgröße
- Auto-Scroll Geschwindigkeit

**Touch-Modus:**
- Termin antippen → Detailpopup (Kunde, KDI, Adresse, Telefon, E-Mail)
- Mitarbeiter antippen → Wochenkalender mit Zeitleiste
- Aufgabe antippen → Mitarbeiter aus Liste auswählen → als erledigt markieren
- Popups schließen automatisch nach einstellbarer Zeit

---

## 🏗️ Architektur

```
LD-Connect-Portal/
├── backend/              Node.js/Express API (Port 3001, intern)
│   ├── routes/
│   │   ├── auth.js       Authentifizierung & Session
│   │   ├── calendar.js   Kalender, Stunden, Termindetails
│   │   ├── vacation.js   Urlaubsverwaltung
│   │   ├── display.js    Mitarbeiterbildschirm
│   │   ├── users.js      Benutzerverwaltung
│   │   ├── branding.js   Branding-Einstellungen
│   │   ├── push.js       Push-Benachrichtigungen
│   │   └── admin.js      Admin-Einstellungen
│   └── db/
│       ├── localDb.js    SQLite (Benutzer, Einstellungen, News, Aufgaben)
│       └── powerbirdDb.js MSSQL (Powerbird, read-only)
├── frontend/             React + Vite (Port 80 / 8081)
│   └── src/
│       ├── pages/        Dashboard, Kalender, Urlaub, Stunden, Admin...
│       ├── components/   Layout, ApptDetailPopup
│       └── contexts/     Auth, Branding, Theme
├── app/                  React Native (Expo) — iOS & Android
└── docker-compose.yml
```

---

## 🔒 Rollen & Berechtigungen

| Rolle | Beschreibung |
|---|---|
| `user` | Normaler Mitarbeiter |
| `vacation_approver` | Kann Urlaubsanträge genehmigen/ablehnen |
| `news_manager` | Kann News und Aufgaben verwalten |
| `admin` | Voller Zugriff auf alle Funktionen |

**Feature-Flags pro Benutzer:**
- 📅 Kalender · 🌴 Urlaubsplanung · ⏱ Stundenkonto
- 📰 News lesen · ✏️ News schreiben
- ✅ Aufgaben lesen · ➕ Aufgaben erstellen

---

## 📱 Mobile App

Die native App liegt im Ordner `app/` und wird mit [Expo](https://expo.dev) gebaut.

**Features:**
- WebView-basiert, lädt das Portal
- Offline-Erkennung mit Banner + Retry
- Push-Benachrichtigungen (iOS via APNs, Android via FCM)
- Automatische Serververbindung

**Build:**
```bash
cd app
npm install
# Android
EAS_NO_VCS=1 eas build --platform android --profile preview
# iOS (Apple Developer Account erforderlich)
EAS_NO_VCS=1 eas build --platform ios --profile production
EAS_NO_VCS=1 eas submit --platform ios
```

**Firebase für Android Push:**
1. [Firebase Console](https://console.firebase.google.com) → Projekt erstellen
2. Android-App mit Package `de.ldconnect.portal` hinzufügen
3. `google-services.json` in `app/` kopieren

---

## 🌐 Reverse Proxy (HTTPS)

Mit bestehendem Nginx Proxy Manager:
- **Port 80** → Web-App (Login erforderlich)
- **Port 8081** → Nur Bildschirme, intern belassen

Kein zusätzlicher Container nötig — einfach Port 80 als Proxy-Ziel eintragen.

---

## 💾 Backup

```bash
# Datenbank-Backup
docker run --rm -v ld-portal_app-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/ld-connect-backup-$(date +%Y%m%d).tar.gz /data
```

---

## 📄 Lizenz

MIT License — frei verwendbar für alle Powerbird-Kunden.

---

*Entwickelt für Powerbird ERP von Hausmann Wynen*
