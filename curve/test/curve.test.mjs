// The 15x curve's kernels, held to curve/CLAIMS.md: the tokenizer (byte map, pre-tokenizer, BPE order), the weekly
// windows and the time split, the held-reference coder, the ratios, every verdict at its bar, and the public-file check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import Q from '../src/qwentok.mjs';
import C from '../src/curve.mjs';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const claims = read('curve/CLAIMS.md').replace(/\s+/g, ' ');

test('the sealed settings in the code are the ones CLAIMS.md states', () => {
  for (const s of ['2026-10-01T12:00:00.000Z', 'each window is **7 days**', 'at least 24 characters', '§ plus a base-36 index', 'below 1.5×', 'between 1.0× and 1.5×', 'no line reaches 15×', 'at least **2.0×**'])
    assert.ok(claims.includes(s), 'CLAIMS.md says: ' + s);
  assert.deepEqual([C.START, C.DAYS, C.MIN_LINE, C.MARK, C.DAY], ['2026-10-01T12:00:00.000Z', 7, 24, '§', 86400000]);
});

test('the byte map is GPT-2\'s: 256 distinct characters, printable bytes kept, the rest shifted past 255 in order', () => {
  const m = Q.byteMap();
  assert.equal(m.length, 256);
  assert.equal(new Set(m).size, 256);
  assert.deepEqual([m[33], m[126], m[161], m[172], m[174], m[255]], ['!', '~', '¡', '¬', '®', 'ÿ']);
  assert.deepEqual([m[0], m[10], m[32], m[127], m[160], m[173]].map((c) => c.codePointAt(0)), [256, 266, 288, 289, 322, 323]);
});

test('the pre-tokenizer cuts as qwen2 does', () => {
  assert.deepEqual(Q.pieces('Hello world'), ['Hello', ' world']);
  assert.deepEqual(Q.pieces("it's THEY'LL"), ['it', "'s", ' THEY', "'LL"]);
  assert.deepEqual(Q.pieces('a123'), ['a', '1', '2', '3']);
  assert.deepEqual(Q.pieces('  x'), [' ', ' x']);
  assert.deepEqual(Q.pieces('a\r\n\nb'), ['a', '\r\n\n', 'b']);
  assert.deepEqual(Q.pieces('x !?\n'), ['x', ' !?\n']);
  assert.deepEqual(Q.pieces('end   '), ['end', '   ']);
  assert.deepEqual(Q.pieces(''), []);
  assert.deepEqual(Q.mergesOf('a b\n\nc d\n'), ['a b', 'c d']);
});

test('BPE merges the lowest-ranked pair first, the first of equal pairs first, and keeps a rule\'s first rank', () => {
  const t1 = Q.tokenizer(['a b', 'ab c']);
  assert.equal(t1.count('abc'), 1);
  assert.equal(t1.count('cab'), 2);
  assert.deepEqual(t1.tokens('abc cab'), ['abc', 'Ġ', 'c', 'ab']);
  assert.equal(Q.tokenizer(['b c', 'a b', 'a bc']).count('abc'), 1, 'b c (rank 0) before a b (rank 1)');
  assert.equal(Q.tokenizer(['a a', 'aa a']).count('aaa'), 1, 'the first of two equal pairs merges first');
  assert.equal(Q.tokenizer(['z z', 'a b', 'b c', 'a b', 'ab c']).count('abc'), 1, 'a repeated rule keeps its first rank');
  assert.equal(Q.tokenizer([]).count('héllo'), 6, 'no rules: one token per byte');
  const t = Q.tokenizer(['a b']);
  assert.equal(t.count('ab ab'), t.count('ab ab'), 'a cached piece counts the same again');
  assert.equal(t.count('ab'), 1);
  assert.deepEqual(Q.tokenizer(['a undefined']).tokens('a'), ['a'], 'no rule ever matches past the end of a piece');
});

test('K3 on the real table: the JavaScript count equals the local model\'s on the committed texts', { skip: !existsSync(new URL('../data/tokverify.json', import.meta.url)) }, () => {
  const tok = Q.tokenizer(Q.mergesOf(read('curve/data/qwen2.5-merges.txt')));
  const v = JSON.parse(read('curve/data/tokverify.json'));
  assert.ok(v.of >= 40, 'at least 40 texts');
  assert.equal(v.equal, v.of);
  for (const t of v.texts) assert.equal(t.js, t.ollama, t.file + ' @' + t.offset);
  assert.equal(tok.count('Hello, world! The settle erases information.') > 5, true);
});

