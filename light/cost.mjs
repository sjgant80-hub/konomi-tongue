// light/cost.mjs — the cost case for the "For business" part of the page: what LIGHT changes in a team's own storage
// and transfer bill, and what it costs to run. Three kinds of number, kept apart:
//   · external figures — read only from the vendored, sourced basis (light/vendor/sovereign-enterprise/data/basis.json):
//     electricity per kWh, a laptop processor's power, CPI. Each is cited on the page beside the result.
//   · LIGHT's own figures — read only from the committed receipt (light/data/light-run.json): the median ratio over the
//     held-out files, the totals against Brotli 11, and the measured coding speed (one thread, which FAILED its own
//     0.5 MB/s bar — the case uses the slow number it got, not the bar).
//   · the reader's figures — how much they keep and send, what they pay per GB (and per core-hour, if they rent CPU),
//     whether they already compress. Not counted: the team's own time to roll it out, which is theirs to estimate.
// Floors, never top ends: against raw data the MEDIAN file ratio is used (the totals ratio is higher); against data that
// is already Brotli-compressed, the totals (the smaller win). No price of ours appears: LIGHT is MIT, no licence fee.
// Pure, total, deterministic: garbage in gives { ok: false, why }, never a throw.

export const DEFAULTS = Object.freeze({ storedGb: 100, movedGbPerMonth: 20, pricePerGbMonth: 0, pricePerGbMoved: 0, pricePerCoreHour: 0, compressedToday: false, years: 3 });
export const BASIS_KEYS = Object.freeze(['electricityPencePerKwh', 'laptopExtraWatts', 'cpi']);
export const MAX_GB = 1e7, MAX_PRICE = 1000;

const isNum = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const isPos = (x) => isNum(x) && x !== 0;
const r2 = (x) => Math.round(x * 100) / 100;
const r1 = (x) => Math.round(x * 10) / 10;

/** the basis entries the case reads, each a sourced number; null when one is missing or unreadable */
function figures(basis) {
  const b = basis && typeof basis === 'object' ? basis : {}, f = (k) => b[k] || {};
  const out = { pence: f('electricityPencePerKwh').value, watts: f('laptopExtraWatts').value, cpi: f('cpi').value };
  return Object.values(out).every(isNum) ? out : null;
}

/** LIGHT's figures from the committed receipt; null unless every one is there and positive */
export function measuredOf(receipt) {
  try {
    const c = receipt.facts.codec;
    const m = { ratio: c.medianRatioJson, lightVsBrotli: c.totalLight / c.totalBrotli, rawVsBrotli: c.totalIn / c.totalBrotli, mbpsEncode: c.mbpsEncode, mbpsDecode: c.mbpsDecode, heldFiles: c.heldFiles };
    return [m.ratio, m.lightVsBrotli, m.rawVsBrotli, m.mbpsEncode, m.mbpsDecode].every(isPos) ? m : null;
  } catch { return null; }
}

/** where each external figure came from, for the page to list beside the numbers */
export function sourcesOf(basis) {
  try { return BASIS_KEYS.map((k) => ({ key: k, value: basis[k].value, what: basis[k].what, source: basis[k].source })); } catch { return []; }
}

/** a yearly cost carried over `years`, rising by CPI each year after the first */
export function over(perYear, cpi, years) {
  let total = 0, factor = 1;
  for (let y = 0; y < years; y++) { total += perYear * factor; factor *= 1 + cpi; }
  return r2(total);
}

/** the case. input (all optional, defaults above): storedGb, movedGbPerMonth, pricePerGbMonth, pricePerGbMoved, pricePerCoreHour
 *  (0 = the CPU is your own, costed as electricity), compressedToday, years */
