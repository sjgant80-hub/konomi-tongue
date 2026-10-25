#!/usr/bin/env node
// light/tools/measure.mjs — LIGHT EVERYWHERE, measured. The claims sealed in light/claims.json (and light/barrier.json)
// held against what this gathers; the judge (light/judge.mjs) is pure and gated. This reads HELD-OUT for the FIRST time.
// It refuses to run if either sealed file differs from the commit that sealed it.
//
//   node light/tools/measure.mjs            every claim it can measure here; writes light/data/light-run.json
//   node light/tools/measure.mjs --quick    skips the local-model claims (T1/T2) and the mesh claims (K1–K3)
//
// The security-testing claims (B1–B4) and the swarm framing are NOT measured by this tool.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { encode, decode, prime } from '../codec.mjs';
import { pack, unpack } from '../vault.mjs';
import { open, prepare, finish, KINDS } from '../packet.mjs';
import { dictIdOf } from '../packet.mjs';
import { sha256, hex } from '../sha256.mjs';
import { judge } from '../judge.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..', '..');
const quick = process.argv.includes('--quick');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const say = (m) => process.stderr.write(m + '\n');

// the seals
function sealed(path) {
  const text = readFileSync(join(ROOT, path), 'utf8');
  const commit = git('log', '-1', '--format=%H', '--', path).trim();
  if (!commit || git('show', commit + ':' + path) !== text) throw new Error(path + ' differs from the commit that sealed it — refusing to measure');
  return { path, commit, sha256: hex(sha256(new TextEncoder().encode(text))), parsed: JSON.parse(text) };
}
const seals = [sealed('light/claims.json'), sealed('light/barrier.json')];
const claims = seals[0].parsed;
say('claims sealed at ' + seals[0].commit.slice(0, 7));

