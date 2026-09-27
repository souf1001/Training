# Forma – Training & Ernährung

Forma ist eine Web-App (PWA) für iPhone und Android. Man öffnet sie im Browser und kann sie wie eine echte App zum Home-Bildschirm hinzufügen. Ein App Store ist dafür nicht nötig.

**Was die App kann:**

- **Profil-Check vor der Registrierung:** Geschlecht, Alter, Größe, Gewicht, Alltag, Ziel, Erfahrung, Gym oder Zuhause (mit Equipment wie Hanteln, Stuhl, Bettkante …), Trainingstage, Trainingsdauer, Cardio-Wunsch und Ernährungsstil. Danach zeigt die App Grundumsatz, Gesamtverbrauch, Kalorienziel und Makros. Bei der Registrierung werden diese Antworten übernommen.
- **Automatischer Trainingsplan:** Der Split (Ganzkörper, Ober-/Unterkörper, Push/Pull/Beine) richtet sich nach deinen Tagen. Die Übungen passen zu Equipment und Erfahrung. Sätze, Wiederholungen, RIR („Wiederholungen in Reserve“), „bis zum Versagen“ und Pausen richten sich nach deinem Ziel.
- **93 Übungen mit Animation**, Schritt-für-Schritt-Anleitung, „Das solltest du spüren“, „Das solltest du nicht spüren“, Tipps und häufigen Fehlern. Jede Übung lässt sich gegen eine Alternative tauschen.
- **Cardio im Plan:** Anzahl und Dauer hängen von Ziel und Vorliebe ab, dazu Puls-Zone 2, Intervalle und ein Schritteziel.
- **Training live tracken:** Gewicht und Wiederholungen pro Satz, Pausen-Timer und Steigerungs-Tipps auf Basis des letzten Trainings.
- **Essen tracken, auch ohne KI:** Freitext wie „2 Eier, 2 Scheiben Brot und ein Kaffee mit Milch“ erkennt die App über eine eingebaute Tabelle mit 332 Lebensmitteln. Dazu kommen die Produktsuche in Open Food Facts (Millionen Produkte, kostenlos) und die manuelle Eingabe. Spracheingabe per Mikrofon ist möglich.
- **KI-Modus (optional):** Mit eigenem API-Key schätzt eine KI Kalorien und Makros aus jedem Text, und ein KI-Coach beantwortet Fragen. Unterstützt werden Google Gemini, Groq, Cerebras, Mistral, OpenRouter, Cohere (alle mit Gratis-Kontingent), OpenAI, Anthropic Claude, xAI, DeepSeek, Together, Fireworks, Perplexity und ein eigener Server (Ollama, LM Studio).
- **Benutzerkonten:** Profil, Plan, Trainings, Essen, Gewichtsverlauf und Einstellungen werden gespeichert. Dazu kommen Datenexport, Passwort ändern und Konto löschen.
- **Ernährungstipps** auf der Startseite, beim Essen und im Training.
- **Hell- und Dunkelmodus.**

---

## Inhalt

