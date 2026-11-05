import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { judge, near } from './judge.mjs';

const CLAIMS = JSON.parse(readFileSync(new URL('./claims.json', import.meta.url), 'utf8'));
const one = (id, facts) => judge({ claims: [CLAIMS.claims.find((c) => c.id === id)] }, facts).verdicts[0];

// facts under which every measurable claim holds (the spec's own 15× claims fail by design)
const GOOD = Object.freeze({
  codec: { heldFiles: 179, lossless: 0, medianRatioJson: 3.5, smallItems: 120, smallMedianLight: 130, smallMedianBrotli: 300, smallMedianGzip: 400, smallLightBeatsBrotliGzip: 120, totalIn: 5e6, totalLight: 1.4e6, totalBrotli: 1.5e6, totalGzip: 1.8e6, mbpsEncode: 0.8, mbpsDecode: 0.9 },
  memory: { ok: true, files: 354, bytes: 3.7e6, vaultBytes: 1e6, ratio: 3.7, identical: true, mismatched: 0, extra: 0 },
  edges: { pageTest: 'pass' },
  llm: { ran: true, model: 'qwen2.5:7b', items: 20, medianJsonTokens: 400, medianPackTokens: 300, packWins: 15, medianRatio: 1.3 },
  mesh: { ran: true, k1: { node0: 'signature', node1: 'recognised', node2: 'recognised', sentLight: 1, admittedLight: [1, 1] },
    k2: { unpinned: { status: 403, stage: 'sender' }, tampered: { status: 403, stage: 'signature' }, decodedBefore: 0, decodedAfter: 0 },
    k3: { one: { ratio: 1.5 }, batch: { json: 5000, light: 2000, ratio: 2.5 } } },
  census: { ran: true, repos: 1802, read: 1160, organs: 300, channel: 120, store: 250, light: 5, organsLight: 3, organsHeldByOthers: 40 },
});
const holds = (id, over) => one(id, { ...GOOD, ...over }).held;

test('every sealed claim has a rule, and the ids and predictions match the sealed file', () => {
  const r = judge(CLAIMS, GOOD);
  assert.equal(r.verdicts.length, CLAIMS.claims.length);
  for (const v of r.verdicts) { assert.notEqual(v.measured, 'no rule for this claim', v.id); assert.ok(v.held === true || v.held === false || v.held === null, v.id); }
});

test('under good facts: the engineering claims HOLD, the spec\'s 15×/model/estate claims FAIL by design, B1–B3 are unmeasured', () => {
  const r = judge(CLAIMS, GOOD);
  for (const id of ['L2', 'L3', 'L4', 'L5', 'M1', 'M2', 'K1', 'K2', 'K3', 'T2', 'E1', 'B4']) assert.equal(holds(id, {}), true, id + ' should hold: ' + one(id, GOOD).measured);
  for (const id of ['L1', 'T1', 'C1']) assert.equal(holds(id, {}), false, id + ' should fail by design');
  for (const id of ['B1', 'B2', 'B3']) assert.equal(holds(id, {}), null, id + ' is measured elsewhere');
  assert.equal(r.held, 12); assert.equal(r.failed, 3); assert.equal(r.unmeasured, 4);   // B1,B2,B3,G1
});

test('L1 (15×): held only at 15× or more; our ~3.5× is kept FAILED with the number', () => {
  assert.equal(holds('L1', { codec: { ...GOOD.codec, medianRatioJson: 15 } }), true);
  assert.equal(holds('L1', { codec: { ...GOOD.codec, medianRatioJson: 14.9 } }), false);
  assert.match(one('L1', GOOD).measured, /^median 3\.5× smaller than JSON/);
  assert.equal(one('L1', { codec: { ...GOOD.codec, medianRatioJson: NaN } }).held, false);
});

test('L2/L3/L4/L5: the codec claims turn on their real edges', () => {
  assert.equal(holds('L2', { codec: { ...GOOD.codec, lossless: 1 } }), false);
  assert.equal(holds('L2', { memory: { ...GOOD.memory, mismatched: 1 } }), false);
  assert.equal(holds('L2', { memory: { ok: false, why: 'x' } }), false);
  assert.equal(holds('L3', { codec: { ...GOOD.codec, smallMedianLight: 300 } }), false, 'tie with brotli is not a win');
  assert.equal(holds('L3', { codec: { ...GOOD.codec, smallMedianGzip: 129 } }), false);
  assert.equal(holds('L4', { codec: { ...GOOD.codec, totalLight: 1.5e6 } }), true, 'equal to brotli passes');
  assert.equal(holds('L4', { codec: { ...GOOD.codec, totalLight: 1.5e6 + 1 } }), false);
  assert.equal(holds('L5', { codec: { ...GOOD.codec, mbpsEncode: 0.49 } }), false);
  assert.equal(holds('L5', { codec: { ...GOOD.codec, mbpsDecode: 0.5 } }), true);
});

