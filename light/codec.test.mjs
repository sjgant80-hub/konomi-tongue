import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { encode, decode, prime, squash, stretch, fits, MAX_BYTES, IN_PLACE, INPUTS, TBITS } from './codec.mjs';
import * as F from './fixtures.mjs';

const h = (u8) => createHash('sha256').update(u8).digest('hex').slice(0, 16);
const same = (a, b) => a instanceof Uint8Array && b instanceof Uint8Array && a.length === b.length && a.every((x, i) => x === b[i]);
const rt = (bytes, primed) => { const e = encode(bytes, primed); assert.equal(e.ok, true); const d = decode(e.bytes, primed); assert.equal(d.ok, true, d.why); assert.ok(same(d.bytes, bytes)); return e.bytes; };
const P = prime(F.dict);
// a digest of everything a primed model holds, so a test can prove it was handed back unchanged
const modelHash = (m) => createHash('sha256').update(m.P).update(m.N).update(new Uint8Array(m.W.buffer)).update(new Uint8Array(m.ht.buffer)).update(m.buf.subarray(0, m.len))
  .update(JSON.stringify([m.len, m.hist, m.hist2, m.word, m.mptr, m.mlen])).digest('hex');

test('the integer logistic: fixed ends, the middle, monotone, and stretch inverts it', () => {
  assert.equal(squash(0), 2047); assert.equal(squash(2047), 4094); assert.equal(squash(2048), 4094); assert.equal(squash(99999), 4094); assert.equal(squash(-2047), 1); assert.equal(squash(-2048), 1);
  assert.equal(squash(-99999), 1); assert.equal(squash('x'), 2047); assert.equal(squash(NaN), 2047); assert.equal(squash(2046.9), squash(2046)); assert.equal(squash(-1.5), squash(-1));
  assert.equal(squash(128), 2549); assert.equal(squash(-128), 1546); assert.equal(squash(64), 2298); assert.equal(squash(-1), 2043);
  for (let d = -2047; d < 2047; d++) assert.ok(squash(d) <= squash(d + 1), 'monotone at ' + d);
  assert.equal(stretch(0), -2047); assert.equal(stretch(4095), 2047); assert.equal(stretch(2047), 0);
  for (const x of [-1200, -700, -129, -1, 0, 1, 129, 700, 1200]) assert.ok(Math.abs(stretch(squash(x)) - x) <= 64, 'stretch ' + x);
  assert.ok(stretch(squash(-1900)) <= -1200 && stretch(squash(1900)) >= 1200, 'the tails stay at the tails');
  for (let p = 0; p < 4095; p++) assert.ok(stretch(p) <= stretch(p + 1), 'stretch monotone at ' + p);
  assert.equal(INPUTS, 7); assert.equal(TBITS, 20); assert.equal(IN_PLACE, 1048576); assert.equal(MAX_BYTES, 67108864);
});

test('lossless: empty, single bytes, ramps, noise, text, records — with and without a dictionary', () => {
  rt(new Uint8Array(0)); rt(new Uint8Array(0), P);
  for (const b of [0, 85, 128, 255]) { rt(Uint8Array.of(b)); rt(Uint8Array.of(b), P); }
  for (const v of [F.text, F.ramp, F.noise(700), new Uint8Array(900).fill(255)]) { rt(v); rt(v, P); }
});

test('the wire format is frozen: these exact outputs, byte for byte (a change to the model is a new version)', () => {
  const G = { text: [1488, 63, '62bbe1dd92ea2e3c', 24, 'ab2104d77debc523'], records: [3242, 396, '9623420c0da7d353', 359, '00c528b4e38463c5'],
    ramp: [1024, 244, '273b6fa6400513d7', 253, '8053346ec5d0bbe6'], noise: [2048, 2094, '164ffe71a5c2bd33', 2109, '44e124d2f9f310f2'] };
  for (const [k, v] of Object.entries({ text: F.text, records: F.records, ramp: F.ramp, noise: F.noise(2048) })) {
    const a = encode(v).bytes, b = encode(v, P).bytes;
    assert.deepEqual([v.length, a.length, h(a), b.length, h(b)], G[k], k);
  }
  // the header: a varint length, then the input's FNV-1a check, big-endian
  const e = encode(F.text).bytes;
  assert.deepEqual([...e.slice(0, 2)], [0xd0, 0x0b]);
  const big = encode(new Uint8Array(200000)).bytes;
  assert.deepEqual([...big.slice(0, 3)], [0xc0, 0x9a, 0x0c]);
  assert.deepEqual([...encode(new Uint8Array(0)).bytes], [0, 0x81, 0x1c, 0x9d, 0xc5, 0, 0, 0, 0]);
  assert.deepEqual([...encode(Uint8Array.of(97)).bytes.slice(0, 5)], [1, 0xe4, 0x0c, 0x29, 0x2c]);
});

