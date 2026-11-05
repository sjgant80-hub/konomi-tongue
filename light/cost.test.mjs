// the For-business cost case: external figures only from the sourced basis, LIGHT's only from the receipt, the rest the
// reader's; floors not top ends; the slow measured speed costed honestly; never a throw
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DEFAULTS, BASIS_KEYS, MAX_GB, MAX_PRICE, measuredOf, sourcesOf, over, lightCase } from './cost.mjs';

const BASIS_TEXT = readFileSync(new URL('./vendor/sovereign-enterprise/data/basis.json', import.meta.url));
const BASIS = JSON.parse(BASIS_TEXT), RUN = JSON.parse(readFileSync(new URL('./data/light-run.json', import.meta.url), 'utf8'));
const SOURCE = JSON.parse(readFileSync(new URL('./vendor/SOURCE.json', import.meta.url), 'utf8'));
const M = measuredOf(RUN);
const base = (patch) => ({ ...BASIS, ...patch });
const PRICED = { pricePerGbMonth: 0.02, pricePerGbMoved: 0.07 };   // test inputs standing in for a reader's own prices

test('the basis is vendored byte for byte: its hash is the one SOURCE.json records', () => {
  assert.equal(createHash('sha256').update(BASIS_TEXT).digest('hex'), SOURCE.files[0].sha256);
  assert.deepEqual(BASIS_KEYS, ['electricityPencePerKwh', 'laptopExtraWatts', 'cpi']);
  assert.deepEqual(sourcesOf(BASIS).map((s) => [s.key, s.value]), [['electricityPencePerKwh', 24.51], ['laptopExtraWatts', 15], ['cpi', 0.031]]);
  for (const s of sourcesOf(BASIS)) assert.match(s.source, /^https:\/\//, s.key + ' is cited');
  assert.deepEqual(sourcesOf(null), []);
});

test('measuredOf reads the receipt: the median ratio, the totals against Brotli, the slow measured speed', () => {
  assert.deepEqual(M, { ratio: 3.416, lightVsBrotli: 318550 / 326952, rawVsBrotli: 1952051 / 326952, mbpsEncode: 0.369, mbpsDecode: 0.366, heldFiles: 179 });
  assert.equal(measuredOf(null), null);
  assert.equal(measuredOf({ facts: { codec: { ...RUN.facts.codec, mbpsDecode: 0 } } }), null, 'a zero speed is not a measurement');
  assert.equal(measuredOf({ facts: { codec: { ...RUN.facts.codec, medianRatioJson: -1 } } }), null);
});

test('the default case: GB saved and core-hours, and no money until the reader gives their own prices', () => {
  const r = lightCase(BASIS, M, {});
  assert.equal(r.ok, true);
  assert.deepEqual(r.inputs, DEFAULTS);
  assert.equal(r.keep, 0.2927);
  assert.deepEqual(r.gb, { storedLight: 29.27, storedSaved: 70.73, movedLightPerMonth: 5.85, movedSavedPerMonth: 14.15 });
  assert.deepEqual(r.cpu, { coreHoursPerYear: 362.8, coreHoursOnce: 75.3 });
  assert.deepEqual(r.lines, { storage: { today: 0, light: 0 }, transfer: { today: 0, light: 0 }, powerPerYear: 1.33, powerOnce: 0.28 });
  assert.deepEqual([r.perYear, r.over, r.savingPerYear, r.savingOver], [{ today: 0, light: 1.33 }, { today: 0, light: 4.39 }, -1.33, -4.39]);
});

test('with the reader\'s prices, raw data: the bill falls to the median ratio, the power is added back', () => {
  const r = lightCase(BASIS, M, PRICED);
  assert.deepEqual(r.lines.storage, { today: 24, light: 7.03 });
  assert.deepEqual(r.lines.transfer, { today: 16.8, light: 4.92 });
  assert.deepEqual(r.perYear, { today: 40.8, light: 13.28 });
  assert.deepEqual(r.over, { today: 126.23, light: 41.37 });
  assert.deepEqual([r.savingPerYear, r.savingOver], [27.52, 84.86]);
});

test('already Brotli-compressed: the win is the small one, and the CPU it costs can outweigh it', () => {
  const r = lightCase(BASIS, M, { ...PRICED, compressedToday: true });
  assert.equal(r.keep, 0.9743);
  assert.deepEqual(r.gb, { storedLight: 97.43, storedSaved: 2.57, movedLightPerMonth: 19.49, movedSavedPerMonth: 0.51 });
  assert.deepEqual(r.cpu, { coreHoursPerYear: 2166.2, coreHoursOnce: 449.4 });
  assert.deepEqual([r.lines.powerPerYear, r.lines.powerOnce], [7.96, 1.65]);
  assert.deepEqual([r.perYear, r.savingPerYear, r.savingOver], [{ today: 40.8, light: 47.71 }, -6.91, -23.03]);
});

test('the figures move with the basis and the receipt, not with anything typed', () => {
  const cheap = lightCase(base({ electricityPencePerKwh: { ...BASIS.electricityPencePerKwh, value: 10 } }), M, {});
  assert.equal(cheap.lines.powerPerYear, Math.round(362.8 * 15 / 1000 * 10 / 100 * 100) / 100);
  const watts = lightCase(base({ laptopExtraWatts: { ...BASIS.laptopExtraWatts, value: 30 } }), M, {});
  assert.equal(watts.lines.powerPerYear, Math.round(362.8 * 30 / 1000 * 24.51 / 100 * 100) / 100);
  const fast = lightCase(BASIS, { ...M, mbpsEncode: 1, mbpsDecode: 2 }, {});
  assert.deepEqual(fast.cpu, { coreHoursPerYear: Math.round((240000 / 1 + 240000 / 2) / 3600 * 10) / 10, coreHoursOnce: Math.round(100000 / 3600 * 10) / 10 });
  assert.equal(lightCase(BASIS, { ...M, ratio: 2 }, {}).gb.storedLight, 50);
  assert.equal(lightCase(base({ cpi: { ...BASIS.cpi, value: 0 } }), M, { ...PRICED, years: 2 }).over.today, 81.6);
});

test('over: the first year flat, CPI on each later year', () => {
  assert.equal(over(100, 0.1, 1), 100);
  assert.equal(over(100, 0.1, 3), 331);
  assert.equal(over(100, 0, 0), 0);
});

test('boundaries hold at both ends of every input', () => {
  for (const ok of [{ storedGb: 0 }, { storedGb: MAX_GB }, { movedGbPerMonth: 0 }, { movedGbPerMonth: MAX_GB }, { pricePerGbMonth: MAX_PRICE }, { pricePerGbMoved: MAX_PRICE }, { years: 1 }, { years: 10 }, { compressedToday: true }]) {
    assert.equal(lightCase(BASIS, M, ok).ok, true, JSON.stringify(ok));
  }
  assert.equal(lightCase(BASIS, M, { years: 1, ...PRICED }).over.today, 40.8);
  assert.equal(lightCase(BASIS, M, { storedGb: 0, movedGbPerMonth: 0 }).perYear.light, 0);
});

test('each bad input refused with its reason', () => {
  const why = (i) => lightCase(BASIS, M, i).why;
  assert.equal(why({ storedGb: MAX_GB + 1 }), 'GB kept: 0 to 10000000');
  assert.equal(why({ storedGb: -1 }), 'GB kept: 0 to 10000000');
  assert.equal(why({ storedGb: '5' }), 'GB kept: 0 to 10000000');
  assert.equal(why({ movedGbPerMonth: MAX_GB + 1 }), 'GB sent a month: 0 to 10000000');
  assert.equal(why({ movedGbPerMonth: NaN }), 'GB sent a month: 0 to 10000000');
  assert.equal(why({ pricePerGbMonth: MAX_PRICE + 0.01 }), 'your price per GB-month: 0 to 1000');
  assert.equal(why({ pricePerGbMonth: -0.01 }), 'your price per GB-month: 0 to 1000');
  assert.equal(why({ pricePerGbMoved: MAX_PRICE + 0.01 }), 'your price per GB sent: 0 to 1000');
  assert.equal(why({ pricePerGbMoved: Infinity }), 'your price per GB sent: 0 to 1000');
  assert.equal(why({ compressedToday: 'yes' }), 'already compressed today: yes or no');
  assert.equal(why({ years: 0 }), 'years: 1 to 10');
  assert.equal(why({ years: 11 }), 'years: 1 to 10');
  assert.equal(why({ years: 2.5 }), 'years: 1 to 10');
});

test('a missing basis figure or receipt figure is refused, never guessed', () => {
  for (const k of BASIS_KEYS) { const b = { ...BASIS }; delete b[k]; assert.equal(lightCase(b, M, {}).why, 'a sourced basis with every figure the case reads', k); }
  assert.equal(lightCase(null, M, {}).why, 'a sourced basis with every figure the case reads');
  for (const k of ['ratio', 'lightVsBrotli', 'rawVsBrotli', 'mbpsEncode', 'mbpsDecode']) assert.equal(lightCase(BASIS, { ...M, [k]: 0 }, {}).why, 'the measured figures from the receipt', k);
  assert.equal(lightCase(BASIS, null, {}).why, 'the measured figures from the receipt');
  assert.deepEqual(lightCase(BASIS, M, 'junk').inputs, DEFAULTS, 'junk input falls back to the defaults, and nothing of it leaks in');
});

test('total: garbage never throws', () => {
  const toxic = { get storedGb() { throw new Error('x'); } };
  assert.deepEqual(lightCase(BASIS, M, toxic), { ok: false, why: 'the inputs could not be read' });
  for (const g of [undefined, 0, 'x', [], () => 1]) assert.doesNotThrow(() => lightCase(g, g, g));
});
