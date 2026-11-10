// layered/page.mjs — the LIGHT, LAYERED page's glue. Every number comes from data/record.json, or from fold.mjs and
// settle.mjs running in this tab; none is typed into index.html. The verdicts are recomputed here from the record.
import * as F from './src/fold.mjs';
import * as S from './src/settle.mjs';
import { verdicts, LADDER, ALONE, GROW } from './src/verdict.mjs';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(props)) if (k === 'class') e.className = v; else e.setAttribute(k, v); for (const c of kids) e.append(c); return e; };
const x = (r) => (r >= 100 ? r.toFixed(0) : r >= 10 ? r.toFixed(1) : r.toFixed(2)) + '×';
const big = (n) => Number(n).toLocaleString('en-GB');
const kb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(n % 1048576 ? 1 : 0) + ' MiB' : n >= 1024 ? Math.round(n / 1024) + ' KiB' : n + ' B');
const tagOf = (held) => el('span', { class: 'tag ' + (held ? 'held' : 'failed') }, held ? 'HELD' : 'FAILED');
const te = new TextEncoder(), td = new TextDecoder();
const NAMES = ['D1', '+D2', '+D3', '+D4', '+D5'];
const CLAIMS = {
  L1: ['Every layer set round-trips every held item; the mutation gate is clean.', 'HOLD'],
  L2: ['The full stack decodes every held item to SHA-256-identical bytes.', 'HOLD'],
  L3: ['On structured data (call book, records) the ratio climbs strictly at every layer.', 'HOLD'],
  S2: ['The ratio compounds across dimensions on structured data (the same measurement as L3).', 'as L3'],
  L4: ['A cold frame (no shared state) and a whisper (the seed) are read by the same decoder, both lossless.', 'HOLD'],
  L5: ['A drifted seed is refused, the sender falls back and that decodes; a changed byte never decodes into other bytes.', 'HOLD'],
  L7: ['The folds multiply: full stack ≥ D1 × each upper layer\'s gain measured alone.', 'FAIL (the layers overlap)'],
  L8: ['15× or more on at least one type, full stack.', 'HOLD on the call book only'],
  L9: ['Smaller than gzip, Brotli and zstd, and than deflate and zstd given the same seed.', 'HOLD'],
  L10: ['Smaller than LIGHT v1 on every type.', 'HOLD'],
  L11: ['The seed grows: the ratio is never lower at a larger seed.', 'HOLD'],
  L12: ['The flat layer (D1) alone is at most 2× on every type.', 'HOLD'],
  S1: ['One blob, two faces: each rule frame decodes to the exact rule, and settles to the library\'s own answer.', 'HOLD'],
  S3: ['The node answers with zero calls out of it.', 'HOLD'],
  S4: ['Capability = stack depth: more rules, more right answers, on a slice the gate never saw.', 'FAIL (the gate is strict)'],
  S5: ['The model only proposes; every rule in the stack has the gate\'s receipt; some proposals are dropped.', 'HOLD'],
  S6: ['Two nodes that share more send less: the last third of their exchange beats the first third.', 'HOLD'],
};
let REC = null, VS = null, SEED = null, LASTFRAME = null;

