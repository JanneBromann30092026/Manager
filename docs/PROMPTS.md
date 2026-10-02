# Manager – Prompts (PWA für iPad/iPhone)

Schritt 0 (CLAUDE.md, docs/INHALTE.md, diese Datei) ist erledigt.

## So arbeitest du nur mit dem iPad

**Einmalig:**
1. Repo anlegen (öffentlich, leer): https://github.com/new?owner=JanneBromann30092026&name=Manager&visibility=public&description=Manager%20%E2%80%93%20Content-%20%26%20Growth-Manager%20(PWA)
   → README usw. **nicht** anhaken → **Create repository**.
2. **Settings → Pages → Source: „GitHub Actions“** wählen.
3. Claude Zugriff geben (falls nötig): github.com/settings/installations → Claude → Configure →
   Manager hinzufügen.
4. CLAUDE.md, README.md und docs/ ins Repo legen (macht Claude im Projekt-Thread).

**Pro Schritt:**
1. Neue Sitzung auf claude.ai/code, Repo **Manager** auswählen.
2. Prompt des Schritts kopieren und abschicken.
3. Claude baut, testet, zeigt Screenshots und öffnet einen Pull Request.
4. Auf GitHub den PR öffnen → **Merge pull request**.
5. 1–2 Minuten warten (Tab **Actions**), dann https://jannebromann30092026.github.io/Manager/ öffnen.
6. Passt etwas nicht, in derselben Sitzung beschreiben (gern mit Screenshot). Erst danach der nächste Schritt.

**App installieren (ab Schritt 1):** Safari → URL öffnen → Teilen-Symbol → **Zum Home-Bildschirm**.
Ab dann immer über das Icon öffnen.

**Bricht Claude ab:** *„Mach weiter, wo du aufgehört hast. Prüfe zuerst mit git status und git diff
den aktuellen Stand und lies die CLAUDE.md.“*

**Echte Daten (Statistiken, Fotos) erst ab Schritt 2** (Verschlüsselung), nie ins Repo.

---

## Schritt 1 – Fundament: Setup, PWA, Deployment, Design-System & Shell

```
Lies die CLAUDE.md und docs/INHALTE.md. Wir setzen Roadmap-Schritt 1 um: Fundament.

Ziel: Eine installierbare, leere Manager-PWA mit dem Fundament aus Cockpit – gleiche Qualität, eigene Identität.

1. Cockpit (öffentliches Repo JanneBromann30092026/Cockpit) als Vorlage: Projekt-Setup, vite.config (CSP, PWA, Chunking), ESLint/Prettier/TS, GitHub-Workflows (CI + Deploy), Playwright mit iPad-Profilen, Screenshot-Pipeline, Icon-Skript, Design-Tokens, UI-Komponenten, Theme, Fokusmodus. Gleiche Paketversionen, Lockfile übernehmen.
2. Anpassen: Name „Manager“ überall, Vite base "/Manager/", Version 0.1.0, eigene Namen (Dexie `manager`, localStorage `manager.`, cacheId `manager`, Scope `/Manager/`) – E2E prüft das.
3. Eigene Identität laut CLAUDE.md: Finanzbruder-Blau + Mint, Kontrast WCAG AA. App-Icon als SVG (blauer Verlauf dunkel links unten → hell rechts oben, Play-Symbol mit steigendem Pfeil), daraus alle PNGs und Startbilder (npm run icons).
4. Shell: Start, Videos, Cover, Zahlen, Plan, Ideen, Marke, Einstellungen (+ Entwickler im Entwicklermodus) mit Platzhaltern „Kommt in Schritt …“. Sidebar ab 900 px, Tab-Bar darunter (auf dem iPhone die 5 wichtigsten + „Mehr“). Tastenkürzel 1–8, ? zeigt alle.
5. Einstellungen-Grundgerüst: Theme, Bewegungen reduzieren, Entwicklermodus, Systemstatus.
6. navigator.storage.persist() beim Start.
7. Tests: Vitest-Grundtest, Playwright-Smoke (keine Konsolenfehler, Manifest, Offline, Navigation, Theme-Persistenz, eigene Namen).

Nicht Teil dieses Schritts: Datenbank-Schema, Verschlüsselung, Fachfunktionen.

Definition of Done:
- typecheck, lint, test, build und e2e fehlerfrei.
- Screenshots iPad quer/hoch, iPhone hoch, Dark/Light, Icon-Vorschau gezeigt.
- CLAUDE.md: Roadmap 1 abgehakt, Entscheidungen notiert.
- Feature-Branch, Pull Request. Im PR und im Chat: was ich nach dem Mergen prüfen soll (URL öffnen, zum Home-Bildschirm, Icon neben Kompass/Cockpit, Flugmodus-Test).
```

