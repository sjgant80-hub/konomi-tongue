#!/usr/bin/env node
// layered/tools/gather.mjs — the material for LIGHT, LAYERED, by the rule sealed in layered/CLAIMS.md (glue, local).
//
//   T1 agent     the agents' messages (tools/corpus.mjs collect()), dated by their timestamp          private
//   T2 memory    the .md files of the Kar memory directory, dated by last write                        private
//   T3 callbook  the records of ~/.si-didy/brain/calls.lcb (kar-mind readBook), as JSON, dated by `at`  private
//   T4 records   git-tracked .json ≤ 256 KB in local clones of the estate's public repositories        public
//   T5 prose     the same rule for .md                                                                 public
//
// CONTEXT (the seed) = before CUT, the most recent whole items up to 4 MiB, taught oldest first. HELD = [CUT, END), in
// SHA-256 order up to 1 MiB. An item whose bytes equal any earlier item's is dropped (de-duplicated by SHA-256: a held
// item the seed side already holds, byte for byte, is not a held item). Public items naming a private repository or
// carrying a key-shaped string are dropped before anything is counted.
//
// gather({ mode: 'context' })        → the seed side only: no held item's bytes are read (tuning and tests may use it)
// gather({ mode: 'all', end })       → both sides; only the measurement calls this, after SEAL 2
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

export const CUT = '2026-11-05T12:00:00.000Z';
export const CONTEXT_CAP = 4 * 1024 * 1024, HELD_CAP = 1024 * 1024, PUBLIC_MAX = 256 * 1024;
export const TYPES = Object.freeze([
  { key: 'agent', t: 'T1', label: 'agent logs', privacy: 'private' },
  { key: 'memory', t: 'T2', label: 'memory journal', privacy: 'private' },
  { key: 'callbook', t: 'T3', label: 'call book', privacy: 'private' },
  { key: 'records', t: 'T4', label: 'structured records', privacy: 'public' },
  { key: 'prose', t: 'T5', label: 'prose', privacy: 'public' },
]);
const HOME = 'C:/Users/sjgan', MEM = HOME + '/.claude/projects/C--Users-sjgan--claude/memory', INDEX = MEM + '/estate-index.json';
const BOOK = HOME + '/.si-didy/brain/calls.lcb';
const SECRET = /(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,})/;
const sha = (b) => createHash('sha256').update(b).digest('hex');
const te = new TextEncoder();
const git = (dir, args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });

function estate() {
  const idx = JSON.parse(readFileSync(INDEX, 'utf8'));
  const list = idx.nodes;
  const isPublic = new Map(list.map((r) => [r.name, r.private !== true]));
  const priv = list.filter((r) => r.private === true).map((r) => r.name.toLowerCase());
  return { isPublic, priv };
}
function namesPrivate(text, priv) {
  const low = text.toLowerCase();
  for (const n of priv) {
    let at = low.indexOf(n);
    while (at !== -1) {
      const before = at === 0 ? '' : low[at - 1], after = low[at + n.length] || '';
      if (!/[a-z0-9-]/.test(before) && !/[a-z0-9-]/.test(after)) return true;
      at = low.indexOf(n, at + 1);
    }
  }
  return false;
}

// every candidate of the two public types: { id, at, size, path }, newest first sighting per repository
function publicCandidates(isPublic) {
  const dirs = [];
  for (const base of [HOME, HOME + '/Downloads', HOME + '/Downloads/repos']) {
    let names = [];
    try { names = readdirSync(base); } catch { continue; }
    for (const n of names) { const d = base + '/' + n; try { if (statSync(d + '/.git').isDirectory()) dirs.push(d); } catch { /* not a clone */ } }
  }
  const out = { records: [], prose: [] }, repos = new Set();
  for (const d of dirs) {
    let url = '';
    try { url = git(d, ['remote', 'get-url', 'origin']).trim(); } catch { continue; }
    const m = /github\.com[/:]sjgant80-hub\/([^/.]+?)(?:\.git)?$/.exec(url);
    if (!m || isPublic.get(m[1]) !== true || repos.has(m[1])) continue;
    const repo = m[1];
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
      const kind = /\.json$/i.test(f) ? 'records' : /\.md$/i.test(f) ? 'prose' : null;
      if (!kind || /(^|\/)(vendor|node_modules)\//.test(f) || /(^|\/)data\/img\//.test(f)) continue;
      if (repo === 'konomi-tongue' && f.startsWith('layered/')) continue;     // this build
      let st;
      try { st = statSync(join(d, f)); } catch { continue; }
      if (!st.isFile() || st.size > PUBLIC_MAX || !last.has(f)) continue;
      out[kind].push({ id: repo + ':' + f, at: new Date(last.get(f)).toISOString(), size: st.size, path: join(d, f) });
    }
  }
  return { ...out, repos: repos.size, clones: dirs.length };
}

