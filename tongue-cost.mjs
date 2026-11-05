// tongue-cost.mjs — the cost case for the root page's "For a team" part: what the shipped JSON pack (tongue-pack.mjs)
// changes in a team's bill for the input tokens its systems send a language model. Three kinds of number, kept apart:
//   · external figures — read only from the vendored, sourced basis (light/vendor/sovereign-enterprise/data/basis.json):
//     the frontier model's published price per million input tokens (USD) and the GBP/USD reference rate. Each is cited
//     on the page beside the result.
//   · the tongue's own figures — read only from the committed ship record (data/ship-run.json): per place, the Claude
//     tokens of the record as sent today, minified, and packed (legend included). The switch is the shipped one: a place
//     is packed only where packed is cheaper, so a place where it is not keeps every token.
//   · the reader's figures — how many million input tokens of JSON records they send a month, their own price per
//     million (it starts at the sourced figure; anyone on another model or a negotiated rate types theirs), whether they
//     already minify, and the years.
// Floors, never top ends: the MEDIAN place's share kept (for an even count, the larger of the two middle shares — the
// smaller saving). Not inflated: the price is held at today's sourced figure, not raised by CPI. Not counted: output
// tokens (packing changes what is sent, not what comes back), the CPU to pack (not measured), and the team's time to roll
// it out. No price of ours appears: the code is MIT, no licence fee.
// Pure, total, deterministic: garbage in gives { ok: false, why }, never a throw.

export const DEFAULTS = Object.freeze({ millionTokensPerMonth: 10, pricePerMillion: null, minifiedToday: false, years: 3 });
export const BASIS_KEYS = Object.freeze(['frontier', 'fxGbpPerUsd']);
export const MAX_TOKENS = 1e6, MAX_PRICE = 1000;

const isNum = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const isPos = (x) => isNum(x) && x !== 0;
const r2 = (x) => Math.round(x * 100) / 100;
const r4 = (x) => Math.round(x * 10000) / 10000;

/** the conservative middle of a list of shares kept: the middle one, or the larger of the two middle ones */
export function upperMedian(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** the sourced figures the case reads, as GBP per million input tokens; null when one is missing or unreadable */
export function priceOf(basis) {
  try {
    const usd = basis.frontier.inPerM, fx = basis.fxGbpPerUsd.value;
    return isPos(usd) && isPos(fx) ? r4(usd * fx) : null;
  } catch { return null; }
}

/** where each external figure came from, for the page to list beside the numbers */
export function sourcesOf(basis) {
  try {
    const f = basis.frontier, x = basis.fxGbpPerUsd;
    return [
      { key: 'frontier', value: f.inPerM, what: f.product + ', input, ' + f.unit, source: f.source },
      { key: 'fxGbpPerUsd', value: x.value, what: x.what, source: x.source },
    ];
  } catch { return []; }
}

/** the tongue's figures from the committed ship record; null unless every place carries three positive counts */
export function measuredOf(shipRun) {
  try {
    const places = shipRun.places;
    if (!Array.isArray(places) || places.length === 0) return null;
    const keepToday = [], keepMinified = [];
    for (const p of places) {
      if (![p.todayTokens, p.minifiedTokens, p.packedTokens].every(isPos)) return null;
      // the shipped switch: where the pack is not cheaper, the place stays as it is and keeps every token
      keepToday.push(Math.min(1, p.packedTokens / p.todayTokens));
      keepMinified.push(Math.min(1, p.packedTokens / p.minifiedTokens));
    }
    return {
      places: places.length,
      winsToday: keepToday.filter((k) => k < 1).length, winsMinified: keepMinified.filter((k) => k < 1).length,
      keepToday: r4(upperMedian(keepToday)), keepMinified: r4(upperMedian(keepMinified)),
      bestToday: r4(Math.min(...keepToday)), bestMinified: r4(Math.min(...keepMinified)),
    };
  } catch { return null; }
}

/** the case. input (all optional, defaults above): millionTokensPerMonth, pricePerMillion (GBP; null = the sourced
 *  figure), minifiedToday, years */
export function tongueCase(basis, measured, input) {
  try {
    const sourced = priceOf(basis);
    if (sourced === null) return { ok: false, why: 'a sourced basis with the model price and the exchange rate' };
    const m = measured && typeof measured === 'object' ? measured : {};
    if (![m.keepToday, m.keepMinified].every((k) => isPos(k) && k <= 1)) return { ok: false, why: 'the measured figures from the ship record' };
    const i = { ...DEFAULTS, ...(input && typeof input === 'object' ? input : {}) };
    if (!isNum(i.millionTokensPerMonth) || i.millionTokensPerMonth > MAX_TOKENS) return { ok: false, why: 'million tokens a month: 0 to ' + MAX_TOKENS };
    if (i.pricePerMillion !== null && (!isNum(i.pricePerMillion) || i.pricePerMillion > MAX_PRICE)) return { ok: false, why: 'your price per million input tokens: 0 to ' + MAX_PRICE };
    if (typeof i.minifiedToday !== 'boolean') return { ok: false, why: 'already minified today: yes or no' };
    if (!Number.isInteger(i.years) || i.years < 1 || i.years > 10) return { ok: false, why: 'years: 1 to 10' };

    const price = i.pricePerMillion === null ? sourced : i.pricePerMillion;
    const keep = i.minifiedToday ? m.keepMinified : m.keepToday;
    const tokensPerYear = i.millionTokensPerMonth * 12;
    const perYear = { today: r2(tokensPerYear * price), packed: r2(tokensPerYear * keep * price) };
    const over = { today: r2(perYear.today * i.years), packed: r2(perYear.packed * i.years) };
    return {
      ok: true, inputs: i, price, priceSourced: i.pricePerMillion === null, keep,
      tokens: { packedPerMonth: r2(i.millionTokensPerMonth * keep), savedPerMonth: r2(i.millionTokensPerMonth * (1 - keep)) },
      perYear, over, savingPerYear: r2(perYear.today - perYear.packed), savingOver: r2(over.today - over.packed),
    };
  } catch { return { ok: false, why: 'the inputs could not be read' }; }
}

export default { DEFAULTS, BASIS_KEYS, MAX_TOKENS, MAX_PRICE, upperMedian, priceOf, sourcesOf, measuredOf, tongueCase };
