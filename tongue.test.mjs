// tongue.test.mjs — the kernel, line by line, on made-up text only (the agents' real talk is measured by the sealed run).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from './tongue.mjs';

const NOPRICE = new Map();
const ALPHA = ['一', '丁', '七', '万', '丈', '三', '上', '下', '不', '与', '丐', '丑'];

test('units cut words (with one leading space), digit runs, whitespace runs and single other characters', () => {
  assert.deepEqual(T.units('Hello world, it is 2026!\n\n◊ ok'), ['Hello', ' world', ',', ' it', ' is', ' 2026', '!', '\n\n', '◊', ' ok']);
  assert.deepEqual(T.units('a  b'), ['a', '  ', 'b']);
  assert.deepEqual(T.units('𒀀x'), ['𒀀', 'x']);
  assert.deepEqual(T.units(''), []);
  assert.deepEqual(T.units(42), []);
  assert.equal(T.str(7), '');
  assert.equal(T.str('x'), 'x');
  assert.equal(T.decode(7, []), '');
  assert.deepEqual(T.decodeJson('1', null), { ok: true, value: 1 });
  assert.deepEqual(T.decodeJson('一', [null, { kind: 'string', value: 'v', glyph: '一' }]), { ok: true, value: 'v' });
  assert.equal(T.squash(null), '');
  assert.deepEqual(T.gradeGrid(null, 5), { right: 0, n: 0, rate: 0, exact: true });
  assert.equal(T.decode('一', null), '一');
  assert.equal(T.decode('一', [7, { glyph: '一', left: 'a', right: 'b' }]), 'ab');
  assert.deepEqual(T.misreads(5, null), []);
});

test('unitCost: words by 8 letters, digits by 3, a priced glyph its price, anything else 1', () => {
  const p = new Map([['◊', 2]]);
  assert.equal(T.unitCost(' cat', p), 1);
  assert.equal(T.unitCost('abcdefgh', p), 1);
  assert.equal(T.unitCost(' abcdefghi', p), 2);
  assert.equal(T.unitCost('123', p), 1);
  assert.equal(T.unitCost(' 1234', p), 2);
  assert.equal(T.unitCost('◊', p), 2);
  assert.equal(T.unitCost(',', p), 1);
  assert.equal(T.unitCost('\n\n', p), 1);
});

test('rng and draw: the seeded mulberry32 stream', () => {
  const r = T.rng(1);
  assert.deepEqual([r(), r()].map((v) => Math.round(v * 1e9)), [627073941, 2735721]);
  assert.equal(T.draw(() => 0.999, 4), 3);
  assert.equal(T.draw(() => 0.25, 4), 1);
});

test('alphabetFrom keeps the one-token single glyphs that never occur in the texts', () => {
  const prices = [{ g: '一', cost: 1 }, { g: '丁', cost: 2 }, { g: '七', cost: 1 }, { g: '⚖️', cost: 1 }, { g: '万', cost: 1 }];
  assert.deepEqual(T.alphabetFrom(prices, ['a 七 b', 'c']), ['一', '万']);
});

const CORPUS = ['the cat sat on the mat', 'the cat ate the rat', 'on the mat the cat sat'];

test('grow merges the most valuable pairs that share no symbol, in rank order', () => {
  const g = T.grow(CORPUS, ALPHA, 10, 2, NOPRICE);
  const d = T.dictionary(g);
  assert.deepEqual(d, [{ glyph: '一', left: 'the', right: ' cat' }, { glyph: '丁', left: ' the', right: ' mat' }]);
  assert.deepEqual(g.merges.map((m) => [m.count, m.saving]), [[2, 2], [2, 2]]);
  assert.deepEqual(T.dictionary(T.grow(CORPUS, ALPHA, 10, 1, NOPRICE)), [{ glyph: '一', left: 'the', right: ' cat' }, { glyph: '丁', left: ' the', right: ' mat' }]);
  assert.deepEqual(T.grow(CORPUS, ALPHA, 0, 2, NOPRICE).merges, []);
  assert.equal(T.grow(CORPUS, ['一'], 10, 2, NOPRICE).merges.length, 1);
  assert.deepEqual(T.grow(['a b c', 'x y z'], ALPHA, 5, 2, NOPRICE).merges, []);
});

