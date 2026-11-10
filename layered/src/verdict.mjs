// ════════════════════════════════════════════════════════════════
// layered/src/verdict.mjs — every sealed claim's verdict, computed from the record's numbers alone (pure, total).
// CI recomputes these from layered/data/record.json; the page shows exactly what this returns. A claim with missing
// numbers is NOT held (it says what is missing). L6 and the G gates are checked by tests, not here.
//
//   ratio(raw, frame)        → raw ÷ frame to three places (0 when there is no frame)
//   verdicts(record)         → [{ id, held, measured }]   L1-L5, L7-L12, S1, S3-S6 (S2 is L3: listed with it)
// ════════════════════════════════════════════════════════════════
export const LADDER = Object.freeze(['1', '3', '7', '15', '31']);
export const ALONE = Object.freeze({ D2: '3', D3: '5', D4: '9', D5: '17' });
export const GROW = Object.freeze(['0', '65536', '262144', '1048576', '4194304']);
export const BASELINES = Object.freeze(['gzip9', 'brotli11', 'zstd19', 'deflateSeed', 'zstdSeed']);
export const STRUCTURED = Object.freeze(['callbook', 'records']);
export const PAIRED = Object.freeze(['agent', 'records', 'prose']);
export const BAR15 = 15, FLAT = 2;

const num = (x) => typeof x === 'number' && Number.isFinite(x);
const whole = (x) => Number.isSafeInteger(x) && x >= 0;
export const ratio = (raw, frame) => (whole(raw) && whole(frame) && frame > 0 ? Math.round((raw / frame) * 1000) / 1000 : 0);
const arr = (x) => (Array.isArray(x) ? x : []);
const obj = (x) => (x !== null && typeof x === 'object' && !Array.isArray(x) ? x : {});
const x3 = (r) => r.toFixed(3) + '×';

// one type's frame total at a mask, and its pooled ratio
const total = (t, group, key) => { const e = obj(obj(t[group])[key]); return whole(e.frame) ? e.frame : null; };
const pooled = (t, group, key) => { const f = total(t, group, key); return f === null ? null : ratio(t.raw, f); };
const lossless = (t, group, key) => { const e = obj(obj(t[group])[key]); return whole(e.checked) && e.checked === t.items && e.identical === e.checked && t.items > 0; };

function eachType(rec, keys, fn) {
  const types = arr(rec.types), out = [];
  for (const k of keys) {
    const t = types.find((x) => obj(x).key === k);
    out.push(t ? fn(t) : { ok: false, say: k + ': not measured' });
  }
  return out;
}
const allTypes = (rec) => arr(rec.types).map((t) => obj(t).key).filter((k) => typeof k === 'string');
const v = (id, results, prefix) => {
  const ok = results.length !== 0 && results.every((r) => r.ok);
  return { id, held: ok, measured: (prefix ? prefix + ' · ' : '') + results.map((r) => r.say).join('; ') };
};

