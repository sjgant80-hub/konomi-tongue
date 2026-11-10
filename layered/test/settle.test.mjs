// layered/test/settle.test.mjs — STACKED LIGHT levels 2-3: a pattern frame is data (exact bytes) and code (a decision),
// a node is a stack that answers or says unknown, and nothing in the hot path can call a model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as S from '../src/settle.mjs';
import * as F from '../src/fold.mjs';

const te = new TextEncoder(), td = new TextDecoder();
const R1 = { when: ['firms'], then: 'verticals', receipt: '7f853e6a' };
const R2 = { when: ['mesh', 'node'], then: 'kar-body' };
const R3 = { when: ['node'], then: 'mesh' };
const cold = (text) => F.encode(te.encode(text), { mask: 15, bits: 18 }).bytes;

test('one blob, two faces: the frame decodes to the canonical rule, and settles to its decision', () => {
  for (const r of [R1, R2, R3]) {
    const f = S.frameOf(r);
    assert.equal(f.ok, true);
    const d = F.decode(f.bytes);
    assert.equal(td.decode(d.bytes), S.ruleText(r));
    assert.deepEqual(S.readFrame(f.bytes).rule, { when: r.when, then: r.then, receipt: r.receipt });
  }
  assert.equal(S.ruleText(R1), '{"kind":"pattern","when":["firms"],"then":"verticals","receipt":"7f853e6a"}');
  assert.equal(S.ruleText(R2), '{"kind":"pattern","when":["mesh","node"],"then":"kar-body","receipt":""}');
  const f1 = S.frameOf(R1).bytes, f2 = S.frameOf(R2).bytes;
  assert.deepEqual(S.settle(f1, ['law', 'firms']), { answer: 'verticals', rule: { when: ['firms'], then: 'verticals', receipt: '7f853e6a' } });
  assert.deepEqual(S.settle(f1, ['firm']), { answer: 'unknown', rule: null });
  assert.equal(S.settle(f2, ['mesh']).answer, 'unknown', 'both WHEN tokens are needed');
  assert.equal(S.settle(f2, ['node', 'mesh', 'x']).answer, 'kar-body');
  assert.equal(S.settle(f1, []).answer, 'unknown'); assert.equal(S.settle(f1, 'firms').answer, 'unknown');
  assert.equal(S.settle(f1, ['firms']).answer, S.settle(f1, ['firms']).answer, 'the same twice');
});

test('a frame that is not a rule settles to unknown, never to a label, and says why it is not one', () => {
  const w = (b) => S.readFrame(b).why;
  assert.equal(w(cold('hello, not json')), 'not a rule: not JSON text');
  assert.equal(w(F.encode(Uint8Array.of(0xff, 0xfe), { mask: 1, bits: 18 }).bytes), 'not a rule: not JSON text');
  assert.equal(w(cold('null')), 'not a rule: no pattern kind');
  assert.equal(w(cold('[1]')), 'not a rule: no pattern kind');
  assert.equal(w(cold('{"kind":"other","when":["abc"],"then":"x"}')), 'not a rule: no pattern kind');
  assert.equal(w(cold('{"kind":"pattern","when":["ab"],"then":"x","receipt":""}')), 'not a rule: a WHEN token is 3+ of a-z0-9');
  assert.equal(w(cold('{"kind":"pattern","when":["abc"],"then":"x","receipt":"zz"}')), 'not a rule: a receipt is 8 hex');
  assert.equal(w(cold('{"kind":"pattern","when":["abc"],"then":"x"}')), 'not a rule: not in canonical form');
  assert.equal(w(cold('{"kind":"pattern", "when":["abc"],"then":"x","receipt":""}')), 'not a rule: not in canonical form');
  assert.equal(w(cold('{"kind":"pattern","when":["abc"],"then":"x","receipt":"","extra":1}')), 'not a rule: not in canonical form');
  assert.equal(S.readFrame(cold('{"kind":"pattern","when":["abc"],"then":"x","receipt":""}')).ok, true);
  assert.equal(w(F.encode(new Uint8Array(4097), { mask: 1, bits: 18 }).bytes), 'more than 4096 bytes');
  assert.equal(S.readFrame(F.encode(te.encode('"' + 'a'.repeat(4094) + '"'), { mask: 1, bits: 18 }).bytes).why, 'not a rule: no pattern kind', 'exactly 4096 bytes is allowed');
  assert.equal(w('x'), 'not bytes');
  const bad = S.frameOf(R1).bytes.slice(); bad[bad.length - 2] ^= 0x41;
  assert.equal(S.settle(bad, ['firms']).answer, 'unknown');
  assert.equal(S.settle(cold('{"kind":"pattern","when":["abc"],"then":"x"}'), ['abc']).answer, 'unknown');
});

