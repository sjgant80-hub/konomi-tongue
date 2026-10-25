import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign as edSign, verify as edVerify } from 'node:crypto';
import { open, frame, prepare, finish, seal, dictIdOf, signedBytes, MAGIC, VERSION, HEADER, SIG, DOMAIN, KINDS, MAX_PACKET, MAX_BODY, STAGES } from './packet.mjs';
import { prime } from './codec.mjs';
import { sha256 } from './sha256.mjs';
import * as F from './fixtures.mjs';

const A = generateKeyPairSync('ed25519'), B = generateKeyPairSync('ed25519');
const signA = (m) => new Uint8Array(edSign(null, m, A.privateKey)), signB = (m) => new Uint8Array(edSign(null, m, B.privateKey));
const verify = (m, sig, key) => { try { return edVerify(null, m, key, sig); } catch { return false; } };
const P = prime(F.dict), ID = dictIdOf(F.dict);
const ctx = (over = {}) => ({ keyFor: (s) => (s === 1 ? A.publicKey : null), verify, dictFor: (id) => (id === ID ? P : null), lastCounter: () => 0n, ...over });
const json = (value, o = {}) => seal({ sender: 1, counter: 1n, kind: KINDS.JSON, value, dictId: ID, primed: P, ...o }, o.sign || signA).bytes;
const resign = (bytes, signer = signA) => { const n = bytes.length - HEADER - SIG, out = bytes.slice(); out.set(signer(signedBytes(out, n)), HEADER + n); return out; };

test('constants: the layout and the stages, in order', () => {
  assert.deepEqual([...MAGIC], [76, 71, 84, 49]); assert.equal(VERSION, 1); assert.equal(HEADER, 23); assert.equal(SIG, 64);
  assert.equal(DOMAIN, 'LIGHT/packet/v1\u0000'); assert.deepEqual(KINDS, { BYTES: 0, JSON: 1 }); assert.equal(MAX_PACKET, 1048576); assert.equal(MAX_BODY, 4194304);
  assert.deepEqual(STAGES, ['size', 'magic', 'version', 'length', 'dictionary', 'sender', 'signature', 'counter', 'body', 'error']);
});

test('a signed packet opens to exactly what was sealed: a JSON value or bytes, with or without a dictionary', () => {
  const v = { kind: 'antigens', list: ['a', 'b'], n: 3, deep: { ok: true, none: null } };
  const r = open(json(v), ctx());
  assert.deepEqual({ ...r }, { admit: true, decoded: true, stage: 'admitted', sender: 1, counter: 1n, kind: 1, dictId: ID, value: v });
  const plain = seal({ sender: 1, counter: 7n, kind: KINDS.BYTES, bytes: F.ramp, dictId: 0 }, signA).bytes;
  const p = open(plain, ctx());
  assert.equal(p.admit, true); assert.deepEqual([...p.bytes], [...F.ramp]); assert.equal(p.dictId, 0); assert.equal(p.counter, 7n);
  assert.equal(open(json('just a string'), ctx()).value, 'just a string');
  assert.equal(open(json(0), ctx()).value, 0);
  const big = seal({ sender: 255, counter: 2n ** 64n - 1n, kind: KINDS.BYTES, bytes: new Uint8Array(0), dictId: 0 }, signA).bytes;
  assert.equal(open(big, ctx({ keyFor: () => A.publicKey })).counter, 2n ** 64n - 1n);
});

test('the header on the wire, byte for byte', () => {
  const b = seal({ sender: 9, counter: 258n, kind: KINDS.JSON, value: 1, dictId: 0x01020304, primed: P }, signA).bytes;
  assert.deepEqual([...b.slice(0, 19)], [76, 71, 84, 49, 1, 1, 2, 3, 4, 9, 0, 0, 0, 0, 0, 0, 1, 2, 1]);
  const n = new DataView(b.buffer).getUint32(19);
  assert.equal(b.length, HEADER + n + SIG);
  const f = frame(b, {});
  assert.deepEqual([f.ok, f.dictId, f.sender, f.counter, f.kind, f.n], [true, 0x01020304, 9, 258n, 1, n]);
  assert.deepEqual([...f.signed.slice(0, 16)], [...new TextEncoder().encode('LIGHT/packet/v1'), 0]);
  assert.equal(f.signed.length, 16 + HEADER + n);
  assert.equal(f.sig.length, 64);
});

