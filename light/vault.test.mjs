import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pack, unpack, safePath, VMAGIC, VVERSION, VHEADER, MAX_FILES, MAX_PATH } from './vault.mjs';
import { prime, encode } from './codec.mjs';
import { dictIdOf } from './packet.mjs';
import { sha256 } from './sha256.mjs';
import * as F from './fixtures.mjs';

const P = prime(F.dict), ID = dictIdOf(F.dict);
const files = [{ path: 'MEMORY.md', bytes: F.text }, { path: 'notes/records.json', bytes: F.records }, { path: 'raw/ramp.bin', bytes: F.ramp }, { path: 'empty.txt', bytes: new Uint8Array(0) }];
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const dictFor = (id) => (id === ID ? P : null);

test('constants', () => {
  assert.deepEqual([...VMAGIC], [76, 86, 84, 49]); assert.equal(VVERSION, 1); assert.equal(VHEADER, 9); assert.equal(MAX_FILES, 100000); assert.equal(MAX_PATH, 1024);
});

test('a vault unpacks to exactly the files packed into it, names and bytes, in order — with and without a dictionary', () => {
  for (const opts of [{}, { dictId: ID, primed: P }]) {
    const v = pack(files, opts);
    assert.equal(v.ok, true); assert.equal(v.files, 4); assert.equal(v.in, F.text.length + F.records.length + F.ramp.length);
    const u = unpack(v.bytes, dictFor);
    assert.equal(u.ok, true, u.why);
    assert.deepEqual(u.entries.map((e) => e.path), files.map((f) => f.path));
    for (let i = 0; i < files.length; i++) assert.ok(same(u.entries[i].bytes, files[i].bytes), files[i].path);
    assert.equal(u.dictId, opts.dictId || 0);
  }
  const none = pack([]);
  assert.deepEqual(unpack(none.bytes).entries, []);
});

test('solid: shared material is paid for once, and the vault header is what it says', () => {
  const twice = pack([{ path: 'a', bytes: F.text }, { path: 'b', bytes: F.text }]).bytes.length, once = pack([{ path: 'a', bytes: F.text }]).bytes.length;
  assert.ok(twice - once < 40, 'the second copy cost ' + (twice - once) + ' bytes');
  const v = pack(files, { dictId: ID, primed: P }).bytes;
  assert.deepEqual([...v.slice(0, 5)], [76, 86, 84, 49, 1]);
  assert.equal(new DataView(v.buffer).getUint32(5), ID);
  assert.ok(pack(files, { dictId: ID, primed: P }).bytes.length < pack(files).bytes.length);
});

test('pack refuses unsafe, duplicate or non-byte entries, and a dictionary id without its model', () => {
  assert.equal(pack('x').why, 'entries is a list of at most 100000');
  assert.equal(pack(files, { dictId: 7 }).why, 'a dictionary id needs its primed model');
  assert.equal(pack([{ path: '../up', bytes: F.ramp }]).why, 'a path is not safe: ../up');
  assert.equal(pack([null]).why, 'a path is not safe: null');
  assert.equal(pack([{ path: 'a', bytes: F.ramp }, { path: 'a', bytes: F.ramp }]).why, 'a path appears twice: a');
  assert.equal(pack([{ path: 'a', bytes: 'text' }]).why, 'not bytes: a');
  assert.equal(pack(files, { dictId: -5 }).ok, true, 'a junk id is no dictionary');
});

test('safePath: plain relative segments only', () => {
  for (const ok of ['a', 'a/b.md', 'x-y_z/1.json', 'dots.in.name', '.hidden', 'a/.b']) assert.equal(safePath(ok), true, ok);
  for (const bad of ['', '/abs', 'a/../b', '..', '.', 'a//b', 'a/', 'C:/x', 'c:x', 'a\\b', 'a\u0000b', 'a\nb', 'x'.repeat(1025), null, 5]) assert.equal(safePath(bad), false, String(bad));
  assert.equal(safePath('x'.repeat(1024)), true);
});

