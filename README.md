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

## Zugriffsschutz (Auth0 mit E-Mail-Code)

Beide Static Web Apps sind hinter einer Anmeldung. Wer die Adresse öffnet, wird zu Auth0 geschickt, bekommt dort einen Code per E-Mail und kommt nur hinein, wenn die Adresse auf der Freigabeliste steht. Alle anderen sehen die Seite „Kein Zugang“ (`nicht-freigeschaltet.html`). Konfiguriert ist das in `staticwebapp.config.json`. Die Dateien selbst werden erst nach der Anmeldung ausgeliefert.

- **Anbieter:** Auth0 als eigener OpenID-Connect-Anbieter (`/.auth/login/auth0`). Das geht nur im **Standard-Tarif** der Static Web App (etwa 9 USD pro Monat und App). Im Free-Tarif funktioniert es nicht.
- **Rolle:** Nach jeder Anmeldung ruft Azure die Funktion `api/roles` auf. Sie vergibt die Rolle `spieler`, wenn die verifizierte Adresse in der App-Einstellung `ALLOWED_EMAILS` steht. Ohne diese Einstellung bekommt niemand die Rolle (sicherer Ausgangszustand).
- **Öffentlich** bleiben nur `sw.js`, `manifest.webmanifest`, `icons/`, `nicht-freigeschaltet.html` und `/api/roles`. Der Build bricht ab, wenn in `auth0/public-config.json` keine echte Auth0-Domain steht, damit nie eine Version ohne funktionierende Anmeldung veröffentlicht wird.
- **Offline:** Die installierte App startet auch ohne Netz aus dem Zwischenspeicher. Online wird bei jedem Start zuerst die Anmeldung geprüft.

### Einrichtung Auth0 (einmalig)
1. Kostenlosen Account auf auth0.com anlegen, Tenant erstellen (Region EU). Die Domain sieht aus wie `mein-dorf.eu.auth0.com`. Sie gehört in `auth0/public-config.json`.
2. **Authentication → Passwordless → Email** einschalten. Im Reiter „Settings“ den Typ **Code** wählen (nicht Link), „Disable Sign Ups“ einschalten. Unter „Applications“ die App aktivieren (Schritt 3).
3. **Applications → Create Application → Regular Web Applications.** Notiere Client ID und Client Secret. Unter **Settings** trägst du ein:
   - Allowed Callback URLs: `https://<adresse-der-static-web-app>/.auth/login/auth0/callback`, für Beta und Prod jeweils die eigene Adresse, durch Komma getrennt.
   - Allowed Logout URLs: dieselben Adressen mit `/`.
4. Reiter **Connections** der Application: nur **email** aktivieren, alle anderen (z. B. Username-Password) ausschalten.
5. **User Management → Users → Create User:** jede Person mit ihrer E-Mail-Adresse anlegen (Connection `email`). Wegen „Disable Sign Ups“ bekommen nur angelegte Personen einen Code.

### Einrichtung Azure (pro Static Web App)
1. Portal → Static Web App → **Hosting plan** auf **Standard** stellen.
2. **Settings → Environment variables** (früher „Configuration“) drei Einträge anlegen:
   - `AUTH0_CLIENT_ID` und `AUTH0_CLIENT_SECRET` aus Auth0 (Geheimnisse, nie ins Repository),
   - `ALLOWED_EMAILS`: erlaubte Adressen, getrennt durch Komma, z. B. `ich@example.com,oma@example.com`.
3. `auth0/public-config.json` mit der Domain füllen, committen, Workflow laufen lassen.

**Person freischalten:** Adresse in Auth0 anlegen (Schritt 5) und in `ALLOWED_EMAILS` ergänzen. Beides ist nötig. Die Liste in Azure ist maßgeblich, Auth0 verschickt nur den Code. Die Änderung gilt ab der nächsten Anmeldung.

## Spielstand und Bestenliste (Azure Functions)

Es gibt nur eine Anmeldung: die von Azure und Auth0 vor den Dateien (siehe oben). Spielstand und Bestenliste speichern verwaltete Azure Functions im Ordner `api/` in einem Azure-Speicherkonto (Blob Storage). Sie erkennen den Spieler am Azure-Login und prüfen die Rolle `spieler` zusätzlich selbst.

- `js/cloud.js` lädt beim Start den neueren von lokalem und Cloud-Stand und sichert alle paar Sekunden. Ohne Netz wird später nachgesichert, das Spiel läuft offline weiter.
- Spielt man auf zwei Geräten, überschreibt ein älterer Stand nie einen neueren. Stattdessen erscheint „Neueren Stand laden“.
- Die Bestenliste wertet Stufe, Bewohner, Bauten und Steinkreis aus. Der Name ist wählbar (Konto → Name). Die Punkte berechnet der Server.
- `/api/*` und `/.auth/*` fängt der Service Worker nie ab, sie werden nicht zwischengespeichert.
- Prod und Beta speichern getrennt (Pfad `saves/<prod|beta>/…`).

**Einmalig einrichten** (pro Static Web App, also für Beta und Prod)
1. Azure-Portal → Speicherkonto erstellen (Standard, LRS, Region wie die Static Web App, z. B. Westeuropa). Es kostet bei dieser Nutzung nur Cent-Beträge im Monat. Beta und Prod können dasselbe Konto verwenden.
2. Im Speicherkonto: Sicherheit + Netzwerk → **Zugriffsschlüssel** → **Verbindungszeichenfolge** von key1 kopieren.
3. Static Web App → **Konfiguration** (Settings → Environment variables) → Eintrag `STORAGE_CONNECTION` mit dieser Zeichenfolge anlegen und speichern. Das ist ein Geheimnis, es gehört nie ins Repository.
4. Den Workflow neu laufen lassen (Actions → Run workflow), damit die Functions bereitgestellt werden.

Solange `STORAGE_CONNECTION` fehlt, läuft das Spiel lokal weiter und zeigt „Cloud noch nicht eingerichtet“.

**Tests:** `cd api && npm ci && npm test` prüft die Schnittstelle mit einem Speicher im Arbeitsspeicher. Gegen den Blob-Speicher lässt sie sich mit dem Emulator Azurite probieren.

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
staticwebapp.config.json  Azure-Einstellungen (Anmeldung, Header, keine Zwischenspeicherung für sw.js, Manifest, env.js)
api/                      Azure Functions: Spielstand und Bestenliste
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