test('size, magic, version, length: refused on raw bytes, decoder never called', () => {
  const good = json({ a: 1 });
  const at = (b) => { const r = open(b, ctx()); return [r.stage, r.reason, r.decoded, r.admit]; };
  assert.deepEqual(at('x'), ['size', 'not bytes', false, false]);
  assert.deepEqual(at(good.slice(0, HEADER + SIG - 1)), ['size', 'a LIGHT packet is 87–1048576 bytes', false, false]);
  assert.deepEqual(open(good, ctx({ maxPacket: good.length - 1 })).reason, 'a LIGHT packet is 87–' + (good.length - 1) + ' bytes');
  assert.equal(open(good, ctx({ maxPacket: good.length })).admit, true);
  assert.equal(open(new Uint8Array(MAX_PACKET + 1), ctx()).stage, 'size');
  for (let i = 0; i < 4; i++) { const t = good.slice(); t[i] ^= 1; assert.deepEqual(at(t), ['magic', 'not a LIGHT packet: it does not begin with LGT1', false, false]); }
  const v2 = good.slice(); v2[4] = 2; assert.deepEqual(at(v2), ['version', 'LIGHT version 2 is not spoken here', false, false]);
  const k2 = good.slice(); k2[18] = 2; assert.deepEqual(at(k2), ['version', 'body kind 2 is not spoken here', false, false]);
  const len = good.slice(); new DataView(len.buffer).setUint32(19, 3);
  assert.deepEqual(at(len), ['length', 'the body length (3) does not match the packet (' + good.length + ' bytes)', false, false]);
  const longer = new Uint8Array(good.length + 1); longer.set(good);
  assert.equal(at(longer)[0], 'length');
});

test('dictionary, sender, signature, counter: refused before decode, and the first failure is the one reported', () => {
  const good = json({ a: 1 });
  assert.deepEqual([open(good, ctx({ dictFor: () => null })).stage, open(good, ctx({ dictFor: () => null })).reason], ['dictionary', 'dictionary ' + ID.toString(16).padStart(8, '0') + ' is not held here']);
  assert.equal(open(good, ctx({ dictFor: 'x' })).stage, 'dictionary');
  const stranger = json({ a: 1 }, { sender: 2 });
  assert.deepEqual([open(stranger, ctx()).stage, open(stranger, ctx()).reason, open(stranger, ctx()).decoded], ['sender', 'sender 2 is not pinned here', false]);
  assert.equal(open(good, ctx({ keyFor: 5 })).stage, 'sender');
  // a perfectly formed packet signed by a key that is not pinned: someone who knows LIGHT but not the key
  const forged = json({ a: 1 }, { sign: signB });
  assert.deepEqual([open(forged, ctx()).stage, open(forged, ctx()).reason, open(forged, ctx()).decoded], ['signature', 'the signature does not verify for sender 1', false]);
  const zeroed = good.slice(); zeroed.fill(0, zeroed.length - SIG); assert.equal(open(zeroed, ctx()).stage, 'signature');
  const flipped = good.slice(); flipped[HEADER + 2] ^= 1; assert.equal(open(flipped, ctx()).stage, 'signature');
  const nodomain = good.slice(); nodomain.set(signA(good.subarray(0, good.length - SIG)), good.length - SIG); assert.equal(open(nodomain, ctx()).stage, 'signature');
  assert.equal(open(good, ctx({ verify: () => 1 })).stage, 'signature', 'only a strict true passes');
  assert.equal(open(good, ctx({ verify: 'yes' })).stage, 'signature');
  assert.deepEqual([open(good, ctx({ lastCounter: () => 1n })).stage, open(good, ctx({ lastCounter: () => 1n })).reason], ['counter', 'counter 1 is not after 1: a replay, or out of order']);
  assert.equal(open(good, ctx({ lastCounter: () => 5n })).stage, 'counter');
  assert.equal(open(good, ctx({ lastCounter: () => 0 })).stage, 'counter', 'a counter that is not a bigint refuses');
  assert.equal(open(good, ctx({ lastCounter: undefined })).admit, true, 'no counter function means nothing seen yet');
  // first failure wins: bad magic AND a forged signature reports magic; an unpinned sender with a forged signature reports sender
  const both = forged.slice(); both[0] = 0; assert.equal(open(both, ctx()).stage, 'magic');
  assert.equal(open(json({ a: 1 }, { sender: 2, sign: signB }), ctx()).stage, 'sender');
  for (const r of [open(forged, ctx()), open(zeroed, ctx()), open(stranger, ctx()), open(good, ctx({ lastCounter: () => 9n }))]) assert.equal(r.decoded, false);
});