test('unpack refuses anything it cannot return exactly, and names why', () => {
  const v = pack(files, { dictId: ID, primed: P }).bytes;
  assert.deepEqual(unpack('x'), { ok: false, why: 'not a LIGHT vault' });
  assert.deepEqual(unpack(v.slice(0, 8)), { ok: false, why: 'not a LIGHT vault' });
  const m = v.slice(); m[2] = 0; assert.deepEqual(unpack(m, dictFor), { ok: false, why: 'not a LIGHT vault: it does not begin with LVT1' });
  const ver = v.slice(); ver[4] = 9; assert.deepEqual(unpack(ver, dictFor), { ok: false, why: 'vault version 9 is not spoken here' });
  assert.deepEqual(unpack(v, () => null), { ok: false, why: 'dictionary ' + ID.toString(16).padStart(8, '0') + ' is not held here' });
  assert.equal(unpack(v).why, 'dictionary ' + ID.toString(16).padStart(8, '0') + ' is not held here');
  const t = v.slice(); t[VHEADER + 30] ^= 1; assert.match(unpack(t, dictFor).why, /^the vault does not decode: /);
  assert.equal(unpack(v, dictFor, { max: 100 }).why, 'the vault does not decode: more than 100 bytes');
});

// a vault whose inner stream is well coded but says something false: built by hand, then coded with no dictionary
const raw = (bytes) => { const c = encode(Uint8Array.from(bytes)).bytes, out = new Uint8Array(VHEADER + c.length); out.set(VMAGIC, 0); out[4] = 1; out.set(c, VHEADER); return out; };
const entry = (path, body, sha = [...sha256(Uint8Array.from(body))]) => { const p = [...new TextEncoder().encode(path)]; return { head: [p.length, ...p, body.length, ...sha], body }; };

test('unpack checks every claim inside the stream: counts, paths, sizes, hashes, duplicates, trailing bytes', () => {
  const a = entry('a.md', [1, 2, 3]);
  assert.equal(unpack(raw([1, ...a.head, ...a.body])).ok, true);
  assert.equal(unpack(raw([])).why, 'the file count is not readable');
  assert.equal(unpack(raw([0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 1])).why, 'the file count is not readable');
  assert.equal(unpack(raw([0xa1, 0x8d, 0x06])).why, 'the file count is not readable', 'more than MAX_FILES');
  assert.equal(unpack(raw([1, 0])).why, 'entry 0: the path is not readable');
  assert.equal(unpack(raw([1, 9, 97])).why, 'entry 0: the path is not readable');
  assert.equal(unpack(raw([1, 2, 0xff, 0xfe, 1, ...new Array(32).fill(0), 1])).why, 'entry 0: the path is not UTF-8');
  const up = entry('..', [1]); assert.equal(unpack(raw([1, ...up.head, ...up.body])).why, 'entry 0: the path is not safe');
  assert.equal(unpack(raw([1, 1, 97, 3, 1, 2])).why, 'entry 0: the size is not readable');
  const wrong = entry('a', [1, 2, 3], new Array(32).fill(7)); assert.equal(unpack(raw([1, ...wrong.head, ...wrong.body])).why, 'a: its SHA-256 does not match');
  const short = entry('a', [1, 2, 3]); assert.equal(unpack(raw([1, ...short.head, 1, 2])).why, 'a: the vault ends early');
  assert.equal(unpack(raw([2, ...a.head, ...a.head, ...a.body, ...a.body])).why, 'a path appears twice: a.md');
  assert.equal(unpack(raw([1, ...a.head, ...a.body, 9])).why, 'bytes after the last file');
});