const dict = new Uint8Array(readFileSync(join(HERE, '..', 'dict', 'v1.txt')));
const primed = prime(dict), ID = dictIdOf(dict);
const corpus = JSON.parse(readFileSync(join(HERE, '..', 'data', 'corpus.json'), 'utf8'));
corpus.dirs = JSON.parse(readFileSync(join(HERE, '..', 'data', 'corpus.local.json'), 'utf8')).dirs;
const held = corpus.items.filter((i) => i.split === 'held');
const read = (it) => { const [repo, ...rest] = it.id.split(':'); return new Uint8Array(readFileSync(join(corpus.dirs[repo], rest.join(':')))); };
const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
const br = (b) => zlib.brotliCompressSync(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
const gz = (b) => zlib.gzipSync(b, { level: 9 }).length;

// ── the codec over HELD-OUT, each file's own hash checked (contaminated files are already excluded)
say('codec over ' + held.length + ' held-out files…');
const rows = [];
let lossless = 0, changed = 0, encMs = 0, decMs = 0, inBytes = 0;
for (const it of held) {
  const bytes = read(it);
  // a file whose content changed since the manifest is still held-out by date; measure its CURRENT bytes and note it
  if (hex(sha256(bytes)) !== it.sha256) changed++;
  const a = performance.now(), e = encode(bytes, primed), b = performance.now(), d = decode(e.bytes, primed), c = performance.now();
  encMs += b - a; decMs += c - b; inBytes += bytes.length;
  if (!d.ok || d.bytes.length !== bytes.length || d.bytes.some((x, i) => x !== bytes[i])) lossless++;
  rows.push({ id: it.id, n: bytes.length, light: e.bytes.length, br: br(bytes), gz: gz(bytes) });
}
const small = rows.filter((r) => r.n <= 2048), sum = (xs, k) => xs.reduce((s, r) => s + r[k], 0);
const codec = {
  heldFiles: rows.length, changedSinceManifest: changed, lossless,
  medianRatioJson: +median(rows.map((r) => r.n / r.light)).toFixed(3),
  smallItems: small.length, smallMedianLight: median(small.map((r) => r.light)), smallMedianBrotli: median(small.map((r) => r.br)), smallMedianGzip: median(small.map((r) => r.gz)),
  smallLightBeatsBrotliGzip: small.filter((r) => r.light < r.br && r.light < r.gz).length,
  totalIn: sum(rows, 'n'), totalLight: sum(rows, 'light'), totalBrotli: sum(rows, 'br'), totalGzip: sum(rows, 'gz'),
  mbpsEncode: +(inBytes / 1e3 / encMs).toFixed(3), mbpsDecode: +(inBytes / 1e3 / decMs).toFixed(3),
};
say('  median ' + codec.medianRatioJson + '× · small: light<br&gz on ' + codec.smallLightBeatsBrotliGzip + '/' + small.length + ' · lossless ' + (lossless === 0 ? 'all' : lossless + ' FAILED') + ' · ' + changed + ' changed since the manifest (current bytes measured)');

// ── memory as one vault
let memory = { ok: false };
try {
  const m = execFileSync(process.execPath, [join(HERE, 'memory.mjs')], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  memory = JSON.parse(m.trim().split('\n').pop());
  say('  memory: ' + memory.files + ' files, ' + memory.ratio + '×, ' + (memory.identical ? 'byte-identical' : memory.mismatched + ' mismatched'));
} catch (e) { memory = { ok: false, why: String(e.message || e).slice(0, 120) }; }

// ── edges: the page's own gate (test/light-page.test.mjs), and that every decode here went through verify-first code
let edges = { pageTest: null };
try { execFileSync(process.execPath, ['--test', join(ROOT, 'test', 'light-page.test.mjs')], { cwd: ROOT, stdio: 'ignore' }); edges.pageTest = 'pass'; }
catch { edges.pageTest = existsSync(join(ROOT, 'test', 'light-page.test.mjs')) ? 'fail' : 'not built'; }

// ── the model-facing text dialect (T2): the existing tongue-pack, counted in local-model tokens
let llm = { ran: false };
if (!quick) {
  try {
    const { pack: tpack, unpack: tunpack } = await import('file:///' + join(ROOT, 'tongue-pack.mjs').replace(/\\/g, '/'));
    const { alphabet } = await import('file:///' + join(ROOT, 'tools', 'ship.mjs').replace(/\\/g, '/'));
    const A = alphabet();
    // record-shaped held-out files: a JSON array or object that holds arrays of objects
    const recordy = held.map((it) => ({ it, bytes: read(it) })).filter(({ bytes }) => { try { const v = JSON.parse(Buffer.from(bytes).toString('utf8')); return Array.isArray(v) ? v.length >= 3 : v && typeof v === 'object' && Object.values(v).some((x) => Array.isArray(x) && x.length >= 3); } catch { return false; } }).slice(0, 40);
    const qtok = async (t) => {
      const r = await (await fetch('http://127.0.0.1:11434/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(120000),
        body: JSON.stringify({ model: 'qwen2.5:7b', prompt: t, raw: true, stream: false, options: { num_predict: 1, num_ctx: 8192 } }) })).json();
      return r.prompt_eval_count || 0;
    };
    const probe = await qtok('probe '.repeat(200));
    if (probe < 100) throw new Error('qwen counter degenerate: ' + probe);
    const pairs = [];
    for (const { bytes } of recordy) {
      const v = JSON.parse(Buffer.from(bytes).toString('utf8'));
      const minJson = JSON.stringify(v), packed = tpack(v, A);
      if (!tunpack(packed.text).ok) continue;
      pairs.push({ json: await qtok(minJson), pack: await qtok(packed.text) });
    }
    llm = { ran: true, model: 'qwen2.5:7b', items: pairs.length, medianJsonTokens: median(pairs.map((p) => p.json)), medianPackTokens: median(pairs.map((p) => p.pack)),
      packWins: pairs.filter((p) => p.pack < p.json).length, medianRatio: +median(pairs.map((p) => (p.pack > 0 ? p.json / p.pack : 0))).toFixed(3) };
    say('  llm-io: pack < json on ' + llm.packWins + '/' + pairs.length + ' record files (qwen tokens), median ' + llm.medianRatio + '×');
  } catch (e) { llm = { ran: false, why: String(e.message || e).slice(0, 120) }; }
}

// ── the mesh, in break-it (K1–K3): run its tool, read its receipt
let mesh = { ran: false };
if (!quick) {
  const BREAK = process.env.BREAK_IT || 'C:/Users/sjgan/break-it';
  try {
    execFileSync(process.execPath, ['tools/light-share.mjs'], { cwd: BREAK, stdio: 'ignore', timeout: 120000 });
    mesh = { ran: true, ...JSON.parse(readFileSync(join(BREAK, 'receipts', 'light-share.json'), 'utf8')).facts };
    say('  mesh: node0→peers, on-sight ' + JSON.stringify(mesh.k1 && [mesh.k1.node1, mesh.k1.node2]));
  } catch (e) { mesh = { ran: false, why: String(e.message || e).slice(0, 140) }; }
}

// ── census
let census = { ran: false };
try { census = { ran: true, ...JSON.parse(execFileSync(process.execPath, [join(HERE, 'census.mjs')], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })) }; }
catch (e) { census = { ran: false, why: String(e.message || e).slice(0, 120) }; }

const facts = { codec, memory, edges, llm, mesh, census, dictBytes: dict.length, dictId: ID, dictSha256: hex(sha256(dict)), heldOut: held.length };
const verdict = judge(claims, facts);
for (const v of verdict.verdicts) say((v.held === true ? '  HELD    ' : v.held === null ? '  (unmeasured) ' : '  FAILED  ') + v.id + ' — ' + v.measured);
say(verdict.held + ' held, ' + verdict.failed + ' failed, ' + verdict.unmeasured + ' not measured here');

const receipt = { kind: 'konomi-tongue.light.receipt', v: 1, ran: new Date().toISOString(), node: process.version,
  sealed: seals.map(({ parsed, ...s }) => s), facts, verdicts: verdict.verdicts, held: verdict.held, failed: verdict.failed, unmeasured: verdict.unmeasured };
if (!quick) writeFileSync(join(HERE, '..', 'data', 'light-run.json'), JSON.stringify(receipt, null, 1) + '\n');
say(quick ? '(a --quick run: nothing written)' : 'wrote light/data/light-run.json');
process.exit(0);