test('windows: only complete weeks from the sealed cut', () => {
  const w1 = '2026-10-08T12:00:00.000Z';
  assert.deepEqual(C.windows(C.START, 7, w1), [{ start: C.START, end: w1 }]);
  assert.deepEqual(C.windows(C.START, 7, '2026-10-08T11:59:59.999Z'), []);
  assert.equal(C.windows(C.START, 7, '2026-11-09T20:00:00.000Z').length, 5);
  assert.equal(C.windows(undefined, undefined, '2026-11-09T20:00:00.000Z').at(-1).end, '2026-11-05T12:00:00.000Z');
  assert.equal(C.windows(C.START, 1, '2026-10-03T12:00:00.000Z').length, 2);
});

test('split and K2: train before the window, held inside it, the later excluded', () => {
  const w = { start: '2026-10-08T12:00:00.000Z', end: '2026-10-15T12:00:00.000Z' };
  const msgs = [{ at: '2026-10-08T11:59:59.999Z', text: 'train-1' }, { at: w.start, text: 'held-1' }, { at: '2026-10-15T11:59:59.999Z', text: 'held-2' }, { at: w.end, text: 'later-1' }];
  const mem = [{ at: '2026-10-01T00:00:00.000Z', text: 'mem-old' }, { at: w.start, text: 'mem-new' }];
  const s = C.split(msgs, mem, w);
  assert.deepEqual(s.train, ['mem-old', 'train-1']);
  assert.deepEqual(s.held.map((m) => m.text), ['held-1', 'held-2']);
  assert.deepEqual(s.check, { inside: true, trainCount: 2, heldCount: 2, laterExcluded: 1 });
  assert.equal(C.splitHolds(msgs, mem, w, [...s.held, msgs[3]]).inside, false, 'a later message among the held fails K2');
  assert.equal(C.splitHolds(msgs, mem, w, [msgs[0]]).inside, false, 'an earlier one does too');
});

test('the held-reference coder: long lines the reader holds become references, everything decodes exactly', () => {
  const long = 'x'.repeat(24), short = 'y'.repeat(23);
  const idx = C.heldIndex([long + '\n' + short + '\n' + long, '§starts with the mark, and long enough']);
  assert.deepEqual(idx.list, [long, '§starts with the mark, and long enough'], '24 characters is held, 23 is not, first occurrence once');
  assert.equal(C.refEncode(long, idx), '§0');
  assert.equal(C.refEncode(short, idx), short);
  assert.equal(C.refEncode('§starts with the mark, and long enough', idx), '§1', 'a held line that starts with the mark is a reference');
  assert.equal(C.refEncode('§not held', idx), '§§not held', 'an unheld line that starts with the mark is escaped');
  const many = C.heldIndex([Array.from({ length: 40 }, (_, i) => 'line number ' + String(i).padStart(12, '0')).join('\n')]);
  assert.equal(C.refEncode('line number 000000000039', many), '§13', 'base 36');
  for (const text of [long + '\n\n' + short + '\n§not held\n§§x\n' + long, '', '§', 'plain']) assert.equal(C.refDecode(C.refEncode(text, idx), idx), text, JSON.stringify(text));
  assert.equal(C.refDecode('line number 000000000039'.replace(/.*/, '§13'), many), 'line number 000000000039');
  assert.equal(C.heldIndex(['a'.repeat(30)], 31).list.length, 0, 'the minimum is a parameter');
});

test('ratio: before over after, three places, zero when nothing is left', () => {
  assert.equal(C.ratio(1000, 3), 333.333);
  assert.equal(C.ratio(2, 3), 0.667);
  assert.equal(C.ratio(5, 0), 0);
  assert.equal(C.ratio(4, 4), 1);
});

