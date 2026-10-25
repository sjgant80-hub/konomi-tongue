#!/usr/bin/env node
// light/tools/corpus.mjs — the material for LIGHT's measurement, gathered by the rule sealed in light/claims.json:
// every git-tracked .json and .md file of at most 256 KB in the local clones of the estate's PUBLIC repositories
// (origin sjgant80-hub, public in the estate index), excluding vendor/, node_modules/ and data/img, de-duplicated by
// SHA-256; TRAIN if the file's last commit is before 2026-10-20T00:00:00Z, HELD-OUT on or after it.
//
//   node light/tools/corpus.mjs     → light/data/corpus.json (paths, sizes, hashes, split; no content)
//                                     + light/data/corpus.local.json (where each repo is cloned here; git-ignored)
//
// One `git log --name-only` per repository gives every file's last commit date (newest first, first sighting wins).
// Content is not copied: the measurement re-reads each file and checks its hash against the manifest.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, '..', 'data', 'corpus.json');
const HOME = 'C:/Users/sjgan', INDEX = HOME + '/.claude/projects/C--Users-sjgan--claude/memory/estate-index.json';
const CUT = Date.parse('2026-10-20T00:00:00Z'), MAX = 256 * 1024;
// files read while the codec was being written, before this corpus existed: held out by the rule, so excluded
export const CONTAMINATED = ['break-it:README.md', 'break-it:receipts/redteam.json'];

const idx = JSON.parse(readFileSync(INDEX, 'utf8'));
const list = Array.isArray(idx) ? idx : (idx.repos || Object.values(idx).find(Array.isArray));
const isPublic = new Map(list.map((r) => [r.name, r.private !== true]));
const git = (dir, args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });

const dirs = [];
for (const base of [HOME, HOME + '/Downloads', HOME + '/Downloads/repos']) {
  let names = [];
  try { names = readdirSync(base); } catch { continue; }
  for (const n of names) { const d = base + '/' + n; try { if (statSync(d + '/.git').isDirectory()) dirs.push(d); } catch { /* not a clone */ } }
}
const seen = new Map(), items = [], repos = new Set();
let skippedPrivate = 0, skippedOther = 0;
for (const d of dirs) {
  let url = '';
  try { url = git(d, ['remote', 'get-url', 'origin']).trim(); } catch { continue; }
  const m = /github\.com[/:]sjgant80-hub\/([^/.]+?)(?:\.git)?$/.exec(url);
  if (!m) { skippedOther++; continue; }
  const repo = m[1];
  if (isPublic.get(repo) !== true) { skippedPrivate++; continue; }
  if (repos.has(repo)) continue;                                  // the same repository cloned twice: the first clone only
  repos.add(repo);
  let log = '';
  try { log = git(d, ['log', '--format=@%cI', '--name-only', '--no-renames', 'HEAD']); } catch { continue; }
  const last = new Map();
  let when = 0;
  for (const line of log.split('\n')) {
    if (line.startsWith('@')) { when = Date.parse(line.slice(1)); continue; }
    if (line && !last.has(line)) last.set(line, when);
  }
  let tracked = [];
  try { tracked = git(d, ['ls-files', '-z']).split('\0').filter(Boolean); } catch { continue; }
  for (const f of tracked) {
    if (!/\.(json|md)$/i.test(f) || /(^|\/)(vendor|node_modules)\//.test(f) || /(^|\/)data\/img\//.test(f)) continue;
    let st;
    try { st = statSync(join(d, f)); } catch { continue; }
    if (!st.isFile() || st.size > MAX) continue;
    const bytes = readFileSync(join(d, f));
    const sha = createHash('sha256').update(bytes).digest('hex');
    if (seen.has(sha)) continue;
    seen.set(sha, true);
    const id = repo + ':' + f, at = last.get(f) || 0;
    const split = CONTAMINATED.includes(id) ? 'excluded' : at >= CUT ? 'held' : 'train';
    items.push({ id, dir: d, bytes: bytes.length, sha256: sha, last: at ? new Date(at).toISOString() : null, split });
  }
}
items.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const count = (s) => items.filter((i) => i.split === s);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ kind: 'konomi-tongue.light.corpus', v: 1, rule: 'light/claims.json material.rule', cut: '2026-10-20T00:00:00Z', contaminated: CONTAMINATED,
  repos: repos.size, clones: dirs.length, skippedPrivate, skippedOther,
  train: { items: count('train').length, bytes: count('train').reduce((s, i) => s + i.bytes, 0) },
  held: { items: count('held').length, bytes: count('held').reduce((s, i) => s + i.bytes, 0) },
  items: items.map(({ dir, ...rest }) => rest) }, null, 1) + '\n');
// where each repository is cloned on this machine: local only (git-ignored), never published
writeFileSync(OUT.replace(/corpus\.json$/, 'corpus.local.json'), JSON.stringify({ dirs: Object.fromEntries(items.map((i) => [i.id.split(':')[0], i.dir])) }, null, 1) + '\n');
console.log('repos', repos.size, 'of', dirs.length, 'clones · skipped private', skippedPrivate, '· other', skippedOther);
console.log('train', count('train').length, 'items · held', count('held').length, 'items · excluded', count('excluded').length);