test('M1/M2: the memory vault must be byte-identical and at least 3×', () => {
  assert.equal(holds('M1', { memory: { ...GOOD.memory, identical: false, mismatched: 2 } }), false);
  assert.equal(holds('M1', { memory: { ok: false, why: 'no dir' } }), false);
  assert.equal(holds('M2', { memory: { ...GOOD.memory, ratio: 3 } }), true);
  assert.equal(holds('M2', { memory: { ...GOOD.memory, ratio: 2.99 } }), false);
});

test('K1/K2/K3: held when the mesh ran and passed, null when it did not run', () => {
  assert.equal(holds('K1', { mesh: { ran: false, why: 'x' } }), null);
  assert.equal(holds('K1', { mesh: { ...GOOD.mesh, k1: { ...GOOD.mesh.k1, node1: 'admitted' } } }), false);
  assert.equal(holds('K1', { mesh: { ...GOOD.mesh, k1: { ...GOOD.mesh.k1, sentLight: 0 } } }), false);
  assert.equal(holds('K2', { mesh: { ...GOOD.mesh, k2: { ...GOOD.mesh.k2, decodedAfter: 1 } } }), false, 'a share whose body was decoded is not a clean refusal');
  assert.equal(holds('K2', { mesh: { ...GOOD.mesh, k2: { ...GOOD.mesh.k2, unpinned: { status: 200 } } } }), false);
  assert.equal(holds('K3', { mesh: { ...GOOD.mesh, k3: { one: { ratio: 1 }, batch: { json: 100, light: 100, ratio: 1 } } } }), false);
  assert.equal(holds('K3', { mesh: { ...GOOD.mesh, k3: { one: { ratio: 0.9 }, batch: { json: 5000, light: 2000, ratio: 2 } } } }), true, 'the batch, not one antigen, decides');
});

test('T1/T2: the binary-for-the-model claim fails by design; the dialect holds when the model reads it as well as JSON', () => {
  assert.equal(holds('T1', {}), false);
  assert.equal(holds('T1', { llm: { ran: false, why: 'no ollama' } }), null);
  assert.equal(holds('T2', { llm: { ...GOOD.llm, packWins: 9 } }), false, 'fewer than half is not a win');
  assert.equal(holds('T2', { llm: { ...GOOD.llm, medianRatio: 0.9 } }), false);
  assert.equal(holds('T2', { llm: { ran: false } }), null);
});

test('C1: full-estate migration is kept FAILED as predicted, with the census counts', () => {
  assert.equal(holds('C1', {}), false);
  assert.equal(holds('C1', { census: { ran: false, why: 'x' } }), null);
  assert.match(one('C1', GOOD).measured, /1802 repos.*260 organs are this window/);
});

test('total: junk claims or facts are failures or unmeasured, never a throw', () => {
  assert.deepEqual(judge(null, null), { held: 0, failed: 0, unmeasured: 0, verdicts: [] });
  const r = judge({ claims: [{ id: 'nope' }, null] }, GOOD);
  assert.equal(r.verdicts[0].measured, 'no rule for this claim');
  assert.equal(r.failed, 2);
  const j = judge(CLAIMS, null);
  assert.equal(j.held, 0);
  assert.ok(j.failed + j.unmeasured === CLAIMS.claims.length);
  assert.doesNotThrow(() => judge(CLAIMS, 'junk'));
});

// ── the edges the mutation gate found unguarded (each test below kills one mutant witness reported surviving) ──────
test('the thresholds hold exactly at the line: 0.5 MB/s each way, ratio 1, half the files, a non-empty set', () => {
  assert.equal(holds('L5', { codec: { ...GOOD.codec, mbpsEncode: 0.5 } }), true, 'encode exactly 0.5 MB/s holds');
  assert.equal(holds('T2', { llm: { ...GOOD.llm, medianRatio: 1 } }), true, 'a median ratio of exactly 1 holds');
  assert.equal(holds('T2', { llm: { ...GOOD.llm, packWins: 10 } }), true, 'exactly half of 20 files cheaper holds');
  assert.equal(holds('L2', { codec: { ...GOOD.codec, heldFiles: 0 } }), false, 'no held-out files is not lossless');
  assert.equal(holds('L3', { codec: { ...GOOD.codec, smallItems: 0 } }), false, 'no small items is not a win');
  assert.equal(holds('L3', { codec: { ...GOOD.codec, smallMedianGzip: 130 } }), false, 'a tie with gzip is not a win');
  assert.equal(holds('L4', { codec: { ...GOOD.codec, totalLight: 0 } }), false, 'an empty total is not a win');
  assert.equal(holds('M1', { memory: { ...GOOD.memory, files: 0 } }), false, 'an empty vault proves nothing');
});