test('the dictionary is what both sides hold: it shrinks familiar text, and decoding without it is refused', () => {
  assert.ok(encode(F.text, P).bytes.length < encode(F.text).bytes.length / 2);
  const coded = encode(F.text, P).bytes;
  assert.deepEqual(decode(coded), { ok: false, why: 'the check does not match: wrong dictionary, or the bytes were changed' });
  assert.equal(decode(coded, prime(F.text)).ok, false);
  assert.equal(decode(coded, P).ok, true);
});

test('a lent model is handed back exactly as it was lent, after encode and after decode', () => {
  const before = modelHash(P);
  const e = encode(F.records, P);
  assert.equal(modelHash(P), before, 'after encode');
  decode(e.bytes, P);
  assert.equal(modelHash(P), before, 'after decode');
  // and after a refused decode too
  decode(Uint8Array.of(5, 1, 2, 3, 4, 9, 9), P);
  assert.equal(modelHash(P), before, 'after a refused decode');
  // a second message with the same model gives the same bytes as the first: nothing carried over
  assert.ok(same(encode(F.records, P).bytes, e.bytes));
});

test('a FRESH primed model comes back unchanged, even after messages long enough to grow the journal', () => {
  const Q = prime(F.dict), before = modelHash(Q);
  const e = encode(F.records, Q);
  assert.equal(modelHash(Q), before, 'after a long encode');
  assert.ok(same(decode(e.bytes, Q).bytes, F.records));
  assert.equal(modelHash(Q), before, 'after a long decode');
  const n = encode(F.noise(800, 11), Q);
  assert.equal(modelHash(Q), before, 'after noise');
  assert.equal(decode(n.bytes, Q).ok, true);
  assert.equal(modelHash(Q), before);
});

test('every lend is stamped once: the stamp counts lends, a copy does not lend, and a wrapped stamp starts clean', () => {
  const Q = prime(F.dict);
  assert.equal(Q.ep, undefined);
  encode(F.text, Q); assert.equal(Q.ep, 1);
  decode(encode(F.text, Q).bytes, Q); assert.equal(Q.ep, 3);
  encode(F.text, Q, { copy: true }); assert.equal(Q.ep, 3, 'a copy is not a lend');
  encode(F.text); assert.equal(Q.ep, 3);
  const before = modelHash(Q);
  Q.ep = 0xffffffff;
  const e = encode(F.records, Q);
  assert.equal(Q.ep, 1, 'the stamp wrapped to 0, the stamps were cleared, and it starts again at 1');
  assert.ok(Q.E.every((v) => v <= 1) && Q.EH.every((v) => v <= 1));
  assert.equal(modelHash(Q), before);
  assert.ok(same(decode(e.bytes, Q).bytes, F.records));
});

test('the lend boundary is exact: a message of IN_PLACE bytes is lent, one byte more is copied', () => {
  const Q = prime(F.dict);
  encode(new Uint8Array(IN_PLACE), Q); assert.equal(Q.ep, 1);
  encode(new Uint8Array(IN_PLACE + 1), Q); assert.equal(Q.ep, 1);
});

test('the split point: a code value exactly on it decodes as a 1 bit', () => {
  // A fresh model's first prediction is squash(1) = 2051, so its first split is 1048575 × 2051 + ((4095 × 2051) >>> 12)
  // = 2150629375. A one-byte stream whose code value IS that point must decode its first bit as 1 (x <= mid). Of the
  // 256 possible checks in the header, exactly one decodes, and it is the check of a byte with its top bit set.
  const MID = 2150629375, fnv = (b) => (Math.imul(0x811c9dc5 ^ b, 0x01000193) >>> 0);
  const stream = (b) => { const c = fnv(b); return Uint8Array.of(1, c >>> 24, (c >>> 16) & 255, (c >>> 8) & 255, c & 255, MID >>> 24, (MID >>> 16) & 255, (MID >>> 8) & 255, MID & 255); };
  const hits = [];
  for (let b = 0; b < 256; b++) if (decode(stream(b)).ok) hits.push(b);
  assert.deepEqual(hits, [128]);
});

test('lending and copying make the same predictions, bit for bit', () => {
  for (const v of [F.text, F.noise(600, 3), new Uint8Array(0)]) {
    const lent = encode(v, P).bytes, copied = encode(v, P, { copy: true }).bytes;
    assert.ok(same(lent, copied));
    assert.ok(same(decode(copied, P, { copy: true }).bytes, v));
    assert.ok(same(decode(lent, P).bytes, v));
  }
  const before = modelHash(P);
  encode(F.text, P, { copy: true });
  assert.equal(modelHash(P), before, 'a copy never touches the lent model');
});

