# Manager – Content- & Growth-Manager für dein.Finanzbruder

## Vision
Manager ist eine Progressive Web App (PWA) nur für mich: mein Content- und Growth-Manager für
den Instagram-/YouTube-Account **dein.Finanzbruder**. Sie bündelt alles, was bisher als Befehle
im Claude-Projekt „Manager“ lief: Video-Pakete planen, Cover bauen, Zahlen auswerten,
Wochenplan, Ideen-Speicher. Primäres Zielgerät ist ein **iPad (Safari, als Homescreen-App
installiert)**, zusätzlich iPhone. Alle Daten liegen **verschlüsselt auf dem Gerät**; die App
funktioniert offline, außer YouTube-/Instagram-Anbindung, optionaler KI und Push.

Die fachlichen Regeln, Vorlagen und Befehle stehen in **[docs/INHALTE.md](docs/INHALTE.md)** –
das ist die verbindliche fachliche Quelle.

1. **Start (Dashboard):** Fortschritt zum Ziel (500 Follower bis 31.12.2026, nötiges vs.
   aktuelles Wochentempo), Hauptkennzahl „neue Follower pro 1.000 Aufrufe“ (Woche/30 Tage),
   was diese Woche ansteht (Wochenplan), nächster CTA in der Rotation, letzte Beiträge.
2. **Neues Video:** Thema eingeben (+ Typ: Reel oder Podcast) → Video-Paket mit Skript (3 Hooks,
   Meme-/B-Roll-Marker), Schnittliste für CapCut, Cover, Caption (IG + YouTube), Community-Frage,
   bei Podcast 4–6 Clips. Jeder Baustein einzeln kopierbar (für CapCut, Instagram, YouTube).
   Status: Idee → Skript → gedreht → geschnitten → veröffentlicht.
3. **Cover-Studio:** Reel-Cover 1080×1920 und YouTube-Thumbnail 1280×720 nach den Cover-Regeln,
   3 Textvarianten, im Browser per Canvas gerendert, als PNG in „Fotos“ speichern/teilen.
4. **Zahlen & Auswertung:** Beiträge erfassen (Formular, CSV-Import, Screenshot auslesen mit
   optionaler KI), Retention/Quellen, Wochenreport (gut/schlecht, warum, 3 Maßnahmen, Fortschritt),
   „Was funktioniert“ (Hooks, Themen, Serien mit Durchschnittswerten).
5. **Wochenplan:** Reels, Stories, Q&A für nächste Woche im 4-Stunden-Budget, Themen aus Ideen und
   Community-Fragen priorisiert; Export in den iPad-Kalender (.ics).
6. **Ideen:** Themenspeicher inkl. Community-Fragen, Serien, Hook-Typ, Status.
7. **Marke:** Brand-Kit (Farben, Schrift, freigestelltes Foto + Posen), Kanalprofil, Regeln,
   Growth-Prioritäten, Bio-/Highlight-Checkliste.
8. **Anbindungen:** YouTube (Statistiken automatisch, nur lesend) und Instagram (Statistiken,
   nur lesend, sofern technisch machbar – s. Schritt 10).
9. **Push-Mitteilungen:** z. B. Sonntag „Wochenplan“, Montag „Auswertung“, „Q&A-Story heute“.

## Arbeitsumgebung (wichtig)
- Der Nutzer hat **nur ein iPad/iPhone**, keinen Rechner, und ist Claude-Code-Anfänger: Schritte
  einfach erklären, kurz und knapp, auf Deutsch.
- Entwickelt wird ausschließlich in Claude-Code-Cloud-Sitzungen. Der Nutzer sieht die App nur über
  GitHub Pages: https://jannebromann30092026.github.io/Manager/ (Deploy per GitHub Actions bei
  jedem Push auf main).
- Jeden Schritt mit Playwright (vorinstalliertes Chromium, kein „playwright install“) gegen den
  Production-Build (vite preview) prüfen und **Screenshots im iPad-Format** (quer 1180×820, hoch
  820×1180, deviceScaleFactor 2, hasTouch, isMobile) plus **iPhone hoch 393×852** zeigen.
- Entwicklerwerkzeuge (Komponentenübersicht, Demo-Daten) auch im Production-Build, versteckt hinter
  „Entwicklermodus“ in den Einstellungen.
- Feature-Branch pro Schritt, am Ende Pull Request mit kurzer deutscher Beschreibung, was der
  Nutzer nach dem Mergen prüfen soll.
