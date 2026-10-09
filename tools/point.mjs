#!/usr/bin/env node
// tools/point.mjs — a STANDING-CURVE point for the 15× chase (glue, local only). Text channel only:
// regather the corpus (train = everything before the fixed CUTOFF, held = every agent message since),
// regrow the dictionary on train alone, encode the held messages, and count real Claude tokens with
// the same counter the sealed run used. No paid readback, no pictures, no seal claimed — this is the
// honest recurring measurement queue #14 asks for: "re-measure as the dictionary grows, on messages
// newer than the last cut." Private outputs only; the printed summary is the point.
//
//   node tools/point.mjs            gather, grow, measure, write ~/.si-didy/tongue/point-<date>.json
//
// If the fresh held window is larger than HELD_CAP characters it is SUBSAMPLED deterministically
// (seed 11, newest-first fill, stratified by sender) so token-counting stays affordable and points
// stay comparable in scale — and the point says so. An unlabelled subsample would be a lie.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import * as T from '../tongue.mjs';
import { gather, CUTOFF, OUT } from './corpus.mjs';
import { CONFIG } from './run.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const PRIV = 'C:/Users/sjgan/.si-didy/tongue';
const sha = (s) => createHash('sha256').update(s).digest('hex');
const log = (m) => process.stderr.write('  ' + m + '\n');
export const HELD_CAP = 80000;

