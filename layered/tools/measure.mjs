#!/usr/bin/env node
// layered/tools/measure.mjs — the one measurement of LIGHT, LAYERED and STACKED LIGHT (glue, local).
//
//   node layered/tools/measure.mjs                 THE run: refuses unless layered/SEAL2.md is committed and every file
//                                                  it seals matches, byte for byte; END = SEAL 2's commit time
//   node layered/tools/measure.mjs --check [--type records|prose]
//                                                  re-derive: each public type from its committed pack (CI does this),
//                                                  each private type from its snapshot when this laptop has it, and
//                                                  every verdict from the record's numbers
//   node layered/tools/measure.mjs --dry           the whole pipeline on SEED-SIDE items only (the newest seed items
//                                                  stand in for held ones; the stack measures on its gate's own slice;
//                                                  no 7B): proves the machinery before SEAL 2 without reading a held item
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { measureType, recent } from './lab.mjs';
import { verdicts } from '../src/verdict.mjs';
import { TYPES, CUT } from './gather.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..'), OUT = join(ROOT, 'layered', 'data', 'record.json');
const PRIV = 'C:/Users/sjgan/.si-didy/layered', sha = (b) => createHash('sha256').update(b).digest('hex');
const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const say = (s) => process.stderr.write(new Date().toISOString().slice(11, 19) + ' ' + s + '\n');
const args = process.argv.slice(2), CHECK = args.includes('--check'), DRY = args.includes('--dry');
const only = args.includes('--type') ? args[args.indexOf('--type') + 1] : null;
const b64 = (u) => Buffer.from(u).toString('base64'), unb64 = (s) => new Uint8Array(Buffer.from(s, 'base64'));

async function lightV1() {
  const L = await import('../../light/codec.mjs');
  const dict = new Uint8Array(readFileSync(join(ROOT, 'light', 'dict', 'v1.txt')));
  return { encode: L.encode, decode: L.decode, primed: L.prime(dict) };
}
const PUBLIC_FIELDS = (t) => { const { key, raw, items, seedBytes, seedId, ladder, alone, grow, baselines, drift, corrupt, pair } = t; return { key, raw, items, seedBytes, seedId, ladder, alone, grow, baselines, drift, corrupt, ...(pair ? { pair } : {}) }; };

function sealed() {
  const text = readFileSync(join(ROOT, 'layered', 'SEAL2.md'), 'utf8');
  const m = /```json\n([\s\S]*?)\n```/.exec(text);
  if (!m) throw new Error('SEAL2.md has no json block');
  const seal = JSON.parse(m[1]);
  if (git(['status', '--porcelain', '--', 'layered/SEAL2.md']).trim() !== '') throw new Error('SEAL2.md is not committed');
  const bad = [];
  for (const [p, want] of Object.entries(seal.files)) {
    const blob = execFileSync('git', ['-C', ROOT, 'show', 'HEAD:' + p], { maxBuffer: 64 * 1024 * 1024 });
    const work = readFileSync(join(ROOT, p));
    if (sha(blob) !== want) bad.push(p + ' (committed)');
    if (sha(work) !== want && sha(Buffer.from(work.toString('latin1').replace(/\r\n/g, '\n'), 'latin1')) !== want) bad.push(p + ' (working copy)');
  }
  // the private inputs (the pattern library's module, its wire, its feed, the library as sealed) are sealed by hash
  // only; their paths live in layered/data/private.local.json
  const local = JSON.parse(readFileSync(join(ROOT, 'layered', 'data', 'private.local.json'), 'utf8'));
  for (const [k, want] of Object.entries(seal.private || {})) if (sha(readFileSync(local[k])) !== want) bad.push('private ' + k);
  if (bad.length) throw new Error('the instrument changed since SEAL 2: ' + bad.join(', '));
  const end = new Date(git(['log', '-1', '--format=%cI', '--', 'layered/SEAL2.md']).trim()).toISOString();
  return { seal, end, commit: git(['log', '-1', '--format=%H', '--', 'layered/SEAL2.md']).trim() };
}

