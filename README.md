# Steinzeitdorf

Aufbauspiel in der Steinzeit als installierbare Web-App (PWA). Eine kleine Horde wächst durch die Jahreszeiten zum Stamm: Arbeitsplätze bauen, Hütten errichten, sich gegen Wölfe, Seuchen, Überfälle und Frostnächte schützen Vorräte im Vorratslager anlegen, den Totempfahl aufstellen und als Großprojekt den Steinkreis bauen: Dafür werden Bewohner von der täglichen Arbeit abgezogen. Das Spiel zeigt ein 3D-Hex-Tal (three.js) und läuft nach dem ersten Laden auch offline.

## Umgebungen

Beide Umgebungen laufen als eigene Azure Static Web App mit eigener Adresse. Die Adresse steht im Azure-Portal unter **Übersicht → URL**.

| Umgebung | Branch | Static Web App | Secret in GitHub |
| --- | --- | --- | --- |
| Test | `beta` | `zealous-mushroom` | `AZURE_STATIC_WEB_APPS_API_TOKEN_ZEALOUS_MUSHROOM_0E306D310` |
| Prod | `main` | `orange-dune` | `AZURE_STATIC_WEB_APPS_API_TOKEN_ORANGE_DUNE_01C008F10` |

Die Secrets hat Azure beim Anlegen der Static Web Apps selbst in GitHub hinterlegt.

Die beiden Versionen sind vollständig getrennt:

- **Eigene App-Identität.** Jede Umgebung hat ein eigenes Manifest. Prod und Beta lassen sich nebeneinander auf dem Handy installieren.
- **Eigener Service Worker und Cache.** Der Cache-Name enthält Umgebung und Commit.
- **Eigener Spielstand.** Der Spielstand liegt im Browser der jeweiligen Domain, der Schlüssel heißt `steinzeitdorf-v1:prod` bzw. `steinzeitdorf-v1:beta`.
- **Erkennbar.** Beta hat blaue Icons mit „BETA“-Band, den Namen „Steinzeitdorf Beta“ und ein Abzeichen im Spiel. Die Fußzeile zeigt Datum und Commit der laufenden Version.

## Zugriffsschutz

Beide Static Web Apps sind hinter einer Anmeldung. Wer die Adresse öffnet, wird zu Microsoft geschickt und kommt nur hinein, wenn das Konto die Rolle `spieler` hat. Alle anderen sehen die Seite „Kein Zugang“ (`nicht-freigeschaltet.html`). Konfiguriert ist das in `staticwebapp.config.json`.

Öffentlich bleiben nur `sw.js`, `manifest.webmanifest`, `icons/` und die Seite „Kein Zugang“. Sie enthalten kein Spiel, und der Browser braucht sie ohne Anmeldung, um die App zu installieren und zu aktualisieren.

**Person freischalten** (pro Umgebung einzeln): Azure-Portal → Static Web App → **Rollenverwaltung** → **Einladen**. Anbieter `Microsoft Entra ID`, E-Mail-Adresse der Person, Rolle `spieler`, Gültigkeit wählen. Die Person öffnet den erzeugten Link und meldet sich an.

**Offline:** Die installierte App startet auch ohne Netz aus dem Zwischenspeicher. Online wird bei jedem Start zuerst die Anmeldung geprüft.

## Umzug auf Supabase und Cloudflare Pages (Branch `supabase`)

Dieser Branch ersetzt Azure durch zwei Teile: Die Dateien liefert **Cloudflare Pages** aus, Anmeldung, Spielstand und Bestenliste übernimmt **Supabase**. Das Spiel läuft weiter offline. Erst nach der Anmeldung startet es.

**Wie es zusammenspielt**
- `js/cloud.js` meldet an (E-Mail und Passwort oder Link per E-Mail), prüft die Freigabe, lädt den neueren von lokalem und Cloud-Stand und sichert alle paar Sekunden.
- Der Spielstand liegt lokal und in der Tabelle `saves`, je Konto und Umgebung. Der jeweils neuere Stand gewinnt. Ohne Netz wird später nachgesichert.
- Die Bestenliste (`scores`) zeigt alle Spieler mit Punkten aus Stufe, Bewohnern, Bauten und Steinkreis und aktualisiert sich live.
- Wer spielen darf, steht in `allowed_emails`. Die Regeln in `supabase/schema.sql` erzwingen das in der Datenbank, nicht nur in der App.
- Die Dateien selbst sind öffentlich abrufbar, sie enthalten aber keine Daten. Wer sie öffnet, sieht nur das Anmeldefenster.