test('a rule is checked: every malformed one is named, and has no bytes', () => {
  const cases = [
    [null, 'not a rule'], [[1], 'not a rule'], ['x', 'not a rule'],
    [{ then: 'x' }, 'WHEN is one or two tokens'], [{ when: [], then: 'x' }, 'WHEN is one or two tokens'],
    [{ when: ['abc', 'def', 'ghi'], then: 'x' }, 'WHEN is one or two tokens'], [{ when: 'abc', then: 'x' }, 'WHEN is one or two tokens'],
    [{ when: ['Abc'], then: 'x' }, 'a WHEN token is 3+ of a-z0-9'], [{ when: [7], then: 'x' }, 'a WHEN token is 3+ of a-z0-9'],
    [{ when: ['abc', 'abc'], then: 'x' }, 'the two WHEN tokens are the same'],
    [{ when: ['abc'] }, 'THEN is a label'], [{ when: ['abc'], then: '-x' }, 'THEN is a label'], [{ when: ['abc'], then: 'X' }, 'THEN is a label'],
    [{ when: ['abc'], then: 'x', receipt: 'abc' }, 'a receipt is 8 hex'], [{ when: ['abc'], then: 'x', receipt: 7 }, 'a receipt is 8 hex'],
  ];
  for (const [r, why] of cases) { assert.equal(S.ruleText(r), null); assert.deepEqual(S.frameOf(r), { ok: false, why }); }
  assert.equal(S.ruleText({ when: ['ab9', 'zz0'], then: 'a-b', receipt: '0123abcd' }), '{"kind":"pattern","when":["ab9","zz0"],"then":"a-b","receipt":"0123abcd"}');
  assert.equal(S.ruleText({ when: ['abc'], then: 'x9' }) !== null, true);
});

test('a node is its stack: the first rule that fires answers with its receipt, else unknown', () => {
  const frames = [R1, R3, R2].map((r) => S.frameOf(r).bytes);
  const s = S.stackOf(frames);
  assert.equal(s.ok, true); assert.equal(s.node.depth, 3); assert.equal(s.node.kind, 'stack.node');
  assert.deepEqual(S.resolve(s.node, ['firms', 'node']), { answer: 'verticals', at: 0, receipt: '7f853e6a' });
  assert.deepEqual(S.resolve(s.node, ['mesh', 'node']), { answer: 'mesh', at: 1, receipt: null }, 'order decides: R3 is above R2');
  assert.deepEqual(S.resolve(s.node, ['other']), { answer: 'unknown', at: -1, receipt: null });
  assert.deepEqual(S.resolve(s.node, []), { answer: 'unknown', at: -1, receipt: null });
  assert.deepEqual(S.resolve(null, ['firms']), { answer: 'unknown', at: -1, receipt: null });
  assert.deepEqual(S.resolve({ kind: 'stack.node', rules: 'x' }, ['firms']), { answer: 'unknown', at: -1, receipt: null });
  assert.deepEqual(S.resolve({ kind: 'other', rules: s.node.rules }, ['firms']), { answer: 'unknown', at: -1, receipt: null });
  const deeper = S.stackOf([R1, R2].map((r) => S.frameOf(r).bytes)).node;
  assert.equal(S.resolve(deeper, ['mesh', 'node']).answer, 'kar-body');
  assert.deepEqual(S.stackOf('x'), { ok: false, why: 'frames are an array', at: -1 });
  const broken = S.stackOf([frames[0], cold('nope')]);
  assert.deepEqual([broken.ok, broken.at, broken.why], [false, 1, 'not a rule: not JSON text']);
  assert.equal(S.stackOf([]).node.depth, 0);
  assert.throws(() => { s.node.rules.push(R1); }, TypeError, 'a node cannot be changed behind its back');
});

test('the tokens are the pattern library\'s', () => {
  assert.deepEqual(S.tokensOf('The Law-Firms of LONDON, and its 2 vertical-ai tools: for you!'), ['law', 'firms', 'london', 'vertical', 'tools']);
  assert.deepEqual(S.tokensOf('mesh mesh node'), ['mesh', 'node']);
  assert.deepEqual(S.tokensOf(''), []); assert.deepEqual(S.tokensOf(null), []); assert.deepEqual(S.tokensOf('ab cd'), []);
  assert.deepEqual(S.tokensOf('every each what who how can has have was abc'), ['abc']);
  assert.deepEqual(S.tokensOf('the and for with from into that this your you are its one all any not but own via per out'), []);
});

test('zero model calls: the node imports only the codec, and settling a stack calls nothing outside it', () => {
  const src = readFileSync(new URL('../src/settle.mjs', import.meta.url), 'utf8'), fold = readFileSync(new URL('../src/fold.mjs', import.meta.url), 'utf8');
  const imports = (s) => [...s.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports(src), ['./fold.mjs']); assert.deepEqual(imports(fold), ['../../light/sha256.mjs']);
  for (const s of [src, fold]) { assert.equal(/\bfetch\b|XMLHttpRequest|WebSocket|import\(/.test(s.replace(/^\/\/.*$/gm, '')), false); }
  const real = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => { calls++; throw new Error('no model in the hot path'); };
  try {
    const node = S.stackOf([R1, R2, R3].map((r) => S.frameOf(r).bytes)).node;
    for (const t of [['firms'], ['mesh', 'node'], ['x'], []]) S.resolve(node, t);
    S.settle(S.frameOf(R1).bytes, ['firms']);
  } finally { globalThis.fetch = real; }
  assert.equal(calls, 0);
});