## Schritt 2 – Datenbank, Verschlüsselung & App-Sperre

```
Lies die CLAUDE.md. Wir setzen Roadmap-Schritt 2 um: Datenbank, Verschlüsselung & App-Sperre.
Übernimm Tresor, Sperrbildschirm (Face ID über Schlüsselbund), Inaktivitätssperre, Passwort ändern und Dateitabelle aus Cockpit/Kompass. Dexie-Tabellen: meta, settings, secrets, files (verschlüsselte Bilder), videos, ideas, posts, retention, reports, plans, errorLog – Inhalte nur verschlüsselt in `payload`. Typen + zod-Schemas nach docs/INHALTE.md (Felder der Auswertung, Video-Paket, Idee). Tests wie in Kompass inkl. „kein Klartext in IndexedDB“.
Definition of Done wie Schritt 1, Screenshots Sperrbildschirm, PR mit Prüfliste.
```

## Schritt 3 – Einstellungen, optionale KI & Marke

```
Lies die CLAUDE.md und docs/INHALTE.md. Roadmap-Schritt 3.
1. KI optional wie Cockpit Schritt 3 (Key verschlüsselt, Modell wählbar, Verbindungstest, aus = Standard).
2. Alle Vorlagen aus docs/INHALTE.md als Daten in src/data/templates (Kanalprofil, Rahmen, Hook-Typen, CTA-Rotation, Cover-Regeln, Untertitel-Regeln, Report-Gliederung, Regeln, Growth-Prioritäten).
3. Bereich „Marke“: Kanalprofil + Regeln lesbar und bearbeitbar; Brand-Kit: Farben (Hex), Schrift (TTF hochladen, per FontFace nutzen), freigestelltes Foto + Posen (Typ: neutral/nachdenklich/überrascht …), alles verschlüsselt. Checkliste Conversion (Bio, Highlights „Start hier“, „Mein Geld“, „Q&A“) zum Abhaken.
4. Ein zentraler KI-Systemprompt aus Kanalprofil + Regeln (keine Anlageberatung, Quellenpflicht, Unsicheres kennzeichnen), getestet.
```

## Schritt 4 – Ideen-Speicher & Community-Fragen

```
Lies die CLAUDE.md. Roadmap-Schritt 4: Ideen (Titel, Quelle eigene Idee/Community-Frage/Podcast, Serie, Hook-Typ, Notiz, Status Idee → geplant → gedreht → veröffentlicht). Schnelles Erfassen (auch mehrere Fragen auf einmal einfügen, eine pro Zeile), Filter nach Serie/Status/Quelle, Sortierung nach Priorität (Growth-Prioritäten: persönliche Themen und Community-Fragen zuerst). Aus einer Idee „Neues Video starten“ (Platzhalter bis Schritt 5).
```

## Schritt 5 – Neues Video

```
Lies die CLAUDE.md und docs/INHALTE.md. Roadmap-Schritt 5: „Neues Video: [Thema]“.
Video-Paket (Datum + Thema, Typ Reel/Podcast) mit den sechs Bausteinen aus docs/INHALTE.md. Ohne KI: Vorlagen mit Lückentext und Checklisten je Baustein. Mit KI: alle Bausteine auf Tipp erzeugen, einzeln neu erzeugen, frei bearbeiten. CTA-Rotation automatisch (nächster CTA vorgeschlagen, änderbar, Stand gespeichert). Jeder Baustein mit „Kopieren“ und „Teilen“; Schnittliste übersichtlich für CapCut. Status-Verlauf. Cover-Baustein verlinkt aufs Cover-Studio (Schritt 6). Regeln-Check vor „Fertig“ (Hook in 2 Sek., Folgen-Grund, CTA, Hinweis „keine Anlageberatung“ falls Anlagethema, Quellen bei Zahlen).
```

## Schritt 6 – Cover-Studio

```
Lies die CLAUDE.md und docs/INHALTE.md. Roadmap-Schritt 6: Cover per Canvas nach den Cover-Regeln. Reel-Cover 1080×1920 (Text im mittleren 4:5-Bereich, Hilfslinie zuschaltbar) und YouTube-Thumbnail 1280×720 (größeres Gesicht, mehr Kontrast). 3 Textvarianten (max. 4 Wörter, 2 Zeilen, Großbuchstaben), Pose automatisch nach Hook-Typ (änderbar), Brand-Schrift und -Farben. Vorschau nebeneinander, PNG speichern/teilen (in „Fotos“). Layout-Berechnung (Zeilenumbruch, Schriftgröße) in src/core, getestet. Demo mit Platzhalter-Silhouette, nie echte Fotos im Repo.
```