// deterministic, stratified, newest-first subsample to the cap (seeded shuffle inside each sender)
export function capHeld(held, cap = HELD_CAP, seed = 11) {
  const total = held.reduce((a, m) => a + m.text.length, 0);
  if (total <= cap) return { held, subsampled: false, chars: total };
  const r = T.rng(seed);
  const bySender = {};
  for (const m of held) (bySender[m.from] = bySender[m.from] || []).push(m);
  const pools = Object.values(bySender).map((xs) => xs.slice().reverse());   // newest first
  for (const p of pools) for (let i = p.length - 1; i > 0; i--) { const j = T.draw(r, i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  const picked = []; let chars = 0, turn = 0;
  while (chars < cap && pools.some((p) => p.length)) {
    const p = pools[turn % pools.length]; turn++;
    if (!p.length) continue;
    const m = p.pop();
    if (chars + m.text.length > cap && picked.length) continue;
    picked.push(m); chars += m.text.length;
  }
  return { held: picked, subsampled: true, chars, of: total };
}

async function main() {
  // 1 · the fresh corpus, same time-split discipline: the dictionary never sees a held message
  const corpus = await gather();
  mkdirSync(PRIV, { recursive: true });
  writeFileSync(OUT, JSON.stringify(corpus));
  log('corpus: ' + JSON.stringify(corpus.counts));

  // 2 · the counters. The sealed run's Claude counter is probed FIRST and refused if degenerate —
  // the current claude CLI build reports zero usage in stream-json mode, and a counter that counts
  // nothing yields a perfect flat 1× (the same false-clean shape as a suite slower than its timeout).
  // The fallback is SOVEREIGN: qwen2.5:7b's prompt_eval_count via local Ollama, texts counted in
  // 6 KB chunks and summed (chunking is labelled; the bias is the same on both sides of a ratio).
  // The two are DIFFERENT tokenizers — a qwen point never silently extends the Claude-token curve.
  const cacheFile = PRIV + '/calls.json';
  const cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};
  const save = () => writeFileSync(cacheFile, JSON.stringify(cache));
  let tokens, tokenizer;
  try {
    const { claudeCounter } = await import('file:///C:/Users/sjgan/kar-mind/tools/claude-count.mjs');
    const counter = await claudeCounter(CONFIG.model);
    const probe = await counter.count('probe '.repeat(200));
    if (probe < 100) throw new Error('degenerate: 1200 chars counted as ' + probe + ' tokens — the CLI is not reporting usage');
    tokenizer = 'claude (' + CONFIG.model + ')';
    tokens = async (t) => { const k = 'count|' + sha(t); if (!(k in cache) || cache[k] <= 1) { cache[k] = (await counter.count(t)) + 1; save(); } return cache[k]; };
  } catch (e) {
    log('claude counter REFUSED (' + String(e.message || e).slice(0, 90) + ') — falling back to the sovereign qwen counter');
    tokenizer = 'qwen2.5:7b via local Ollama, 6KB-chunked (NOT comparable to the Claude-token points)';
    // per-CHUNK cache + retries: a laptop Ollama can stall mid-swap, and losing a half-counted
    // 80 KB text to one slow chunk would make every retry start from zero.
    const qchunk = async (chunk) => {
      const k = 'qc|' + sha(chunk);
      if (k in cache) return cache[k];
      let lastErr;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const r = await (await fetch('http://127.0.0.1:11434/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' },
            signal: AbortSignal.timeout(180000),
            body: JSON.stringify({ model: 'qwen2.5:7b', prompt: chunk, raw: true, stream: false, options: { num_predict: 1, num_ctx: 8192 } }) })).json();
          cache[k] = r.prompt_eval_count || 0; save();
          return cache[k];
        } catch (e) { lastErr = e; await new Promise((d) => setTimeout(d, 5000 * (attempt + 1))); }
      }
      throw lastErr;
    };
    const qcount = async (t) => {
      let total = 0;
      for (let i = 0; i < t.length; i += 6000) total += await qchunk(t.slice(i, i + 6000));
      if (total < t.length / 80) throw new Error('qwen counter degenerate too: ' + total + ' tokens for ' + t.length + ' chars');
      return total;
    };
    tokens = async (t) => { const k = 'qcount|' + sha(t); if (!(k in cache)) { cache[k] = await qcount(t); save(); } return cache[k]; };
  }

  // 3 · the alphabet and the dictionary, grown on train alone
  const prices = JSON.parse(readFileSync(join(ROOT, 'data/prices.json'), 'utf8'));
  const priceMap = new Map(prices.glyphs.map((p) => [p.g, p.cost]));
  const capped = capHeld(corpus.held);
  const heldTexts = capped.held.map((m) => m.text);
  const alphabet = T.alphabetFrom(prices.glyphs.filter((p) => ['kanji', 'kana', 'kanji-wide'].includes(p.source)), [...corpus.train, ...corpus.held.map((m) => m.text)], 2);
  log('alphabet ' + alphabet.length + ' glyphs · held ' + heldTexts.length + ' messages, ' + capped.chars + ' chars' + (capped.subsampled ? ' (SUBSAMPLED from ' + capped.of + ' — labelled)' : ''));
  const t0 = Date.now();
  const grown = T.grow(corpus.train, alphabet, CONFIG.text.rounds, CONFIG.text.batch, priceMap);
  const dict = T.dictionary(grown);
  log('grew ' + dict.length + ' glyphs in ' + Math.round((Date.now() - t0) / 1000) + ' s');

  // 4 · the curve on the fresh held window
  const plain = heldTexts.join('\n\n');
  const plainTokens = await tokens(plain);
  const points = [...new Set([...CONFIG.text.checkpoints.filter((n) => n < dict.length), dict.length])];
  const curve = [];
  for (const n of points) {
    const coded = heldTexts.map((m) => T.encode(m, dict, n)).join('\n\n');
    const c = await tokens(coded);
    curve.push({ entries: n, plainTokens, codedTokens: c, ratio: T.ratio(plainTokens, c), chars: [...coded].length });
    log('text ' + n + ' glyphs -> ' + T.ratio(plainTokens, c) + 'x');
  }
  const codedFull = heldTexts.map((m) => T.encode(m, dict));
  const lossless = { ok: heldTexts.filter((m, k) => T.decode(codedFull[k], dict) === m).length, n: heldTexts.length };
  log('lossless ' + lossless.ok + '/' + lossless.n);

  // 5 · the point, written privately; the summary is what gets quoted
  const point = {
    at: new Date().toISOString(), cutoff: CUTOFF, channel: 'text', counts: corpus.counts,
    held: { messages: heldTexts.length, chars: capped.chars, subsampled: capped.subsampled, ...(capped.subsampled ? { ofChars: capped.of, cap: HELD_CAP, seed: 11 } : {}) },
    dict: dict.length, tokenizer, curve, lossless,
    charRatio: Math.round((curve[0].chars / curve[curve.length - 1].chars) * 1000) / 1000,
    note: 'standing-curve point (queue #14): text channel only, no paid phases, no seal claimed',
  };
  const file = PRIV + '/point-' + point.at.slice(0, 10) + '.json';
  writeFileSync(file, JSON.stringify(point, null, 1));
  const best = curve.reduce((a, b) => (b.ratio > a.ratio ? b : a));
  console.log(JSON.stringify({ at: point.at.slice(0, 10), tokenizer, heldMessages: heldTexts.length, heldChars: capped.chars, subsampled: capped.subsampled, dict: dict.length, bestRatio: best.ratio, atEntries: best.entries, charRatio: point.charRatio, lossless: lossless.ok + '/' + lossless.n, file }));
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/point.mjs')) {
  await main();
}
