# Forma – Training & Ernährung

Forma ist eine Web-App (PWA) für iPhone und Android. Man öffnet sie im Browser und kann sie wie eine echte App zum Home-Bildschirm hinzufügen. Ein App Store ist dafür nicht nötig.

**Was die App kann:**

- **Profil-Check vor der Registrierung:** Geschlecht, Alter, Größe, Gewicht, Alltag, Ziel, Erfahrung, Gym oder Zuhause (mit Equipment wie Hanteln, Stuhl, Bettkante …), Trainingstage, Trainingsdauer, Cardio-Wunsch und Ernährungsstil. Danach zeigt die App Grundumsatz, Gesamtverbrauch, Kalorienziel und Makros. Bei der Registrierung werden diese Antworten übernommen.
- **Automatischer Trainingsplan:** Der Split (Ganzkörper, Ober-/Unterkörper, Push/Pull/Beine) richtet sich nach deinen Tagen. Die Übungen passen zu Equipment und Erfahrung. Sätze, Wiederholungen, RIR („Wiederholungen in Reserve“), „bis zum Versagen“ und Pausen richten sich nach deinem Ziel.
- **93 Übungen mit Animation**, Schritt-für-Schritt-Anleitung, „Das solltest du spüren“, „Das solltest du nicht spüren“, Tipps und häufigen Fehlern. Jede Übung lässt sich gegen eine Alternative tauschen.
- **Cardio im Plan:** Anzahl und Dauer hängen von Ziel und Vorliebe ab, dazu Puls-Zone 2, Intervalle und ein Schritteziel.
- **Training live tracken:** Gewicht und Wiederholungen pro Satz (mit Komma, z. B. 22,5 kg). Die Werte vom letzten Mal sind vorausgefüllt, und „Letztes Mal: 60 kg × 10, 10, 9“ steht bei jeder Übung. Dazu kommen ein Pausen-Timer, der auch ein Neuladen übersteht, und Steigerungs-Tipps. Offline beendete Trainings werden später automatisch hochgeladen.
- **Essen tracken, auch ohne KI:** Freitext wie „2 Eier, 2 Scheiben Brot und ein Kaffee mit Milch“ erkennt die App über eine eingebaute Tabelle mit 332 Lebensmitteln. Dazu kommen die Produktsuche in Open Food Facts (Millionen Produkte, kostenlos) und die manuelle Eingabe. Spracheingabe per Mikrofon ist möglich.
- **KI-Modus (optional):** Mit eigenem API-Key schätzt eine KI Kalorien und Makros aus jedem Text, und ein KI-Coach beantwortet Fragen. Unterstützt werden Google Gemini, Groq, Cerebras, Mistral, OpenRouter, Cohere (alle mit Gratis-Kontingent), OpenAI, Anthropic Claude, xAI, DeepSeek, Together, Fireworks, Perplexity und ein eigener Server (Ollama, LM Studio).
- **Benutzerkonten:** Profil, Plan, Trainings, Essen, Gewichtsverlauf und Einstellungen werden gespeichert. Dazu kommen Datenexport, Passwort ändern und Konto löschen.
- **Ernährungstipps** auf der Startseite, beim Essen und im Training.
- **Hell- und Dunkelmodus**, Kontraste nach WCAG AA.
- **Funktioniert offline:** Ist die App einmal geöffnet, startet sie auch ohne Internet (z. B. im Gym-Keller) mit den zuletzt geladenen Daten.
- **Sicherheit:**
  - Passwörter werden mit PBKDF2-SHA256 gehasht, Login-Sitzungen über HttpOnly-Cookies verwaltet.
  - Login, Registrierung und die KI-Weiterleitung sind begrenzt (Rate Limits).
  - Sicherheits-Header wie CSP sind gesetzt, Formulare fremder Webseiten werden abgewiesen (CSRF-Schutz), und Eingaben werden auf Größe geprüft.
  - Nach einer Passwortänderung werden alle anderen Geräte abgemeldet.
  - Beim Abmelden werden lokale Daten (auch der KI-Key) vom Gerät gelöscht.
