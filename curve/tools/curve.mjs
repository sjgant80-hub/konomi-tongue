#!/usr/bin/env node
// curve/tools/curve.mjs — the 15x curve (glue, local only). Snapshots the private corpus, then measures every complete
// weekly window that is not yet recorded: line A (the tongue's dictionary, grown on train), line B (held reference),
// line C (LIGHT's codec, bytes) and gzip-9 beside it, every coding checked lossless, tokens counted by the local model's
// own tokenizer (curve/src/qwentok.mjs, K3). Writes curve/data/curve.json — numbers, dates, fixed labels and hashes only
// (K9). Recorded points are never rewritten; each names the snapshot it was measured on.
//
//   node curve/tools/curve.mjs            snapshot, measure the new complete windows, write curve.json
//   node curve/tools/curve.mjs --check    re-derive every recorded point from its snapshot (on this laptop), byte for byte
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import * as T from '../../tongue.mjs';
import { prime, encode as lightEncode, decode as lightDecode } from '../../light/codec.mjs';
import { collect } from '../../tools/corpus.mjs';
import { CONFIG } from '../../tools/run.mjs';
import Q from '../src/qwentok.mjs';
import C from '../src/curve.mjs';

const ROOT = new URL('../../', import.meta.url);
const PRIV = 'C:/Users/sjgan/.si-didy/tongue/curve';
const OUT = new URL('curve/data/curve.json', ROOT);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const log = (m) => process.stderr.write('  ' + m + '\n');
const utf8 = (s) => new TextEncoder().encode(s);

const ANCHORS = C.ANCHORS, FIXED = C.fixedStrings();

const tok = Q.tokenizer(Q.mergesOf(read('curve/data/qwen2.5-merges.txt')));
const tokens = (texts) => texts.reduce((n, t) => n + tok.count(t), 0);
const prices = JSON.parse(read('data/prices.json'));
const priceMap = new Map(prices.glyphs.map((p) => [p.g, p.cost]));
const kanji = prices.glyphs.filter((p) => ['kanji', 'kana', 'kanji-wide'].includes(p.source));
const lightDict = new Uint8Array(readFileSync(new URL('light/dict/v1.txt', ROOT)));
const primed = prime(lightDict);

/** one point: every line on one window of one snapshot */
export function measure(snap, w) {
  const s = C.split(snap.messages, snap.memory, w), held = s.held.map((m) => m.text);
  if (!s.check.inside) throw new Error('K2 broken for window ' + w.start);
  const plain = tokens(held);
  // A · the tongue's dictionary, grown on train alone. The alphabet leaves out every glyph the window's own text uses,
  // so a code can never be confused with a character the message really contains (that is what makes it lossless).
  const t0 = Date.now(), alphabet = T.alphabetFrom(kanji, [...s.train, ...held], 2);
  const dict = T.dictionary(T.grow(s.train, alphabet, CONFIG.text.rounds, CONFIG.text.batch, priceMap));
  const codedA = held.map((m) => T.encode(m, dict));
  const A = { ratio: C.ratio(plain, tokens(codedA)), tokens: tokens(codedA), glyphs: dict.length, lossless: held.filter((m, k) => T.decode(codedA[k], dict) === m).length };
  log('A ' + A.ratio + 'x with ' + A.glyphs + ' glyphs (' + Math.round((Date.now() - t0) / 1000) + ' s)');
  // B · held reference: lines the reader already holds go as a reference
  const idx = C.heldIndex(s.train), codedB = held.map((m) => C.refEncode(m, idx));
  const refs = codedB.reduce((n, t) => n + t.split('\n').filter((l) => l.startsWith(C.MARK) && !l.startsWith(C.MARK + C.MARK)).length, 0);
  const B = { ratio: C.ratio(plain, tokens(codedB)), tokens: tokens(codedB), heldLines: idx.list.length, referenced: refs, lossless: held.filter((m, k) => C.refDecode(codedB[k], idx) === m).length };
  log('B ' + B.ratio + 'x, ' + refs + ' lines referenced');
  // C · LIGHT, each message on its own, with LIGHT's committed dictionary; gzip-9 per message beside it
  let raw = 0, coded = 0, zipped = 0, okC = 0;
  for (const m of held) {
    const b = utf8(m), e = lightEncode(b, primed);
    if (!e.ok) throw new Error('LIGHT refused a message: ' + e.why);
    const d = lightDecode(e.bytes, primed);
    raw += b.length; coded += e.bytes.length; zipped += gzipSync(b, { level: 9 }).length;
    if (d.ok && Buffer.from(d.bytes).equals(Buffer.from(b))) okC++;
  }
  const Cl = { ratio: C.ratio(raw, coded), bytes: coded, lossless: okC };
  log('C ' + Cl.ratio + 'x bytes; gzip ' + C.ratio(raw, zipped) + 'x');
  return {
    window: w, snapshot: snap.sha256,
    held: { messages: held.length, chars: held.reduce((n, m) => n + m.length, 0), tokens: plain, bytes: raw },
    train: { texts: s.train.length, chars: s.train.reduce((n, t) => n + t.length, 0) }, split: s.check,
    A, B, C: Cl, gzip: { ratio: C.ratio(raw, zipped), bytes: zipped },
  };
}

