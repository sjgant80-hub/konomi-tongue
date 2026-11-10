// layered/test/fold.test.mjs — the codec kernel's gate: every layer set round-trips, every frame is pinned (so a
// change to any prediction is caught even though encoder and decoder would still agree), every refusal says why,
// the seed's id chain, fork and negotiation behave, and nothing a frame carries can decode into other bytes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as F from '../src/fold.mjs';
import { FIX } from './fixtures.mjs';
import { sha256, hex } from '../../light/sha256.mjs';

const GOLDEN = JSON.parse(readFileSync(new URL('./golden.json', import.meta.url), 'utf8'));
const g = (u) => hex(sha256(u)).slice(0, 16);
const same = (a, b) => a.length === b.length && g(a) === g(b);
const w = (r) => (r.ok ? 'ok' : r.why);
const COLDS = [1, 3, 5, 7, 9, 15];

test('every cold layer set round-trips every fixture, and every frame is the pinned one', () => {
  for (const [k, v] of Object.entries(FIX)) for (const m of COLDS) {
    const e = F.encode(v, { mask: m, bits: 16 });
    assert.equal(e.ok, true);
    assert.equal(g(e.bytes) + ':' + e.bytes.length, GOLDEN[k][m], k + ' at ' + F.label(m));
    const d = F.decode(e.bytes);
    assert.equal(d.ok, true); assert.equal(d.mask, m); assert.ok(same(d.bytes, v), k + ' at ' + F.label(m));
  }
});

test('the ladder climbs on structured fixtures: each layer adds to the one below', () => {
  for (const k of ['records', 'log', 'prose']) {
    const r = COLDS.map((m) => FIX[k].length / +GOLDEN[k][m].split(':')[1]);
    assert.ok(r[0] < r[1] && r[1] < r[3] && r[3] < r[5], k + ' ' + r.map((x) => x.toFixed(2)).join(' '));
  }
  assert.ok(FIX.records.length / +GOLDEN.records[15].split(':')[1] > 9, 'records cold full above 9x');
  assert.ok(FIX.records.length / +GOLDEN.records[1].split(':')[1] < 2, 'the flat layer stays below 2x');
});

test('a seed: frames pinned, the id chain fixed, the whisper beats the cold frame, and the seed is not changed', () => {
  const half = FIX.records.subarray(0, 2000), rest = FIX.records.subarray(2000);
  const a = F.seed([half, FIX.log], { bits: 16 }), b = F.seed([half, FIX.log], { mask: 1, bits: 16 });
  assert.equal(a.ok, true); assert.equal(b.ok, true);
  const s31 = a.seed, s17 = b.seed;
  assert.equal(F.idOf(s31), GOLDEN.seeded.id31); assert.equal(F.idOf(s17), GOLDEN.seeded.id17);
  assert.equal(s31.mask, 31); assert.equal(s17.mask, 17); assert.equal(s31.bytes, 3900); assert.equal(s31.bits, 16);
  const snap = () => g(new Uint8Array(s31.model.P.buffer)) + g(s31.model.buf) + g(new Uint8Array(s31.model.A.buffer)) + g(new Uint8Array(s31.model.W.buffer))
    + g(new Uint8Array(s31.model.ht.buffer)) + g(new Uint8Array(s31.model.fk.buffer)) + g(new Uint8Array(s31.model.st.buffer)) + s31.model.len + ':' + s31.model.mptr;
  const before = snap();
  for (const [k, v] of [['rest', rest], ['prose', FIX.prose], ['log', FIX.log]]) {
    const x = F.encode(v, { seed: s31, bits: 20 }), y = F.encode(v, { mask: 17, seed: s17 });
    assert.equal(g(x.bytes) + ':' + x.bytes.length, GOLDEN.seeded[k + '31'], k + ' full');
    assert.equal(g(y.bytes) + ':' + y.bytes.length, GOLDEN.seeded[k + '17'], k + ' D1+D5');
    assert.equal(x.bytes[2], 16, "a seeded frame carries the seed's table size");
    const dx = F.decode(x.bytes, { seed: s31 }), dy = F.decode(y.bytes, { seed: s17 });
    assert.ok(dx.ok && same(dx.bytes, v)); assert.ok(dy.ok && same(dy.bytes, v));
    assert.equal(g(F.encode(v, { seed: s31 }).bytes), g(x.bytes), 'the same frame twice');
  }
  assert.equal(snap(), before, 'encode and decode never change the seed');
  const cold = F.encode(FIX.log, { mask: 15, bits: 16 }).bytes.length, warm = F.encode(FIX.log, { seed: s31 }).bytes.length;
  assert.ok(warm * 4 < cold, 'a seed that holds the log whispers it: ' + warm + ' vs ' + cold);
});