- **Läuft auf Cloudflare:** Die App liegt auf Cloudflare Workers, die Daten in Cloudflare D1. Für dich und ein paar Freunde reicht der Gratis-Plan.

---

## Inhalt

1. [Wie ist das Projekt aufgebaut?](#1-wie-ist-das-projekt-aufgebaut)
2. [App auf deinem Computer starten](#2-app-auf-deinem-computer-starten)
3. [Auf dem Handy testen](#3-auf-dem-handy-testen)
4. [Tests und Build](#4-tests-und-build)
5. [App online stellen (Cloudflare)](#5-app-online-stellen-cloudflare)
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
| **Backend** (Server) | Cloudflare Worker mit Hono, Datenbank Cloudflare D1 | Benutzerkonten, Daten speichern, KI-Anfragen weiterleiten |

Ein paar Begriffe:

- **Cloudflare Workers** führt kleine Server-Programme in Cloudflares Rechenzentren aus. Du musst keinen eigenen Server mieten oder warten. Cloudflare liefert auch die fertige App (Ordner `dist/`) als statische Dateien aus.
- **Hono** ist ein kleines Web-Framework. Damit schreibt man die API-Routen (`/api/...`) übersichtlich.
- **D1** ist Cloudflares Datenbank. Sie funktioniert wie SQLite und versteht normales SQL.
- **Wrangler** ist Cloudflares Kommandozeilen-Programm. Es wird mit `npm install` installiert und startet die App lokal, legt die Datenbank an und veröffentlicht die App.
- **Migrationen** (Ordner `migrations/`) sind SQL-Dateien, die die Tabellen anlegen. Wrangler merkt sich, welche schon ausgeführt wurden.

```
Training/
├── index.html               Einstiegsseite der App
├── wrangler.jsonc           Cloudflare-Einstellungen (Name, Datenbank, nächtliches Aufräumen)
├── migrations/
│   └── 0001_init.sql        legt alle Tabellen an
├── public/                  Dateien, die 1:1 ausgeliefert werden
│   ├── _headers             Sicherheits- und Cache-Header für Cloudflare
│   ├── exercises/           Übungsbilder: 0.webp + 1.webp (= Animation), thumb.webp
│   ├── icons/               App-Icons
│   ├── manifest.webmanifest macht die App installierbar
│   ├── theme.js             setzt Hell/Dunkel, bevor die Seite erscheint
│   └── sw.js                Service Worker: Offline-Cache (Dateiliste fügt der Build ein)
├── worker/                  Backend (läuft auf Cloudflare)
│   ├── index.ts             alle API-Routen (/api/...)
│   ├── auth.ts              Login-Sitzungen, Rate Limits, nächtliches Aufräumen
│   ├── password.ts          Passwörter hashen und prüfen
│   └── ai.ts                Weiterleitung an KI-Anbieter
├── scripts/
│   └── reset-password.ts    Passwort eines Kontos zurücksetzen (für dich als Betreiber)
└── src/                     Frontend
    ├── main.tsx             startet React
    ├── App.tsx              welche Seite bei welcher URL
    ├── styles.css           das komplette Design
    ├── state/app.tsx        eingeloggter Nutzer, Profil, Plan, Offline-Speicher
    ├── pages/               eine Datei pro Seite (z. B. TodayPage.tsx, WorkoutPage.tsx)
    ├── components/          wiederverwendbare Bausteine
    ├── data/
    │   ├── exercises.ts     die Übungsbibliothek
    │   └── foods.ts         die Lebensmittel-Tabelle
    └── lib/                 die Logik ohne Oberfläche
        ├── plan.ts          Trainingsplan-Generator
        ├── nutrition.ts     Kalorien und Makros
        ├── foodParser.ts    erkennt Essen aus Text (ohne KI)
        ├── ai.ts            KI-Funktionen
        ├── format.ts        Zahlen formatieren und lesen (Komma!)
        ├── hooks.ts         Daten laden, Fehlerbehandlung (useAction)
        ├── storage.ts       sicherer Zugriff auf localStorage
        ├── aiProviders.ts   Liste aller KI-Anbieter
        └── tips.ts          Ernährungs- und Trainingstipps
```

---

## 2. App auf deinem Computer starten

### Schritt 1: Node.js installieren

Du brauchst **Node.js ab Version 22.18**.

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
```

- `git clone …` lädt das Projekt in einen neuen Ordner `Training`.
- `cd Training` wechselt in diesen Ordner.

### Schritt 3: Abhängigkeiten installieren

```bash
npm install
```

Das lädt alle Pakete (React, Hono, Wrangler …) in den Ordner `node_modules`. Das dauert beim ersten Mal ein bis zwei Minuten.

### Schritt 4: App starten

```bash
npm run dev
```

Damit starten zwei Programme gleichzeitig:

- **api** (blau): Wrangler startet den Worker auf Port 8787, genau so, wie er später bei Cloudflare läuft. Vorher legt er die Tabellen in einer lokalen Test-Datenbank an.
- **web** (grün): die Oberfläche auf Port 5173. Sie leitet alle `/api`-Anfragen an den Worker weiter.

Öffne jetzt im Browser: **http://localhost:5173**

Änderst du Code, lädt sich die Seite automatisch neu. Zum Beenden drückst du `Strg + C` im Terminal.

> Für die lokale Entwicklung brauchst du **kein** Cloudflare-Konto. Die Test-Datenbank liegt im Ordner `.wrangler/`. Willst du von vorn anfangen, stopp die App und lösch diesen Ordner.

---

## 3. Auf dem Handy testen

Dein Handy und dein Computer müssen im **selben WLAN** sein.

1. Öffne zwei Terminals im Projektordner:

   ```bash
   # Terminal 1: der Worker (API)
   npm run dev:api
   ```

   ```bash
   # Terminal 2: die Oberfläche, im WLAN erreichbar
   npm run dev:web -- --host
   ```

   Das `--host` sagt Vite, dass auch andere Geräte im WLAN zugreifen dürfen. Die zwei Striche `--` braucht npm, damit es `--host` an Vite weitergibt.

2. Vite zeigt jetzt eine Zeile wie `Network: http://192.168.178.23:5173/`.
3. Öffne genau diese Adresse im Browser deines Handys.

> **Hinweis:** Die Spracheingabe per Mikrofon und die Installation als App funktionieren auf dem Handy nur über HTTPS, also erst, wenn die App online ist (Schritt 5). Die Diktierfunktion der Handy-Tastatur funktioniert immer.

---

## 4. Tests und Build

```bash
npm test            # 43 automatische Tests (Kalorien, Plan-Generator, Essens-Erkennung, KI-Antworten, Passwörter)
npm run typecheck   # prüft den TypeScript-Code (Frontend und Worker) auf Fehler
npm run build       # prüft die Typen und baut die fertige App in den Ordner dist/
npm run preview     # baut die App und startet sie wie bei Cloudflare: http://localhost:8787
```

---

## 5. App online stellen (Cloudflare)

Damit du die App unterwegs und deine Freunde sie nutzen können, kommt sie auf Cloudflare. Das ist für den Anfang **kostenlos**. Der Gratis-Plan erlaubt 100.000 Anfragen pro Tag und 5 GB Datenbank.

Du hast zwei Wege. **Weg A** geht einmalig vom eigenen Computer. **Weg B** verbindet Cloudflare mit GitHub, dann geht jede Änderung auf `main` automatisch online. Am einfachsten machst du einmal Weg A und richtest danach Weg B ein.

### Vorbereitung: Cloudflare-Konto

1. Öffne https://dash.cloudflare.com/sign-up
2. Registriere dich mit E-Mail und Passwort und bestätige die E-Mail.
3. Eine Kreditkarte oder eine eigene Domain brauchst du **nicht**.

### Weg A: Vom Computer veröffentlichen

**Schritt 1: Wrangler mit deinem Konto verbinden**

Im Projektordner:

```bash
npx wrangler login
```

- `npx` startet ein Programm aus `node_modules`, hier Wrangler.
- Es öffnet sich ein Browserfenster. Log dich bei Cloudflare ein und klick auf **„Allow“**.
- Im Terminal steht dann `Successfully logged in`.

Prüfen, ob es geklappt hat:

```bash
npx wrangler whoami
```

Hier sollten deine E-Mail und dein Account stehen.

**Schritt 2: Veröffentlichen**

```bash
npm run deploy
```

Das macht drei Dinge nacheinander:

1. `npm run build`: prüft den Code und baut die App in `dist/`.
2. `wrangler deploy`: lädt alles zu Cloudflare hoch. **Beim ersten Mal** legt Wrangler automatisch eine Datenbank namens `forma` in deinem Konto an. Wrangler trägt danach die ID der Datenbank in `wrangler.jsonc` ein. Diese Änderung kannst du committen oder verwerfen, beides funktioniert.
3. `wrangler d1 migrations apply forma --remote`: legt die Tabellen in der Online-Datenbank an. Wrangler fragt `Ok to proceed?`. Bestätige mit `y` und Enter.

Am Ende zeigt Wrangler die Adresse deiner App, zum Beispiel:

```
https://forma.<dein-name>.workers.dev
```

Öffne sie im Browser, fertig. Die Adresse findest du auch im Cloudflare-Dashboard unter **Workers & Pages**, dann **forma**.

> **Updates:** Nach jeder Änderung einfach wieder `npm run deploy`. Die Daten in der Datenbank bleiben erhalten.

### Weg B: Automatisch bei jedem Push (GitHub verbinden)

1. Öffne https://dash.cloudflare.com, dann links **Workers & Pages**.
2. Hast du Weg A schon gemacht, klick auf den Worker **forma**, dann **Settings** und **Build**, dann bei **Git repository** auf **Connect**. Sonst klick auf **Create**, dann **Import a repository**.
3. Verbinde dein GitHub-Konto und wähl das Repository `souf1001/Training`.
4. Trag Folgendes ein:

   | Feld | Wert |
   |---|---|
   | Project name | `forma` (muss genau so heißen wie `name` in `wrangler.jsonc`) |
   | Production branch | `main` |
   | Build command | `npm run build` |
   | Deploy command | `npx wrangler deploy && npx wrangler d1 migrations apply forma --remote` |

5. Klick auf **Save and Deploy**.

Ab jetzt baut Cloudflare die App bei jedem Push auf `main` und stellt sie online. Unter **Deployments** siehst du, ob ein Build geklappt hat. Die Node-Version für den Build steht in der Datei `.node-version`.

### Eigene Domain (optional)

Hast du eine Domain bei Cloudflare (z. B. `forma-app.de`):

1. Im Dashboard: **Workers & Pages**, dann **forma**, **Settings**, **Domains & Routes**.
2. Klick auf **Add**, dann **Custom domain**.
3. Trag die Adresse ein, z. B. `app.forma-app.de`, und bestätige. Cloudflare richtet DNS und HTTPS automatisch ein.

### Gut zu wissen

- **Passwort-Stärke und Gratis-Plan:** Der Gratis-Plan erlaubt pro Anfrage 10 ms Rechenzeit. Passwörter werden deshalb mit 50.000 PBKDF2-Runden gehasht (etwa 9 ms). Mit **Workers Paid** (5 $/Monat) kannst du in `wrangler.jsonc` `"PASSWORD_ITERATIONS": "100000"` eintragen, das ist sicherer. Das Maximum bei Cloudflare ist 100.000. Alte Passwörter funktionieren nach der Änderung weiter.
- **Logs ansehen:** Mit `npx wrangler tail` siehst du live, was der Worker macht und ob Fehler auftreten. Oder im Dashboard: **forma**, dann **Observability**.
- **Datenbank ansehen:** Im Dashboard: **Storage & Databases**, dann **D1**, dann **forma**. Oder per Terminal:

  ```bash
  npx wrangler d1 execute forma --remote --command "SELECT COUNT(*) FROM users"
  ```

- **Backup:** Mit Time Travel kann Cloudflare die Datenbank auf einen Zeitpunkt der letzten 30 Tage zurücksetzen (Gratis-Plan: 7 Tage). Eine Kopie als Datei bekommst du so:

  ```bash
  npx wrangler d1 export forma --remote --output backup.sql
  ```

- **Nächtliches Aufräumen:** Jede Nacht um 03:17 Uhr (UTC) löscht der Worker abgelaufene Logins und alte Rate-Limit-Zähler. Das steht unter `triggers` in `wrangler.jsonc`.
- **Neue Tabellen oder Spalten:** Leg eine neue Datei an, z. B. `migrations/0002_neue_spalte.sql`. Ändere nie eine alte Migration. `npm run deploy` führt neue Migrationen automatisch aus.

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
- **Eigener Server (Ollama):** Dieser wird direkt aus dem Browser angesprochen, denn der Forma-Server kann deinen Computer nicht erreichen. Starte Ollama mit erlaubtem Zugriff, zum Beispiel: `OLLAMA_ORIGINS=* ollama serve`. Aus Sicherheitsgründen (Content Security Policy) muss die Adresse `http://localhost…` oder `https://…` sein.

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

- **Eiweiß:** 1,6 bis 2,0 g pro kg (+0,2 g bei High Protein), höchstens 40 % der Kalorien. Bei viel Körperfett wird mit dem Gewicht bei BMI 27 gerechnet.
- **Fett:** 27 bis 28 % der Kalorien (Low Carb 40 %, Keto: der Rest), mindestens 0,6 g pro kg, aber nie mehr, als nach dem Eiweiß noch übrig ist.
- **Kohlenhydrate:** der Rest (bei Keto maximal 30 g).

**Trainingsplan** (`src/lib/plan.ts`):

| Tage | Split |
|---|---|
| 1–3 | Ganzkörper A/B/C |
| 4 | Oberkörper / Unterkörper |
| 5 | Ober-/Unterkörper + Push/Pull/Beine |
| 6 | Push / Pull / Beine × 2 |

- Anfänger bekommen maximal 4 Krafttage, die übrigen Tage werden Cardio-Tage. Ein Tag pro Woche bleibt immer ganz frei.
- Jeder Trainingstag ist eine Liste von Bewegungsmustern (Kniebeuge, Hüftstreckung, Drücken, Ziehen …). Für jedes Muster wählt die App eine passende Übung aus `exercises.ts`:
  - nur mit Geräten, die du hast (im Gym: Langhantel, Kabel, Maschinen, Kurzhanteln, Kettlebell, Bank, Klimmzugstange),
  - nur passend zu deiner Erfahrung,
  - schwerere, besser steigerbare Geräte zuerst, abwechselnd zwischen den besten 3 Optionen,
  - jeder Tag beginnt mit einer Grundübung (z. B. Kniebeuge statt Beinbeuger),
  - Rumpf-Übungen an höchstens 2 Tagen pro Woche und nie bis zum Versagen.
- Der Kalorienverbrauch zählt die Krafttage, die wirklich im Plan stehen, nicht die gewählten.
- Die Anzahl der Übungen richtet sich nach der Trainingszeit: 30 Min. = 4, 45 Min. = 5, 60 Min. = 6 …
- **Steigerung (Double Progression):** Schaffst du in allen Sätzen die obere Wiederholungszahl, schlägt die App beim nächsten Mal mehr Gewicht vor: +1 kg unter 10 kg, +2 kg bis 40 kg, darüber +2,5 kg. Bei Halte-Übungen sind es 5 Sekunden mehr.

---

## 9. Erweitern: Übungen, Lebensmittel, KI-Anbieter

**Neue Übung:** Füge in `src/data/exercises.ts` ein Objekt beim passenden `pattern` hinzu. Die Reihenfolge ist die Priorität: weiter oben bedeutet, dass die Übung öfter gewählt wird. Die Bilder legst du als `public/exercises/<ordner>/0.webp` (Start), `1.webp` (Ende, je ca. 640 px breit) und `thumb.webp` (160 × 160 px) ab. Die vorhandenen Fotos stammen aus der gemeinfreien [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Public Domain / Unlicense).

**Neues Lebensmittel:** Füge in `src/data/foods.ts` einen Eintrag hinzu (Werte pro 100 g). Unter `aliases` stehen alle Wörter, die Leute dafür tippen, in Kleinbuchstaben.

**Neuer KI-Anbieter:** Die meisten Anbieter sprechen das OpenAI-Format. Ein neuer Eintrag in `src/lib/aiProviders.ts` mit `api: 'openai'` und der `baseUrl` genügt.

---

## 10. Häufige Probleme

| Problem | Lösung |
|---|---|
| `npm install` oder `npm run dev` bricht mit Syntax-Fehlern ab | Deine Node-Version ist zu alt. Installiere Node ab 22.18 (`node -v` prüfen). |
| `npx wrangler login` öffnet keinen Browser | Kopier die Adresse, die im Terminal steht, in deinen Browser. |
| Beim Deploy: `You are not authenticated` | Erst `npx wrangler login` ausführen (Schritt 5, Weg A). |
| Online: Fehler `no such table: users` | Die Tabellen fehlen noch. Führ `npm run db:migrate` aus. |
| Online: Registrierung oder Login bricht mit „Error 1102“ oder „exceeded CPU“ ab | Der Gratis-Plan hat zu wenig Rechenzeit. Setz in `wrangler.jsonc` `PASSWORD_ITERATIONS` auf `"40000"` und führ `npm run deploy` aus. Oder wechsle auf Workers Paid. |
| Weg B: Build schlägt fehl, Worker heißt anders | Der Project name im Dashboard muss `forma` sein, genau wie `name` in `wrangler.jsonc`. |
| Weg B: Migration schlägt mit „Authentication error“ fehl | Beim Build-Token fehlt das Recht für D1. Im Dashboard unter **forma**, **Settings**, **Build**, **API token** ein Token mit „D1 Edit“ wählen. Oder die Migration einmal per `npm run db:migrate` vom Computer ausführen. |
| Wrangler zeigt Warnungen zu Telemetrie oder Proxy | Das ist nur ein Hinweis und kein Fehler. |
| KI: „API-Key ungültig“ | Schlüssel neu kopieren (ohne Leerzeichen) oder prüfen, ob er beim Anbieter aktiv ist. |
| KI: „Modell nicht gefunden“ | Tippe auf „Modelle laden“ und wähl eines aus der Liste. |
| Passwort vergessen | Im Projektordner `npm run reset-password -- person@beispiel.de` ausführen (du musst mit `npx wrangler login` eingeloggt sein). Das Programm zeigt ein neues Passwort an und meldet alle Geräte ab. Für die lokale Test-Datenbank hängst du `--local` an. |
| Nach einem Update zeigt die App noch die alte Version | Die App einmal schließen und neu öffnen. Der Service Worker lädt die neue Version im Hintergrund. |
| Port 8787 oder 5173 schon belegt | Das andere Programm beenden, z. B. ein altes Terminal mit `npm run dev`. |