const pt = (o = {}) => ({ held: { messages: 10 }, split: { inside: true }, A: { ratio: 1.1, lossless: 10 }, B: { ratio: 1.2, lossless: 10 }, C: { ratio: 3, lossless: 10 }, gzip: { ratio: 2.5 }, ...o });
const pass = (points) => Object.fromEntries(C.verdicts(points).map((v) => [v.id, v.pass]));
test('verdicts: every bar at its edge', () => {
  assert.deepEqual(pass([pt(), pt({ B: { ratio: 1.3, lossless: 10 } })]), { K1: true, K2: true, K4: true, K5: true, K6: true, K7: true, K8: true });
  assert.equal(pass([pt({ A: { ratio: 1.499, lossless: 10 } })]).K4, true); assert.equal(pass([pt({ A: { ratio: 1.5, lossless: 10 } })]).K4, false);
  assert.equal(pass([pt({ B: { ratio: 1, lossless: 10 } })]).K5, true); assert.equal(pass([pt({ B: { ratio: 0.999, lossless: 10 } })]).K5, false);
  assert.equal(pass([pt({ B: { ratio: 1.5, lossless: 10 } })]).K5, true); assert.equal(pass([pt({ B: { ratio: 1.501, lossless: 10 } })]).K5, false);
  assert.equal(pass([pt({ C: { ratio: 14.999, lossless: 10 } })]).K6, true); assert.equal(pass([pt({ C: { ratio: 15, lossless: 10 } })]).K6, false);
  assert.equal(pass([pt({ A: { ratio: 15, lossless: 10 } })]).K6, false); assert.equal(pass([pt({ B: { ratio: 15, lossless: 10 } })]).K6, false);
  assert.equal(pass([pt(), pt()]).K7, false, 'level is not a climb'); assert.equal(pass([pt()]).K7, false, 'one point cannot climb');
  assert.equal(pass([pt(), pt({ A: { ratio: 1.21, lossless: 10 } })]).K7, true, 'the better of A and B is compared');
  assert.equal(pass([pt({ C: { ratio: 2, lossless: 10 }, gzip: { ratio: 1.9 } })]).K8, true); assert.equal(pass([pt({ C: { ratio: 1.999, lossless: 10 }, gzip: { ratio: 1 } })]).K8, false);
  assert.equal(pass([pt({ C: { ratio: 2.5, lossless: 10 } })]).K8, false, 'not above gzip');
  for (const k of ['A', 'B', 'C']) assert.equal(pass([pt({ [k]: { ratio: k === 'C' ? 3 : 1.1, lossless: 9 } })]).K1, false, k);
  assert.equal(pass([pt({ split: { inside: false } })]).K2, false);
  assert.deepEqual(Object.values(pass([])), [false, false, false, false, false, false, false], 'no points: nothing held');
  const v = C.verdicts([pt(), pt()]);
  assert.deepEqual(v.map((x) => x.id), ['K1', 'K2', 'K4', 'K5', 'K6', 'K7', 'K8']);
  assert.deepEqual(v[0].measured, ['30/30', '30/30']);
  assert.deepEqual(v[5].measured, [1.2, 1.2]);
  assert.deepEqual(v[6].measured, [[3, 2.5], [3, 2.5]]);
  assert.deepEqual(C.verdicts([])[5].measured, []);
});

test('K9: the public file may hold only fixed labels, dates, hashes, claim ids and counts', () => {
  const ok = { unit: 'bytes', at: '2026-11-05T12:00:00.000Z', sha: 'a'.repeat(64), id: 'K10', n: '3/9', nested: [{ line: 'held reference', x: 1.2 }] };
  assert.deepEqual(C.strayStrings(ok), []);
  assert.deepEqual(C.strayStrings({ a: ['tongue dictionary', 'something someone wrote'], b: { c: 'K100' }, n: null, t: true, z: 0 }), ['something someone wrote', 'K100'], 'nulls, booleans and numbers are skipped');
  assert.deepEqual(C.strayStrings({ a: 'a claim text' }, ['a claim text']), []);
  assert.deepEqual(C.strayStrings({ a: 'A'.repeat(64), b: '2026-11-05', c: '1/2/3' }), ['A'.repeat(64), '2026-11-05', '1/2/3']);
  assert.ok(Object.isFrozen(C.LABELS));
  assert.deepEqual(C.ANCHORS.map((a) => [a.ratio, a.unit, a.at]), [[1.05, 'Claude tokens', C.START], [2.72, 'Claude tokens', C.START], [3.75, 'Claude tokens', C.START], [50.1, 'Claude tokens', C.START]]);
  assert.ok(Object.isFrozen(C.ANCHORS) && C.ANCHORS.every(Object.isFrozen));
  const f = C.fixedStrings();
  assert.equal(f[0], 'curve/CLAIMS.md'); assert.equal(f.length, 1 + 4 + 14);
  assert.ok(f.includes('LIGHT templates by name, best') && f.includes('last above first (predicted to fail)'));
  assert.deepEqual(C.strayStrings({ anchors: C.ANCHORS, v: C.verdicts([]) }, f), [], 'everything the code writes passes K9');
});