test('grow nests: a glyph can be made of glyphs, and a long word is worth more than a short one', () => {
  const texts = [' go go go go go go go go', ' go go go go'];
  const d = T.dictionary(T.grow(texts, ALPHA, 6, 1, NOPRICE));
  assert.deepEqual(d.slice(0, 2), [{ glyph: '一', left: ' go', right: ' go' }, { glyph: '丁', left: '一', right: '一' }]);
  assert.deepEqual(T.depths(d).slice(0, 2), [1, 2]);
  const long = T.dictionary(T.grow(['xx yy', 'xx yy', 'xx yy', 'abcdefghijklmnopq rs', 'abcdefghijklmnopq rs'], ALPHA, 1, 1, NOPRICE));
  assert.deepEqual(long, [{ glyph: '一', left: 'abcdefghijklmnopq', right: ' rs' }]);
});

test('encode applies the entries in order; decode unfolds every glyph back to the exact text', () => {
  const d = T.dictionary(T.grow(CORPUS, ALPHA, 10, 2, NOPRICE));
  const coded = T.encode('the cat sat on the mat today', d);
  assert.equal(coded, '一 sat on丁 today');
  assert.equal(T.decode(coded, d), 'the cat sat on the mat today');
  assert.equal(T.encode('the cat sat on the mat', d, 1), '一 sat on the mat');
  assert.equal(T.encode('the cat sat on the mat', d, 0), 'the cat sat on the mat');
  const nest = T.dictionary(T.grow([' go go go go go go go go', ' go go go go'], ALPHA, 6, 1, NOPRICE));
  const c2 = T.encode(' go go go go go', nest);
  assert.equal(T.decode(c2, nest), ' go go go go go');
  assert.ok([...c2].length < 5);
  assert.equal(T.decode('plain', nest), 'plain');
});

test('legendText: the dictionary one level down, or flat', () => {
  const nest = [{ glyph: '一', left: ' go', right: ' go' }, { glyph: '丁', left: '一', right: '一' }];
  assert.equal(T.legendText(nest, false), '一=" go go"\n丁="一一"');
  assert.equal(T.legendText(nest, true), '一=" go go"\n丁=" go go go go"');
});

const RECORDS = [[{ a: 1, b: 'xyz' }, { a: 2, b: 'xyz' }], { a: 3, b: 'qqq' }, { c: 'ab' }];

test('learnJson: recurring schemas, keys and strings (longer than 2), weighted by length × count', () => {
  assert.deepEqual(T.learnJson(RECORDS, ALPHA), [
    { kind: 'schema', value: '["a","b"]', glyph: '一' },
    { kind: 'key', value: 'a', glyph: '丁' },
    { kind: 'key', value: 'b', glyph: '七' },
    { kind: 'string', value: 'xyz', glyph: '万' },
  ]);
  assert.deepEqual(T.learnJson(RECORDS, ALPHA, 4), []);
  assert.equal(T.learnJson(RECORDS, ['一']).length, 1);
});

test('encodeJson and decodeJson round-trip every kind of value', () => {
  const d = T.learnJson(RECORDS, ALPHA);
  const v = [{ a: 5, b: 'xyz' }, { c: 'xyz', ...JSON.parse('{"__proto__":1}') }, 'he said "hi"\\', null, [true, false, -1.5e3, 0], {}, [], { b: 'z', a: 'xyz' }];
  const coded = T.encodeJson(v, d);
  assert.equal(coded, '[一(5,万),{"c":万,"__proto__":1},"he said \\"hi\\"\\\\",null,[true,false,-1500,0],{},[],{七:"z",丁:万}]');
  const back = T.decodeJson(coded, d);
  assert.equal(back.ok, true);
  assert.equal(JSON.stringify(back.value), JSON.stringify(v));
  const empty = [{ kind: 'schema', value: '[]', glyph: '一' }];
  assert.deepEqual(T.decodeJson(T.encodeJson({}, empty), empty), { ok: true, value: {} });
  assert.equal(T.encodeJson({}, empty), '一()');
});

