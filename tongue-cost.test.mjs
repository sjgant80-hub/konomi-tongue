// the root page's cost case: the model price only from the sourced basis, the tongue's figures only from the ship
// record, the rest the reader's; the median place (a floor), the shipped switch, the price held flat; never a throw
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import C, { DEFAULTS, BASIS_KEYS, MAX_TOKENS, MAX_PRICE, upperMedian, priceOf, sourcesOf, measuredOf, tongueCase } from './tongue-cost.mjs';

const BASIS_TEXT = readFileSync(new URL('./light/vendor/sovereign-enterprise/data/basis.json', import.meta.url));
const BASIS = JSON.parse(BASIS_TEXT), SHIP = JSON.parse(readFileSync(new URL('./data/ship-run.json', import.meta.url), 'utf8'));
const SOURCE = JSON.parse(readFileSync(new URL('./light/vendor/SOURCE.json', import.meta.url), 'utf8'));
const M = measuredOf(SHIP);
const place = (today, minified, packed) => ({ todayTokens: today, minifiedTokens: minified, packedTokens: packed });

test('the basis is the vendored one, byte for byte, and the price is its sourced figure in pounds', () => {
  assert.equal(createHash('sha256').update(BASIS_TEXT).digest('hex'), SOURCE.files.find((f) => f.path.endsWith('basis.json')).sha256);
  assert.deepEqual(BASIS_KEYS, ['frontier', 'fxGbpPerUsd']);
  assert.equal(priceOf(BASIS), 1.5079, '2 USD per million input tokens at 0.75396 GBP per USD');
  assert.equal(priceOf(null), null);
  assert.equal(priceOf({ frontier: { inPerM: 2 } }), null, 'no exchange rate, no price');
  assert.equal(priceOf({ frontier: { inPerM: 0 }, fxGbpPerUsd: { value: 0.75 } }), null, 'a zero price is not a sourced price');
  assert.equal(priceOf({ frontier: { inPerM: 2 }, fxGbpPerUsd: { value: 0 } }), null, 'a zero rate is not a rate');
  assert.equal(priceOf({ frontier: { inPerM: '2' }, fxGbpPerUsd: { value: 0.75 } }), null, 'a string is not a number');
  assert.equal(priceOf({ frontier: { inPerM: 3 }, fxGbpPerUsd: { value: 0.5 } }), 1.5, 'the figure moves with the basis');
});