test('the exact boundaries: dictId range, the MAX_FILES/MAX_PATH/size limits, the header length, the guards', () => {
  // dictId upper edge: 0xffffffff is valid and must be PRESERVED in the header (kills <= → < on the range check); one over is clamped to 0
  const topId = pack(files, { dictId: 0xffffffff, primed: P });
  assert.equal(topId.ok, true);
  assert.equal(new DataView(topId.bytes.buffer, topId.bytes.byteOffset).getUint32(5), 0xffffffff, 'dictId 0xffffffff is kept, not rejected');
  assert.equal(new DataView(pack(files, { dictId: 0x100000000, primed: P }).bytes.buffer).getUint32(5), 0, 'out of u32 → no dictionary (0)');
  // a single empty file: its 32-byte sha is the very last of the stream, so at+32 === b.length on read (kills at+32 > vs >=)
  const oneEmpty = pack([{ path: 'x', bytes: new Uint8Array(0) }], {});
  assert.equal(oneEmpty.ok, true);
  const u1 = unpack(oneEmpty.bytes);
  assert.equal(u1.ok, true, u1.why);
  assert.deepEqual(u1.entries, [{ path: 'x', bytes: new Uint8Array(0) }]);
  // a 9-byte vault (header only, no codec bytes): passes the length check, fails at decode — distinguishes < from <=
  const header = new Uint8Array(VHEADER); header.set(VMAGIC, 0); header[4] = VVERSION;
  assert.match(unpack(header).why, /does not decode|dictionary/);
  assert.equal(unpack(header.slice(0, VHEADER - 1)).why, 'not a LIGHT vault');
  // opts guard: a truthy non-object opts must be used (and ignored field-wise), not crash
  assert.equal(pack(files, 5).ok, true);
  assert.equal(unpack(pack(files).bytes, undefined, 5).ok, true);
  // inside the stream (raw-built, no dictionary): the count, path-length and size limits at their exact edges
  const entry = (path, body, sha = [...sha256(Uint8Array.from(body))]) => { const p = [...new TextEncoder().encode(path)]; return [p.length, ...p, body.length, ...sha, ...body]; };
  const raw = (bytes) => { const c = encode(Uint8Array.from(bytes)).bytes, out = new Uint8Array(VHEADER + c.length); out.set(VMAGIC, 0); out[4] = 1; out.set(c, VHEADER); return out; };
  // pack's own file-count limit: a sparse array of exactly MAX_FILES passes the count check (then the first hole fails
  // as an unsafe path); MAX_FILES+1 is refused by the count. Sparse arrays keep this cheap. Kills entries.length > vs >=
  assert.equal(pack(new Array(MAX_FILES)).why, 'a path is not safe: undefined');
  assert.equal(pack(new Array(MAX_FILES + 1)).why, 'entries is a list of at most ' + MAX_FILES);
  // decode: the sha bytes must be present — size read, fewer than 32 bytes left. Kills at + 32 > vs >=
  const sha31 = [1, 1, 97, 0, ...new Array(31).fill(0)];                  // path 'a', size 0, only 31 sha bytes
  const vi = (n) => { const o = []; for (;;) { const b = n % 128; n = Math.floor(n / 128); if (n === 0) { o.push(b); break; } o.push(b | 128); } return o; };
  assert.equal(unpack(raw(vi(MAX_FILES))).why, 'entry 0: the path is not readable', 'count === MAX_FILES passes the count check');
  assert.equal(unpack(raw(vi(MAX_FILES + 1))).why, 'the file count is not readable');
  // path length exactly MAX_PATH*4 passes the length check (then safePath rejects it for being too long); +1 fails the length check
  assert.equal(unpack(raw([1, ...vi(MAX_PATH * 4), ...new Array(MAX_PATH * 4).fill(97)])).why, 'entry 0: the path is not safe', 'pl === MAX_PATH*4 is read, then found unsafe');
  assert.equal(unpack(raw([1, ...vi(MAX_PATH * 4 + 1), ...new Array(MAX_PATH * 4 + 1).fill(97)])).why, 'entry 0: the path is not readable', 'pl one over the cap is refused');
  assert.equal(unpack(raw(sha31)).why, 'entry 0: the size is not readable', 'fewer than 32 sha bytes after the size is refused');
  // the varint reader at the exact end of the buffer: a header claiming a count, then nothing, returns a read error not a misread
  assert.equal(unpack(raw([])).why, 'the file count is not readable', 'an empty stream: the count reader hits the end');
});

test('total: noise never throws', () => {
  for (let s = 1; s < 80; s++) {
    const g = F.noise(20 + s * 7, s);
    if (s % 2) g.set(VMAGIC, 0), (g[4] = 1);
    const r = unpack(g, dictFor, { max: 1 << 16 });
    assert.equal(r.ok === false || Array.isArray(r.entries), true);
  }
});