test('the model is exactly the sizes it says', () => {
  const s = F.seed([FIX.prose, FIX.one], { bits: 16 }).seed, m = s.model;
  assert.equal(m.P.length, (1 << 16) + 384); assert.equal(m.ht.length, 1 << 14); assert.equal(m.fk.length, 4096);
  assert.equal(m.A.length, 65536 * 33); assert.equal(m.W.length, 1024 * 13); assert.equal(m.st.length, 16);
  assert.equal(m.buf.length, FIX.prose.length + 1); assert.equal(m.len, FIX.prose.length + 1);
  assert.equal(F.grow(s, FIX.log).ok, true);
  assert.equal(s.model.buf.length, FIX.prose.length + 1 + FIX.log.length); assert.equal(s.bytes, FIX.prose.length + 1 + FIX.log.length);
  assert.equal(s.model.len, s.bytes);
  assert.equal(F.seed([], { bits: 17 }).seed.model.P.length, (1 << 17) + 384);
  assert.equal(F.seed(undefined, { bits: 16 }).seed.bytes, 0);
  assert.equal(F.seed(FIX.one, { bits: 16 }).seed.bytes, 1);
  assert.equal(F.seed([FIX.one]).seed.bits, 22);
});

test('grow is the chain: a seed grown with b equals the seed taught [a, b]; one taught a+b as one chunk is another id', () => {
  const a = FIX.prose.subarray(0, 1500), b = FIX.prose.subarray(1500);
  const one = F.seed([a, b], { bits: 16 }).seed, two = F.seed([a], { bits: 16 }).seed;
  const r = F.grow(two, b);
  assert.equal(r.ok, true); assert.equal(r.id, F.idOf(one)); assert.equal(F.idOf(two), F.idOf(one));
  const e1 = F.encode(FIX.log, { seed: one }), e2 = F.encode(FIX.log, { seed: two });
  assert.equal(g(e1.bytes), g(e2.bytes));
  const flat = F.seed([FIX.prose], { bits: 16 }).seed;
  assert.notEqual(F.idOf(flat), F.idOf(one));
  const e3 = F.encode(FIX.log, { seed: flat });
  assert.equal(g(e3.bytes.subarray(7)), g(e1.bytes.subarray(7)), 'the same model: only the id differs');
  assert.match(F.decode(e1.bytes, { seed: flat }).why, /^this frame needs seed [0-9a-f]{8}; this end holds [0-9a-f]{8}$/);
});

test('drift: a forked seed that grew apart is refused, the sender falls back, the cold frame decodes', () => {
  const base = F.seed([FIX.records.subarray(0, 3000)], { bits: 16 }).seed;
  const f = F.fork(base);
  assert.equal(f.ok, true); assert.equal(F.idOf(f.seed), F.idOf(base)); assert.equal(f.seed.bytes, 3000);
  assert.equal(g(F.encode(FIX.log, { seed: f.seed }).bytes), g(F.encode(FIX.log, { seed: base }).bytes), 'a fork is the same seed');
  F.grow(f.seed, FIX.log);
  assert.notEqual(F.idOf(f.seed), F.idOf(base));
  assert.equal(F.idOf(base), F.idOf(F.seed([FIX.records.subarray(0, 3000)], { bits: 16 }).seed), 'the original did not move');
  assert.equal(base.model.len, 3000);
  const whisper = F.encode(FIX.records.subarray(3000), { seed: f.seed });
  const r = F.decode(whisper.bytes, { seed: base });
  assert.equal(r.ok, false); assert.equal(r.bytes, undefined);
  const mask = F.negotiate(f.seed, F.idOf(base));
  assert.equal(mask, 15);
  const cold = F.encode(FIX.records.subarray(3000), { mask, bits: 16 }), d = F.decode(cold.bytes, { seed: base });
  assert.ok(d.ok && same(d.bytes, FIX.records.subarray(3000)), 'the cold frame decodes whatever the seed');
  assert.equal(F.negotiate(base, F.idOf(base)), 31);
  assert.equal(F.negotiate(F.seed([], { mask: 7, bits: 16 }).seed, 'nope'), 7);
  assert.equal(F.negotiate(null, 'x'), 15); assert.equal(F.negotiate(base, 7), 15);
  assert.equal(F.fork(null).ok, false);
});

