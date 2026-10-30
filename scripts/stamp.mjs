#!/usr/bin/env node
/* Baut eine auslieferbare Kopie der App und stempelt Umgebung, Version und Pfad ein.

   Aufruf: node scripts/stamp.mjs <prod|beta> <quelle> <ziel> <sha> <datum> <basispfad>
   Beispiel: node scripts/stamp.mjs beta ./beta ./site/beta a1b2c3d 2026-10-30 /benjaminsgame/beta/
*/
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [env, src, dest, sha, date, base] = process.argv.slice(2);
if (!['prod', 'beta'].includes(env) || !src || !dest || !sha || !date || !base) {
  console.error('Aufruf: stamp.mjs <prod|beta> <quelle> <ziel> <sha> <datum> <basispfad>');
  process.exit(1);
}

const APP = ['index.html', 'env.js', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'vendor', 'fonts', 'icons'];
mkdirSync(dest, { recursive: true });
for (const item of APP) cpSync(join(src, item), join(dest, item), { recursive: true });

/* Beta bringt eigene Icons mit, damit sie auf dem Homescreen nicht mit Prod verwechselt wird. */
const betaIcons = join(dest, 'icons', 'beta');
if (env === 'beta' && existsSync(betaIcons)) cpSync(betaIcons, join(dest, 'icons'), { recursive: true });
rmSync(betaIcons, { recursive: true, force: true });

const read = (f) => readFileSync(join(dest, f), 'utf8');
const write = (f, s) => writeFileSync(join(dest, f), s);

write('env.js', `window.APP_ENV = '${env}';\nwindow.APP_BUILD = '${date} · ${sha}';\n`);

const sw = read('sw.js');
if (!sw.includes('__BUILD__') || !sw.includes('__ENV__')) throw new Error('Platzhalter in sw.js fehlen');
write('sw.js', sw.replaceAll('__BUILD__', sha).replaceAll('__ENV__', env));

const manifest = JSON.parse(read('manifest.webmanifest'));
manifest.id = base; /* eigene App-Identität je Umgebung, sonst gelten Prod und Beta als dieselbe App */
if (env === 'beta') {
  manifest.name = 'Steinzeitdorf Beta';
  manifest.short_name = 'Dorf Beta';
  manifest.description = 'Testversion von Steinzeitdorf. Spielstand und Installation sind von der Hauptversion getrennt.';
  manifest.background_color = '#1f2c36';
  manifest.theme_color = '#1f2c36';
}
write('manifest.webmanifest', JSON.stringify(manifest, null, 2) + '\n');

console.log(`${env} -> ${dest} (${sha}, ${base})`);