test('body: a signed packet whose body does not decode, or is not JSON, is refused after decoding', () => {
  const p = prepare({ sender: 1, counter: 1n, kind: KINDS.BYTES, bytes: F.text, dictId: ID, primed: P });
  const broken = p.unsigned.slice(); broken[HEADER + 8] ^= 0x40;
  const r = open(resign(broken), ctx());
  assert.deepEqual([r.stage, r.decoded, r.admit], ['body', true, false]);
  assert.match(r.reason, /^the body does not decode: /);
  const notJson = prepare({ sender: 1, counter: 1n, kind: KINDS.BYTES, bytes: new TextEncoder().encode('{not json'), dictId: 0 }).unsigned;
  notJson[18] = KINDS.JSON;
  assert.deepEqual([open(resign(notJson), ctx()).stage, open(resign(notJson), ctx()).reason], ['body', 'the body is not JSON']);
  const badUtf8 = prepare({ sender: 1, counter: 1n, kind: KINDS.BYTES, bytes: Uint8Array.of(0x22, 0xff, 0x22), dictId: 0 }).unsigned;
  badUtf8[18] = KINDS.JSON;
  assert.equal(open(resign(badUtf8), ctx()).reason, 'the body is not JSON');
  const tooBig = seal({ sender: 1, counter: 1n, kind: KINDS.BYTES, bytes: new Uint8Array(5000), dictId: 0 }, signA).bytes;
  assert.deepEqual([open(tooBig, ctx({ maxBody: 4999 })).stage, open(tooBig, ctx({ maxBody: 4999 })).reason], ['body', 'the body does not decode: more than 4999 bytes']);
  assert.equal(open(tooBig, ctx({ maxBody: 5000 })).admit, true);
  assert.equal(open(tooBig, ctx({ maxBody: -3 })).admit, true, 'a junk bound falls back to the default');
});

test('the exact boundaries of size, the limits and the guards', () => {
  // the size stage passes at exactly HEADER+SIG (87) and refuses one under. A real body never encodes to 0 bytes, so
  // the 87-byte case is hand-built: valid magic/version/kind, body length 0; it passes size and fails later (signature)
  const at87 = new Uint8Array(HEADER + SIG); at87.set(MAGIC, 0); at87[4] = VERSION; at87[9] = 1; new DataView(at87.buffer).setBigUint64(10, 1n); at87[18] = KINDS.BYTES; /* n=0 */
  assert.equal(at87.length, 87);
  assert.notEqual(open(at87, ctx()).stage, 'size', 'an 87-byte packet passes the size stage');
  assert.equal(open(at87.slice(0, 86), ctx()).stage, 'size', 'one byte under is refused at size');
  const tiny = seal({ sender: 1, counter: 1n, kind: KINDS.BYTES, bytes: new Uint8Array(0), dictId: 0 }, signA).bytes;
  assert.equal(open(tiny, ctx()).admit, true);
  // maxBody bounds the DECODED size (900 here). Exactly fits vs one short — distinguishes bound()'s v<=d and > 0 guard
  const big = seal({ sender: 1, counter: 1n, kind: KINDS.BYTES, bytes: new Uint8Array(900), dictId: 0 }, signA).bytes;
  assert.equal(open(big, ctx({ maxBody: 900 })).admit, true, 'maxBody exactly the decoded size admits');
  assert.equal(open(big, ctx({ maxBody: 899 })).stage, 'body', 'one byte under refuses at body');
  assert.equal(open(big, ctx({ maxBody: 0 })).admit, true, 'maxBody 0 is junk → falls back to the default, admits');
  assert.equal(open(big, ctx({ maxBody: -1 })).admit, true, 'negative maxBody → default');
  // maxPacket exactly at the packet length admits; one under refuses (prepare and open both clamp via bound)
  assert.equal(open(tiny, ctx({ maxPacket: tiny.length })).admit, true, 'maxPacket exactly the packet length admits');
  assert.equal(open(tiny, ctx({ maxPacket: tiny.length - 1 })).stage, 'size');
  assert.equal(open(tiny, ctx({ maxPacket: 0 })).admit, true, 'maxPacket 0 → default');
  // prepare: a packet whose total is exactly maxPacket is built; one byte under is refused
  const p = prepare({ sender: 1, counter: 1n, kind: KINDS.BYTES, bytes: new Uint8Array(200), dictId: 0 });
  const total = p.unsigned.length;
  assert.equal(prepare({ sender: 1, counter: 1n, kind: KINDS.BYTES, bytes: new Uint8Array(200), dictId: 0, maxPacket: total }).ok, true, 'total === maxPacket fits');
  assert.equal(prepare({ sender: 1, counter: 1n, kind: KINDS.BYTES, bytes: new Uint8Array(200), dictId: 0, maxPacket: total - 1 }).ok, false, 'one byte over maxPacket is refused');
});

test('a truthy non-object ctx or opts is used, not silently replaced (the && guards)', () => {
  const good = json({ a: 1 });
  // ctx = 5 (truthy, not an object): the mutant && → || would keep it and then c.keyFor is undefined → sender refusal
  for (const junk of [5, 'x', true]) { const r = open(good, junk); assert.equal(r.admit, false); assert.ok(STAGES.includes(r.stage)); }
  // open with a real ctx but opts junk on decode path is covered by maxBody tests above
  assert.equal(open(good, ctx()).admit, true);
});

