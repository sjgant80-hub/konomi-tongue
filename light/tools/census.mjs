#!/usr/bin/env node
// light/tools/census.mjs — how far LIGHT reaches across the estate (light/claims.json C1). Every repository in the
// estate index is counted; every one cloned on this machine is read (its git-tracked .js, .mjs, .cjs and .html files)
// for three signs, by fixed patterns, no model guessing:
//   STORE    it keeps records of its own: IndexedDB, localStorage, or an append-only file it writes
//   CHANNEL  it talks to other organs: WebRTC, WebSocket, BroadcastChannel, a node-to-node HTTP share
//   LIGHT    it reads or writes LIGHT through the one codec (light/ or vendor/light/ codec, packet or vault)
// A repository not cloned here is counted as NOT READ, never guessed. Published: counts, and the names of PUBLIC
// repositories that speak LIGHT. Private names stay in light/data/census.local.json (git-ignored).
//
//   node light/tools/census.mjs
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOME = 'C:/Users/sjgan', INDEX = HOME + '/.claude/projects/C--Users-sjgan--claude/memory/estate-index.json';
export const SIGNS = {
  store: /\bindexedDB\b|\blocalStorage\b|appendFileSync|createWriteStream\([^)]*\.jsonl/,
  channel: /\bRTCPeerConnection\b|\bnew WebSocket\(|\bBroadcastChannel\(|\/immune\/share/,
  light: /(?:^|[/'"])(?:vendor\/)?light\/(?:codec|packet|vault)\.mjs['"]/m,
};
// repositories other sessions lead: theirs to move, not this window's
export const OTHERS = ['kardlings', 'digi-card', 'pixelwhisperer'];

const idx = JSON.parse(readFileSync(INDEX, 'utf8'));
const list = Array.isArray(idx) ? idx : (idx.repos || Object.values(idx).find(Array.isArray));
const byName = new Map(list.map((r) => [r.name, r]));
const git = (d, a) => execFileSync('git', ['-C', d, ...a], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });

const clones = new Map();
for (const base of [HOME, HOME + '/Downloads', HOME + '/Downloads/repos']) {
  let names = [];
  try { names = readdirSync(base); } catch { continue; }
  for (const n of names) {
    const d = base + '/' + n;
    try { if (!statSync(d + '/.git').isDirectory()) continue; } catch { continue; }
    let url = '';
    try { url = git(d, ['remote', 'get-url', 'origin']).trim(); } catch { continue; }
    const m = /github\.com[/:]sjgant80-hub\/([^/.]+?)(?:\.git)?$/.exec(url);
    if (m && byName.has(m[1]) && !clones.has(m[1])) clones.set(m[1], d);
  }
}
const rows = [];
for (const r of list) {
  const d = clones.get(r.name);
  const row = { name: r.name, private: r.private === true, read: !!d, store: false, channel: false, light: false, other: OTHERS.includes(r.name) };
  if (d) {
    let files = [];
    try { files = git(d, ['ls-files', '-z']).split('\0').filter((f) => /\.(m?js|cjs|html)$/i.test(f) && !/(^|\/)node_modules\//.test(f)); } catch { files = []; }
    for (const f of files) {
      let t = '';
      try { const st = statSync(join(d, f)); if (st.size > 2 * 1024 * 1024) continue; t = readFileSync(join(d, f), 'utf8'); } catch { continue; }
      if (!row.store && SIGNS.store.test(t)) row.store = true;
      if (!row.channel && SIGNS.channel.test(t)) row.channel = true;
      if (!row.light && SIGNS.light.test(t)) row.light = true;
    }
  }
  rows.push(row);
}
const n = (f) => rows.filter(f).length;
const organs = rows.filter((r) => r.store || r.channel);
const census = {
  kind: 'konomi-tongue.light.census', v: 1, at: new Date().toISOString(), rule: 'light/tools/census.mjs SIGNS, over git-tracked .js/.mjs/.cjs/.html',
  repos: rows.length, read: n((r) => r.read), notRead: n((r) => !r.read),
  organs: organs.length, store: n((r) => r.store), channel: n((r) => r.channel),
  light: n((r) => r.light), organsLight: n((r) => (r.store || r.channel) && r.light),
  organsHeldByOthers: n((r) => (r.store || r.channel) && r.other),
  speaksLight: rows.filter((r) => r.light && !r.private).map((r) => r.name).sort(),
  privateSpeakingLight: n((r) => r.light && r.private),
};
mkdirSync(join(HERE, '..', 'data'), { recursive: true });
writeFileSync(join(HERE, '..', 'data', 'census.json'), JSON.stringify(census, null, 1) + '\n');
writeFileSync(join(HERE, '..', 'data', 'census.local.json'), JSON.stringify(rows, null, 1) + '\n');
console.log(JSON.stringify(census, null, 1));