test('a changed byte anywhere in a frame is refused or decodes to exactly the original, never to other bytes', () => {
  const sd = F.seed([FIX.log], { bits: 16 }).seed;
  for (const [frame, opts] of [[F.encode(FIX.log, { mask: 15, bits: 16 }).bytes, {}], [F.encode(FIX.records.subarray(0, 900), { seed: sd }).bytes, { seed: sd }]]) {
    const truth = F.decode(frame, opts).bytes;
    let refused = 0;
    for (let i = 0; i < frame.length; i += Math.max(1, Math.floor(frame.length / 24))) {
      for (const flip of [1, 128]) {
        const c = frame.slice(); c[i] ^= flip;
        const d = F.decode(c, { ...opts, max: 1 << 16 });
        if (d.ok) assert.ok(same(d.bytes, truth), 'byte ' + i); else refused++;
      }
    }
    assert.ok(refused > 20, 'refused ' + refused);
  }
});

test('refusals: junk in is a reason, never a throw', () => {
  assert.equal(w(F.encode('x')), 'not bytes');
  assert.equal(w(F.encode(new Uint8Array(F.MAX_BYTES + 1))), 'more than 67108864 bytes');
  for (const mask of [0, 2, 32, 1.5, '3', -1]) assert.equal(w(F.encode(FIX.one, { mask })), 'mask is 1..31 with D1 on');
  for (const bits of [15, 25, 16.5, '16']) assert.equal(w(F.encode(FIX.one, { mask: 1, bits })), 'bits is 16..24');
  assert.equal(w(F.encode(FIX.one, { mask: 31 })), 'a D5 frame needs the shared seed');
  const s17 = F.seed([FIX.one], { mask: 1, bits: 16 }).seed;
  assert.equal(w(F.encode(FIX.one, { mask: 31, seed: s17 })), 'the seed was taught with another mask');
  assert.equal(w(F.encode(FIX.one, { seed: s17 })), 'the seed was taught with another mask', 'a seed given means the full stack');
  assert.equal(F.encode(FIX.one, null).ok, true); assert.equal(F.encode(FIX.one, 5).ok, true);
  assert.equal(F.encode(FIX.one).bytes[1], 15); assert.equal(F.encode(FIX.one).bytes[2], 18);
  assert.equal(F.encode(FIX.one, { mask: 17, seed: s17 }).bytes[1], 17);
  assert.equal(w(F.seed('x')), 'chunks are a Uint8Array or an array of them');
  assert.equal(w(F.seed([FIX.one, 'x'])), 'chunks are a Uint8Array or an array of them');
  assert.equal(w(F.seed([FIX.one], { mask: 2 })), 'mask is 1..31 with D1 on');
  assert.equal(w(F.seed([FIX.one], { mask: 1.5 })), 'mask is 1..31 with D1 on');
  assert.equal(w(F.seed([FIX.one], { bits: 25 })), 'bits is 16..24');
  assert.equal(w(F.seed([new Uint8Array(F.MAX_BYTES), FIX.one])), 'a seed holds at most 67108864 bytes');
  assert.equal(F.seed([FIX.one], 7).ok, true); assert.equal(F.seed([FIX.one], 7).seed.mask, 31);
  const s = F.seed([FIX.one], { bits: 16 }).seed;
  assert.equal(w(F.grow({}, FIX.one)), 'not a seed'); assert.equal(w(F.grow(s, 'x')), 'not bytes');
  s.bytes = F.MAX_BYTES; assert.equal(w(F.grow(s, FIX.one)), 'a seed holds at most 67108864 bytes');
  s.bytes = F.MAX_BYTES - 1; assert.equal(w(F.grow(s, FIX.one)), 'ok');
  assert.equal(F.idOf({}), null); assert.equal(F.idOf(null), null);
  assert.equal(F.idOf({ kind: 'fold.seed', model: { P: new Uint16Array(1) }, id: new Uint8Array(4) }), null);
  assert.equal(F.idOf({ kind: 'fold.seed', model: { P: new Uint32Array(1) }, id: [1, 2, 3, 4] }), null);
  assert.equal(F.idOf({ kind: 'seed', model: { P: new Uint32Array(1) }, id: new Uint8Array(4) }), null);
  assert.equal(F.idOf({ kind: 'fold.seed', model: null, id: new Uint8Array(4) }), null);
  assert.equal(F.idOf({ kind: 'fold.seed', model: { P: new Uint32Array(1) }, id: Uint8Array.of(1, 2, 3, 4, 5) }), '01020304');
});

