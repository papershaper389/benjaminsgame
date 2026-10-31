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

## Anmeldung, Spielstand und Bestenliste (Supabase)

Die Dateien liefern weiter die zwei Azure Static Web Apps aus. Anmeldung, Spielstand und Bestenliste übernimmt **Supabase**. Das Spiel läuft weiter offline, startet aber erst nach der Anmeldung.

**Wie es zusammenspielt**
- `js/cloud.js` meldet an (E-Mail und Passwort oder Link per E-Mail), prüft die Freigabe, lädt den neueren von lokalem und Cloud-Stand und sichert alle paar Sekunden.
- Der Spielstand liegt lokal und in der Tabelle `saves`, je Konto und Umgebung. Der jeweils neuere Stand gewinnt. Ohne Netz wird später nachgesichert.
- Die Bestenliste (`scores`) zeigt alle Spieler mit Punkten aus Stufe, Bewohnern, Bauten und Steinkreis und aktualisiert sich live.
- Wer spielen darf, steht in `allowed_emails`. Die Regeln in `supabase/schema.sql` erzwingen das in der Datenbank, nicht nur in der App.
- Die Spieldateien sind öffentlich abrufbar, enthalten aber keine Daten. Wer sie öffnet, sieht nur das Anmeldefenster. `staticwebapp.config.json` setzt Sicherheitsheader samt Content-Security-Policy, die nur Verbindungen zu Supabase erlaubt.

**Einrichtung Supabase**
1. Projekt anlegen, im SQL Editor `supabase/schema.sql` ausführen.
2. Authentication → Sign In / Providers: „Allow new users to sign up“ **ausschalten**.
3. Eigenes Konto anlegen (Authentication → Users → Add user, mit „Auto Confirm User“) und dieselbe Adresse in `allowed_emails` eintragen.
4. Authentication → URL Configuration: Site URL und Redirect URLs auf die Adressen der beiden Static Web Apps setzen.
5. Project URL und öffentlichen Schlüssel (`sb_publishable_…`) in `supabase/public-config.json` eintragen. Der geheime Schlüssel (`sb_secret_…` oder `service_role`) gehört nie in die App.

**Person freischalten:** Konto unter Authentication → Users anlegen (oder einladen), dann die Adresse in `allowed_emails` eintragen.

**Getrennte Daten:** Prod und Beta teilen das Supabase-Projekt, speichern aber getrennt (Spalte `env`). Wer sie auf zwei Projekte legen will, setzt `SUPABASE_URL` und `SUPABASE_ANON_KEY` als Umgebungsvariablen im jeweiligen Workflow-Schritt, sie haben Vorrang vor der Datei.

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
