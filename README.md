# Steinzeitdorf

Aufbauspiel in der Steinzeit als installierbare Web-App (PWA). Eine kleine Horde wächst durch die Jahreszeiten zum Stamm: Arbeitsplätze bauen, Hütten errichten, sich gegen Wölfe, Seuchen, Überfälle und Frostnächte schützen und am Ende den Totempfahl aufstellen. Das Spiel zeigt ein 3D-Hex-Tal (three.js) und läuft nach dem ersten Laden auch offline.

## Umgebungen

| Umgebung | Branch | Adresse |
| --- | --- | --- |
| Prod | `main` | https://papershaper389.github.io/benjaminsgame/ |
| Test | `beta` | https://papershaper389.github.io/benjaminsgame/beta/ |

Beide laufen auf derselben Domain und sind trotzdem vollständig getrennt:

- **Eigene App-Identität.** Jede Umgebung hat ein eigenes Manifest mit eigener `id`. Prod und Beta lassen sich nebeneinander installieren.
- **Eigener Service Worker und Cache.** Der Cache-Name enthält Umgebung und Commit, ein Update der einen Version berührt die andere nicht.
- **Eigener Spielstand.** Der Speicherschlüssel im Browser lautet `steinzeitdorf-v1:prod` bzw. `steinzeitdorf-v1:beta`.
- **Erkennbar.** Beta hat andere Icons (blau, mit „BETA“-Band), den Namen „Steinzeitdorf Beta“ und ein Abzeichen im Spiel. Die Fußzeile zeigt Datum und Commit der laufenden Version.

## Arbeitsablauf

1. Änderungen auf `beta` pushen. Nach ein bis zwei Minuten sind sie unter `/beta/` live.
2. Testen, am besten auch auf dem Handy mit der installierten Beta-App.
3. Wenn alles passt, `beta` nach `main` mergen (Pull Request). Danach ist Prod aktualisiert.

Wer die App schon geöffnet hat, sieht beim nächsten Besuch den Hinweis „Neue Version verfügbar“. Erst ein Klick auf „Jetzt laden“ wechselt die Version, ein laufendes Spiel wird nie ungefragt neu geladen. Der Spielstand bleibt dabei erhalten.

## Einmalige Einrichtung auf GitHub

Unter **Settings → Pages → Build and deployment → Source** den Wert **GitHub Actions** wählen. Mehr ist nicht nötig. Die Workflows liegen in `.github/workflows/`:

- `deploy.yml` baut `main` und `beta` und veröffentlicht beides zusammen als eine Pages-Seite (`main` unter `/`, `beta` unter `/beta/`). Er läuft bei jedem Push auf `main`.
- `beta-trigger.yml` startet bei jedem Push auf `beta` den Deploy-Workflow auf `main`. Das ist nötig, weil die Umgebung `github-pages` standardmäßig nur vom Standard-Branch aus deployen darf.

Wer lieber die Branch-Regel der Umgebung unter **Settings → Environments → github-pages** um `beta` erweitert, kann `beta-trigger.yml` löschen und in `deploy.yml` den Trigger `branches: [main, beta]` setzen.

## Lokal entwickeln

```sh
python3 -m http.server 8000
# http://localhost:8000
```

Lokal gilt die Umgebung `dev`: Der Service Worker reicht alles direkt ans Netz durch, nichts bleibt veraltet im Cache. Der Spielstand liegt unter `steinzeitdorf-v1:dev`.

Die gestempelte Auslieferung (wie auf GitHub) lässt sich lokal nachbauen:

```sh
node scripts/stamp.mjs beta . site/beta abc1234 2026-10-30 /benjaminsgame/beta/
node scripts/stamp.mjs prod . site abc1234 2026-10-30 /benjaminsgame/
python3 -m http.server 8000 --directory site
```

## Aufbau

```
index.html              Oberfläche
css/style.css           Gestaltung, Hell- und Dunkelmodus
js/game.js              Spiellogik und 3D-Szene
js/pwa.js               Installieren, Update-Hinweis, Umgebungsanzeige
sw.js                   Service Worker (Vorab-Cache, Offline, Updates)
manifest.webmanifest    App-Manifest (Prod; Beta wird beim Bauen abgeleitet)
env.js                  Umgebung und Version, wird beim Bauen überschrieben
scripts/stamp.mjs       Baut eine Umgebung und stempelt Version, Pfad und Namen ein
icons/, icons/beta/     Icons für Prod und Beta
vendor/three.min.js     three.js r128
fonts/                  Alfa Slab One, Atkinson Hyperlegible
```

Neue Dateien, die offline gebraucht werden, gehören in die Liste `ASSETS` in `sw.js` und in die Liste `APP` in `scripts/stamp.mjs`.

## Installieren

- **Chrome, Edge, Android:** Schaltfläche „Installieren“ im Spiel oder das Installationssymbol der Adressleiste.
- **iPhone und iPad (Safari):** Teilen, dann „Zum Home-Bildschirm“.

Der Spielstand liegt im Browser des jeweiligen Geräts und wird nicht zwischen Geräten abgeglichen.

## Drittanbieter

- three.js r128, MIT-Lizenz
- Alfa Slab One und Atkinson Hyperlegible, SIL Open Font License 1.1 (über Fontsource)
