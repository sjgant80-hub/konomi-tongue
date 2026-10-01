#!/usr/bin/env node
// tools/run.mjs — the sealed run of the Konomi Tongue (glue). Refuses to run unless data/prereg.json is sealed and matches
// its inputs. Paid calls go through the official claude CLI on Simon's login (tools/cli.mjs); each is cached privately by
// the hash of what was sent, so a stopped run never pays twice. Public record: data/run.json and the picture payload
// images in data/img/. Private record (the agents' messages, the grown dictionary, everything carrying them):
// ~/.si-didy/tongue/private-run.json — only its sha256 and counts are published.
//
//   node tools/run.mjs --run        run every phase (text, json, picture, combined) and write the records
//   node tools/run.mjs --verify     CI: re-grade every recorded read, rebuild the JSON channel from the committed files,
//                                   re-derive every ratio and bits-per-token from the recorded counts; exit 1 on any drift
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import * as T from '../tongue.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const PRIV = 'C:/Users/sjgan/.si-didy/tongue';
const sha = (s) => createHash('sha256').update(s).digest('hex');
const text = (f) => readFileSync(join(ROOT, f), 'utf8');
const stable = (o) => JSON.stringify(o, null, 1) + '\n';
const has = (f) => process.argv.includes(f);

export const CONFIG = {
  model: 'claude-sonnet-5-5',
  text: { rounds: 512, batch: 16, checkpoints: [0, 64, 256, 1024, 4096], readback: { n: 8, seed: 11 } },
  json: { min: 2, checkpoints: [0, 16, 64, 256] },
  picture: {
    alphabet: 256, font: 'Yu Gothic', scale: 0.82, cols: 24, rows: 16, glyphSizes: [28, 20, 14, 10, 8],
    dots: { cols: 48, rows: 48, sizes: [8, 6, 4, 3, 2], gap: 1 }, perSize: 2, evolveSizes: [10, 8], seed: 7,
    depth: { dot: 6, levels: [1, 2, 3, 4], images: 2 }, bar: 0.99,
  },
  combined: { n: 6, seed: 23, sizes: [16, 12, 9], width: 760, font: 'Yu Gothic' },
};
export const PROMPTS = {
  system: 'You transcribe images exactly. Reply with the transcription only.',
  glyphs: (r, c) => 'The image is a grid of ' + r + ' rows and ' + c + ' columns of characters. Write the grid exactly, one row per line, the characters only, with no spaces and nothing else.',
  dots: (r, c) => 'The image is a grid of ' + r + ' rows and ' + c + ' columns of squares, grouped in blocks of 3 (and blocks of blocks). Each square is black or white; white squares have a faint outline. Write the grid exactly, one row per line, 1 for black and 0 for white, with no spaces and nothing else.',
  combined: 'Transcribe the text in this image exactly, character for character. Write only the text.',
  readSystem: 'You read the Konomi Tongue: a shared dictionary of glyphs, each standing for an exact piece of text.',
  readback: (legend, coded) => 'Here is the legend: each line is a glyph, then =, then the exact text it stands for (JSON-quoted).\n\n' + legend
    + '\n\nDecode this message by replacing every glyph with its text, and write only the decoded message, exactly as it was:\n\n' + coded,
};

// the seed of one picture payload, from where it sits in the run (FNV-1a of a readable key)
export function seedOf(key) {
  let h = 0x811c9dc5;
  for (const ch of key) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
}
// the familiar-glyph alphabet B: 256 one-token kanji spread evenly across the priced range (fixed before any read)
export function alphabetB(alphabet, n) {
  const step = Math.floor(alphabet.length / n);
  return Array.from({ length: n }, (_, k) => alphabet[k * step]);
}