test('every external figure is listed with its source', () => {
  assert.deepEqual(sourcesOf(BASIS), [
    { key: 'frontier', value: 2, what: 'Claude Sonnet 5 (API), input, USD per million tokens', source: 'https://platform.claude.com/docs/en/about-claude/pricing' },
    { key: 'fxGbpPerUsd', value: 0.75396, what: 'ECB reference rates 2026-09-28 (GBP 0.85785 / USD 1.1378 per euro)', source: 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml' },
  ]);
  assert.deepEqual(sourcesOf(null), []);
  assert.deepEqual(sourcesOf({ frontier: BASIS.frontier }), []);
});

test('upperMedian: the middle share, or the larger of the two middle ones — the smaller saving', () => {
  assert.equal(upperMedian([0.9, 0.1, 0.5]), 0.5);
  assert.equal(upperMedian([0.8, 0.2, 0.6, 0.4]), 0.6);
  assert.equal(upperMedian([0.7]), 0.7);
  assert.equal(upperMedian([0.3, 0.1]), 0.3);
});

test('measuredOf reads the ship record: 13 places, the shipped switch, the median place', () => {
  assert.deepEqual(M, { places: 13, winsToday: 12, winsMinified: 10, keepToday: 0.6708, keepMinified: 0.8103, bestToday: 0.2972, bestMinified: 0.509 });
  // where the pack is not cheaper the place stays as it is: it keeps every token, never more
  assert.deepEqual(measuredOf({ places: [place(100, 80, 120), place(100, 80, 50), place(100, 80, 80)] }),
    { places: 3, winsToday: 2, winsMinified: 1, keepToday: 0.8, keepMinified: 1, bestToday: 0.5, bestMinified: 0.625 });
  assert.equal(measuredOf(null), null);
  assert.equal(measuredOf({}), null);
  assert.equal(measuredOf({ places: [] }), null, 'no places, no measurement');
  assert.equal(measuredOf({ places: 'abc' }), null);
  assert.equal(measuredOf({ places: [place(100, 80, 50), place(100, 0, 50)] }), null, 'a zero count is not a measurement');
  assert.equal(measuredOf({ places: [place(100, 80, 50), place(-1, 80, 50)] }), null);
  assert.equal(measuredOf({ places: [place(100, 80, 50), place(100, 80, NaN)] }), null);
  assert.equal(measuredOf({ places: [null] }), null);
});

test('the default case: ten million tokens a month at the sourced price, packed where it wins', () => {
  assert.deepEqual(DEFAULTS, { millionTokensPerMonth: 10, pricePerMillion: null, minifiedToday: false, years: 3 });
  assert.deepEqual([MAX_TOKENS, MAX_PRICE], [1e6, 1000]);
  const r = tongueCase(BASIS, M, {});
  assert.deepEqual(r, {
    ok: true, inputs: DEFAULTS, price: 1.5079, priceSourced: true, keep: 0.6708,
    tokens: { packedPerMonth: 6.71, savedPerMonth: 3.29 },
    perYear: { today: 180.95, packed: 121.38 }, over: { today: 542.85, packed: 364.14 }, savingPerYear: 59.57, savingOver: 178.71,
  });
  assert.deepEqual(tongueCase(BASIS, M), r, 'no input is the defaults');
  assert.deepEqual(tongueCase(BASIS, M, null), r);
  assert.deepEqual(tongueCase(BASIS, M, 'ab').inputs, DEFAULTS, 'a string is not an input object');
});

test('already minified: the smaller win', () => {
  const r = tongueCase(BASIS, M, { minifiedToday: true });
  assert.equal(r.keep, 0.8103);
  assert.deepEqual(r.tokens, { packedPerMonth: 8.1, savedPerMonth: 1.9 });
  assert.deepEqual([r.perYear, r.savingPerYear, r.savingOver], [{ today: 180.95, packed: 146.62 }, 34.33, 102.99]);
});

test('the reader\'s own volume, price and years replace the defaults', () => {
  const r = tongueCase(BASIS, M, { millionTokensPerMonth: 250, pricePerMillion: 3, years: 5 });
  assert.deepEqual([r.price, r.priceSourced], [3, false]);
  assert.deepEqual(r.tokens, { packedPerMonth: 167.7, savedPerMonth: 82.3 });
  assert.deepEqual([r.perYear, r.over, r.savingPerYear, r.savingOver], [{ today: 9000, packed: 6037.2 }, { today: 45000, packed: 30186 }, 2962.8, 14814]);
  const free = tongueCase(BASIS, M, { pricePerMillion: 0 });
  assert.deepEqual([free.ok, free.price, free.priceSourced, free.savingPerYear], [true, 0, false, 0], 'a price of 0 is the reader\'s, not the sourced one');
  const none = tongueCase(BASIS, M, { millionTokensPerMonth: 0 });
  assert.deepEqual([none.ok, none.perYear, none.savingOver], [true, { today: 0, packed: 0 }, 0]);
  const one = tongueCase(BASIS, M, { years: 1 }), ten = tongueCase(BASIS, M, { years: 10 });
  assert.deepEqual([one.ok, one.over, ten.ok, ten.over.today], [true, one.perYear, true, 1809.5]);
  assert.equal(tongueCase(BASIS, M, { millionTokensPerMonth: MAX_TOKENS }).ok, true);
  assert.equal(tongueCase(BASIS, M, { pricePerMillion: MAX_PRICE }).ok, true);
});

test('where nothing is cheaper packed, nothing is saved — and the figures move with the record, not with anything typed', () => {
  const flat = tongueCase(BASIS, { keepToday: 1, keepMinified: 1 }, {});
  assert.deepEqual([flat.ok, flat.keep, flat.savingPerYear, flat.tokens.savedPerMonth], [true, 1, 0, 0]);
  const half = tongueCase(BASIS, { keepToday: 0.5, keepMinified: 0.9 }, { pricePerMillion: 2 });
  assert.deepEqual([half.perYear, half.savingPerYear], [{ today: 240, packed: 120 }, 120]);
  assert.equal(tongueCase({ frontier: { inPerM: 4 }, fxGbpPerUsd: { value: 0.5 } }, M, {}).price, 2);
});

test('garbage in gives a reason, never a throw', () => {
  const why = (b, m, i) => { const r = tongueCase(b, m, i); assert.equal(r.ok, false); return r.why; };
  assert.equal(why(null, M, {}), 'a sourced basis with the model price and the exchange rate');
  assert.equal(why(BASIS, null, {}), 'the measured figures from the ship record');
  assert.equal(why(BASIS, 'x', {}), 'the measured figures from the ship record');
  assert.equal(why(BASIS, { keepToday: 0, keepMinified: 0.8 }, {}), 'the measured figures from the ship record');
  assert.equal(why(BASIS, { keepToday: 0.7, keepMinified: 1.2 }, {}), 'the measured figures from the ship record', 'a share kept above 1 is not the shipped switch');
  assert.equal(why(BASIS, { keepToday: 0.7 }, {}), 'the measured figures from the ship record');
  assert.equal(why(BASIS, M, { millionTokensPerMonth: -1 }), 'million tokens a month: 0 to 1000000');
  assert.equal(why(BASIS, M, { millionTokensPerMonth: MAX_TOKENS + 1 }), 'million tokens a month: 0 to 1000000');
  assert.equal(why(BASIS, M, { millionTokensPerMonth: Infinity }), 'million tokens a month: 0 to 1000000');
  assert.equal(why(BASIS, M, { millionTokensPerMonth: '10' }), 'million tokens a month: 0 to 1000000');
  assert.equal(why(BASIS, M, { pricePerMillion: -1 }), 'your price per million input tokens: 0 to 1000');
  assert.equal(why(BASIS, M, { pricePerMillion: MAX_PRICE + 0.01 }), 'your price per million input tokens: 0 to 1000');
  assert.equal(why(BASIS, M, { pricePerMillion: 'cheap' }), 'your price per million input tokens: 0 to 1000');
  assert.equal(why(BASIS, M, { minifiedToday: 'yes' }), 'already minified today: yes or no');
  assert.equal(why(BASIS, M, { years: 0 }), 'years: 1 to 10');
  assert.equal(why(BASIS, M, { years: 11 }), 'years: 1 to 10');
  assert.equal(why(BASIS, M, { years: 2.5 }), 'years: 1 to 10');
  const trap = { get millionTokensPerMonth() { throw new Error('no'); } };
  assert.equal(why(BASIS, M, trap), 'the inputs could not be read');
  assert.equal(C.tongueCase, tongueCase, 'the default export carries the same functions');
  assert.deepEqual(Object.keys(C), ['DEFAULTS', 'BASIS_KEYS', 'MAX_TOKENS', 'MAX_PRICE', 'upperMedian', 'priceOf', 'sourcesOf', 'measuredOf', 'tongueCase']);
});