## Schritt 7 – Zahlen & Auswertung

```
Lies die CLAUDE.md und docs/INHALTE.md. Roadmap-Schritt 7.
1. Beiträge erfassen (alle Felder der Auswertung + Retention/Quellen), Zuordnung zu Video-Paketen.
2. Import: performance.csv und retention.csv (Spalten wie in docs/INHALTE.md) und Startwerte vom 28.09.2026. Screenshot auslesen mit KI (Werte als „abgelesen“ markiert, vor dem Speichern bestätigen).
3. Kennzahlen in src/core: Follower pro 1.000 Aufrufe, Zielfortschritt, Durchschnitte nach Hook-Typ/Thema/Serie/Format.
4. Wochenreport JJJJ-KW: gut/schlecht, warum, 3 Maßnahmen, Fortschritt – ohne KI regelbasiert, mit KI ausformuliert; Export als Markdown.
5. Start-Dashboard mit Zielfortschritt, Hauptkennzahl, letzten Beiträgen, nächstem CTA.
```

## Schritt 8 – Wochenplan

```
Lies die CLAUDE.md. Roadmap-Schritt 8: Wochenplan für nächste Woche (Reels, Stories, Q&A) im 4-Std.-Budget (Zeitbedarf je Aufgabe als Vorlage, änderbar), Themen aus Ideen + Community-Fragen priorisiert, Q&A-Story mindestens 1×/Woche. Export als .ics in den iPad-Kalender (wie Kompass/Cockpit).
```

## Schritt 9 – YouTube-Anbindung

```
Lies die CLAUDE.md. Roadmap-Schritt 9: YouTube nur lesend. Zuerst prüfen und mir einfach erklären, was ich in der Google Cloud Console einrichten muss (Projekt, YouTube Data API v3 + YouTube Analytics API aktivieren, OAuth-Client „Webanwendung“ mit Origin jannebromann30092026.github.io, mich als Testnutzer). Anmeldung wie Cockpit Schritt 4 (auf dem iPad zuerst testen). Abrufen: eigene Videos, Aufrufe, Likes, Kommentare, Wiedergabezeit, durchschnittliche Wiedergabedauer, gewonnene Abonnenten → in „Zahlen“ übernehmen (Quelle „YouTube API“, Stand-Zeit). CSP nur um die nötigen Google-Hosts erweitern. Tests mit gemockten APIs.
```

## Schritt 10 – Instagram-Anbindung

```
Lies die CLAUDE.md. Roadmap-Schritt 10: Instagram nur lesend. ZUERST Machbarkeit prüfen und mir das Ergebnis kurz erklären, bevor du baust: aktueller Stand der Instagram API mit Instagram-Login (Professional-Account nötig, Meta-App im Entwicklungsmodus), ob ein Token ohne eigenen Server nutzbar ist (im Meta-Dashboard erzeugen, in der App verschlüsselt hinterlegen, verlängern) und ob graph.instagram.com Browser-Aufrufe (CORS) erlaubt. Wenn machbar: Medien + Insights (Aufrufe, Reichweite, Likes, Kommentare, Shares, Saves, Follows) in „Zahlen“ übernehmen, Ablauf-Erinnerung für den Token. Wenn nicht: Screenshot-Import aus Schritt 7 verbessern und das ehrlich dokumentieren.
```

## Schritt 11 – Push-Mitteilungen

```
Lies die CLAUDE.md. Roadmap-Schritt 11: Push wie Cockpit Schritt 8 (VAPID, GitHub Actions, allgemeine Texte ohne persönliche Daten): Sonntag „Wochenplan für nächste Woche“, Montag „Zeit für die Auswertung“, an geplanten Tagen „Heute: Q&A-Story“ / „Heute: Reel drehen“. Zeiten in den Einstellungen.
```

## Schritt 12 – Backups, Export & Feinschliff

```
Lies die CLAUDE.md. Roadmap-Schritt 12: verschlüsseltes Backup (Export/Import, Erinnerung) wie Kompass, CSV-Export der Zahlen, Feinschliff (leere Zustände, Animationen, Barrierefreiheit), Installationshinweise, Abschluss-Screenshots aller Seiten.
```