- Das Repo ist **öffentlich** (GitHub Pages im kostenlosen Plan): nur Code und erfundene
  Demo-Daten, **nie** echte Statistiken, Tokens oder Fotos des Creators.
- Schwesterprojekte **Kompass**, **Cockpit**, **Synapse** (alle öffentlich, gleiche Arbeitsweise
  und Technik). Infrastruktur und Komponenten dürfen kopiert und angepasst werden (Kompass/Cockpit
  sind die neueste Basis: Tresor, Sperre, Backup, Kalender-Export, Google-OAuth aus Cockpit
  Schritt 4, Push aus Cockpit Schritt 8). Die Apps bleiben vollständig getrennt.
- **Gleicher Origin** (jannebromann30092026.github.io): eigene Namen sind Pflicht – Dexie-DB
  `manager`, localStorage-Präfix `manager.`, Workbox-`cacheId` `manager`, Service-Worker-Scope
  `/Manager/`.

## Tech-Stack (verbindlich, nicht ohne Rückfrage ändern)
Gleiche Versionen wie Cockpit/Kompass (dort in package.json nachsehen):
- Node.js 22 LTS, Vite + React 19 + TypeScript strict
- vite-plugin-pwa (Workbox), Tailwind CSS 4, Motion, lucide-react, Inter, Zustand,
  react-router (HashRouter), Dexie.js, zod
- Web Crypto API (PBKDF2 + AES-GCM) – keine Krypto-Bibliotheken von Dritten in der App
- Canvas 2D für das Cover-Studio (keine Bildbibliothek nötig; eigene Schrift per FontFace laden)
- @anthropic-ai/sdk im Browser (dangerouslyAllowBrowser: true), **optional**, standardmäßig aus,
  Modell konfigurierbar
- YouTube Data API v3 + YouTube Analytics API per Google-OAuth direkt aus dem Browser (nur lesend)
- Instagram API (Meta) – Ansatz wird in Schritt 10 geprüft
- Web Push (VAPID) per GitHub Actions wie Cockpit
- Vitest (+ fake-indexeddb), @playwright/test exakt 1.56.1, ESLint + Prettier
- Deployment: GitHub Actions → GitHub Pages (Vite base: "/Manager/")

## Architekturprinzipien
- **Verschlüsselung und App-Sperre wie Kompass/Cockpit:** App-Passwort, PBKDF2 (SHA-256,
  ≥ 600.000 Iterationen) → AES-GCM-256-Schlüssel nur im Arbeitsspeicher. In Dexie nur
  verschlüsselte `payload`; Bilder (Brand-Fotos, Screenshots, Cover) ebenfalls verschlüsselt.
