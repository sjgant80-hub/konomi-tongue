// layered/test/verdict.test.mjs — every verdict computed from numbers alone: a record where each claim holds, then each
// claim broken on purpose, one at a time, and the verdict must turn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as V from '../src/verdict.mjs';

const KEYS = ['agent', 'memory', 'callbook', 'records', 'prose'];
function type(key) {
  const raw = 100000, items = 50, ok = { checked: items, identical: items };
  const fr = (r) => ({ frame: Math.round(raw / r), ...ok });
  return {
    key, raw, items,
    ladder: { 1: fr(1.6), 3: fr(2.2), 7: fr(2.6), 15: fr(3.1), 31: fr(40) },
    alone: { 5: fr(2.0), 9: fr(2.9), 17: fr(1.7) },
    grow: { 0: fr(3.0), 65536: fr(5), 262144: fr(9), 1048576: fr(20), 4194304: fr(40) },
    baselines: { gzip9: 40000, brotli11: 35000, zstd19: 36000, deflateSeed: 30000, zstdSeed: 9000, lightV1: 30000 },
    drift: { refused: items, other: 0, fallback: items },
    corrupt: { tried: items, refused: 49, exact: 1, other: 0 },
    pair: { first: 3.2, last: 6.1, coldOk: items, identical: items },
  };
}
function good() {
  return {
    types: KEYS.map(type), gate: { clean: true, killed: 10, total: 10 },
    stacked: {
      s1: { rules: 3, identical: 3, settled: 30, agree: 30, twice: true, nonRuleLabels: 0 },
      s3: { cases: 10, resolved: 10, fetchCalls: 0 },
      s4: { byDepth: [{ right: 0 }, { right: 2 }, { right: 3 }, { right: 3 }] },
      s5: { proposed: { mined: 9, '7b': 6, library: 1 }, dropped: 13, stack: 3, receipts: 3, unreceipted: 0 },
    },
  };
}
const get = (rec, id) => V.verdicts(rec).find((x) => x.id === id);
const held = (rec, id) => get(rec, id).held;
const tweak = (fn) => { const r = good(); fn(r); return r; };
const T = (r, key) => r.types.find((t) => t.key === key);

test('a record where every claim holds says so, claim by claim, in the sealed order', () => {
  const vs = V.verdicts(good());
  assert.deepEqual(vs.map((x) => x.id), ['L1', 'L2', 'L3', 'S2', 'L4', 'L5', 'L7', 'L8', 'L9', 'L10', 'L11', 'L12', 'S1', 'S3', 'S4', 'S5', 'S6']);
  for (const x of vs) assert.equal(x.held, true, x.id + ': ' + x.measured);
  assert.match(get(good(), 'L3').measured, /^callbook 1\.600× → 2\.200× → 2\.600× → 3\.100× → 40\.000×; records /);
  assert.match(get(good(), 'L7').measured, /full 40\.000× vs product /);
  assert.equal(get(good(), 'S4').measured, 'right on FINAL-B by depth: 0 → 2 → 3 → 3');
  assert.equal(get(good(), 'S5').measured, '16 proposed (mined 9, 7b 6, library 1); 13 dropped; stack 3, with receipts 3');
  assert.match(get(good(), 'L1').measured, /mutation gate 10\/10 clean$/);
});