test('priming reads the dictionary and leaves the junk-primed model fresh', () => {
  assert.equal(modelHash(prime(null)), modelHash(prime(new Uint8Array(0))));
  assert.equal(modelHash(prime('text')), modelHash(prime(new Uint8Array(0))));
  const m = prime(F.dict);
  assert.equal(m.len, F.dict.length);
  assert.ok(same(m.buf.subarray(0, m.len), F.dict));
  assert.ok(same(encode(F.text, prime(null)).bytes, encode(F.text).bytes), 'an empty dictionary is no dictionary');
});

test('decode refuses, with a reason, everything it cannot read exactly', () => {
  assert.deepEqual(decode('x'), { ok: false, why: 'not bytes' });
  assert.deepEqual(decode(null), { ok: false, why: 'not bytes' });
  assert.deepEqual(decode(new Uint8Array(0)), { ok: false, why: 'no length' });
  assert.deepEqual(decode(Uint8Array.of(128, 128, 128, 128, 128, 1)), { ok: false, why: 'no length' });
  assert.deepEqual(decode(Uint8Array.of(128, 128, 128, 128)), { ok: false, why: 'no length' });
  assert.deepEqual(decode(Uint8Array.of(0x80, 0x80, 0x80, 0x80, 0x01, 0, 0, 0, 0)), { ok: false, why: 'more than 67108864 bytes' }, 'a five-byte length is read, and is too large');
  assert.deepEqual(decode(Uint8Array.of(0x80, 0x80, 0x80, 0x80, 0x80, 0x01)), { ok: false, why: 'no length' }, 'six bytes of length is not a length');
  assert.equal(fits(MAX_BYTES), true); assert.equal(fits(MAX_BYTES + 1), false); assert.equal(fits(0), true);
  assert.deepEqual(decode(encode(new Uint8Array(0)).bytes, null, { max: 0 }), { ok: true, bytes: new Uint8Array(0) });
  assert.deepEqual(decode(encode(Uint8Array.of(9)).bytes, null, { max: 0 }), { ok: false, why: 'more than 0 bytes' });
  assert.equal(decode(encode(Uint8Array.of(9)).bytes, null, { max: MAX_BYTES }).ok, true);
  assert.deepEqual(decode(Uint8Array.of(0x81, 0x80, 0x80, 0x20)), { ok: false, why: 'more than 67108864 bytes' });
  assert.equal(decode(Uint8Array.of(0x80, 0x80, 0x80, 0x21, 0, 0, 0, 0)).why, 'more than 67108864 bytes');
  assert.equal(decode(Uint8Array.of(0x80, 0x80, 0x80, 0x1f, 0, 0, 0, 0), null, { max: 100 }).why, 'more than 100 bytes');
  assert.deepEqual(decode(Uint8Array.of(5, 1, 2, 3)), { ok: false, why: 'no check' });
  assert.deepEqual(decode(Uint8Array.of(0, 1, 2, 3)), { ok: false, why: 'no check' });
  assert.deepEqual(decode(Uint8Array.of(0, 0x81, 0x1c, 0x9d, 0xc5)), { ok: true, bytes: new Uint8Array(0) });
  const e = encode(F.text).bytes;
  for (const at of [1, 3, 6, 20, e.length - 1]) { const t = e.slice(); t[at] ^= 0x10; assert.equal(decode(t).ok, false, 'flip at ' + at); }
  assert.equal(decode(e.slice(0, e.length - 6)).ok, false, 'truncated');
  // max: what a caller allows; junk is ignored, an exact bound is allowed
  assert.equal(decode(e, null, { max: F.text.length }).ok, true);
  assert.equal(decode(e, null, { max: F.text.length - 1 }).why, 'more than ' + (F.text.length - 1) + ' bytes');
  for (const junk of [{ max: -1 }, { max: 1.5 }, { max: '9' }, { max: MAX_BYTES + 5 }, 'x', null]) assert.equal(decode(e, null, junk).ok, true, JSON.stringify(junk));
});

test('encode refuses what is not bytes, or too much', () => {
  for (const junk of [null, undefined, 'abc', [1, 2], 5, {}]) assert.deepEqual(encode(junk), { ok: false, why: 'not bytes' });
  assert.deepEqual(encode(new Uint8Array(MAX_BYTES + 1)), { ok: false, why: 'more than 67108864 bytes' });
  assert.equal(decode(encode(new Uint8Array(1 << 7)).bytes).ok, true);
});

test('total: garbage never throws, and a refused or garbled stream returns ok:false or exact bytes, never a throw', () => {
  for (let s = 1; s < 120; s++) {
    const g = F.noise(1 + (s * 37) % 300, s);
    if (s % 3 === 0) g[0] = s % 7;
    const r = decode(g, s % 2 ? P : undefined, { max: 4096 });
    assert.equal(typeof r.ok, 'boolean');
    if (!r.ok) assert.equal(typeof r.why, 'string');
  }
});
