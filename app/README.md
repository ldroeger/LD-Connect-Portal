# Powerbird Mobile App

React Native App (Expo) für das Powerbird Mitarbeiterportal.

## Voraussetzungen

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- EAS CLI (für Builds): `npm install -g eas-cli`
- Expo Go App auf dem Telefon (zum Testen)

## Setup

```bash
npm install
```

## Entwicklung / Testen

```bash
npm start
```

Dann QR-Code mit der **Expo Go** App scannen (iOS App Store / Google Play).

## APK für Android bauen (ohne Apple Developer Account)

```bash
# Einmalig: Expo Account erstellen auf expo.dev
eas login

# APK bauen (kostenlos, dauert ~10 Min auf Expo-Servern)
eas build --platform android --profile preview
```

In `eas.json` ist ein "preview" Profil für eine direkt installierbare APK ohne Store.

## iOS bauen

Benötigt Apple Developer Account ($99/Jahr).

```bash
eas build --platform ios
```

## App verwenden

1. App starten
2. IP-Adresse des Servers eingeben (z.B. `192.168.1.100` oder `192.168.1.100:80`)
3. App verbindet sich und öffnet das Portal als WebApp
4. Zum Ändern der Server-Adresse: **2 Sekunden** auf das ⚙ Symbol unten rechts drücken

## Hinweise

- App und Server müssen im **gleichen Netzwerk** sein
- Port 80 muss erreichbar sein
- HTTPS wird auch unterstützt (einfach `https://` eingeben)