test('each claim turns when its own number is broken', () => {
  const cases = [
    ['L1', (r) => { T(r, 'prose').alone[5].identical = 49; }], ['L1', (r) => { r.gate.clean = false; }], ['L1', (r) => { r.gate.killed = 9; }],
    ['L1', (r) => { r.gate = { clean: true, killed: 0, total: 0 }; }], ['L1', (r) => { T(r, 'agent').grow[65536].checked = 49; }],
    ['L1', (r) => { delete T(r, 'memory').alone[17]; }],
    ['L2', (r) => { T(r, 'memory').ladder[31].identical = 48; }], ['L2', (r) => { T(r, 'memory').items = 0; }],
    ['L3', (r) => { T(r, 'records').ladder[7].frame = T(r, 'records').ladder[3].frame; }],
    ['L3', (r) => { T(r, 'callbook').ladder[31].frame = T(r, 'callbook').ladder[15].frame + 10; }],
    ['L3', (r) => { r.types = r.types.filter((t) => t.key !== 'records'); }],
    ['S2', (r) => { T(r, 'records').ladder[3].frame = 999999; }],
    ['L4', (r) => { T(r, 'agent').ladder[1].identical = 0; }],
    ['L5', (r) => { T(r, 'agent').drift.refused = 49; }], ['L5', (r) => { T(r, 'agent').drift.other = 1; }], ['L5', (r) => { T(r, 'agent').drift.fallback = 49; }],
    ['L5', (r) => { T(r, 'prose').corrupt.other = 1; T(r, 'prose').corrupt.refused = 48; }], ['L5', (r) => { T(r, 'prose').corrupt.tried = 49; }],
    ['L5', (r) => { T(r, 'prose').corrupt.exact = 0; }],
    ['L7', (r) => { T(r, 'records').ladder[31].frame = Math.round(100000 / 3.0); }], ['L7', (r) => { delete T(r, 'records').alone[9]; }],
    ['L7', (r) => { T(r, 'records').ladder[1].frame = 0; }],
    ['L8', (r) => { for (const t of r.types) t.ladder[31].frame = Math.round(100000 / 14.9); }],
    ['L9', (r) => { T(r, 'callbook').baselines.zstdSeed = T(r, 'callbook').ladder[31].frame; }], ['L9', (r) => { delete T(r, 'agent').baselines.gzip9; }],
    ['L10', (r) => { T(r, 'prose').baselines.lightV1 = 2000; }], ['L10', (r) => { delete T(r, 'prose').baselines.lightV1; }],
    ['L11', (r) => { T(r, 'memory').grow[1048576].frame = T(r, 'memory').grow[262144].frame + 1; }], ['L11', (r) => { delete T(r, 'memory').grow[0]; }],
    ['L12', (r) => { T(r, 'agent').ladder[1].frame = Math.round(100000 / 2.01); }], ['L12', (r) => { delete T(r, 'agent').ladder[1]; }],
    ['S1', (r) => { r.stacked.s1.identical = 2; }], ['S1', (r) => { r.stacked.s1.agree = 29; }], ['S1', (r) => { r.stacked.s1.twice = 'yes'; }],
    ['S1', (r) => { r.stacked.s1.nonRuleLabels = 1; }], ['S1', (r) => { r.stacked.s1 = { rules: 0, identical: 0, settled: 0, agree: 0, twice: true, nonRuleLabels: 0 }; }],
    ['S1', (r) => { r.stacked.s1.settled = 0; r.stacked.s1.agree = 0; }],
    ['S3', (r) => { r.stacked.s3.fetchCalls = 1; }], ['S3', (r) => { r.stacked.s3.resolved = 9; }], ['S3', (r) => { r.stacked.s3 = { cases: 0, resolved: 0, fetchCalls: 0 }; }],
    ['S4', (r) => { r.stacked.s4.byDepth = [{ right: 0 }, { right: 3 }, { right: 2 }]; }], ['S4', (r) => { r.stacked.s4.byDepth = [{ right: 0 }, { right: 3 }]; }],
    ['S4', (r) => { r.stacked.s4.byDepth = [{ right: 0 }, { right: 3 }, { right: 3 }]; }], ['S4', (r) => { r.stacked.s4.byDepth = []; }],
    ['S4', (r) => { r.stacked.s4.byDepth = [{ right: 0 }, { right: 1 }, { right: 'x' }]; }],
    ['S5', (r) => { r.stacked.s5.receipts = 2; }], ['S5', (r) => { r.stacked.s5.dropped = 0; }], ['S5', (r) => { r.stacked.s5.proposed = {}; }],
    ['S5', (r) => { r.stacked.s5.unreceipted = 1; }],
    ['S6', (r) => { T(r, 'prose').pair.last = 3.2; }], ['S6', (r) => { T(r, 'agent').pair.coldOk = 49; }], ['S6', (r) => { T(r, 'records').pair.identical = 0; }],
    ['S6', (r) => { delete T(r, 'records').pair.first; }],
  ];
  for (const [id, fn] of cases) assert.equal(held(tweak(fn), id), false, id + ' should turn: ' + fn);
  // and breaking one claim's number leaves the others alone
  assert.equal(held(tweak((r) => { r.stacked.s3.fetchCalls = 1; }), 'S1'), true);
  assert.equal(held(tweak((r) => { T(r, 'prose').pair.last = 1; }), 'L3'), true);
  assert.equal(held(tweak((r) => { T(r, 'agent').ladder[31].frame = Math.round(100000 / 3); }), 'L8'), true, 'one type at 15x is enough');
});