test('a verifier that throws fails the door closed', () => {
  const r = open(json({ a: 1 }), ctx({ verify: () => { throw new Error('boom'); } }));
  assert.deepEqual([r.stage, r.reason, r.admit, r.decoded], ['error', 'the door failed closed', false, false]);
});

test('prepare refuses what it cannot write', () => {
  const base = { sender: 1, counter: 1n, kind: KINDS.JSON, value: 1, dictId: 0 };
  const why = (o) => prepare({ ...base, ...o }).why;
  assert.equal(prepare(null).why, 'sender is a whole number 0–255');
  for (const s of [-1, 256, 1.5, '1']) assert.equal(why({ sender: s }), 'sender is a whole number 0–255');
  for (const c of [0n, -1n, 2n ** 64n, 1]) assert.equal(why({ counter: c }), 'counter is a u64 from 1');
  for (const d of [-1, 2 ** 32, 1.5, '0']) assert.equal(why({ dictId: d }), 'dictId is a u32 (0 = no dictionary)');
  assert.equal(why({ dictId: 5 }), 'a dictionary id needs its primed model');
  assert.equal(why({ value: 1n }), 'the value is not JSON');
  assert.equal(why({ value: undefined }), 'the value is not JSON');
  assert.equal(why({ kind: KINDS.BYTES, bytes: 'x' }), 'the body is not bytes');
  assert.equal(why({ kind: 2 }), 'kind is 0 (bytes) or 1 (JSON)');
  assert.equal(why({ kind: KINDS.BYTES, bytes: F.noise(3000), maxPacket: 1000 }), 'too large for one packet (' + prepare({ ...base, kind: KINDS.BYTES, bytes: F.noise(3000) }).unsigned.length + ' bytes)');
  assert.equal(prepare({ ...base, sender: 0, counter: 2n ** 64n - 1n, dictId: 0xffffffff, primed: P }).ok, true);
});

test('finish and seal refuse a missing or wrong-sized signature, and a signer that throws', () => {
  const p = prepare({ sender: 1, counter: 1n, kind: KINDS.JSON, value: 1, dictId: 0 });
  assert.deepEqual(finish(p.unsigned, new Uint8Array(63)), { ok: false, why: 'a signature is 64 bytes' });
  assert.deepEqual(finish(new Uint8Array(10), new Uint8Array(64)), { ok: false, why: 'not an unsigned packet' });
  assert.deepEqual(finish('x', new Uint8Array(64)), { ok: false, why: 'not an unsigned packet' });
  assert.equal(finish(p.unsigned, signA(p.signed)).ok, true);
  // the exact minimum length finish accepts: HEADER+SIG passes, one under is refused (a real unsigned is longer, but finish is public)
  assert.equal(finish(new Uint8Array(HEADER + SIG), new Uint8Array(SIG)).ok, true, 'finish accepts an exactly 87-byte unsigned buffer');
  assert.deepEqual(finish(new Uint8Array(HEADER + SIG - 1), new Uint8Array(SIG)), { ok: false, why: 'not an unsigned packet' });
  assert.deepEqual(seal({ sender: 1, counter: 1n, kind: KINDS.JSON, value: 1, dictId: 0 }, () => { throw new Error('no'); }), { ok: false, why: 'a signature is 64 bytes' });
  assert.deepEqual(seal({ sender: 1, counter: 1n, kind: KINDS.JSON, value: 1, dictId: 0 }, 'nope'), { ok: false, why: 'a signature is 64 bytes' });
  assert.equal(seal({ sender: -1 }, signA).why, 'sender is a whole number 0–255');
  // finish copies: the unsigned packet is not changed
  const before = [...p.unsigned]; finish(p.unsigned, signA(p.signed)); assert.deepEqual([...p.unsigned], before);
});

test('dictIdOf is the first four bytes of the SHA-256, never 0', () => {
  const h = sha256(F.dict);
  assert.equal(dictIdOf(F.dict), ((h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) >>> 0);
  const e = sha256(new Uint8Array(0));
  assert.equal(dictIdOf('junk'), ((e[0] << 24) | (e[1] << 16) | (e[2] << 8) | e[3]) >>> 0);
  assert.notEqual(dictIdOf(F.text), dictIdOf(F.dict));
});

test('total: random bytes, LIGHT-prefixed noise and junk contexts never throw, and never admit', () => {
  for (let s = 1; s < 200; s++) {
    const g = F.noise(60 + (s * 13) % 400, s);
    if (s % 2) g.set(MAGIC, 0), (g[4] = 1), (g[18] = s % 3);
    for (const c of [ctx(), {}, null, ctx({ lastCounter: () => -1n })]) {
      const r = open(g, c);
      assert.equal(r.admit, false);
      assert.ok(STAGES.includes(r.stage), r.stage);
      assert.equal(typeof r.reason, 'string');
    }
  }
});