// the sealed selection for one type, from candidates { id, at, size, read() }
function select(cands, mode, end, filter) {
  const c = { contextCandidates: 0, heldCandidates: 0, droppedPrivate: 0, droppedDuplicate: 0, droppedCapContext: 0, droppedCapHeld: 0 };
  const before = cands.filter((x) => x.at < CUT).sort((a, b) => (a.at > b.at ? -1 : a.at < b.at ? 1 : a.id < b.id ? -1 : 1));
  const after = mode === 'all' ? cands.filter((x) => x.at >= CUT && x.at < end) : [];
  c.contextCandidates = before.length; c.heldCandidates = after.length;
  const seen = new Set(), context = [];
  let total = 0, full = false;
  // every seed-side item is hashed (so a held copy of any of them is known), the most recent fill the seed
  for (const x of before) {
    const bytes = x.read();
    if (filter && filter(bytes)) { c.droppedPrivate++; continue; }
    const h = sha(bytes);
    if (seen.has(h)) { c.droppedDuplicate++; continue; }
    seen.add(h);
    if (full || total + bytes.length > CONTEXT_CAP) { full = true; c.droppedCapContext++; continue; }
    total += bytes.length;
    context.push({ id: x.id, at: x.at, sha256: h, bytes });
  }
  context.reverse();                                           // taught oldest first
  const pool = [];
  for (const x of after) {
    const bytes = x.read();
    if (filter && filter(bytes)) { c.droppedPrivate++; continue; }
    const h = sha(bytes);
    if (seen.has(h)) { c.droppedDuplicate++; continue; }
    seen.add(h);
    pool.push({ id: x.id, at: x.at, sha256: h, bytes });
  }
  pool.sort((a, b) => (a.sha256 < b.sha256 ? -1 : 1));
  const held = [];
  let ht = 0;
  for (let i = 0; i < pool.length; i++) {
    if (ht + pool[i].bytes.length > HELD_CAP) { c.droppedCapHeld = pool.length - i; break; }
    ht += pool[i].bytes.length; held.push(pool[i]);
  }
  return { context, held, counts: { ...c, contextItems: context.length, contextBytes: total, heldItems: held.length, heldBytes: ht } };
}

export async function gather(opts) {
  const o = opts || {}, mode = o.mode === 'all' ? 'all' : 'context', end = o.end;
  if (mode === 'all' && (typeof end !== 'string' || !(end > CUT))) throw new Error('gather all needs END after CUT');
  const { isPublic, priv } = estate();
  const types = {};
  // T1 agent logs
  const { collect } = await import('../../tools/corpus.mjs');
  const { messages } = await collect();
  types.agent = select(messages.map((m, i) => ({ id: 'm' + i, at: m.at, read: () => te.encode(m.text) })), mode, end, null);
  // T2 memory journal
  const mem = readdirSync(MEM).filter((f) => f.endsWith('.md')).sort()
    .map((f) => ({ id: f, at: statSync(join(MEM, f)).mtime.toISOString(), read: () => new Uint8Array(readFileSync(join(MEM, f))) }));
  types.memory = select(mem, mode, end, null);
  // T3 call book
  const { readBook } = await import('file:///C:/Users/sjgan/kar-mind/callbook.mjs');
  const book = existsSync(BOOK) ? readBook(new Uint8Array(readFileSync(BOOK))) : { ok: false };
  if (!book.ok) throw new Error('the call book did not read: ' + (book.why || 'missing'));
  types.callbook = select(book.records.map((r, i) => ({ id: 'c' + i, at: r.at, read: () => te.encode(JSON.stringify(r)) })), mode, end, null);
  // T4 records, T5 prose
  const pub = publicCandidates(isPublic), td = new TextDecoder();
  const filter = (b) => { const t = td.decode(b); return SECRET.test(t) || namesPrivate(t, priv); };
  for (const k of ['records', 'prose']) types[k] = select(pub[k].map((x) => ({ id: x.id, at: x.at, read: () => new Uint8Array(readFileSync(x.path)) })), mode, end, filter);
  return { cut: CUT, end: mode === 'all' ? end : null, mode, repos: pub.repos, clones: pub.clones, types };
}

// node layered/tools/gather.mjs   the seed side only, cached PRIVATELY for tuning (~/.si-didy/layered/dev-context.json)
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('layered/tools/gather.mjs')) {
  const { writeFileSync, mkdirSync } = await import('node:fs');
  const g = await gather({ mode: 'context' });
  for (const t of TYPES) console.log(t.t, t.key, JSON.stringify(g.types[t.key].counts));
  const dev = {};
  for (const t of TYPES) dev[t.key] = g.types[t.key].context.map((x) => ({ at: x.at, b64: Buffer.from(x.bytes).toString('base64') }));
  mkdirSync(HOME + '/.si-didy/layered', { recursive: true });
  writeFileSync(HOME + '/.si-didy/layered/dev-context.json', JSON.stringify({ cut: CUT, mode: 'context', types: dev }));
  console.log('cached the seed side for tuning');
}