test('missing records are not held, and say what is missing; junk is a verdict, never a throw', () => {
  for (const junk of [null, undefined, 7, 'x', [], { types: 'x' }, { types: [null, 5] }]) {
    const vs = V.verdicts(junk);
    assert.equal(vs.length, 17);
    for (const x of vs) assert.equal(x.held, false, x.id);
  }
  assert.match(get({}, 'L3').measured, /^callbook: not measured; records: not measured$/);
  assert.equal(get({}, 'S4').measured, 'right on FINAL-B by depth: none (a stack of 0 rules)');
  assert.equal(get({ stacked: { s4: { byDepth: [{ right: 0 }, { right: 1 }] } } }, 'S4').measured, 'right on FINAL-B by depth: 0 → 1 (a stack of 1 rule)');
  assert.equal(get({}, 'S1').measured, '0/0 frames byte-identical; 0/0 settlings agree with the library; twice the same: false; non-rule frames that gave a label: ?');
  assert.equal(get({}, 'S3').measured, '0/0 cases settled; calls out of the node: ?');
});

test('every bar is inclusive or exclusive exactly as sealed: the boundaries', () => {
  // L7 "at least": a full stack exactly equal to the product holds
  const eq = tweak((r) => { for (const t of r.types) { for (const g of ['ladder', 'alone']) for (const k of Object.keys(t[g])) t[g][k].frame = 50000; } });
  assert.equal(held(eq, 'L7'), true);
  // L8 "15× or more": exactly 15.000 holds
  assert.equal(held(tweak((r) => { for (const t of r.types) t.ladder[31].frame = Math.round(100000 / 14); T(r, 'agent').raw = 150000; T(r, 'agent').ladder[31].frame = 10000; }), 'L8'), true);
  // L11 "no lower": equal steps hold
  assert.equal(held(tweak((r) => { for (const t of r.types) for (const g of Object.keys(t.grow)) t.grow[g].frame = 20000; }), 'L11'), true);
  // L12 "at most 2.0×": exactly 2.000 holds
  assert.equal(held(tweak((r) => { T(r, 'prose').ladder[1].frame = 50000; }), 'L12'), true);
  // L10 "smaller than": equal is not smaller
  assert.equal(held(tweak((r) => { T(r, 'prose').baselines.lightV1 = T(r, 'prose').ladder[31].frame; }), 'L10'), false);
  // S4: a plateau inside the stack still holds; three depths is enough; the measured text has no note at three
  assert.equal(held(tweak((r) => { r.stacked.s4.byDepth = [{ right: 0 }, { right: 2 }, { right: 2 }, { right: 3 }]; }), 'S4'), true);
  const s43 = tweak((r) => { r.stacked.s4.byDepth = [{ right: 0 }, { right: 1 }, { right: 2 }]; });
  assert.equal(held(s43, 'S4'), true); assert.equal(get(s43, 'S4').measured, 'right on FINAL-B by depth: 0 → 1 → 2');
  // S5: exactly one dropped holds
  assert.equal(held(tweak((r) => { r.stacked.s5.dropped = 1; }), 'S5'), true);
  // zero items is never a pass, whatever else is zero with it
  const none = tweak((r) => { for (const t of r.types) { t.items = 0; for (const g of ['ladder', 'alone', 'grow']) for (const k of Object.keys(t[g])) { t[g][k].checked = 0; t[g][k].identical = 0; } t.drift = { refused: 0, other: 0, fallback: 0 }; t.corrupt = { tried: 0, refused: 0, exact: 0, other: 0 }; t.pair = { first: 1, last: 2, coldOk: 0, identical: 0 }; } });
  for (const id of ['L1', 'L2', 'L4', 'L5', 'S6']) assert.equal(held(none, id), false, id + ' with no items');
  // S1 with no rules but settlings is not a pass
  assert.equal(held(tweak((r) => { r.stacked.s1 = { rules: 0, identical: 0, settled: 5, agree: 5, twice: true, nonRuleLabels: 0 }; }), 'S1'), false);
  // a number that is not finite is not a number
  assert.equal(held(tweak((r) => { T(r, 'agent').pair.first = -Infinity; }), 'S6'), false);
  assert.equal(held(tweak((r) => { T(r, 'agent').pair.first = NaN; }), 'S6'), false);
  // L7 says "not measured" for each missing piece on its own
  assert.match(get(tweak((r) => { T(r, 'agent').raw = 0; }), 'L7').measured, /^agent not measured;/);
  assert.match(get(tweak((r) => { delete T(r, 'agent').ladder[31]; }), 'L7').measured, /^agent not measured;/);
  assert.match(get(tweak((r) => { delete T(r, 'agent').alone[9]; }), 'L7').measured, /^agent not measured;/);
  assert.match(get(tweak((r) => { T(r, 'agent').alone[9].frame = 'x'; }), 'L7').measured, /^agent not measured;/);
});