test('G1: unmeasured until the gate\'s facts are present, then held only when clean', () => {
  assert.equal(one('G1', GOOD).measured, 'the mutation gate is run by CI (light/*.mjs), not inside this tool');
  assert.deepEqual([one('G1', { ...GOOD, gate: { clean: true, killed: 9, total: 9 } }).held, one('G1', { ...GOOD, gate: { clean: true, killed: 9, total: 9 } }).measured], [true, '9/9 mutants killed']);
  assert.equal(one('G1', { ...GOOD, gate: { clean: false, killed: 8, total: 9 } }).held, null);
});

test('near: within one either way, and never for a value that is not a finite number', () => {
  assert.equal(near(1, 2), true); assert.equal(near(2, 1), true); assert.equal(near(5, 10), false);
  assert.equal(near(1, NaN), false); assert.equal(near(NaN, 1), false); assert.equal(near(Infinity, Infinity), false);
});

// ── B1–B3: the barrier claims, from light/tools/barrier.mjs's facts ─────────────────────────────────────────────────
const BAR = Object.freeze({ ran: true,
  b1: { sent: 28, admitted: 0, decoded: 0, named: 28, stages: { size: 25, magic: 3 } },
  b2: [{ case: 'sender not pinned', admit: false, decoded: false, stage: 'sender' }, { case: "a stranger's key", admit: false, decoded: false, stage: 'signature' },
    { case: 'signature zeroed', admit: false, decoded: false, stage: 'signature' }, { case: 'one body byte flipped', admit: false, decoded: false, stage: 'signature' }],
  b3: { sent: 28, exact: 28 } });
const bar = (over) => ({ ...GOOD, barrier: { ...BAR, ...over } });

test('B1: every raw input refused with a named stage and nothing decoded — and the words say so', () => {
  assert.equal(one('B1', bar({})).held, true);
  assert.equal(one('B1', bar({})).measured, '28 test inputs sent to the door as raw bytes: 0 admitted, 0 decoded, 28 refused with a named stage (magic 3, size 25)');
  assert.equal(one('B1', bar({ b1: { ...BAR.b1, admitted: 1 } })).held, false, 'one admitted fails');
  assert.equal(one('B1', bar({ b1: { ...BAR.b1, decoded: 1 } })).held, false, 'one decoded fails');
  assert.equal(one('B1', bar({ b1: { ...BAR.b1, named: 27 } })).held, false, 'an unnamed refusal fails');
  assert.equal(one('B1', bar({ b1: { ...BAR.b1, sent: 0, named: 0 } })).held, false, 'nothing sent proves nothing');
  assert.equal(one('B1', { ...GOOD, barrier: { ran: false } }).held, null);
});

test('B2: knowing the format without the key gets nothing decoded, at the sender or signature stage only', () => {
  assert.equal(one('B2', bar({})).held, true);
  assert.equal(one('B2', bar({})).measured, "sender not pinned: refused at sender; a stranger's key: refused at signature; signature zeroed: refused at signature; one body byte flipped: refused at signature; 0 decoded");
  const with_ = (i, c) => bar({ b2: BAR.b2.map((x, j) => (j === i ? { ...x, ...c } : x)) });
  assert.equal(one('B2', with_(2, { stage: 'counter' })).held, false, 'refused later than the signature fails');
  assert.equal(one('B2', with_(1, { decoded: true })).held, false, 'a decoded body fails');
  assert.match(one('B2', with_(1, { decoded: true })).measured, /a stranger's key: refused at signature, BODY DECODED;.*; 1 decoded$/);
  assert.equal(one('B2', with_(3, { admit: true })).held, false, 'an admitted forgery fails');
  assert.equal(one('B2', bar({ b2: BAR.b2.slice(0, 3) })).held, false, 'all four cases or nothing');
  assert.equal(one('B2', bar({ b2: 'junk' })).held, false);
  assert.equal(one('B2', GOOD).measured, 'measured by light/tools/barrier.mjs');
});

test('B3: data carried in a signed packet comes back exactly — the language does not sanitise it', () => {
  assert.equal(one('B3', bar({})).held, true);
  assert.match(one('B3', bar({})).measured, /^28 of 28 test inputs carried as data/);
  assert.equal(one('B3', bar({ b3: { sent: 28, exact: 27 } })).held, false);
  assert.equal(one('B3', bar({ b3: { sent: 0, exact: 0 } })).held, false, 'nothing sent proves nothing');
  assert.equal(one('B3', GOOD).held, null);
});
