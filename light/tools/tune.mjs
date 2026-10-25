#!/usr/bin/env node
// light/tools/tune.mjs — tuning inside TRAIN only. TRAIN is split again: items whose SHA-256 starts with 0 or 1 (an
// eighth) are VALIDATION; a dictionary is grown from the rest, and the codec is scored on VALIDATION against gzip -9 and
// Brotli 11. HELD-OUT is never opened here. Every choice of the codec's constants and the dictionary's size is made on
// these numbers, before the sealed measurement reads HELD-OUT for the first time.
//
//   node light/tools/tune.mjs [--sample 400] [--budget 196608]
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { encode, decode, prime } from '../codec.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const SAMPLE = Number(arg('--sample', '400')), BUDGET = arg('--budget', '196608');
const corpus = JSON.parse(readFileSync(join(HERE, '..', 'data', 'corpus.json'), 'utf8'));
corpus.dirs = JSON.parse(readFileSync(join(HERE, '..', 'data', 'corpus.local.json'), 'utf8')).dirs;
const train = corpus.items.filter((i) => i.split === 'train');
const val = train.filter((i) => /^[01]/.test(i.sha256));
const tmp = mkdtempSync(join(tmpdir(), 'light-tune-'));
writeFileSync(join(tmp, 'except.json'), JSON.stringify(val.map((i) => i.id)));
execFileSync(process.execPath, [join(HERE, 'dict.mjs'), '--budget', BUDGET, '--out', join(tmp, 'dict.txt'), '--except', join(tmp, 'except.json')], { stdio: 'inherit' });
const dict = new Uint8Array(readFileSync(join(tmp, 'dict.txt')));
const t0 = performance.now(), primed = prime(dict), tPrime = performance.now() - t0;

// a deterministic sample of VALIDATION, spread across sizes
const pick = val.slice().sort((a, b) => (a.sha256 < b.sha256 ? -1 : 1)).slice(0, SAMPLE);
const rows = [];
let encMs = 0, decMs = 0, inBytes = 0, bad = 0;
for (const it of pick) {
  const [repo, ...rest] = it.id.split(':');
  const bytes = new Uint8Array(readFileSync(join(corpus.dirs[repo], rest.join(':'))));
  const a = performance.now(), e = encode(bytes, primed), b = performance.now(), d = decode(e.bytes, primed), c = performance.now();
  encMs += b - a; decMs += c - b; inBytes += bytes.length;
  if (!d.ok || d.bytes.length !== bytes.length || d.bytes.some((x, i) => x !== bytes[i])) bad++;
  const br = zlib.brotliCompressSync(bytes, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length, gz = zlib.gzipSync(bytes, { level: 9 }).length;
  rows.push({ n: bytes.length, light: e.bytes.length, br, gz });
}
const med = (xs) => { const s = xs.slice().sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
const small = rows.filter((r) => r.n <= 2048), sum = (xs, k) => xs.reduce((s, r) => s + r[k], 0);
console.log(JSON.stringify({
  validation: val.length, sampled: rows.length, dictBytes: dict.length, primeMs: Math.round(tPrime), lossless: bad === 0 ? 'all' : bad + ' FAILED',
  medianRatio: +med(rows.map((r) => r.n / r.light)).toFixed(3), medianRatioBrotli: +med(rows.map((r) => r.n / r.br)).toFixed(3),
  small: { items: small.length, medianLight: med(small.map((r) => r.light)), medianBrotli: med(small.map((r) => r.br)), medianGzip: med(small.map((r) => r.gz)), lightBeatsBrotli: small.filter((r) => r.light < r.br).length },
  total: { in: sum(rows, 'n'), light: sum(rows, 'light'), brotli: sum(rows, 'br'), gzip: sum(rows, 'gz') },
  mbps: { encode: +(inBytes / 1e3 / encMs).toFixed(3), decode: +(inBytes / 1e3 / decMs).toFixed(3) },
}, null, 1));
