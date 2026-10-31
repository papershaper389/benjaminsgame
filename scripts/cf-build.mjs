#!/usr/bin/env node
/* Build-Befehl für Cloudflare Pages: node scripts/cf-build.mjs
   Branch main wird zu prod, jeder andere Branch (beta) zu beta. Ausgabe liegt in dist/.
   Umgebungsvariablen im Cloudflare-Projekt: SUPABASE_URL und SUPABASE_ANON_KEY
   (für Produktion und Vorschau getrennt einstellbar). */
import { spawnSync } from 'node:child_process';

const branch = process.env.CF_PAGES_BRANCH || 'beta';
const env = branch === 'main' ? 'prod' : 'beta';
const sha = (process.env.CF_PAGES_COMMIT_SHA || 'lokal').slice(0, 7);
const date = new Date().toISOString().slice(0, 10);
const r = spawnSync(process.execPath, ['scripts/stamp.mjs', env, '.', 'dist', sha, date, '/'], { stdio: 'inherit' });
process.exit(r.status ?? 1);