// ── the grade, from a record — the page, the README and CI all call this ──────────────────────────────────────────
export function grade(pre, run) {
  const t = run.text, j = run.json, p = run.picture, c = run.combined;
  const last = (xs) => xs[xs.length - 1];
  const bestText = Math.max(...p.textBaselines.map((b) => b.bitsPerToken));
  const arm = (a) => p.arms[a].best ? p.arms[a].best.bitsPerToken : 0;
  const bestPicture = Math.max(arm('A'), arm('B'), arm('C'));
  const climbs = t.curve.every((x, k) => k === 0 || x.ratio > t.curve[k - 1].ratio);
  const rules = [
    { id: 'text-15x', value: 'held-out agent messages ' + last(t.curve).ratio + '× with the grown dictionary held (' + last(t.curve).entries + ' glyphs)', pass: last(t.curve).ratio >= 15 },
    { id: 'text-climbs', value: t.curve.map((x) => x.entries + ': ' + x.ratio + '×').join(' → '), pass: climbs },
    { id: 'text-lossless', value: t.lossless.ok + ' of ' + t.lossless.n + ' held-out messages decode exactly', pass: t.lossless.ok === t.lossless.n },
    { id: 'claude-reads-tongue', value: t.readback.filter((r) => r.exact).length + ' of ' + t.readback.length + ' decoded exactly by Claude from the legend', pass: t.readback.filter((r) => r.exact).length >= 6 },
    { id: 'json-15x', value: 'held-out JSON ' + last(j.curve).ratio + '× with the shared schema held (' + last(j.curve).entries + ' glyphs)', pass: last(j.curve).ratio >= 15 },
    { id: 'json-lossless', value: j.lossless.ok + ' of ' + j.lossless.n + ' held-out files decode exactly', pass: j.lossless.ok === j.lossless.n },
    { id: 'picture-beats-text', value: 'best picture ' + bestPicture + ' bits/token vs best text ' + bestText, pass: bestPicture > bestText },
    { id: 'familiar-beats-dots', value: 'familiar glyphs ' + Math.max(arm('B'), arm('C')) + ' vs raw dots ' + arm('A') + ' bits/token', pass: Math.max(arm('B'), arm('C')) > arm('A') },
    { id: 'evolved-beats-familiar', value: 'evolved ' + arm('C') + ' vs familiar ' + arm('B') + ' bits/token', pass: arm('C') > arm('B') },
    { id: 'combined-15x', value: 'plain English ÷ picture of the coded message ' + c.ratio + '× at ≥' + pre.config.picture.bar * 100 + '% read-back', pass: c.ratio >= 15 },
    { id: 'reproducible', value: 'CI re-grades every read and re-derives every number from the record; the JSON channel is rebuilt from committed files', pass: run.verified === true },
  ];
  return { rules, passed: rules.filter((r) => r.pass).length, of: rules.length, bestText, bestPicture };
}

// the best size of an arm: the smallest where every held-out image read back at or above the bar
export function bestOf(reads, bar) {
  const sizes = [...new Set(reads.map((r) => r.size))];
  const ok = sizes.filter((s) => reads.filter((r) => r.size === s).every((r) => r.grade.rate >= bar));
  if (!ok.length) return null;
  const bpt = (s) => { const rs = reads.filter((r) => r.size === s); return Math.round((rs.reduce((a, r) => a + r.bits, 0) / rs.reduce((a, r) => a + r.imageTokens, 0)) * 100) / 100; };
  const best = ok.map((s) => ({ size: s, bitsPerToken: bpt(s) })).sort((a, b) => b.bitsPerToken - a.bitsPerToken)[0];
  return best;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/run.mjs')) {
  const sealed = spawnSync(process.execPath, [join(ROOT, 'tools/seal.mjs'), '--check'], { cwd: ROOT }).status === 0;
  if (!sealed) { console.error('not sealed, or the seal does not match its inputs — refusing'); process.exitCode = 1; }
  else if (has('--run')) await import('./run-phases.mjs').then((m) => m.runAll({ ROOT, PRIV, CONFIG, PROMPTS, seedOf, alphabetB, bestOf, grade }));
  else if (has('--verify')) await import('./run-phases.mjs').then((m) => m.verify({ ROOT, CONFIG, PROMPTS, seedOf, alphabetB, bestOf, grade }));
}