const pooled = (t, g, k) => { const c = (t[g] || {})[k]; return c && c.frame ? t.raw / c.frame : 0; };
const full = (t) => pooled(t, 'ladder', '31');
const NS = 'http://www.w3.org/2000/svg';
function svg(W, H) { const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 ' + W + ' ' + H); s.add = (name, attrs, text) => { const e = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; s.append(e); return e; }; return s; }
const logY = (T, H, B, top) => (r) => T + (H - T - B) * (1 - Math.log(Math.max(1, Math.min(top, r))) / Math.log(top));

function ladderChart() {
  const types = REC.types, top = Math.max(16, ...types.map(full)) * 1.15;
  const W = 900, H = 320, L = 50, T = 16, B = 50, gw = (W - L - 10) / types.length, s = svg(W, H), y = logY(T, H, B, top);
  for (const r of [1, 2, 4, 8, 15, 32, 64].filter((r) => r < top)) {
    s.add('line', { x1: L, x2: W - 10, y1: y(r), y2: y(r), stroke: r === 15 ? 'var(--bad)' : 'var(--line)', 'stroke-dasharray': r === 15 ? '6 5' : '' });
    s.add('text', { x: L - 6, y: y(r) + 4, 'text-anchor': 'end', class: r === 15 ? 'r' : 'd' }, r + '×');
  }
  const colours = ['var(--faint)', 'var(--accent2)', 'var(--gold)', 'var(--accent)', 'var(--grn)'];
  types.forEach((t, i) => {
    const x0 = L + i * gw + 10, bw = (gw - 30) / 5;
    LADDER.forEach((k, j) => {
      const r = pooled(t, 'ladder', k), yy = y(r);
      s.add('rect', { x: x0 + j * bw, y: yy, width: bw - 3, height: Math.max(1, y(1) - yy), fill: colours[j], rx: 2 });
      if (j === 4) s.add('text', { x: x0 + j * bw + bw / 2, y: yy - 4, 'text-anchor': 'middle', class: 'g', style: 'font-size:11px' }, x(r));
    });
    for (const [key, dash, name] of [['zstdSeed', '5 3', 'zstd+seed'], ['lightV1', '2 3', 'LIGHT v1']]) {
      const r = t.raw / t.baselines[key];
      s.add('line', { x1: x0 - 4, x2: x0 + 5 * bw, y1: y(r), y2: y(r), stroke: 'var(--ink)', 'stroke-dasharray': dash, 'stroke-width': 1.2 });
    }
    s.add('text', { x: x0 + 2.5 * bw, y: H - 30, 'text-anchor': 'middle' }, t.label);
    s.add('text', { x: x0 + 2.5 * bw, y: H - 14, 'text-anchor': 'middle', class: 'd', style: 'font-size:11px' }, t.privacy + ' · ' + t.items + ' items');
  });
  NAMES.forEach((n, j) => s.add('text', { x: L + 8 + j * 64, y: T + 2, fill: colours[j], style: 'font-size:12px' }, '■ ' + n));
  s.add('text', { x: L + 340, y: T + 2, class: 'd', style: 'font-size:12px' }, '- - zstd -19 given the same seed   ··· LIGHT v1');
  $('ladder-chart').replaceChildren(s);
  const tb = $('ladder-table').querySelector('tbody');
  tb.replaceChildren(...REC.types.map((t) => {
    const r = LADDER.map((k) => pooled(t, 'ladder', k));
    return el('tr', {}, el('td', {}, t.t + ' ' + t.label), el('td', { class: 'n' }, big(t.items)),
      ...r.map((v, j) => el('td', { class: 'n' }, x(v) + (j ? ' (' + (v / r[j - 1]).toFixed(2) + ')' : ''))),
      ...['gzip9', 'brotli11', 'zstd19', 'zstdSeed', 'lightV1'].map((k) => el('td', { class: 'n' }, x(t.raw / t.baselines[k]))));
  }));
  $('ladder-note').textContent = 'In brackets: that layer\'s fold over the one below. ' + REC.types.map((t) => {
    const r = LADDER.map((k) => pooled(t, 'ladder', k)), folds = r.slice(1).map((v, j) => v / r[j]), lo = folds.indexOf(Math.min(...folds));
    return t.label + ' plateaus most at ' + NAMES[lo + 1] + ' (' + folds[lo].toFixed(2) + ')';
  }).join('; ') + '.';
}

function multiply() {
  const v = VS.find((y) => y.id === 'L7');
  $('mult-table').querySelector('tbody').replaceChildren(...REC.types.map((t) => {
    const r1 = pooled(t, 'ladder', '1'), alone = Object.values(ALONE).map((k) => pooled(t, k === '3' ? 'ladder' : 'alone', k));
    const product = alone.reduce((p, a) => p * (a / r1), r1), f = full(t);
    return el('tr', {}, el('td', {}, t.label), el('td', { class: 'n' }, x(r1)), ...alone.map((a) => el('td', { class: 'n' }, x(a))),
      el('td', { class: 'n' }, x(product)), el('td', { class: 'n' }, x(f)), el('td', {}, tagOf(f >= product)));
  }));
  $('mult-say').textContent = (v.held ? 'On every type the full stack reached at least the product: the layers compounded at least as much as multiplying would predict. ' : 'Not on every type: ')
    + REC.types.map((t) => { const r1 = pooled(t, 'ladder', '1'), p = Object.values(ALONE).map((k) => pooled(t, k === '3' ? 'ladder' : 'alone', k)).reduce((q, a) => q * (a / r1), r1); return t.label + ' ' + (full(t) >= p ? 'beat' : 'fell short of') + ' its product (' + x(full(t)) + ' vs ' + x(p) + ')'; }).join('; ')
    + '. Where a layer\'s gain alone is small but large inside the stack (the seed teaches the repeat model what to look for), the layers work together; where two layers catch the same thing, they overlap.';
}

function grow() {
  const W = 440, H = 280, L = 44, R = 10, T = 14, B = 34, s = svg(W, H);
  const top = Math.max(16, ...REC.types.map((t) => Math.max(...GROW.map((g) => pooled(t, 'grow', g))))) * 1.1, y = logY(T, H, B, top);
  const xs = (i) => L + (i * (W - L - R)) / (GROW.length - 1);
  for (const r of [1, 2, 4, 8, 15, 32].filter((r) => r < top)) { s.add('line', { x1: L, x2: W - R, y1: y(r), y2: y(r), stroke: r === 15 ? 'var(--bad)' : 'var(--line)', 'stroke-dasharray': r === 15 ? '6 5' : '' }); s.add('text', { x: L - 5, y: y(r) + 4, 'text-anchor': 'end', class: r === 15 ? 'r' : 'd' }, r + '×'); }
  GROW.forEach((g, i) => s.add('text', { x: xs(i), y: H - 12, 'text-anchor': 'middle', class: 'd' }, g === '0' ? 'none' : kb(+g)));
  const col = ['var(--accent)', 'var(--accent2)', 'var(--gold)', 'var(--grn)', 'var(--ink)'];
  const ends = REC.types.map((t, j) => ({ t, j, r: pooled(t, 'grow', GROW[GROW.length - 1]) })).sort((a, b) => b.r - a.r);
  let last = -Infinity;
  for (const e of ends) { e.ly = Math.max(y(e.r) - 4, last + 13); last = e.ly; }
  for (const { t, j, r, ly } of ends) {
    s.add('polyline', { points: GROW.map((g, i) => xs(i) + ',' + y(pooled(t, 'grow', g))).join(' '), fill: 'none', stroke: col[j], 'stroke-width': 2 });
    s.add('text', { x: W - R - 2, y: ly, 'text-anchor': 'end', fill: col[j], style: 'font-size:11px' }, t.label + ' ' + x(r));
  }
  $('grow-chart').replaceChildren(s);
  $('grow-table').querySelector('tbody').replaceChildren(...REC.types.map((t) => el('tr', {}, el('td', {}, t.label), ...GROW.map((g) => el('td', { class: 'n' }, x(pooled(t, 'grow', g)) + (g !== '0' && t.grow[g].seedBytes === t.seedBytes && +g > t.seedBytes ? ' (its whole seed: ' + kb(t.seedBytes) + ')' : ''))))));
  $('pair').replaceChildren(...REC.types.filter((t) => t.pair).map((t) => el('div', { class: 'stat' }, el('span', {}, t.label + ' (' + t.pair.items + ' items, shared ' + kb(t.pair.sharedAtEnd) + ' by the end)'),
    el('b', { class: t.pair.last > t.pair.first ? '' : 'red' }, x(t.pair.first) + ' → ' + x(t.pair.middle) + ' → ' + x(t.pair.last)))),
  el('p', { class: 'dim' }, 'Both nodes\' seeds keep the same id after every item: ' + REC.types.filter((t) => t.pair).every((t) => t.pair.sameId) + '. Every item decoded byte-identical: ' + REC.types.filter((t) => t.pair).map((t) => t.pair.identical + '/' + t.pair.items).join(', ') + '.'));
}

// TRY IT — the codec in this tab
async function packSeed() {
  const out = [];
  for (const k of ['prose', 'records']) {
    const r = await fetch('data/public/' + k + '.json.gz');
    if (!r.ok) throw new Error('the ' + k + ' pack did not load');
    const text = await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text();
    const ctx = JSON.parse(text).context.map((c) => Uint8Array.from(atob(c.b64), (ch) => ch.charCodeAt(0)));
    let t = 0; const pick = [];
    for (let i = ctx.length - 1; i >= 0 && t + ctx[i].length <= 131072; i--) { t += ctx[i].length; pick.unshift(ctx[i]); }
    out.push(...pick);
  }
  return out;
}
function fold() {
  const b = te.encode($('t-in').value), rows = [];
  const add = (name, frame, seed) => {
    const d = F.decode(frame, seed ? { seed } : {}), same = d.ok && d.bytes.length === b.length && d.bytes.every((v, i) => v === b[i]);
    rows.push(el('div', { class: 'stat' }, el('span', {}, name), el('b', { class: same ? '' : 'red' }, big(frame.length) + ' B · ' + x(b.length / frame.length) + (same ? ' · round trip ✓' : ' · round trip FAILED'))));
  };
  rows.push(el('div', { class: 'stat' }, el('span', {}, 'your text'), el('b', {}, big(b.length) + ' B')));
  for (const [m, name] of [[1, 'D1 symbol'], [3, '+D2 token'], [7, '+D3 structure'], [15, '+D4 prediction (cold frame)']]) add(name, F.encode(b, { mask: m }).bytes);
  if (SEED) { LASTFRAME = F.encode(b, { seed: SEED }).bytes; add('+D5 context (whisper, seed ' + F.idOf(SEED) + ')', LASTFRAME, SEED); }
  else rows.push(el('p', { class: 'dim' }, 'Teach the public seed to see D5.'));
  $('t-out').replaceChildren(...rows);
}
async function teach() {
  $('t-out').replaceChildren(el('p', { class: 'dim' }, 'Fetching this site\'s public packs and teaching the most recent 256 KiB of them…'));
  await new Promise((r) => setTimeout(r, 30));
  try {
    const chunks = await packSeed(), t0 = performance.now();
    SEED = F.seed(chunks, { bits: 20 }).seed;
    fold();
    const ms = performance.now() - t0, rate = Math.round(SEED.bytes / 1024 / (ms / 1000));
    $('t-out').prepend(el('p', { class: 'dim' }, 'Seed taught: ' + kb(SEED.bytes) + ' in ' + Math.round(ms) + ' ms (' + rate + ' KiB a second in this browser), id ' + F.idOf(SEED) + '.'));
    $('speed').textContent = 'in this browser it just taught ' + kb(SEED.bytes) + ' at ' + rate + ' KiB a second (decoding runs at the same speed)';
  } catch (e) { $('t-out').replaceChildren(el('p', { class: 'no' }, 'Could not teach the seed: ' + e.message)); }
}
function drift() {
  if (!SEED || !LASTFRAME) { $('t-out').append(el('p', { class: 'dim' }, 'Teach the seed and fold first.')); return; }
  const other = F.fork(SEED).seed; F.grow(other, te.encode('one line the sender never saw\n'));
  const r = F.decode(LASTFRAME, { seed: other }), mask = F.negotiate(SEED, F.idOf(other)), back = F.encode(te.encode($('t-in').value), { mask }).bytes, d = F.decode(back, { seed: other });
  $('t-out').append(el('div', { class: 'callout' }, 'A reader whose seed grew one line apart (id ' + F.idOf(other) + '): the whisper is ' + (r.ok ? 'decoded' : 'refused — "' + r.why + '"') + '. The sender, told that id, falls back to ' + F.label(mask) + ': ' + big(back.length) + ' B, which that reader decodes ' + (d.ok ? 'byte-identical ✓' : 'NOT') + '. Less squeezed, never wrong.'));
}

// STACKED
function stacked() {
  const st = REC.stacked, measured = (st.rules || []).length > 0;
  const rules = measured ? st.rules : (st.libraryRules || []).map((r) => ({ ...r, source: 'the library', held: null }));
  const frames = rules.map((r) => S.frameOf(r).bytes);
  $('st-rules').replaceChildren(...rules.map((r, i) => el('details', {}, el('summary', {}, 'WHEN ' + r.when.join(' AND ') + ' THEN ' + r.then + ' · ' + r.source),
    el('div', { class: 'mono' }, 'frame (' + frames[i].length + ' B): ' + Array.from(frames[i].subarray(0, 32), (b) => b.toString(16).padStart(2, '0')).join(' ') + (frames[i].length > 32 ? ' …' : '')),
    el('div', { class: 'mono' }, 'decoded: ' + td.decode(F.decode(frames[i]).bytes)),
    el('div', { class: 'dim' }, r.held ? 'gate: held-out ' + r.held.right + '/' + r.held.cover + ' right, final-A ' + r.finalA.right + '/' + r.finalA.cover + ', receipt ' + r.receipt : "kept by the library's own nightly gate (on its whole final slice), receipt " + r.receipt))),
  ...(measured ? [] : [el('p', { class: 'callout' }, "This run's stricter gate (its final exam on half the slice) kept no rule, so S1 and S4 had nothing to measure and are recorded as failed. Shown instead: the library as it stands, admitted by its own nightly gate. The demo is the same code; the claim is not counted.")]),
  el('p', { class: 'dim' }, rules.length + (rules.length === 1 ? ' rule' : ' rules') + ' shown' + (st.rulesWithheld ? ' (' + st.rulesWithheld + ' withheld by the private-name filter)' : '') + '; ' + st.counts.cases + ' public repositories, ' + st.counts.families + ' families.'));
  const node = S.stackOf(frames).node;
  $('st-ask').onclick = () => {
    const tokens = S.tokensOf($('st-in').value), real = globalThis.fetch; let calls = 0;
    globalThis.fetch = (...a) => { calls++; return real(...a); };
    let r; try { r = S.resolve(node, tokens); } finally { globalThis.fetch = real; }
    $('st-out').replaceChildren(el('div', {}, 'words: ' + (tokens.join(' ') || '(none)')), el('div', {}, 'answer: ' + r.answer + (r.at >= 0 ? ' · by rule ' + (r.at + 1) + ', receipt ' + r.receipt : ' · no rule fired, so it says unknown rather than guess')), el('div', {}, 'calls out of the node: ' + calls));
  };
  const by = st.s4.byDepth;
  $('st-depth').replaceChildren(...by.map((d) => el('div', { class: 'stat' }, el('span', {}, d.depth + ' rule' + (d.depth === 1 ? '' : 's')), el('b', {}, d.right + ' right of ' + d.answered + ' answered (' + st.counts.finalB + ' cases)'))));
  const s5 = st.s5;
  $('st-gate').replaceChildren(...Object.entries(s5.proposed).map(([k, n]) => el('div', { class: 'stat' }, el('span', {}, 'proposed by ' + (k === '7b' ? 'the local 7B' : k === 'mined' ? 'the miner' : 'the library')), el('b', {}, String(n)))),
    el('div', { class: 'stat' }, el('span', {}, 'kept by the gate'), el('b', {}, String(s5.stack))), el('div', { class: 'stat' }, el('span', {}, 'dropped, with a reason'), el('b', { class: 'red' }, String(s5.dropped))),
    el('p', { class: 'dim' }, 'Why dropped: ' + Object.entries(s5.droppedWhy).map(([k, n]) => k + ' ' + n).join(', ') + '. ' + (s5.model7b ? 'The 7B (' + s5.model7b + ') was called ' + s5.calls7b + ' times, offline, before any case was answered.' : 'The 7B proposed nothing: ' + (s5.why7b || 'it was not reached') + '.')));
}

function fill() {
  const v = VS, held = v.filter((y) => y.held).length, best = [...REC.types].sort((a, b) => full(b) - full(a))[0];
  const flat = [...REC.types].sort((a, b) => pooled(b, 'ladder', '1') - pooled(a, 'ladder', '1'))[0], l8 = v.find((y) => y.id === 'L8');
  $('kstat').textContent = held + ' of ' + v.length + ' sealed claims held'; $('kstat').classList.add('live');
  $('f-best').textContent = x(full(best)); $('f-best-s').textContent = 'best full stack: ' + best.label + ' (D1..D5)';
  $('f-flat').textContent = x(pooled(flat, 'ladder', '1'));
  $('f-15').textContent = l8.held ? 'reached' : 'not reached'; $('f-15-s').textContent = 'the 15× bar: ' + (l8.held ? 'on ' + REC.types.filter((t) => full(t) >= 15).map((t) => t.label).join(', ') : 'best ' + full(best).toFixed(3) + '× on the ' + best.label);
  const items = REC.types.reduce((a, t) => a + t.items, 0), ident = REC.types.reduce((a, t) => a + t.ladder['31'].identical, 0);
  $('f-ll').textContent = big(ident) + '/' + big(items);
  $('w-gate').textContent = REC.gate.killed + ' of ' + REC.gate.total;
  const cr = REC.types.reduce((n, t) => n + t.corrupt.refused, 0), dr = REC.types.reduce((n, t) => n + t.drift.refused, 0);
  $('sec-n').textContent = 'measured: ' + big(cr) + ' of ' + big(items) + ' frames with a byte changed, and ' + big(dr) + ' of ' + big(items) + ' readers holding a drifted seed, refused'; $('f-gate').textContent = REC.gate.killed + '/' + REC.gate.total;
  const failed = v.filter((y) => !y.held).map((y) => y.id);
  $('headline').textContent = 'Measured once, on items dated after the cut: the full stack reached ' + REC.types.map((t) => x(full(t)) + ' on ' + t.label).join(', ') + ' (D1..D5, pooled). D1 alone stayed between ' + x(Math.min(...REC.types.map((t) => pooled(t, 'ladder', '1')))) + ' and ' + x(pooled(flat, 'ladder', '1')) + '. ' + (failed.length ? 'Failed, and kept: ' + failed.map((id) => ({ L7: 'the folds did not simply multiply (L7)', L8: '15× was not reached (L8: best ' + full(best).toFixed(3) + '× on the ' + best.label + ')', S1: 'the measured pattern stack came out empty (S1, S4)', S4: null }[id] || (id === 'S4' ? null : id))).filter(Boolean).join('; ') + '.' : 'Every sealed claim held.');
  $('verdicts').querySelector('tbody').replaceChildren(...v.map((y) => el('tr', {}, el('td', {}, el('b', {}, y.id)), el('td', {}, CLAIMS[y.id][0] + ' Predicted: ' + CLAIMS[y.id][1] + '.'), el('td', {}, tagOf(y.held)), el('td', { class: 'mono' }, y.measured))));
  const same = JSON.stringify(v) === JSON.stringify(REC.verdicts);
  $('rc-meta').textContent = 'Cut ' + REC.cut + ' · held items up to ' + REC.end + ' (SEAL 2) · measured ' + REC.ran + ' on Node ' + REC.node + ' · private snapshot sha256 ' + String(REC.snapshot).slice(0, 16) + '… · verdicts recomputed in this tab from the record: ' + (same ? 'identical ✓' : 'DIFFERENT');
  const rec = REC.types.find((t) => t.key === 'records');
  if (rec) $('trace').textContent = 'The ' + big(rec.items) + ' public JSON records held out (' + kb(rec.raw) + ') went to ' + LADDER.map((k, j) => NAMES[j] + ' ' + kb(rec.ladder[k].frame)).join(', ') + ', every one decoded and checked; zstd -19 gave ' + kb(rec.baselines.zstd19) + ', and given the same 4 MiB seed ' + kb(rec.baselines.zstdSeed) + '.';
  const small = REC.types.filter((t) => t.items < 20);
  $('scope-small').textContent = small.length ? 'Small samples: ' + small.map((t) => t.label + ' had ' + t.items + ' held items').join(', ') + ' (everything dated after the cut, as sealed); their ratios rest on few items.' : 'Every type had at least 20 held items.';
  $('scope-fail').textContent = failed.length ? 'Failed claims are shown, not hidden: ' + failed.map((id) => id + ' (' + v.find((y) => y.id === id).measured + ')').join('; ') + '.' : 'Every sealed claim held on this data; a different estate\'s data may not.';
  $('results').replaceChildren(...v.map((y) => el('li', {}, y.id + ' ' + (y.held ? 'held' : 'failed') + ': ' + y.measured)));
  $('meaning').textContent = 'The flat layer is the low one; the big multipliers came from prediction and, most of all, from the shared seed. ' + (v.find((y) => y.id === 'L7').held ? 'The folds compounded at least as much as multiplying would predict, because the seed and the repeat model work together.' : 'The folds did not simply multiply: layers that catch the same redundancy overlap.') + ' ' + (l8.held ? '15× is real on ' + REC.types.filter((t) => full(t) >= 15).map((t) => t.label).join(' and ') + ', where both ends already share most of what is said.' : '15× was not reached.') + ' Level 2 to 4: a verified rule kept as a frame is data and code at once, and a node runs on its stack with no model in the loop.';
  $('faq-15').textContent = l8.held ? 'Yes, on ' + REC.types.filter((t) => full(t) >= 15).map((t) => t.label + ' (' + x(full(t)) + ', full stack)').join(', ') + '. Not on ' + REC.types.filter((t) => full(t) < 15).map((t) => t.label + ' (' + x(full(t)) + ')').join(', ') + '.' : 'No. The best was ' + full(best).toFixed(3) + '× on ' + best.label + ', full stack: ' + (15 - full(best)).toFixed(3) + ' short of the bar. The next best was ' + x(full([...REC.types].sort((a, b) => full(b) - full(a))[1])) + '.';
  $('board').textContent = 'On the estate\'s own data, measured against held-out items with every failure kept, the layered codec stored ' + REC.types.map((t) => t.label + ' at ' + x(full(t))).join(', ') + ', against zstd -19 at ' + REC.types.map((t) => x(t.raw / t.baselines.zstd19)).join(', ') + '. It is owned outright, runs where the data is, and is checked by CI on every change.';
  const sel = $('c-type'); sel.replaceChildren(...REC.types.map((t) => el('option', { value: t.key }, t.label)));
  const calc = () => {
    const t = REC.types.find((y) => y.key === sel.value), vs = $('c-vs').value, bill = Math.max(0, Number($('c-bill').value) || 0);
    const cmp = vs === 'raw' ? t.raw : t.baselines[vs], f = t.ladder['31'].frame, save = bill * (1 - f / cmp);
    $('c-out').textContent = save > 0 ? 'About ' + big(Math.round(save)) + ' a month saved (' + Math.round((1 - f / cmp) * 100) + '% fewer bytes than ' + (vs === 'raw' ? 'raw' : vs) + ' on ' + t.label + ')' : 'No saving against ' + vs + ' on ' + t.label + ' at this depth.';
  };
  for (const id of ['c-type', 'c-vs', 'c-bill']) $(id).addEventListener('input', calc);
  calc();
}

$('theme').onclick = () => { const r = document.documentElement, dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; r.dataset.theme = dark ? 'light' : 'dark'; };
$('t-run').onclick = fold; $('t-teach').onclick = teach; $('t-drift').onclick = drift;
fetch('../light/data/light-run.json').then((r) => (r.ok ? r.json() : null)).then((v1) => { if (v1) $('v1ratio').textContent = x(v1.facts.codec.medianRatioJson); }).catch(() => {});
fetch('data/record.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error('no record')))).then((rec) => {
  REC = rec; VS = verdicts(rec);
  fill(); ladderChart(); multiply(); grow(); stacked(); fold();
}).catch((e) => { $('kstat').textContent = 'the record did not load: ' + e.message; });