test('decodeJson refuses what it cannot read, and says where', () => {
  const d = T.learnJson(RECORDS, ALPHA);
  assert.deepEqual(T.decodeJson('一5', d), { ok: false, error: 'expected ( at 1' });
  assert.deepEqual(T.decodeJson('一(5)', d), { ok: false, error: 'record length at 4' });
  assert.deepEqual(T.decodeJson('[1;2]', d), { ok: false, error: 'bad literal at 4' });
  assert.deepEqual(T.decodeJson('[1 2]', d), { ok: false, error: 'bad literal at 4' });
  assert.deepEqual(T.decodeJson('["a" 2]', d), { ok: false, error: 'expected , or ] at 4' });
  assert.deepEqual(T.decodeJson('{"a"5}', d), { ok: false, error: 'expected : at 4' });
  assert.deepEqual(T.decodeJson('1]', d), { ok: false, error: 'trailing at 1' });
  assert.equal(T.decodeJson('{x:1}', d).ok, false);
  assert.equal(T.decodeJson('', d).ok, false);
});

test('the picture channel: seeded payloads, grids, grading position by position', () => {
  const p = T.payload(6, 4, 3);
  assert.deepEqual(p, T.payload(6, 4, 3));
  assert.ok(p.every((x) => x >= 0 && x < 4));
  assert.notDeepEqual(T.payload(6, 4, 4), p);
  assert.equal(T.bitsOf(6, 4), 12);
  assert.equal(T.gridText([0, 1, 2, 3, 1], 2, ['a', 'b', 'c', 'd']), 'ab\ncd\nb');
  assert.deepEqual(T.gradeGrid('ab\ncd', 'ab\ncd'), { right: 4, n: 4, rate: 1, exact: true });
  assert.deepEqual(T.gradeGrid('ab\ncd', ' a b \ncx\n'), { right: 3, n: 4, rate: 0.75, exact: false });
  assert.deepEqual(T.gradeGrid('ab\ncd', 'ab'), { right: 2, n: 4, rate: 0.5, exact: false });
  assert.deepEqual(T.gradeGrid('ab', 'abc'), { right: 2, n: 3, rate: 2 / 3, exact: false });
  assert.deepEqual(T.gradeGrid('ab', 'ab\nzz'), { right: 2, n: 2, rate: 1, exact: false });
  assert.deepEqual(T.gradeGrid('', ''), { right: 0, n: 0, rate: 0, exact: true });
});

test('bits per token and ratios', () => {
  assert.equal(T.bitsPerToken(100, 4), 25);
  assert.equal(T.bitsPerToken(100, 0), 0);
  assert.equal(T.ratio(150, 10), 15);
  assert.equal(T.ratio(10, 3), 3.33);
  assert.equal(T.ratio(10, 0), 0);
});

test('grow stops at the rounds it is given; encode joins left to right and never reuses a joined piece', () => {
  assert.equal(T.grow(CORPUS, ALPHA, 1, 1, NOPRICE).merges.length, 1);
  assert.equal(T.grow(CORPUS, ALPHA, 2, 1, NOPRICE).merges.length, 2);
  const d = [{ glyph: '一', left: ' a', right: ' a' }];
  assert.equal(T.encode(' a a a', d), '一 a');
  assert.equal(T.encode(' a a a a', d), '一一');
  assert.equal(T.encode(' b a a', d), ' b一');
  assert.deepEqual([...T.unfolded([{ glyph: '一', left: ' a', right: ' b' }, { glyph: '丁', left: '一', right: ' c' }])], [['一', ' a b'], ['丁', ' a b c']]);
});

test('learnJson: a repeated two-letter string is not worth a glyph; the bar is inclusive; ties keep first-met order', () => {
  const v = [{ c: 'ab' }, { c: 'ab' }, { c: 'abc' }, { c: 'abc' }];
  assert.deepEqual(T.learnJson(v, ALPHA).map((e) => e.value), ['["c"]', 'c', 'abc']);
  assert.deepEqual(T.learnJson(RECORDS, ALPHA, 3).map((e) => e.value), ['["a","b"]', 'a', 'b']);
  assert.deepEqual(T.learnJson([{ b: 1, a: 2 }, { b: 3, a: 4 }], ALPHA).map((e) => e.value), ['["b","a"]', 'b', 'a']);
});