export function verdicts(record) {
  const rec = obj(record), keys = allTypes(rec), gate = obj(rec.gate), st = obj(rec.stacked), out = [];
  const groups = (t) => [['ladder', LADDER], ['alone', Object.values(ALONE).filter((k) => k !== '3')], ['grow', GROW]];
  // L1 every layer set round-trips, and the gate is clean
  const l1 = eachType(rec, keys, (t) => {
    const bad = [];
    for (const [g, ks] of groups(t)) for (const k of ks) if (!lossless(t, g, k)) bad.push(g + ' ' + k);
    return { ok: bad.length === 0, say: t.key + (bad.length ? ' NOT lossless at ' + bad.join(', ') : ' every layer set lossless on ' + t.items) };
  });
  l1.push({ ok: gate.clean === true && whole(gate.killed) && gate.killed === gate.total && gate.total > 0, say: 'mutation gate ' + (gate.killed | 0) + '/' + (gate.total | 0) + (gate.clean === true ? ' clean' : ' NOT clean') });
  out.push(v('L1', l1));
  // L2 the full stack, SHA-256 identical
  out.push(v('L2', eachType(rec, keys, (t) => ({ ok: lossless(t, 'ladder', '31'), say: t.key + ' ' + (obj(obj(t.ladder)['31']).identical | 0) + '/' + t.items }))));
  // L3 the ladder climbs strictly on structured data
  const l3 = eachType(rec, STRUCTURED, (t) => {
    const r = LADDER.map((k) => pooled(t, 'ladder', k));
    const ok = r.every(num) && r.every((x, i) => i === 0 || x > r[i - 1]);
    return { ok, say: t.key + ' ' + r.map((x) => (num(x) ? x3(x) : '?')).join(' → ') };
  });
  out.push(v('L3', l3));
  out.push({ id: 'S2', held: out[2].held, measured: 'S2 is L3, one measurement: ' + out[2].measured });
  // L4 cold D1 frames with no state, full frames with the seed, both lossless
  out.push(v('L4', eachType(rec, keys, (t) => ({ ok: lossless(t, 'ladder', '1') && lossless(t, 'ladder', '31'), say: t.key + ' D1 ' + (obj(obj(t.ladder)['1']).identical | 0) + ' + full ' + (obj(obj(t.ladder)['31']).identical | 0) + ' of ' + t.items }))));
  // L5 drift refused, fallback decodes, a changed byte never decodes into other bytes
  out.push(v('L5', eachType(rec, keys, (t) => {
    const d = obj(t.drift), c = obj(t.corrupt);
    const ok = t.items > 0 && d.refused === t.items && d.other === 0 && d.fallback === t.items && whole(c.tried) && c.tried === t.items && c.other === 0 && c.refused + c.exact === c.tried;
    return { ok, say: t.key + ' drift refused ' + (d.refused | 0) + '/' + t.items + ', fallback ' + (d.fallback | 0) + ', changed byte: ' + (c.refused | 0) + ' refused, ' + (c.exact | 0) + ' exact, ' + (c.other | 0) + ' other' };
  })));
  // L7 the folds multiply: full ≥ D1 × Π (alone ÷ D1)
  out.push(v('L7', eachType(rec, keys, (t) => {
    const r1 = pooled(t, 'ladder', '1'), full = pooled(t, 'ladder', '31');
    const alone = Object.values(ALONE).map((k) => pooled(t, k === '3' ? 'ladder' : 'alone', k));
    if (!(r1 > 0) || !num(full) || !alone.every(num)) return { ok: false, say: t.key + ' not measured' };
    const product = alone.reduce((p, a) => p * (a / r1), r1);
    return { ok: full >= product, say: t.key + ' full ' + x3(full) + ' vs product ' + x3(Math.round(product * 1000) / 1000) };
  })));
  // L8 15× on at least one type
  const l8 = eachType(rec, keys, (t) => { const f = pooled(t, 'ladder', '31'); return { ok: num(f) && f >= BAR15, say: t.key + ' ' + (num(f) ? x3(f) : '?') }; });
  out.push({ id: 'L8', held: l8.some((r) => r.ok), measured: l8.map((r) => r.say).join('; ') });
  // L9 below every standard coder, and below them given the same seed
  out.push(v('L9', eachType(rec, keys, (t) => {
    const f = total(t, 'ladder', '31'), b = obj(t.baselines), lose = BASELINES.filter((k) => !(whole(b[k]) && f !== null && f < b[k]));
    return { ok: f !== null && lose.length === 0, say: t.key + ' ' + f + ' bytes' + (lose.length ? ', NOT below ' + lose.join(', ') : ', below all ' + BASELINES.length) };
  })));
  // L10 below LIGHT v1
  out.push(v('L10', eachType(rec, keys, (t) => { const f = total(t, 'ladder', '31'), l = obj(t.baselines).lightV1; return { ok: f !== null && whole(l) && f < l, say: t.key + ' ' + f + ' vs LIGHT v1 ' + l }; })));
  // L11 the seed grows: no lower at each larger seed
  out.push(v('L11', eachType(rec, keys, (t) => {
    const r = GROW.map((k) => pooled(t, 'grow', k));
    return { ok: r.every(num) && r.every((x, i) => i === 0 || x >= r[i - 1]), say: t.key + ' ' + r.map((x) => (num(x) ? x3(x) : '?')).join(' → ') };
  })));
  // L12 the flat layer is the low one
  out.push(v('L12', eachType(rec, keys, (t) => { const r = pooled(t, 'ladder', '1'); return { ok: num(r) && r <= FLAT, say: t.key + ' D1 ' + (num(r) ? x3(r) : '?') }; })));
  // S1 one blob, two faces
  const s1 = obj(st.s1);
  out.push({ id: 'S1', held: whole(s1.rules) && s1.rules > 0 && s1.identical === s1.rules && whole(s1.settled) && s1.settled > 0 && s1.agree === s1.settled && s1.twice === true && s1.nonRuleLabels === 0,
    measured: (s1.identical | 0) + '/' + (s1.rules | 0) + ' frames byte-identical; ' + (s1.agree | 0) + '/' + (s1.settled | 0) + ' settlings agree with the library; twice the same: ' + (s1.twice === true) + '; non-rule frames that gave a label: ' + (whole(s1.nonRuleLabels) ? s1.nonRuleLabels : '?') });
  // S3 zero model calls
  const s3 = obj(st.s3);
  out.push({ id: 'S3', held: s3.fetchCalls === 0 && whole(s3.cases) && s3.cases > 0 && s3.resolved === s3.cases,
    measured: (s3.resolved | 0) + '/' + (s3.cases | 0) + ' cases settled; calls out of the node: ' + (whole(s3.fetchCalls) ? s3.fetchCalls : '?') });
  // S4 capability = stack depth
  const by = arr(obj(st.s4).byDepth).map((d) => obj(d).right);
  const s4ok = by.length >= 3 && by.every(whole) && by.every((x, i) => i === 0 || x >= by[i - 1]) && by[by.length - 1] > by[1];
  out.push({ id: 'S4', held: s4ok, measured: 'right on FINAL-B by depth: ' + (by.length ? by.join(' → ') : 'none') + (by.length < 3 ? ' (a stack of ' + Math.max(0, by.length - 1) + ' rule' + (by.length === 2 ? '' : 's') + ')' : '') });
  // S5 the gate decides
  const s5 = obj(st.s5), prop = obj(s5.proposed), nProp = Object.values(prop).filter(whole).reduce((a, b) => a + b, 0);
  out.push({ id: 'S5', held: whole(s5.stack) && s5.receipts === s5.stack && nProp > 0 && whole(s5.dropped) && s5.dropped >= 1 && s5.unreceipted === 0,
    measured: nProp + ' proposed (' + Object.entries(prop).map(([k, n]) => k + ' ' + n).join(', ') + '); ' + (s5.dropped | 0) + ' dropped; stack ' + (s5.stack | 0) + ', with receipts ' + (s5.receipts | 0) });
  // S6 the pair: the last third smaller than the first third, cold pair decodes, every item round-trips
  out.push(v('S6', eachType(rec, PAIRED, (t) => {
    const p = obj(t.pair), a = p.first, b = p.last;
    const ok = num(a) && num(b) && b > a && p.coldOk === t.items && p.identical === t.items && t.items > 0;
    return { ok, say: t.key + ' first third ' + (num(a) ? x3(a) : '?') + ' → last third ' + (num(b) ? x3(b) : '?') + ', round-trips ' + (p.identical | 0) + '/' + t.items };
  })));
  return out;
}
