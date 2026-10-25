#!/usr/bin/env node
// light/tools/dict.mjs — LIGHT's shared dictionary, grown from TRAIN material only (light/claims.json): the lines the
// estate writes again and again, in many files of many repositories — the structure of its JSON records, the credit
// lines, the headings, the badges. The dictionary is what both sides already hold; the codec reads it before a
// message's first byte. It is versioned: v1 is this cut, and a later version grows from later TRAIN material.
//
//   node light/tools/dict.mjs [--budget 196608] [--out light/dict/v1.txt] [--except <ids file>]
//
// A line earns its place by how many DIFFERENT files contain it (at least MIN_FILES, from at least MIN_REPOS
// repositories), weighted by its length; then the best lines, in that order, up to the byte budget. HELD-OUT files are
// never opened (their split is read from the manifest, and skipped).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const BUDGET = Number(arg('--budget', '196608')), OUT = arg('--out', join(HERE, '..', 'dict', 'v1.txt'));
const EXCEPT = new Set(arg('--except', '') ? JSON.parse(readFileSync(arg('--except'), 'utf8')) : []);
const MIN_FILES = 2, MIN_REPOS = 2, MAX_LINE = 240;

const corpus = JSON.parse(readFileSync(join(HERE, '..', 'data', 'corpus.json'), 'utf8'));
corpus.dirs = JSON.parse(readFileSync(join(HERE, '..', 'data', 'corpus.local.json'), 'utf8')).dirs;
// The dictionary is a NEW public file: each line in it was public somewhere, but gathered together they must still
// say nothing the estate keeps off public surfaces. A line is never kept if it names a private repository, uses the
// contribution-ledger terms, carries an email address or a person's name, or looks like a credential or a key.
const INDEX = 'C:/Users/sjgan/.claude/projects/C--Users-sjgan--claude/memory/estate-index.json';
const idx = JSON.parse(readFileSync(INDEX, 'utf8'));
const list = Array.isArray(idx) ? idx : (idx.repos || Object.values(idx).find(Array.isArray));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PRIVATE = new RegExp('(^|[^a-z0-9-])(' + list.filter((r) => r.private === true).map((r) => esc(r.name)).join('|') + ')($|[^a-z0-9-])', 'i');
const BLOCK = /kcc|airdrop|@[a-z0-9-]+\.[a-z]{2,}|simon gant|password|passwd|secret|api[_-]?key|bearer |token|sk-[a-z]|ghp_|private[_ ]key|ssid|[0-9a-f]{32}/i;
export const keepLine = (l) => !PRIVATE.test(l) && !BLOCK.test(l);
const lines = new Map();                                           // line → { files, repos:Set }
let read = 0;
for (const it of corpus.items) {
  if (it.split !== 'train' || EXCEPT.has(it.id)) continue;
  const [repo, ...rest] = it.id.split(':');
  const bytes = readFileSync(join(corpus.dirs[repo], rest.join(':')));
  if (createHash('sha256').update(bytes).digest('hex') !== it.sha256) continue;   // changed since the manifest: not used
  read++;
  const mine = new Set(bytes.toString('utf8').split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim().length >= 4 && l.length <= MAX_LINE && keepLine(l)));
  for (const l of mine) { let e = lines.get(l); if (!e) lines.set(l, (e = { files: 0, repos: new Set() })); e.files++; e.repos.add(repo); }
}
const ranked = [...lines].filter(([, e]) => e.files >= MIN_FILES && e.repos.size >= MIN_REPOS)
  .map(([l, e]) => [l, e.files * Buffer.byteLength(l)]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
const out = [];
let size = 0;
for (const [l] of ranked) { const n = Buffer.byteLength(l) + 1; if (size + n > BUDGET) continue; out.push(l); size += n; }
// least valuable first, so the most common lines sit nearest the message and the match model finds them soonest
const text = out.reverse().join('\n') + '\n';
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, text);
console.log('read', read, 'train files ·', lines.size, 'distinct lines ·', ranked.length, 'recur ·', out.length, 'kept ·', Buffer.byteLength(text), 'bytes · sha256', createHash('sha256').update(text).digest('hex').slice(0, 16));