**Einrichtung Supabase** (je ein Projekt für Prod und Beta, oder ein gemeinsames)
1. Projekt anlegen, im SQL Editor `supabase/schema.sql` ausführen.
2. Authentication → Sign In / Providers: „Allow new users to sign up“ **ausschalten**.
3. Authentication → URL Configuration: Site URL und Redirect URLs auf die Adressen der App setzen.
4. Spieler einladen: Authentication → Users → Invite user, danach die Adresse in `allowed_emails` eintragen.
5. Project URL und den öffentlichen Schlüssel (`sb_publishable_…` oder „anon public“) in `supabase/public-config.json` eintragen. Der geheime Schlüssel (`sb_secret_…` oder `service_role`) gehört nie in die App.

**Einrichtung Cloudflare Pages**
1. Pages-Projekt aus diesem GitHub-Repository anlegen. Produktions-Branch `main`.
2. Build-Befehl `node scripts/cf-build.mjs`, Ausgabeverzeichnis `dist`.
3. Keine Variablen nötig: Der Build liest URL und öffentlichen Schlüssel aus `supabase/public-config.json`. Wer Prod und Beta auf getrennte Supabase-Projekte legen will, setzt `SUPABASE_URL` und `SUPABASE_ANON_KEY` getrennt für Produktion und Vorschau, sie haben Vorrang. Der Branch `beta` wird als Vorschau veröffentlicht.
4. Optional: Cloudflare Access davor, wenn auch die Dateien nicht öffentlich sein sollen.

Die Azure-Workflows und `staticwebapp.config.json` bleiben, bis der Umzug abgeschlossen ist.

## Arbeitsablauf

1. Änderungen auf `beta` pushen. Der Workflow baut die Beta-Version und veröffentlicht sie nach etwa einer Minute.
2. Testen, am besten auch mit der installierten Beta-App auf dem Handy.
3. Wenn alles passt, `beta` per Pull Request nach `main` mergen. Danach wird Prod veröffentlicht.

Pull Requests erzeugen in der jeweiligen Static Web App außerdem eine eigene Vorschau-Adresse, die beim Schließen des Pull Requests wieder verschwindet.

Wer die App schon geöffnet hat, sieht beim nächsten Besuch den Hinweis „Neue Version verfügbar“. Erst ein Klick auf „Jetzt laden“ wechselt die Version, ein laufendes Spiel wird nie ungefragt neu geladen. Der Spielstand bleibt dabei erhalten.

## Workflows

Beide Dateien in `.github/workflows/` stammen vom Azure-Assistenten und sind um einen Build-Schritt ergänzt: `scripts/stamp.mjs` setzt Umgebung, Version und Namen ein und schreibt das Ergebnis nach `dist/`, das Azure dann unverändert ausliefert. Beide Dateien liegen auf beiden Branches, jede reagiert nur auf ihren eigenen. Dadurch gibt es beim Mergen von `beta` nach `main` keine Konflikte. Unter **Actions** lässt sich jeder Workflow auch von Hand starten.

## Lokal entwickeln

```sh
python3 -m http.server 8000
# http://localhost:8000
```

Lokal gilt die Umgebung `dev`: Der Service Worker reicht alles direkt ans Netz durch, nichts bleibt veraltet im Cache. Der Spielstand liegt unter `steinzeitdorf-v1:dev`.

Die gestempelte Auslieferung, wie sie auf Azure landet, lässt sich lokal nachbauen:

```sh
node scripts/stamp.mjs beta . dist abc1234 2026-10-30 /
python3 -m http.server 8000 --directory dist
```

## Aufbau

```
index.html                Oberfläche
css/style.css             Gestaltung, Hell- und Dunkelmodus
js/game.js                Spiellogik und 3D-Szene
js/pwa.js                 Installieren, Update-Hinweis, Umgebungsanzeige
sw.js                     Service Worker (Vorab-Cache, Offline, Updates)
manifest.webmanifest      App-Manifest (Prod; Beta wird beim Bauen abgeleitet)
env.js                    Umgebung und Version, wird beim Bauen überschrieben
staticwebapp.config.json  Azure-Einstellungen (keine Zwischenspeicherung für sw.js, Manifest, env.js)
scripts/stamp.mjs         Baut eine Umgebung und stempelt Version, Pfad und Namen ein
icons/, icons/beta/       Icons für Prod und Beta
vendor/three.min.js       three.js r128
fonts/                    Alfa Slab One, Atkinson Hyperlegible
```

Neue Dateien, die offline gebraucht werden, gehören in die Liste `ASSETS` in `sw.js` und in die Liste `APP` in `scripts/stamp.mjs`.

## Installieren

- **Chrome, Edge, Android:** Schaltfläche „Installieren“ im Spiel oder das Installationssymbol der Adressleiste.
- **iPhone und iPad (Safari):** Teilen, dann „Zum Home-Bildschirm“.

Der Spielstand liegt im Browser des jeweiligen Geräts und wird nicht zwischen Geräten abgeglichen.

## Drittanbieter

- three.js r128, MIT-Lizenz
- Alfa Slab One und Atkinson Hyperlegible, SIL Open Font License 1.1 (über Fontsource)
