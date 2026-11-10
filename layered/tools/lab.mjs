// layered/tools/lab.mjs — one type's measurement, exactly as sealed (glue; deterministic: the same items give the same
// numbers, so the measurement and CI's --check run this same function). Node 25.7.0 (zstd in node:zlib).
//
//   measureType(key, context, held, light, say) → the type's numbers for the record
//     context: Uint8Array[] oldest first (the seed side) · held: [{ id, at, bytes }] in SHA-256 order
//     light: { encode, decode, primed } LIGHT v1 primed with its dictionary · say: a progress line
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import * as F from '../src/fold.mjs';
import { PAIRED, GROW } from '../src/verdict.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const COLD_MASKS = [1, 3, 5, 7, 9, 15];
const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193); return h >>> 0; };

/** the most recent whole items whose total is at most `cap`, oldest first */
export function recent(context, cap) {
  const out = [];
  let t = 0;
  for (let i = context.length - 1; i >= 0; i--) { if (t + context[i].length > cap) break; t += context[i].length; out.unshift(context[i]); }
  return out;
}
const concat = (list) => { let n = 0; for (const c of list) n += c.length; const u = new Uint8Array(n); let at = 0; for (const c of list) { u.set(c, at); at += c.length; } return u; };

export function measureType(key, context, held, light, say) {
  const log = typeof say === 'function' ? say : () => {};
  const raw = held.reduce((a, h) => a + h.bytes.length, 0), items = held.length;
  const cell = () => ({ frame: 0, checked: 0, identical: 0, median: 0, r: [] });
  const ladder = {}, alone = {}, grow = {};
  for (const m of [1, 3, 7, 15, 31]) ladder[m] = cell();
  for (const m of [5, 9, 17]) alone[m] = cell();
  for (const g of GROW) grow[g] = cell();
  const put = (c, item, frame, seed) => {
    c.frame += frame.length;
    const d = F.decode(frame, seed ? { seed } : {});
    c.checked++;
    if (d.ok && d.bytes.length === item.length && sha(d.bytes) === sha(item)) c.identical++;
    c.r.push(item.length / frame.length);
  };
  // the seeds: the whole seed side (full stack), it minus its most recent item (the drifted peer), D1 alone taught it,
  // and the smaller recent seeds for the grow curve
  const t0 = Date.now();
  const drift = F.seed(context.slice(0, -1), { mask: 15 }).seed;
  const full = F.fork(drift).seed;
  F.grow(full, context[context.length - 1] || new Uint8Array(0));
  const d1seed = F.seed(context, { mask: 1 }).seed;
  const growSeeds = {};
  for (const g of GROW) {
    const pick = recent(context, +g);
    growSeeds[g] = pick.length === context.length ? full : F.seed(pick, { mask: 15 }).seed;
    grow[g].seedBytes = pick.reduce((a, c) => a + c.length, 0);
  }
  log(key + ': seeds taught in ' + Math.round((Date.now() - t0) / 1000) + ' s (' + full.bytes + ' bytes, id ' + F.idOf(full) + ')');
  const ctxAll = concat(context), last32 = ctxAll.subarray(Math.max(0, ctxAll.length - 32768));
  const baselines = { gzip9: 0, brotli11: 0, zstd19: 0, deflateSeed: 0, zstdSeed: 0, lightV1: 0, lightV1Identical: 0 };
  const drifted = { refused: 0, other: 0, fallback: 0 }, corrupt = { tried: 0, refused: 0, exact: 0, other: 0 };
  let n = 0;
  for (const h of held) {
    const b = h.bytes;
    const fr = {};
    for (const m of COLD_MASKS) { fr[m] = F.encode(b, { mask: m }).bytes; put(m === 5 || m === 9 ? alone[m] : ladder[m], b, fr[m], null); }
    fr[31] = F.encode(b, { seed: full }).bytes; put(ladder[31], b, fr[31], full);
    const f17 = F.encode(b, { mask: 17, seed: d1seed }).bytes; put(alone[17], b, f17, d1seed);
    for (const g of GROW) { const s = growSeeds[g]; if (s === full) { grow[g].frame += fr[31].length; grow[g].checked++; grow[g].identical = ladder[31].identical; grow[g].r.push(b.length / fr[31].length); } else put(grow[g], b, F.encode(b, { seed: s }).bytes, s); }
    // the standard coders, alone and given the same seed
    const buf = Buffer.from(b);
    baselines.gzip9 += zlib.gzipSync(buf, { level: 9 }).length;
    baselines.brotli11 += zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length } }).length;
    baselines.zstd19 += zlib.zstdCompressSync(buf, { params: { [zlib.constants.ZSTD_c_compressionLevel]: 19 } }).length;
    baselines.deflateSeed += zlib.deflateRawSync(buf, { level: 9, dictionary: Buffer.from(last32) }).length;
    baselines.zstdSeed += zlib.zstdCompressSync(buf, { params: { [zlib.constants.ZSTD_c_compressionLevel]: 19 }, dictionary: Buffer.from(ctxAll) }).length;
    const lv = light.encode(b, light.primed);
    baselines.lightV1 += lv.bytes.length;
    const ld = light.decode(lv.bytes, light.primed);
    if (ld.ok && sha(ld.bytes) === sha(b)) baselines.lightV1Identical++;
    // drift: the peer's seed lacks the newest item — refused; the sender falls back; the fallback decodes
    const dd = F.decode(fr[31], { seed: drift });
    if (!dd.ok) drifted.refused++; else if (sha(dd.bytes) !== sha(b)) drifted.other++;
    const mask = F.negotiate(full, F.idOf(drift)), fb = F.decode(fr[mask], { seed: drift });
    if (fb.ok && sha(fb.bytes) === sha(b)) drifted.fallback++;
    // one changed byte, at a place fixed by the item's id
    const c = fr[31].slice(), pos = fnv(h.id) % c.length; c[pos] ^= 0x5a;
    const cd = F.decode(c, { seed: full, max: b.length * 2 + 1024 });
    corrupt.tried++;
    if (!cd.ok) corrupt.refused++; else if (sha(cd.bytes) === sha(b)) corrupt.exact++; else corrupt.other++;
    if (++n % 50 === 0) log(key + ': ' + n + '/' + items + ' items');
  }
  const fin = (c) => { const r = c.r.sort((a, b) => a - b); c.median = r.length ? Math.round(r[Math.floor((r.length - 1) / 2)] * 1000) / 1000 : 0; delete c.r; return c; };
  for (const g of [ladder, alone, grow]) for (const k of Object.keys(g)) fin(g[k]);
  const out = { key, raw, items, seedBytes: full.bytes, seedId: F.idOf(full), ladder, alone, grow, baselines, drift: drifted, corrupt };
  // level 4: the pair. Two nodes start with nothing shared; each item, in time order, is coded against A's seed,
  // decoded with B's, then both grow with it
  if (PAIRED.includes(key)) {
    const order = [...held].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1));
    const A = F.seed([], { mask: 15 }).seed, B = F.seed([], { mask: 15 }).seed;
    const third = Math.floor(order.length / 3), parts = [[0, 0], [0, 0], [0, 0]];
    let identical = 0;
    for (let i = 0; i < order.length; i++) {
      const b = order[i].bytes, f = F.encode(b, { seed: A }).bytes, d = F.decode(f, { seed: B });
      if (d.ok && sha(d.bytes) === sha(b)) identical++;
      const p = i < third ? 0 : i >= order.length - third ? 2 : 1;
      parts[p][0] += b.length; parts[p][1] += f.length;
      F.grow(A, b); F.grow(B, d.ok ? d.bytes : b);
    }
    const rr = ([r, f]) => (f > 0 ? Math.round((r / f) * 1000) / 1000 : 0);
    out.pair = { items: order.length, third, first: rr(parts[0]), middle: rr(parts[1]), last: rr(parts[2]), firstBytes: parts[0], lastBytes: parts[2],
      identical, coldOk: ladder[15].identical, sharedAtEnd: A.bytes, sameId: F.idOf(A) === F.idOf(B) };
    log(key + ': pair ' + out.pair.first + ' → ' + out.pair.last);
  }
  return out;
}