async function run() {
  const { gather } = await import('./gather.mjs');
  let seal = null, end, material;
  if (DRY) {
    const dev = JSON.parse(readFileSync(PRIV + '/dev-context.json', 'utf8'));
    material = {};
    for (const t of TYPES) {
      const items = dev.types[t.key].map((x, i) => ({ id: t.key + i, at: x.at, bytes: unb64(x.b64) }));
      const held = [], cap = 65536; let hb = 0;
      while (items.length && hb + items[items.length - 1].bytes.length <= cap) { const x = items.pop(); hb += x.bytes.length; held.unshift(x); }
      held.sort((a, b) => (sha(a.bytes) < sha(b.bytes) ? -1 : 1));
      material[t.key] = { context: recent(items.map((x) => x.bytes), 524288), held, counts: { dry: true } };
    }
    end = CUT;
  } else {
    seal = sealed(); end = seal.end;
    say('SEAL 2 holds (' + seal.commit.slice(0, 7) + '); END = ' + end + '; gathering both sides');
    const g = await gather({ mode: 'all', end });
    material = {};
    for (const t of TYPES) material[t.key] = { context: g.types[t.key].context.map((x) => x.bytes), held: g.types[t.key].held, counts: g.types[t.key].counts, ctxItems: g.types[t.key].context };
    // the private snapshot (local only) and the public packs (committed, so CI re-derives the public types)
    const snap = JSON.stringify({ cut: CUT, end, types: Object.fromEntries(TYPES.map((t) => [t.key, { context: material[t.key].context.map(b64), held: material[t.key].held.map((h) => ({ id: h.id, at: h.at, b64: b64(h.bytes) })) }])) });
    mkdirSync(PRIV, { recursive: true });
    const snapSha = sha(snap);
    writeFileSync(PRIV + '/snapshot-' + snapSha.slice(0, 16) + '.json', snap);
    material.snapshot = snapSha;
    mkdirSync(join(ROOT, 'layered', 'data', 'public'), { recursive: true });
    material.packs = {};
    for (const t of TYPES.filter((x) => x.privacy === 'public')) {
      const m = material[t.key];
      const pack = gzipSync(Buffer.from(JSON.stringify({ key: t.key, cut: CUT, end, context: m.ctxItems.map((x) => ({ id: x.id, at: x.at, sha256: x.sha256, b64: b64(x.bytes) })), held: m.held.map((h) => ({ id: h.id, at: h.at, sha256: h.sha256, b64: b64(h.bytes) })) })), { level: 9 });
      writeFileSync(join(ROOT, 'layered', 'data', 'public', t.key + '.json.gz'), pack);
      material.packs[t.key] = sha(pack);
    }
  }
  const light = await lightV1(), types = [];
  for (const t of TYPES) {
    const m = material[t.key];
    say(t.t + ' ' + t.key + ': ' + m.held.length + ' held items, ' + m.context.length + ' seed items');
    const r = measureType(t.key, m.context, m.held, light, say);
    types.push({ ...PUBLIC_FIELDS(r), t: t.t, label: t.label, privacy: t.privacy, counts: m.counts });
  }
  const priv = (() => { try { return JSON.parse(readFileSync(JSON.parse(readFileSync(join(ROOT, 'layered/data/private.local.json'), 'utf8')).index, 'utf8')).nodes.filter((n) => n.private === true).map((n) => n.name.toLowerCase()); } catch { return []; } })();
  const { stackRun } = await import('./stack.mjs');
  const stacked = await stackRun({ at: new Date().toISOString(), say, privateNames: priv, dry: DRY });
  const gate = existsSync(join(ROOT, 'layered/data/witness.json')) ? JSON.parse(readFileSync(join(ROOT, 'layered/data/witness.json'), 'utf8')) : { clean: false, killed: 0, total: 0 };
  const record = {
    kind: 'konomi-tongue.layered.record', v: 1, dry: DRY,
    sealed: seal ? [{ path: 'layered/CLAIMS.md', commit: git(['log', '--format=%H', '--reverse', '--', 'layered/CLAIMS.md']).trim().split('\n')[0] },
      { path: 'layered/STACKED-CLAIMS.md', commit: git(['log', '--format=%H', '--reverse', '--', 'layered/STACKED-CLAIMS.md']).trim().split('\n')[0] },
      { path: 'layered/SEAL2.md', commit: seal.commit }] : [],
    cut: CUT, end, ran: new Date().toISOString(), node: process.version,
    snapshot: material.snapshot || null, packs: material.packs || {},
    types, stacked, gate: { clean: gate.clean === true, killed: gate.killed | 0, total: gate.total | 0 },
  };
  record.verdicts = verdicts(record);
  writeFileSync(DRY ? PRIV + '/record-dry.json' : OUT, JSON.stringify(record, null, 1) + '\n');
  for (const v of record.verdicts) say((v.held ? 'HELD   ' : 'FAILED ') + v.id + '  ' + v.measured);
  say(DRY ? 'dry run written privately (' + PRIV + '/record-dry.json)' : 'record written: layered/data/record.json');
}

async function check() {
  const rec = JSON.parse(readFileSync(OUT, 'utf8')), problems = [];
  const light = await lightV1();
  for (const t of rec.types) {
    if (only && t.key !== only) continue;
    let mat = null;
    if (t.privacy === 'public') {
      const pack = readFileSync(join(ROOT, 'layered', 'data', 'public', t.key + '.json.gz'));
      if (sha(pack) !== rec.packs[t.key]) { problems.push(t.key + ': the committed pack is not the one measured'); continue; }
      const p = JSON.parse(gunzipSync(pack).toString('utf8'));
      mat = { context: p.context.map((x) => unb64(x.b64)), held: p.held.map((h) => ({ id: h.id, at: h.at, bytes: unb64(h.b64) })) };
      for (const h of p.held) if (sha(unb64(h.b64)) !== h.sha256) problems.push(t.key + ': held item ' + h.id + ' changed');
    } else {
      const f = PRIV + '/snapshot-' + String(rec.snapshot).slice(0, 16) + '.json';
      if (!existsSync(f)) { say(t.key + ': private, its snapshot is not on this machine; its verdicts are re-checked from the record'); continue; }
      const s = JSON.parse(readFileSync(f, 'utf8'));
      mat = { context: s.types[t.key].context.map(unb64), held: s.types[t.key].held.map((h) => ({ id: h.id, at: h.at, bytes: unb64(h.b64) })) };
    }
    say(t.key + ': re-deriving ' + mat.held.length + ' items');
    const again = PUBLIC_FIELDS(measureType(t.key, mat.context, mat.held, light, say));
    const want = JSON.stringify(PUBLIC_FIELDS(t)), got = JSON.stringify(again);
    if (want !== got) problems.push(t.key + ': re-derived numbers differ from the record');
    else say(t.key + ': every number re-derived exactly');
  }
  const vs = verdicts(rec);
  if (JSON.stringify(vs) !== JSON.stringify(rec.verdicts)) problems.push('the verdicts do not follow from the record\'s numbers');
  if (problems.length) { for (const p of problems) console.error('::error::' + p); process.exit(1); }
  console.log('LAYERED REPRODUCED · ' + (only || 'all available types') + ' · ' + vs.filter((v) => v.held).length + ' of ' + vs.length + ' verdicts held, as recorded');
}

await (CHECK ? check() : run());
