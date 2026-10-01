#!/usr/bin/env node
// tools/price.mjs — the alphabet is decided by price. Every candidate glyph's cost in Claude tokens, counted by the
// official claude CLI on Simon's login (kar-mind tools/claude-count.mjs: the input tokens of a message minus those of
// the one-token message "x", plus one). Glue, local only; writes data/prices.json (public: glyphs and counts only).
//
//   candidates  seed      every non-ASCII grapheme of the v25 seed (the seed itself stays private; only its sha256)
//               light     LIGHT's opcodes, rings and buses (src/ops.js of the estate's fork, pinned)
//               cuneiform U+12000–U+12399, the Cuneiform block
//               kanji     U+4E00–U+51FF, the first 1,024 CJK unified ideographs
//               kana      hiragana U+3041–U+3096 and katakana U+30A1–U+30FA
//               kanji-wide U+5200–U+61FF, the next 4,096, in batches only (see below)
//   method      seed, light, cuneiform and kana one glyph per call; kanji in newline-separated batches of 16 — a batch whose
//               count is the least possible (every glyph 1 token, every newline 1 token) proves all 16 cost 1; any
//               other batch is priced one glyph per call. Newlines are additive (measured: "a\nb" = 3, "型\n数" = 3).
//   node tools/price.mjs [--jobs 6]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const SEED = 'C:/Users/sjgan/Downloads/v25-seed.md';
const LIGHT = 'C:/Users/sjgan/Downloads/light-fork';
const CACHE = 'C:/Users/sjgan/.si-didy/tongue/price-cache.json';
const OUT = new URL('../data/prices.json', import.meta.url);
const sha = (s) => createHash('sha256').update(s).digest('hex');
const jobs = Number((process.argv[process.argv.indexOf('--jobs') + 1]) || 6) || 6;

export function candidates() {
  const seedText = readFileSync(SEED, 'utf8');
  const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
  const seen = new Set(), seed = [];
  for (const { segment: s } of seg.segment(seedText)) if (!/^[\x00-\x7f]+$/.test(s) && !seen.has(s)) { seen.add(s); seed.push(s); }
  const ops = createRequire(import.meta.url)(LIGHT + '/src/ops.js');
  const light = [...Object.keys(ops.EMOJI_OPS), ...Object.keys(ops.RING_PRE), ...Object.keys(ops.BUS_GLY)];
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String.fromCodePoint(a + i));
  return {
    sources: { seed: { file: 'v25-seed.md (private)', sha256: sha(seedText) }, light: { repo: 'sjgant80-hub/smartstuffidontfullyget', file: 'src/ops.js', sha256: sha(readFileSync(LIGHT + '/src/ops.js', 'utf8')) } },
    seed, light, cuneiform: range(0x12000, 0x12399), kanji: range(0x4E00, 0x51FF), kana: [...range(0x3041, 0x3096), ...range(0x30A1, 0x30FA)], wide: range(0x5200, 0x61FF),
  };
}

async function main() {
  const { claudeCounter } = await import('file:///C:/Users/sjgan/kar-mind/tools/claude-count.mjs');
  mkdirSync('C:/Users/sjgan/.si-didy/tongue', { recursive: true });
  const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
  const c = await claudeCounter();
  let calls = 0, done = 0;
  const tokens = async (text) => {
    if (!(text in cache)) {
      calls += 1;
      cache[text] = (await c.count(text)) + 1;
      if (calls % 25 === 0) { writeFileSync(CACHE, JSON.stringify(cache)); process.stderr.write('  ' + calls + ' calls\n'); }
    }
    return cache[text];
  };
  const pool = async (items, fn) => {
    const out = new Array(items.length); let next = 0;
    await Promise.all(Array.from({ length: jobs }, async () => { while (next < items.length) { const k = next++; out[k] = await fn(items[k]); done += 1; } }));
    return out;
  };
  const C = candidates();
  const rows = [];
  for (const src of ['seed', 'light', 'cuneiform', 'kana']) {
    const costs = await pool(C[src], (g) => tokens(g));
    C[src].forEach((g, k) => rows.push({ g, source: src, cost: costs[k], how: 'single' }));
  }
  const batches = [];
  for (let k = 0; k < C.kanji.length; k += 16) batches.push(C.kanji.slice(k, k + 16));
  const sums = await pool(batches, (b) => tokens(b.join('\n')));
  const failed = [];
  batches.forEach((b, k) => { if (sums[k] === 2 * b.length - 1) b.forEach((g) => rows.push({ g, source: 'kanji', cost: 1, how: 'batch' })); else failed.push(...b); });
  const singles = await pool(failed, (g) => tokens(g));
  failed.forEach((g, k) => rows.push({ g, source: 'kanji', cost: singles[k], how: 'single' }));
  // the next 4,096 kanji, in batches only: a batch whose 16 glyphs cost at most 2 tokens each on average (count ≤ 3k − 1)
  // is admitted, every glyph in it written down as 2 — the price the dictionary plans with; what coded text really
  // costs is counted by the CLI regardless. Batches costing more are left out.
  const wide = [];
  for (let k = 0; k < C.wide.length; k += 16) wide.push(C.wide.slice(k, k + 16));
  const wsums = await pool(wide, (b) => tokens(b.join('\n')));
  wide.forEach((b, k) => { if (wsums[k] <= 3 * b.length - 1) b.forEach((g) => rows.push({ g, source: 'kanji-wide', cost: 2, how: 'batch, at most 2 on average' })); });
  writeFileSync(CACHE, JSON.stringify(cache));
  const order = { seed: 0, light: 1, cuneiform: 2, kanji: 3, kana: 4, 'kanji-wide': 5 };
  rows.sort((a, b) => order[a.source] - order[b.source] || a.g.codePointAt(0) - b.g.codePointAt(0) || (a.g < b.g ? -1 : 1));
  const tally = Object.fromEntries(Object.keys(order).map((s) => {
    const r = rows.filter((x) => x.source === s);
    const by = {}; for (const x of r) by[x.cost] = (by[x.cost] || 0) + 1;
    return [s, { n: r.length, byCost: by }];
  }));
  writeFileSync(OUT, JSON.stringify({ kind: 'konomi-tongue-prices', v: 1, model: c.base.model, login: c.base.login, baseline: c.base.total,
    method: 'cost = input tokens of the message minus those of "x", plus one; kanji in newline batches of 16 (least possible count proves every glyph 1 token), else one per call',
    sources: C.sources, tally, glyphs: rows.map((r) => ({ g: r.g, cp: [...r.g].map((ch) => 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' '), source: r.source, cost: r.cost, how: r.how })) }, null, 1) + '\n');
  console.log('priced ' + rows.length + ' glyphs in ' + calls + ' new calls · ' + JSON.stringify(tally));
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/price.mjs')) await main();