1. [Wie ist das Projekt aufgebaut?](#1-wie-ist-das-projekt-aufgebaut)
2. [App auf deinem Computer starten](#2-app-auf-deinem-computer-starten)
3. [Auf dem Handy testen](#3-auf-dem-handy-testen)
4. [Tests und Build](#4-tests-und-build)
5. [App online stellen (Hosting)](#5-app-online-stellen-hosting)
6. [Als App auf dem Handy installieren](#6-als-app-auf-dem-handy-installieren)
7. [KI-Modus einrichten](#7-ki-modus-einrichten)
8. [Wie rechnet die App?](#8-wie-rechnet-die-app)
9. [Erweitern: Übungen, Lebensmittel, KI-Anbieter](#9-erweitern-übungen-lebensmittel-ki-anbieter)
10. [Häufige Probleme](#10-häufige-probleme)

---

## 1. Wie ist das Projekt aufgebaut?

Die App besteht aus zwei Teilen:

| Teil | Technik | Aufgabe |
|---|---|---|
| **Frontend** (was du im Browser siehst) | React, TypeScript, Vite, normales CSS | Oberfläche, Trainingsplan-Berechnung, Kalorien-Berechnung |
| **Backend** (Server) | Node.js, Express, SQLite | Benutzerkonten, Daten speichern, KI-Anfragen weiterleiten |

**SQLite** ist eine Datenbank in einer einzigen Datei (`data/forma.db`). Node.js hat SQLite bereits eingebaut, daher musst du keinen Datenbank-Server installieren.

```
Training/
├── index.html               Einstiegsseite der App
├── public/                  Dateien, die 1:1 ausgeliefert werden
│   ├── exercises/           Übungsbilder (je 2 Bilder = Animation)
│   ├── icons/               App-Icons
│   ├── manifest.webmanifest macht die App installierbar
│   └── sw.js                Service Worker: Offline-Cache
├── server/                  Backend
│   ├── index.ts             alle API-Routen (/api/...)
│   ├── db.ts                Datenbank-Tabellen
│   ├── auth.ts              Passwörter, Login-Sitzungen
│   └── ai.ts                Weiterleitung an KI-Anbieter
└── src/                     Frontend
    ├── main.tsx             startet React
    ├── App.tsx              welche Seite bei welcher URL
    ├── styles.css           das komplette Design
    ├── state/app.tsx        eingeloggter Nutzer, Profil, Plan
    ├── pages/               eine Datei pro Seite
    ├── components/          wiederverwendbare Bausteine
    ├── data/
    │   ├── exercises.ts     die Übungsbibliothek
    │   └── foods.ts         die Lebensmittel-Tabelle
    └── lib/                 die Logik ohne Oberfläche
        ├── plan.ts          Trainingsplan-Generator
        ├── nutrition.ts     Kalorien und Makros
        ├── foodParser.ts    erkennt Essen aus Text (ohne KI)
        ├── ai.ts            KI-Funktionen
        ├── aiProviders.ts   Liste aller KI-Anbieter
        └── tips.ts          Ernährungs- und Trainingstipps
```

---

## 2. App auf deinem Computer starten

### Schritt 1: Node.js installieren

Du brauchst **Node.js ab Version 22.18**, denn ab dieser Version kann Node TypeScript direkt ausführen.

1. Öffne https://nodejs.org
2. Lade die **LTS**-Version herunter und installiere sie (einfach immer „Weiter“ klicken).
3. Öffne ein Terminal:
   - **Windows:** Starttaste drücken, `PowerShell` eintippen, Enter.
   - **Mac:** `Cmd + Leertaste`, `Terminal` eintippen, Enter.
4. Prüfe die Version:

   ```bash
   node -v
   ```

   Hier sollte etwas wie `v22.18.0` oder höher stehen. Steht dort eine kleinere Zahl, installiere Node neu.

### Schritt 2: Projekt herunterladen

Falls du Git noch nicht hast, installiere es von https://git-scm.com.

```bash
git clone https://github.com/souf1001/Training.git
cd Training
git checkout claude/new-session-sys9gc
```

- `git clone …` lädt das Projekt in einen neuen Ordner `Training`.
- `cd Training` wechselt in diesen Ordner.
- `git checkout …` wechselt auf den Branch mit der App.

### Schritt 3: Abhängigkeiten installieren

```bash
npm install
```

Das lädt alle Pakete (React, Express …) in den Ordner `node_modules`. Das dauert beim ersten Mal ein bis zwei Minuten.

### Schritt 4: App starten

```bash
npm run dev
```

Damit starten zwei Programme gleichzeitig:

- **api** (blau): der Server auf Port 3000
- **web** (grün): die Oberfläche auf Port 5173. Sie leitet alle `/api`-Anfragen an den Server weiter.

Öffne jetzt im Browser: **http://localhost:5173**

Änderst du Code, lädt sich die Seite automatisch neu. Zum Beenden drückst du `Strg + C` im Terminal.

> Die Datenbank liegt danach in `data/forma.db`. Willst du von vorn anfangen, stopp die App und lösch den Ordner `data`.

---

## 3. Auf dem Handy testen

Dein Handy und dein Computer müssen im **selben WLAN** sein.

1. Starte die Oberfläche so, dass sie im Netzwerk erreichbar ist. Öffne dafür zwei Terminals:

   ```bash
   # Terminal 1
   npm run dev:api
   ```

   ```bash
   # Terminal 2
   npm run dev:web -- --host
   ```

2. Vite zeigt jetzt eine Zeile wie `Network: http://192.168.178.23:5173/`.
3. Öffne genau diese Adresse im Browser deines Handys.

> **Hinweis:** Die Spracheingabe per Mikrofon funktioniert auf dem Handy nur über HTTPS, also erst nach dem Hosting (Schritt 5). Die Diktierfunktion der Handy-Tastatur funktioniert immer.

---

## 4. Tests und Build

```bash
npm test            # automatische Tests (Kalorien, Plan-Generator, Essens-Erkennung)
npm run typecheck   # prüft den TypeScript-Code auf Fehler
npm run build       # baut die fertige App in den Ordner dist/
npm start           # startet den Server, der dist/ ausliefert: http://localhost:3000
```

---

## 5. App online stellen (Hosting)

Damit Freunde (oder du unterwegs) die App nutzen können, muss sie auf einem Server im Internet laufen. **Wichtig:** Der Server braucht eine **dauerhafte Festplatte** (ein „Volume“), denn dort liegt die SQLite-Datenbank. Ohne Volume sind bei jedem Neustart alle Konten weg.

Im Projekt liegt ein fertiges `Dockerfile`. Damit läuft die App bei fast jedem Anbieter.

### Variante A: Railway (am einfachsten)

1. Erstelle ein Konto auf https://railway.app (Login mit GitHub).
2. Klicke auf **New Project**, dann **Deploy from GitHub repo**, und wähl `souf1001/Training`.
3. Unter **Settings** wählst du als Branch `claude/new-session-sys9gc`. Railway erkennt das `Dockerfile` automatisch.
4. Lege ein Volume an: Rechtsklick auf den Service, dann **Attach Volume**, Mount Path: `/data`.
5. Unter **Variables** fügst du hinzu:
   - `NODE_ENV` = `production`
6. Unter **Settings**, **Networking** klickst du auf **Generate Domain**. Du bekommst eine Adresse wie `forma-production.up.railway.app`.
7. Öffne die Adresse, fertig.

### Variante B: Fly.io

1. Installiere das Fly-Programm (Anleitung: https://fly.io/docs/flyctl/install/).
2. Im Projektordner:

   ```bash
   fly auth login                      # im Browser einloggen
   fly launch --no-deploy              # App anlegen; Fragen mit Enter bestätigen
   fly volumes create data --size 1    # 1 GB Festplatte für die Datenbank
   ```

3. Öffne die neu erstellte Datei `fly.toml` und füg am Ende hinzu:

   ```toml
   [mounts]
     source = "data"
     destination = "/data"

   [env]
     NODE_ENV = "production"
   ```

4. Veröffentlichen:

   ```bash
   fly deploy
   ```

### Variante C: Eigener Server mit Docker (z. B. ein kleiner VPS)

```bash
docker build -t forma .
docker run -d --name forma -p 3000:3000 -v forma-data:/data -e NODE_ENV=production --restart unless-stopped forma
```

Davor brauchst du einen Webserver mit HTTPS (z. B. Caddy), der auf Port 3000 weiterleitet.

> **Warum HTTPS?** Mit `NODE_ENV=production` wird das Login-Cookie nur über HTTPS gesendet. Außerdem brauchen Installation als App und Mikrofon HTTPS. Railway und Fly.io machen das automatisch.

---

## 6. Als App auf dem Handy installieren

**iPhone (Safari):**

1. Öffne die Adresse der App in **Safari**.
2. Tippe unten auf das Teilen-Symbol (Quadrat mit Pfeil nach oben).
3. Scroll runter und tippe auf **„Zum Home-Bildschirm“**.
4. Tippe auf **„Hinzufügen“**.

**Android (Chrome):**

1. Öffne die Adresse der App in **Chrome**.
2. Tippe oben rechts auf **⋮**.
3. Tippe auf **„App installieren“** (oder „Zum Startbildschirm hinzufügen“).
4. Bestätige mit **„Installieren“**.

Die App startet dann im Vollbild ohne Browser-Leiste. Diese Anleitung findest du auch in der App unter **Profil, Als App installieren**.

---

## 7. KI-Modus einrichten

Ohne KI funktioniert alles, nur das Essen wird über die eingebaute Tabelle und Open Food Facts erkannt. Mit KI kannst du beliebige Mahlzeiten beschreiben.

**Kostenlos starten, z. B. mit Google Gemini:**

1. Öffne https://aistudio.google.com/apikey und log dich mit einem Google-Konto ein.
2. Klicke auf **„API-Schlüssel erstellen“** und kopiere den Schlüssel.
3. In Forma: **Profil, KI-Anbieter**.
4. Anbieter: **Google Gemini · Gratis**. Füge den Schlüssel ins Feld „API-Key“ ein.
5. Tippe auf **„Testen“**. Steht dort „Verbindung klappt“, tippst du auf **„Speichern“**.

Genauso geht es mit **Groq** (https://console.groq.com/keys), ebenfalls kostenlos und sehr schnell.

- **„Modelle laden“** zeigt alle Modelle, die dein Schlüssel nutzen darf. Tippe ins Feld „Modell“, dann erscheint eine Auswahl.
- **Wo liegt der Schlüssel?** Nur im Browser deines Geräts (`localStorage`), nicht in der Datenbank. Bei einer KI-Anfrage schickt die App ihn einmalig an den Forma-Server, der die Anfrage an den Anbieter weiterleitet. Dadurch gibt es keine Browser-Sperren (CORS). Der Server speichert den Schlüssel nicht.
- **Eigener Server (Ollama):** Dieser wird direkt aus dem Browser angesprochen, denn der Forma-Server kann deinen Computer nicht erreichen. Starte Ollama mit erlaubtem Zugriff, zum Beispiel: `OLLAMA_ORIGINS=* ollama serve`.

---

## 8. Wie rechnet die App?

**Kalorien** (`src/lib/nutrition.ts`):

- **Grundumsatz (BMR)** nach Mifflin-St Jeor:
  - Mann: `10 × kg + 6,25 × cm − 5 × Alter + 5`
  - Frau: `10 × kg + 6,25 × cm − 5 × Alter − 161`
- **Gesamtverbrauch (TDEE)** = BMR × Alltagsfaktor (1,2 bis 1,7) + Kalorien aus Kraft- und Cardiotraining (über MET-Werte, auf den Tag verteilt)
- **Kalorienziel** = TDEE × Ziel-Faktor:

  | Ziel | Faktor |
  |---|---|
  | Abnehmen | −20 % (maximal −750 kcal) |
  | Abnehmen & aufbauen | −10 % |
  | Aufbauen | +8 % |
  | Bulken | +15 % |
  | Fit bleiben | ±0 |

- **Eiweiß:** 1,6 bis 2,0 g pro kg (+0,2 g bei High Protein). Bei viel Körperfett wird mit dem Gewicht bei BMI 27 gerechnet.
- **Fett:** 27 bis 28 % der Kalorien (Low Carb 40 %, Keto 70 %).
- **Kohlenhydrate:** der Rest (bei Keto maximal 30 g).

**Trainingsplan** (`src/lib/plan.ts`):

| Tage | Split |
|---|---|
| 1–3 | Ganzkörper A/B/C |
| 4 | Oberkörper / Unterkörper |
| 5 | Ober-/Unterkörper + Push/Pull/Beine |
| 6 | Push / Pull / Beine × 2 |

- Anfänger bekommen maximal 4 Krafttage, die übrigen Tage werden Cardio-Tage.
- Jeder Trainingstag ist eine Liste von Bewegungsmustern (Kniebeuge, Hüftstreckung, Drücken, Ziehen …). Für jedes Muster nimmt die App die erste passende Übung aus `exercises.ts`, die zu Equipment und Erfahrung passt.
- Die Anzahl der Übungen richtet sich nach der Trainingszeit: 30 Min. = 4, 45 Min. = 5, 60 Min. = 6 …
- **Steigerung (Double Progression):** Schaffst du in allen Sätzen die obere Wiederholungszahl, schlägt die App beim nächsten Mal mehr Gewicht vor.

---

## 9. Erweitern: Übungen, Lebensmittel, KI-Anbieter

**Neue Übung:** Füge in `src/data/exercises.ts` ein Objekt beim passenden `pattern` hinzu. Die Reihenfolge ist die Priorität: weiter oben bedeutet, dass die Übung öfter gewählt wird. Die Bilder legst du als `public/exercises/<ordner>/0.jpg` (Start) und `1.jpg` (Ende) ab. Die vorhandenen Fotos stammen aus der gemeinfreien [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Public Domain / Unlicense).

**Neues Lebensmittel:** Füge in `src/data/foods.ts` einen Eintrag hinzu (Werte pro 100 g). Unter `aliases` stehen alle Wörter, die Leute dafür tippen, in Kleinbuchstaben.

**Neuer KI-Anbieter:** Die meisten Anbieter sprechen das OpenAI-Format. Ein neuer Eintrag in `src/lib/aiProviders.ts` mit `api: 'openai'` und der `baseUrl` genügt.

---

## 10. Häufige Probleme

| Problem | Lösung |
|---|---|
| `SyntaxError` oder `Unknown file extension ".ts"` beim Start | Deine Node-Version ist zu alt. Installiere Node ab 22.18 (`node -v` prüfen). |
| Nach dem Login sofort wieder ausgeloggt (online) | Läuft die Seite über `http://` statt `https://`? Mit `NODE_ENV=production` braucht das Cookie HTTPS. |
| Alle Konten nach einem Neustart weg | Beim Hosting fehlt das Volume unter `/data` (siehe Schritt 5). |
| KI: „API-Key ungültig“ | Schlüssel neu kopieren (ohne Leerzeichen) oder prüfen, ob er beim Anbieter aktiv ist. |
| KI: „Modell nicht gefunden“ | Tippe auf „Modelle laden“ und wähl eines aus der Liste. |
| Port 3000 oder 5173 schon belegt | Anderes Programm beenden oder den Port wechseln: `PORT=3001 npm run dev:api` (dann auch in `vite.config.ts` anpassen). |