test('the ratio and the sealed constants', () => {
  assert.deepEqual([V.ratio(1000, 300), V.ratio(10, 3), V.ratio(5, 0), V.ratio(-1, 2), V.ratio(1.5, 1), V.ratio(7, 7)], [3.333, 3.333, 0, 0, 0, 1]);
  assert.equal(V.ratio(2, 3), 0.667);
  assert.deepEqual([...V.LADDER], ['1', '3', '7', '15', '31']); assert.deepEqual({ ...V.ALONE }, { D2: '3', D3: '5', D4: '9', D5: '17' });
  assert.deepEqual([...V.GROW], ['0', '65536', '262144', '1048576', '4194304']);
  assert.deepEqual([...V.BASELINES], ['gzip9', 'brotli11', 'zstd19', 'deflateSeed', 'zstdSeed']);
  assert.deepEqual([...V.STRUCTURED], ['callbook', 'records']); assert.deepEqual([...V.PAIRED], ['agent', 'records', 'prose']);
  assert.equal(V.BAR15, 15); assert.equal(V.FLAT, 2);
});

test('the multiply test is the product of each layer alone over D1', () => {
  const r = good(), t = T(r, 'agent');
  // D1 1.6; alone: D2 2.2, D3 2.0, D4 2.9, D5 1.7 → 1.6 × (2.2/1.6)(2.0/1.6)(2.9/1.6)(1.7/1.6) ≈ 5.30; the product is
  // computed from the rounded frames' own ratios, so it reads 5.296
  t.ladder[31].frame = Math.round(100000 / 5.25);
  assert.equal(held(r, 'L7'), false);
  t.ladder[31].frame = Math.round(100000 / 5.4);
  assert.equal(held(r, 'L7'), true);
  assert.match(get(r, 'L7').measured, /^agent full 5\.400× vs product 5\.296×; memory full 40\.000× vs product 5\.296×/);
});