export function lightCase(basis, measured, input) {
  try {
    const f = figures(basis);
    if (!f) return { ok: false, why: 'a sourced basis with every figure the case reads' };
    const m = measured && typeof measured === 'object' ? measured : {};
    if (![m.ratio, m.lightVsBrotli, m.rawVsBrotli, m.mbpsEncode, m.mbpsDecode].every(isPos)) return { ok: false, why: 'the measured figures from the receipt' };
    const i = { ...DEFAULTS, ...(input && typeof input === 'object' ? input : {}) };
    if (!isNum(i.storedGb) || i.storedGb > MAX_GB) return { ok: false, why: 'GB kept: 0 to ' + MAX_GB };
    if (!isNum(i.movedGbPerMonth) || i.movedGbPerMonth > MAX_GB) return { ok: false, why: 'GB sent a month: 0 to ' + MAX_GB };
    if (!isNum(i.pricePerGbMonth) || i.pricePerGbMonth > MAX_PRICE) return { ok: false, why: 'your price per GB-month: 0 to ' + MAX_PRICE };
    if (!isNum(i.pricePerGbMoved) || i.pricePerGbMoved > MAX_PRICE) return { ok: false, why: 'your price per GB sent: 0 to ' + MAX_PRICE };
    if (!isNum(i.pricePerCoreHour) || i.pricePerCoreHour > MAX_PRICE) return { ok: false, why: 'your price per core-hour: 0 to ' + MAX_PRICE };
    if (typeof i.compressedToday !== 'boolean') return { ok: false, why: 'already compressed today: yes or no' };
    if (!Number.isInteger(i.years) || i.years < 1 || i.years > 10) return { ok: false, why: 'years: 1 to 10' };

    // what is left of today's bytes once they are LIGHT: against raw data the median file ratio (a floor); against data
    // already Brotli-compressed, LIGHT's total over Brotli's total on the same held-out files (the smaller win)
    const keep = i.compressedToday ? m.lightVsBrotli : 1 / m.ratio;
    // the raw size the codec has to read (compressed volumes are scaled back up by Brotli's own measured ratio)
    const raw = i.compressedToday ? m.rawVsBrotli : 1;
    const storedLightGb = r2(i.storedGb * keep), movedLightGbPerMonth = r2(i.movedGbPerMonth * keep);
    const storage = { today: r2(i.storedGb * i.pricePerGbMonth * 12), light: r2(i.storedGb * keep * i.pricePerGbMonth * 12) };
    const transfer = { today: r2(i.movedGbPerMonth * 12 * i.pricePerGbMoved), light: r2(i.movedGbPerMonth * keep * 12 * i.pricePerGbMoved) };
    // one thread: each GB sent is encoded once and decoded once; the store is encoded once (reads of it are not counted)
    const mbMovedPerYear = i.movedGbPerMonth * raw * 12 * 1000;
    const coreHoursPerYear = r1((mbMovedPerYear / m.mbpsEncode + mbMovedPerYear / m.mbpsDecode) / 3600);
    const coreHoursOnce = r1((i.storedGb * raw * 1000 / m.mbpsEncode) / 3600);
    // the CPU's cost: on machines you own, the electricity at a laptop processor's base power (sourced); on CPU you rent,
    // your own price per core-hour instead — the electricity is inside the rent, so it is not added twice
    const kwh = (hours) => hours * f.watts / 1000;
    const powerPerYear = r2(kwh(coreHoursPerYear) * f.pence / 100), powerOnce = r2(kwh(coreHoursOnce) * f.pence / 100);
    const rentPerYear = r2(coreHoursPerYear * i.pricePerCoreHour), rentOnce = r2(coreHoursOnce * i.pricePerCoreHour);
    const rented = i.pricePerCoreHour > 0;
    const cpuPerYear = rented ? rentPerYear : powerPerYear, cpuOnce = rented ? rentOnce : powerOnce;
    const perYear = { today: r2(storage.today + transfer.today), light: r2(storage.light + transfer.light + cpuPerYear) };
    const total = { today: over(perYear.today, f.cpi, i.years), light: r2(over(perYear.light, f.cpi, i.years) + cpuOnce) };
    return {
      ok: true, inputs: i, keep: Math.round(keep * 10000) / 10000,
      gb: { storedLight: storedLightGb, storedSaved: r2(i.storedGb - storedLightGb), movedLightPerMonth: movedLightGbPerMonth, movedSavedPerMonth: r2(i.movedGbPerMonth - movedLightGbPerMonth) },
      cpu: { coreHoursPerYear, coreHoursOnce, rented }, lines: { storage, transfer, powerPerYear, powerOnce, rentPerYear, rentOnce, cpuPerYear, cpuOnce }, perYear, over: total,
      savingPerYear: r2(perYear.today - perYear.light), savingOver: r2(total.today - total.light),
    };
  } catch { return { ok: false, why: 'the inputs could not be read' }; }
}

export default { DEFAULTS, BASIS_KEYS, MAX_GB, MAX_PRICE, measuredOf, sourcesOf, over, lightCase };