test('decode and peek: every malformed header is named', () => {
  const good = F.encode(FIX.prose, { mask: 7, bits: 16 }).bytes;
  assert.equal(w(F.decode('x')), 'not bytes'); assert.equal(w(F.peek(5)), 'not bytes');
  assert.equal(w(F.decode(good.subarray(0, 2))), 'not a layered LIGHT frame');
  assert.equal(w(F.decode(good.subarray(0, 3))), 'no length');
  const bad = (i, v) => { const c = good.slice(); c[i] = v; return c; };
  assert.equal(w(F.decode(bad(0, 0xf0))), 'not a layered LIGHT frame');
  for (const m of [0, 2, 32]) assert.equal(w(F.decode(bad(1, m))), 'mask is 1..31 with D1 on');
  for (const b of [15, 25]) assert.equal(w(F.decode(bad(2, b))), 'bits is 16..24');
  assert.equal(w(F.decode(Uint8Array.of(0xf1, 31, 16, 1, 2, 3))), 'no seed id');
  assert.equal(w(F.decode(Uint8Array.of(0xf1, 31, 16, 1, 2, 3, 4))), 'no length');
  assert.equal(w(F.decode(Uint8Array.of(0xf1, 1, 16, 128, 128, 128, 128, 128, 1, 0, 0, 0, 0))), 'no length');
  assert.equal(w(F.decode(Uint8Array.of(0xf1, 1, 16, 128, 128, 128, 128, 1, 0, 0, 0, 0))), 'more than 67108864 bytes');
  assert.equal(w(F.decode(Uint8Array.of(0xf1, 1, 16, 129, 128, 128, 32, 0, 0, 0, 0), { max: 1 << 30 })), 'more than 67108864 bytes');
  assert.equal(w(F.decode(Uint8Array.of(0xf1, 1, 16, 3, 1, 2, 3))), 'no check');
  assert.equal(w(F.decode(Uint8Array.of(0xf1, 1, 16, 3, 1, 2, 3, 4))), 'the check does not match: another seed, or the frame was changed');
  const p = F.peek(good);
  assert.deepEqual([p.ok, p.mask, p.bits, p.id, p.n, p.at], [true, 7, 16, null, FIX.prose.length, 5]);
  const sd = F.seed([FIX.log], { bits: 16 }).seed, wf = F.encode(FIX.one, { seed: sd }).bytes, pw = F.peek(wf);
  assert.deepEqual([pw.mask, pw.bits, pw.id, pw.n, pw.at], [31, 16, F.idOf(sd), 1, 8]);
  assert.equal(w(F.decode(wf)), 'this frame needs the shared seed ' + F.idOf(sd));
  assert.equal(w(F.decode(wf, { seed: {} })), 'this frame needs the shared seed ' + F.idOf(sd));
  const other = F.seed([FIX.log], { bits: 17 }).seed, otherMask = F.seed([FIX.log], { mask: 15, bits: 16 }).seed;
  otherMask.mask = 15;
  assert.equal(w(F.decode(wf, { seed: other })), 'the seed was taught with another mask or table size');
  assert.equal(w(F.decode(wf, { seed: otherMask })), 'the seed was taught with another mask or table size');
  assert.equal(w(F.decode(good, { max: FIX.prose.length - 1 })), 'more than ' + (FIX.prose.length - 1) + ' bytes');
  assert.equal(w(F.decode(good, { max: FIX.prose.length })), 'ok');
  assert.equal(w(F.decode(good, { max: -1 })), 'ok'); assert.equal(w(F.decode(good, { max: 1.5 })), 'ok');
  assert.equal(w(F.decode(good, 'x')), 'ok');
  const e0 = F.encode(FIX.empty, { mask: 1, bits: 16 }).bytes;
  assert.equal(w(F.decode(e0, { max: 0 })), 'ok'); assert.equal(w(F.decode(F.encode(FIX.one, { mask: 1, bits: 16 }).bytes, { max: 0 })), 'more than 0 bytes');
  assert.equal(w(F.decode(e0.subarray(0, e0.length - 1))), 'ok', 'an empty frame needs no code byte');
  const flipped = good.slice(); flipped[good.length - 3] ^= 0x55;
  assert.equal(w(F.decode(flipped)), 'the check does not match: another seed, or the frame was changed');
});