function publicFile(points) {
  return {
    claims: 'curve/CLAIMS.md', start: C.START, days: C.DAYS,
    unit: { tokens: 'qwen2.5:7b tokens (local tokenizer)', light: 'bytes' },
    lines: { A: 'tongue dictionary', B: 'held reference', C: 'LIGHT codec', gzip: 'gzip-9 per message' },
    tokenizer: { mergesSha256: sha(read('curve/data/qwen2.5-merges.txt')), verify: (({ equal, of }) => ({ equal, of }))(JSON.parse(read('curve/data/tokverify.json'))) },
    anchors: ANCHORS, points, verdicts: C.verdicts(points),
  };
}
const text = (o) => JSON.stringify(o, null, 1) + '\n';

/** K9 at write time: every string in the public file is a fixed label written by this code, or a date, hash, claim id or
 *  count. No message text can reach it, because nothing taken from a message is ever a string in it (only counts are). */
function assertPrivate(file) {
  const stray = C.strayStrings(file, FIXED);
  if (stray.length) throw new Error('K9: the public file would hold ' + stray.length + ' unlisted strings');
}

const snapFile = (h) => PRIV + '/snapshot-' + h.slice(0, 16) + '.json';
if (process.argv.includes('--check')) {
  const want = read('curve/data/curve.json'), rec = JSON.parse(want), snaps = new Map();
  const points = rec.points.map((p) => {
    if (!snaps.has(p.snapshot)) {
      const f = snapFile(p.snapshot);
      if (!existsSync(f)) throw new Error('snapshot ' + p.snapshot.slice(0, 16) + ' is not on this machine: --check runs where the private corpus lives');
      const body = readFileSync(f, 'utf8');
      if (sha(body) !== p.snapshot) throw new Error('snapshot ' + p.snapshot.slice(0, 16) + ' changed');
      snaps.set(p.snapshot, { ...JSON.parse(body), sha256: p.snapshot });
    }
    return measure(snaps.get(p.snapshot), p.window);
  });
  const same = text(publicFile(points)) === want;
  console.log(same ? 'CURVE REPRODUCED · ' + points.length + ' points' : 'CURVE DIFFERS');
  process.exit(same ? 0 : 1);
}

mkdirSync(PRIV, { recursive: true });
const { messages, memory } = await collect();
const asOf = new Date().toISOString();
const body = JSON.stringify({ asOf, messages: messages.map((m) => ({ at: m.at, from: m.from, text: m.text })), memory: memory.map((m) => ({ at: m.at, text: m.text })) });
const snap = { ...JSON.parse(body), sha256: sha(body) };
writeFileSync(snapFile(snap.sha256), body);
log('snapshot ' + snap.sha256.slice(0, 16) + ': ' + messages.length + ' messages, ' + memory.length + ' memory files, as of ' + asOf);
const prior = existsSync(OUT) ? JSON.parse(read('curve/data/curve.json')).points : [];
const done = new Set(prior.map((p) => p.window.start));
const fresh = C.windows(C.START, C.DAYS, asOf).filter((w) => !done.has(w.start));
log(prior.length + ' points recorded; measuring ' + fresh.length + ' new window(s)');
const points = [...prior];
for (const w of fresh) { log('window ' + w.start.slice(0, 10) + ' → ' + w.end.slice(0, 10)); points.push(measure(snap, w)); }
const file = publicFile(points);
assertPrivate(file);
writeFileSync(OUT, text(file));
for (const v of file.verdicts) console.log((v.pass ? '  held   ' : '  FAILED ') + v.id + ' · ' + v.what + ' · ' + JSON.stringify(v.measured) + ' (bar ' + v.bar + ')');