test('gridText ends on the last row; an unterminated string is a bad literal', () => {
  assert.equal(T.gridText([0, 1, 2, 3], 2, ['a', 'b', 'c', 'd']), 'ab\ncd');
  assert.deepEqual(T.decodeJson('"abc', []), { ok: false, error: 'bad literal at 0' });
  assert.deepEqual(T.decodeJson('"a\\"b"', []), { ok: true, value: 'a"b' });
});

test('misreads: the truth glyphs read wrong, position by position, spaces ignored', () => {
  assert.deepEqual(T.misreads('ab\ncd', 'ab\ncd'), []);
  assert.deepEqual(T.misreads('ab\ncd', 'a x\nc'), ['b', 'd']);
  assert.deepEqual(T.misreads('ab\ncd', 'ab'), ['c', 'd']);
  assert.deepEqual(T.misreads('ab', ' ba \n'), ['a', 'b']);
});

test('evolveAlphabet replaces every misread glyph with a fresh one from the pool, seeded', () => {
  const a = ['a', 'b', 'c'];
  assert.deepEqual(T.evolveAlphabet(a, [], ['x', 'y'], 1), a);
  const e = T.evolveAlphabet(a, ['b', 'b', 'c'], ['a', 'x', 'y', 'z'], 1);
  assert.equal(e[0], 'a');
  assert.ok(['x', 'y', 'z'].includes(e[1]) && ['x', 'y', 'z'].includes(e[2]) && e[1] !== e[2]);
  assert.deepEqual(e, T.evolveAlphabet(a, ['b', 'c'], ['a', 'x', 'y', 'z'], 1));
  assert.deepEqual(e, ['a', 'y', 'x']);
  assert.deepEqual(T.evolveAlphabet(a, ['b', 'c'], ['x'], 1), ['a', 'x', 'c']);
  assert.deepEqual(T.evolveAlphabet(a, ['b'], [], 1), a);
});

test('squash and editRate: whitespace runs are one space; the rest character by character', () => {
  assert.equal(T.squash('  a \n\n b\t'), 'a b');
  assert.deepEqual(T.editRate('a b', 'a\n b'), { exact: true, distance: 0, rate: 1 });
  assert.deepEqual(T.editRate('abcd', 'abxd'), { exact: false, distance: 1, rate: 0.75 });
  assert.deepEqual(T.editRate('abcd', 'abd'), { exact: false, distance: 1, rate: 0.75 });
  assert.deepEqual(T.editRate('ab', 'abcd'), { exact: false, distance: 2, rate: 0.5 });
  assert.deepEqual(T.editRate('', ''), { exact: true, distance: 0, rate: 1 });
  assert.deepEqual(T.editRate('kitten', 'sitting'), { exact: false, distance: 3, rate: 1 - 3 / 7 });
  assert.deepEqual(T.editRate('一丁', '一丁'), { exact: true, distance: 0, rate: 1 });
});

test('two-token glyphs: cheapest first in the alphabet, and a pair is only merged where the glyph still saves', () => {
  const prices = [{ g: '二', cost: 2 }, { g: '一', cost: 1 }, { g: '三', cost: 3 }, { g: '四', cost: 2 }];
  assert.deepEqual(T.alphabetFrom(prices, []), ['一']);
  assert.deepEqual(T.alphabetFrom(prices, [], 2), ['一', '二', '四']);
  const two = new Map([['二', 2], ['四', 2]]);
  const g = T.grow(['abcdefghijklmnopq rs', 'abcdefghijklmnopq rs', 'the cat', 'the cat'], ['二', '四'], 3, 2, two);
  assert.deepEqual(g.merges.map((m) => [m.glyph, m.count, m.saving, m.cost]), [['二', 2, 4, 2]]);
  assert.deepEqual(T.dictionary(g), [{ glyph: '二', left: 'abcdefghijklmnopq', right: ' rs' }]);
});