- navigator.storage.persist() beim Start; regelmäßige Export-Erinnerung (verschlüsselte Backup-Datei).
- Datenzugriff nur über Repository-Module (src/data/repositories/*). Schemaänderungen nur über neue
  Dexie-Versionen mit upgrade-Funktion.
- **Fachliche Vorlagen sind Daten:** alles aus docs/INHALTE.md (Hook-Typen, CTA-Rotation,
  Cover-Regeln, Untertitel-Regeln, Report-Gliederung, Regeln, Growth-Prioritäten) liegt in
  src/data/templates/*, nicht in Komponenten.
- **KI ist optional und standardmäßig aus.** Ohne KI: Vorlagen mit Lückentext, Checklisten,
  Formulare, Regel-basierte Auswertung. Mit KI: Skript, Hooks, Captions, Clips, Screenshot-Auslesen,
  Report-Text. Jeder KI-Prompt enthält die Regeln aus docs/INHALTE.md (insb. „keine
  Anlageberatung“, Zahlen/Steuer/Recht nur mit Quelle, Unsicheres kennzeichnen). KI-Ausgaben sind
  Entwürfe, als „(Claude)“ markiert; Zahlen aus Screenshots muss der Nutzer bestätigen.
  KI-Aufrufe gekapselt über src/services/ai/*.
- **Die App veröffentlicht nie selbst** – sie liefert Texte und Bilder zum Kopieren/Teilen.
  YouTube/Instagram nur lesend.
- Tokens/API-Keys verschlüsselt in Tabelle „secrets“, nie geloggt, nie exportiert, in der UI nie im
  Klartext. OAuth-Client-IDs dürfen im Code stehen, Client-Secrets nie.
- Reine Logik (Kennzahlen, Zielfortschritt, CTA-Rotation, Wochenplan-Budget, Report-Regeln,
  CSV-Import, Cover-Layout-Berechnung) in src/core/ ohne React/Browser-APIs, mit Vitest getestet.
- CSP per meta-Tag, so restriktiv wie möglich; externe Verbindungen (Google, Meta,
  api.anthropic.com) erst mit dem Schritt, der sie braucht.

## Fachliche Regeln
- Hauptkennzahl: neue Follower pro 1.000 Aufrufe = neue Follower / Aufrufe × 1.000 (eine Stelle).
- Zielfortschritt: verbleibende Follower / verbleibende Wochen bis 31.12.2026 vs. Tempo der letzten
  4 Wochen; ehrlich anzeigen, wenn das Ziel so verfehlt wird.
- Unbekannte Werte bleiben leer (nie schätzen); Werte aus Screenshots mit Markierung „abgelesen“.
- Zahlen in Reports immer mit Datum/Stand; bei sehr frühen Zahlen (< 24 h) Hinweis „zu früh“.

## Ordnerstruktur (Zielbild)
src/core/            – reine Logik (metrics, goal, cta, plan, report, import, cover-layout, crypto-Formate)
src/data/            – Dexie, Schema, Repositories, Typen, templates/ (Inhalte aus docs/INHALTE.md)
src/services/        – Tresor, KI, YouTube, Instagram, Push, Backup/Export, Kalender-Export
src/app/             – App-Root, Router, Shell, Sperrbildschirm
src/components/ui/   – Design-System-Komponenten
src/features/        – start, videos, covers, stats, plan, ideas, brand, connections, settings, dev
src/styles/, src/i18n/de.ts, scripts/, e2e/

## Design-Leitlinien
Gleiche Designsprache wie Kompass/Cockpit – schlicht, modern, ruhig, große Radien, Pill-Buttons,
Inter, weiche Schatten, kurze Spring-Animationen, Dark/Light nach System, prefers-reduced-motion.
**Eigene Identität:** Akzent **Finanzbruder-Blau** (an die Cover angelehnt: dunkles Navy → helles
Himmelblau), Zusatzakzent **Eisblau** wie die hellblauen Akzentlinien der Cover – klar
unterscheidbar von Cockpit (Kobalt + Gelb). Alle Textfarben ≥ 4,5:1. App-Icon: abgerundetes Quadrat mit blauem Verlauf
(dunkel links unten → hell rechts oben) und Play-Symbol, dessen Spitze in einen steigenden Pfeil
übergeht. Name überall „Manager“.
Touch-first wie Kompass: Tippflächen ≥ 44 px, kein Hover-only, Safe Areas, dvh, Tastatur-sicher,
Hoch-/Querformat, Split View, iPhone-Layout.

## Konventionen
- UI Deutsch (du-Form, knapp), Code Englisch. Keine hartkodierten UI-Texte (src/i18n/de.ts).
- UUIDs, ISO-Zeitstempel UTC, Kalenderdaten „JJJJ-MM-TT“ lokal.
- Jeder Schritt endet mit typecheck, lint, test, build ohne Fehler + Screenshots.
- Google, Meta und KI in Tests immer per `page.route` mocken; nie echte Konten oder Keys.
- Nur den beauftragten Schritt umsetzen. Nach Abschluss Roadmap abhaken und unter „Entscheidungen
  & Notizen“ kurz dokumentieren.

## Roadmap
- [x] 0 Projektkontext (CLAUDE.md, docs/INHALTE.md, docs/PROMPTS.md)
- [x] 1 Fundament: Setup, PWA, Deployment, Design-System & Shell (aus Cockpit)
- [x] 2 Datenbank, Verschlüsselung & App-Sperre (aus Cockpit/Kompass)
- [x] 3 Einstellungen, optionale KI & Marke (Brand-Kit, Regeln, Kanalprofil)
- [x] 4 Ideen-Speicher & Community-Fragen
- [ ] 5 Neues Video (Video-Pakete, CTA-Rotation, Kopieren)
- [ ] 6 Cover-Studio (Canvas, 3 Varianten, Reel + Thumbnail)
- [ ] 7 Zahlen & Auswertung (Erfassen, CSV-/Screenshot-Import, Wochenreport, Start-Dashboard)
- [ ] 8 Wochenplan (4-Std.-Budget, Kalender-Export)
- [ ] 9 YouTube-Anbindung (OAuth, Data + Analytics API, nur lesend)
- [ ] 10 Instagram-Anbindung (Machbarkeit zuerst prüfen, sonst Screenshot-Weg)
- [ ] 11 Push-Mitteilungen
- [ ] 12 Backups, Export & Feinschliff

## Entscheidungen & Notizen
- Entstehung: Claude-Projekt „Manager“ (Befehle „Neues Video“, „Auswertung“, „Wochenplan“) wird
  als eigene App nachgebaut, gleiche Bauweise wie Kompass/Cockpit.
- Bestehende Daten (analytics/performance.csv, analytics/retention.csv, reports/*.md) liegen im
  Claude-Projekt, **nicht** im Repo; sie werden in Schritt 7 in der App per Datei-Import übernommen.
- Anbindungen (Stand 02.10.2026, im jeweiligen Schritt erneut prüfen):
  - YouTube: Data API v3 (Videos, Aufrufe, Likes, Kommentare) + Analytics API (Wiedergabezeit,
    Abonnenten gewonnen) per Google-OAuth im Browser machbar, Ansatz wie Cockpit Schritt 4.
    Hochladen per API bewusst nicht (ungeprüfte API-Projekte laden nur privat hoch; Veröffentlichen
    bleibt beim Creator).
  - Instagram: nur mit **Professional-Account (Creator/Business)** + eigener **Meta-App**
    (Entwicklungsmodus reicht für den eigenen Account). Der Token-Tausch braucht das App-Secret →
    ohne eigenen Server nicht sauber im Browser. Zu prüfen: Token im Meta-Dashboard erzeugen und in
    der App hinterlegen (60 Tage gültig, verlängerbar), ob graph.instagram.com Browser-Aufrufe (CORS)
    erlaubt. Fallback: Screenshot-Import mit KI.
- Schritt 1 (Fundament):
  - Basis ist Cockpit Schritt 1 (main, gleiche Paketversionen, Lockfile übernommen); umbenannt auf
    Manager (Dexie `manager`, localStorage `manager.bootPrefs`, cacheId `manager`, Scope `/Manager/`;
    E2E prüft alles).
  - Farben (alle Textfarben ≥ 4,5:1): Akzent hell `#0369a1` (weiße Schrift), dunkel `#38bdf8` mit
    dunkler Schrift `#04121f`. Zweitakzent Eisblau: `--signal` `#7dd3fc`/`#a5f3fc` für Flächen,
    `--signal-fg` `#0e7490`/`#67e8f9` für Text. Hintergründe wie Cockpit (`#f3f5f9`/`#090d16`).
    Icon-Töne `--brand-deep/--brand/--brand-light` (Tailwind `brand-*`).
  - Icon: `public/icons/favicon.svg` – blauer Verlauf dunkel links unten → hell rechts oben, zwei
    hellblaue Akzentlinien, weißer Play-Button mit steigender Linie, deren Pfeil oben rechts
    herausragt. `npm run icons` erzeugt alle PNGs und Startbilder.
  - Navigation: Start, Videos, Cover, Zahlen, Plan, Ideen, Marke, Einstellungen (+ Entwickler);
    Routen /start, /videos, /covers, /stats, /plan, /ideas, /brand, /settings, /dev/ui. Tasten
    `1`–`8`. Platzhalter nennen den Schritt (Start/Zahlen 7, Videos 5, Cover 6, Plan 8, Ideen 4,
    Marke 3).
  - iPhone: eigenes Playwright-Profil `iphone-portrait` (393×852) für E2E und Screenshots. Unter
    30rem Breite zeigt die Tab-Bar nur Symbole (Beschriftung bleibt für VoiceOver).
- Schritt 2 (Tresor):
  - Übernommen aus Kompass Schritt 2: Krypto-Schicht (PBKDF2 800.000 Iterationen → AES-GCM-256,
    AAD `manager:v1:<tabelle>:<id>`), Tresor/Sperre (`src/services/vault.ts`, Face ID über den
    Schlüsselbund), Inaktivitäts- und Hintergrundsperre, Passwort ändern (alles in einer
    Transaktion neu verschlüsselt), Tab-Sync per liveQuery, „Passwort vergessen“ = alles löschen.
  - Dexie **Version 2**: `meta`, `videos`, `ideas`, `posts`, `reports`, `plans`, `files`,
    `secrets`, `snapshots`, `errorLog`. Indiziert nur `id`/`updatedAt`; alles andere nur in
    `payload`. Kein Verlauf (anders als Kompass): Inhalte sind keine Kundendaten.
  - Retention/Quellen sind Teil eines Beitrags (`post.retention`), keine eigene Tabelle – ein
    Screenshot gehört immer zu genau einem Beitrag.
  - `files`: Kopf (Name, Typ, Größe, Art) und Bytes getrennt verschlüsselt (`meta`/`payload`),
    damit Listen ohne Entschlüsseln großer Bilder auskommen; max. 15 MB je Datei; nicht im
    Speicher-Store, erst beim Öffnen entschlüsselt (`filesRepo.open`).
  - Generisches `createRecordRepo` für alle Datentabellen (list/get/create/update/remove).
  - Sperrbildschirm zeigt das App-Icon lebendig (`AppMark`: Linie zeichnet sich beim Prüfen,
    Pfeil schnellt beim Entsperren hoch). Testpasswort `Manager-Test-2026!` (nur E2E/Demo).
  - Entwicklermodus: „Verschlüsselung testen“ legt Test-Videopakete an und zeigt den Ciphertext.
- Schritt 3 (Einstellungen, KI & Marke):
  - Vorlagen aus docs/INHALTE.md in `src/data/templates/` (channel, content, rules, brand):
    Kanalprofil, Rahmen, Ziel, Hook-Typen, CTA-Rotation, Skript-/Untertitel-/Cover-Regeln,
    Report-Gliederung, Regeln, Growth-Prioritäten, Conversion-Checkliste, Posen, Farben.
  - Dexie **Version 3**: Tabelle `brand` (ein verschlüsselter Datensatz; `brandRepo.get()` liefert
    bis zum ersten Speichern die Vorlage). Felder: channel, rules, growth, colors (Hex),
    fontFileId, photoFileId, poses (fileId + Stimmung), checklist, lastCta (für Schritt 5).
  - Dateien (Schrift, Foto, Posen) über `filesRepo`; Schrift wird vor dem Speichern per FontFace
    geprüft und aus den entschlüsselten Bytes registriert (Familie „Manager Brand“, keine
    font-src nötig). Bilder als Blob-URLs (`useFileUrl`).
  - KI: aus = Standard. Einstellungen `aiEnabled`/`aiModel` (unverschlüsselt, technisch), API-Key
    verschlüsselt in `secrets` (`secretsRepo`, AAD `manager:v1:secrets:<key>`), Modelle in
    `src/core/ai/models.ts` + eigene Modell-ID. Client `src/services/ai/client.ts`
    (@anthropic-ai/sdk, dangerouslyAllowBrowser, `testConnection`, `generate`). CSP connect-src
    um `https://api.anthropic.com` erweitert.
  - Ein zentraler Systemprompt `src/core/ai/systemPrompt.ts` aus Kanalprofil, Ziel,
    Growth-Prioritäten und Regeln; `CORE_AI_RULES` (keine Anlageberatung, Quellen,
    „[unsicher]“, Entwürfe) stehen immer drin, auch wenn die Regeln bearbeitet werden.
  - CTA-Rotation als reine Logik `src/core/cta.ts` (`nextCta`).
- Schritt 4 (Ideen):
  - Idee hat zusätzlich `personal` (persönliches „So mache ich es“-Thema, Growth-Priorität 2);
    neues Feld mit Default, keine Dexie-Migration nötig. Bei eigenen Ideen wird es aus dem Titel
    vorbelegt (`looksPersonal`: ich/mein…), bei Community-Fragen nie automatisch.
  - Reine Logik `src/core/ideas.ts`: `parseBulkIdeas` (eine pro Zeile, Aufzählungszeichen und
    Duplikate weg, max. 50), Priorität `ideaScore` (Community 4, persönlich 3, Serie 2,
    Podcast 1), Sortierung offen → gedreht → veröffentlicht, Filter Status/Quelle/Serie/Suche.
  - `createRecordRepo.createMany` legt mehrere Datensätze in einer Transaktion an.
  - „Neues Video starten“ setzt die Idee auf „geplant“ und öffnet „Videos“ (Platzhalter bis
    Schritt 5, der dort ein Paket aus der Idee anlegt).
  - Screenshots legen erfundene Demo-Ideen über „Mehrere einfügen“ an.