test('the edges: a code value exactly on a split decodes as the encoder meant; the largest table; exactly the size limit', () => {
  // a fresh D1 model's first split is at 0x7fefffff: on it the bit is 1 (x <= mid), one above it 0
  const one = (code) => { for (let c = 0; c < 256; c++) { const k = sha256(Uint8Array.of(c)).subarray(0, 4); if (F.decode(Uint8Array.of(0xf1, 1, 16, 1, k[0], k[1], k[2], k[3], ...code)).ok) return c; } return -1; };
  assert.equal(one([0x7f, 0xef, 0xff, 0xff]), 128);
  assert.equal(one([0x7f, 0xf0, 0x00, 0x00]), 127);
  const big = F.encode(FIX.one, { mask: 1, bits: 24 });
  assert.equal(big.bytes[2], 24); assert.ok(same(F.decode(big.bytes).bytes, FIX.one));
  // exactly MAX_BYTES passes the size check (and is then refused for its mask, so nothing is coded); one more does not
  assert.equal(w(F.encode(new Uint8Array(F.MAX_BYTES), { mask: 0 })), 'mask is 1..31 with D1 on');
  assert.equal(w(F.seed([new Uint8Array(F.MAX_BYTES)], { mask: 0 })), 'mask is 1..31 with D1 on');
  assert.equal(w(F.seed([new Uint8Array(F.MAX_BYTES), FIX.one], { mask: 0 })), 'a seed holds at most 67108864 bytes');
});

test('the integer logistic, its inverse, the cold table sizes and the labels', () => {
  assert.deepEqual([F.squash(0), F.squash(-2047), F.squash(2047), F.squash(5000), F.squash(-5000), F.squash(NaN), F.squash('x'), F.squash(1.7), F.squash(-1)],
    [2047, 1, 4094, 4094, 1, 2047, 2047, 2051, 2043]);
  assert.deepEqual([F.squash(1), F.squash(127), F.squash(128), F.squash(129), F.squash(-128), F.squash(1000), F.squash(300)], [2051, 2545, 2549, 2552, 1546, 4013, 3116]);
  assert.deepEqual([F.stretch(0), F.stretch(1), F.stretch(2047), F.stretch(2048), F.stretch(4094), F.stretch(4095), F.stretch(1000)], [-2047, -2047, 0, 1, 1984, 2047, -292]);
  for (let p = 1; p < 4095; p += 37) assert.ok(Math.abs(F.squash(F.stretch(p)) - p) <= 4, 'p ' + p);
  assert.deepEqual([F.coldBits(0), F.coldBits(512), F.coldBits(513), F.coldBits(2048), F.coldBits(2049), F.coldBits(1e6)], [18, 18, 19, 20, 21, 22]);
  assert.deepEqual([F.label(1), F.label(5), F.label(31), F.label(0), F.label(2), F.label(32)], ['D1', 'D1+D3', 'D1+D2+D3+D4+D5', null, null, null]);
  assert.deepEqual([F.D1, F.D2, F.D3, F.D4, F.D5, F.COLD, F.FULL, F.MAGIC, F.MIN_BITS, F.MAX_BITS, F.BITS, F.NIN, F.MAX_BYTES], [1, 2, 4, 8, 16, 15, 31, 0xf1, 16, 24, 22, 13, 67108864]);
  assert.deepEqual([...F.LADDER], [1, 3, 7, 15, 31]); assert.deepEqual([...F.NAMES], ['symbol', 'token', 'structure', 'prediction', 'context']);
});
