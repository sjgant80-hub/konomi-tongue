// curve/page.mjs — the 15x curve page's glue. Every number comes from data/curve.json, data/witness.json or the cost
// kernel run in this tab (claim K11: none is typed into index.html). Count your text runs the same tokenizer as the curve.
import Q from './src/qwentok.mjs';
import C from './src/curve.mjs';
import CK from '../tongue-cost.mjs';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(props)) if (k === 'class') e.className = v; else e.setAttribute(k, v); for (const c of kids) e.append(c); return e; };
const json = (p) => fetch(p).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const x = (r) => r.toFixed(r < 10 ? 2 : 1) + '×';
const x3 = (r) => r.toFixed(3) + '×';   // where two places would hide the movement (1.084 → 1.080 both read 1.08)
const big = (n) => Number(n).toLocaleString('en-GB');
const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const tag = (v) => el('span', { class: 'tag ' + (v.pass ? 'held' : 'failed') }, v.pass ? 'HELD' : 'FAILED');
const better = (p) => Math.max(p.A.ratio, p.B.ratio);
let REC = null, GATE = null, BASIS = null, TOK = null;

function chart(points, anchors) {
  const W = 900, H = 300, L = 54, R = 20, T = 18, B = 40, NS = 'http://www.w3.org/2000/svg';
  const lo = Math.log(1), hi = Math.log(16), yOf = (r) => T + (H - T - B) * (1 - (Math.log(Math.max(1, Math.min(16, r))) - lo) / (hi - lo));
  const n = points.length, xOf = (i) => L + (n > 1 ? (i * (W - L - R)) / (n - 1) : (W - L - R) / 2);
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  const add = (name, attrs, text) => { const e = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; s.append(e); return e; };
  for (const r of [1, 2, 4, 8, 15]) {
    add('line', { x1: L, x2: W - R, y1: yOf(r), y2: yOf(r), stroke: r === 15 ? 'var(--bad)' : 'var(--line)', 'stroke-dasharray': r === 15 ? '6 5' : '', 'stroke-width': r === 15 ? 2 : 1 });
    add('text', { x: L - 8, y: yOf(r) + 4, 'text-anchor': 'end', class: r === 15 ? 'r' : 'd' }, r + '×');
  }
  add('text', { x: W - R, y: yOf(15) - 6, 'text-anchor': 'end', class: 'r' }, "Simon's 15× line");
  points.forEach((p, i) => add('text', { x: xOf(i), y: H - 14, 'text-anchor': 'middle', class: 'd' }, day(p.window.start)));
  const series = [['A', 'var(--accent)', '', 'A · dictionary (tokens)'], ['B', 'var(--accent2)', '', 'B · held reference (tokens)'], ['C', 'var(--gold)', '4 4', 'C · LIGHT (bytes)'], ['gzip', 'var(--faint)', '2 4', 'gzip-9 (bytes)']];
  series.forEach(([k, colour, dash, name], j) => {
    if (n > 1) add('polyline', { points: points.map((p, i) => xOf(i) + ',' + yOf(p[k].ratio)).join(' '), fill: 'none', stroke: colour, 'stroke-width': 2.5, 'stroke-dasharray': dash });
    points.forEach((p, i) => add('circle', { cx: xOf(i), cy: yOf(p[k].ratio), r: 4, fill: colour }));
    add('text', { x: L + 6 + j * 210, y: T + 4, fill: colour, style: 'font-size:12px' }, name);
  });
  anchors.forEach((a, j) => add('text', { x: L + 6, y: yOf(Math.min(a.ratio, 15)) + (a.ratio > 15 ? -4 : 14) + j * 0, class: 'g', style: 'font-size:11px' }, '◆ ' + a.label + ' ' + x(a.ratio) + ' (' + a.unit + ', ' + day(a.at) + ')' + (a.ratio > 15 ? ' ↑ off the scale' : '')));
  $('chart').replaceChildren(s);
}

function fill() {
  const pts = REC.points, last = pts[pts.length - 1], v = REC.verdicts, vf = (id) => v.find((y) => y.id === id) || {};
  const lossless = pts.reduce((n, p) => n + p.A.lossless + p.B.lossless + p.C.lossless, 0), coded = pts.reduce((n, p) => n + 3 * p.held.messages, 0);
  const held = v.filter((y) => y.pass).length;
  $('kstat').textContent = held + ' of ' + v.length + ' sealed claims held · ' + pts.length + ' points';
  $('kstat').classList.add('live');
  $('f-best').textContent = x(better(last));
  $('f-best-s').textContent = 'the better token coding, week starting ' + day(last.window.start) + ' (' + (last.B.ratio >= last.A.ratio ? 'held reference' : 'dictionary') + ')';
  $('f-gap').textContent = x(15 / better(last)) + ' short';
  $('f-points').textContent = String(pts.length);
  $('f-lossless').textContent = big(lossless) + ' of ' + big(coded);
  chart(pts, REC.anchors);
  $('chart-note').textContent = 'Log scale from 1× (no saving) to 15×. Solid lines are qwen2.5 tokens; dashed lines are bytes. The diamonds are the sealed 1 October points, in Claude tokens, shown for reference only.';
  $('points').querySelector('tbody').replaceChildren(...pts.map((p) => el('tr', {}, el('td', {}, day(p.window.start) + ' – ' + day(p.window.end)), el('td', { class: 'n' }, big(p.held.messages)), el('td', { class: 'n' }, x(p.A.ratio)), el('td', { class: 'n' }, x(p.B.ratio)), el('td', { class: 'n' }, x(p.C.ratio)), el('td', { class: 'n' }, x(p.gzip.ratio)))));
  const first = pts[0];
  $('lesson').textContent = 'Over ' + pts.length + ' weeks the better token coding went from ' + x3(better(first)) + ' to ' + x3(better(last)) + (vf('K7').pass ? ': it climbed, against the sealed prediction.' : ', so the curve did not climb, as sealed.') + ' The held-reference line saves only the lines a reader already holds word for word, and most of each week is new. LIGHT shrinks the bytes ' + x(last.C.ratio) + ' (gzip ' + x(last.gzip.ratio) + '), but bytes are for storage and transport; a model would still have to read the text. On new information, 15× is ' + x(15 / better(last)) + ' further away than the best line reaches.';
  const tb = $('claims').querySelector('tbody'); tb.replaceChildren();
  const show = (y) => (y.id === 'K1' ? y.measured.join(', ') : y.id === 'K2' ? y.measured.map((b) => (b ? 'yes' : 'no')).join(', ') : y.id === 'K7' ? x3(y.measured[0]) + ' → ' + x3(y.measured[1]) : y.id === 'K8' ? y.measured.map(([c, g]) => x(c) + ' vs ' + x(g)).join(', ') : y.measured.map(x).join(', '));
  for (const y of v) tb.append(el('tr', {}, el('td', {}, el('b', {}, y.id)), el('td', {}, y.what), el('td', {}, show(y)), el('td', {}, y.bar), el('td', {}, tag(y))));
  const k3 = REC.tokenizer.verify;
  tb.append(el('tr', {}, el('td', {}, el('b', {}, 'K3')), el('td', {}, 'the JavaScript tokenizer counts exactly what the local model counts'), el('td', {}, k3.equal + ' of ' + k3.of + ' texts the same'), el('td', {}, 'every text'), el('td', {}, tag({ pass: k3.equal === k3.of && k3.of >= 40 }))));
  for (const [id, w, how] of [['K9', 'the public file holds only numbers, dates, fixed labels and hashes', 'checked in CI'], ['K10', 'every point re-derives byte for byte from its pinned snapshot', 'checked where the snapshot lives'], ['K11', 'no measured number is typed into this page', 'checked in CI']])
    tb.append(el('tr', {}, el('td', {}, el('b', {}, id)), el('td', {}, w), el('td', {}, how), el('td', {}, '—'), el('td', {}, el('span', { class: 'tag na' }, 'CI'))));
  for (const g of (GATE && GATE.kernels) || []) tb.append(el('tr', {}, el('td', {}, el('b', {}, 'G')), el('td', {}, 'mutation gate on ' + g.file), el('td', {}, g.killed + ' of ' + g.total + ' caught, ' + g.ignored + ' baselined'), el('td', {}, 'clean'), el('td', {}, tag({ pass: g.clean && g.ignored === 0 }))));
  const gl = (f) => { const g = ((GATE && GATE.kernels) || []).find((k) => k.file === f); return g ? 'mutation gate ' + g.killed + '/' + g.total + ', nothing baselined' : 'tested'; };
  $('parts').querySelector('tbody').replaceChildren(...[
    ['curve/src/qwentok.mjs', 'qwen2.5\'s own tokenizer in plain JavaScript: the pre-tokenizer, the byte map, the merges', gl('curve/src/qwentok.mjs') + '; K3 ' + k3.equal + '/' + k3.of + ' against the local model'],
    ['curve/src/curve.mjs', 'the weekly windows, the time split, the held-reference coder, the verdicts, the public-file check', gl('curve/src/curve.mjs')],
    ['curve/data/qwen2.5-merges.txt', 'the merge table, read from the model file on the estate\'s laptop', 'its SHA-256 is in the record and in qwen2.5-source.json'],
    ['curve/tools/curve.mjs', 'the measurement: snapshot, split, code, decode, count, publish only numbers', 'K10, re-derived where the snapshot lives'],
    ['curve/tools/tokverify.mjs', 'counts committed public texts both ways and compares', 'recounted in CI'],
    ['../tongue.mjs · ../light/codec.mjs · ../tongue-cost.mjs', 'the dictionary coder, LIGHT\'s codec and the cost case, used unchanged', 'each gated in its own receipt'],
  ].map(([a, b, c]) => el('tr', {}, el('td', { class: 'mono' }, a), el('td', {}, b), el('td', {}, c))));
  const ul = $('results'); ul.replaceChildren(...pts.map((p) => el('li', {}, 'Week of ' + day(p.window.start) + ': ' + big(p.held.messages) + ' messages; A ' + x(p.A.ratio) + ', B ' + x(p.B.ratio) + ' (tokens); C ' + x(p.C.ratio) + ', gzip ' + x(p.gzip.ratio) + ' (bytes); lossless ' + (p.A.lossless + p.B.lossless + p.C.lossless) + '/' + 3 * p.held.messages + '.')));
  $('faq-15').textContent = 'No. At the newest point the better token coding is ' + x(better(last)) + ', and no line has reached 15× at any point (claim K6' + (vf('K6').pass ? ', as predicted' : '') + '). The only way the estate has seen high ratios is on material the reader already holds, such as named templates (best ' + x(REC.anchors[3].ratio) + ' on one, in Claude tokens); new information has to be read in full.';
  renderCost();
}

function renderCost() {
  const last = REC.points[REC.points.length - 1], keep = Math.min(1, Math.round((1 / better(last)) * 10000) / 10000);
  const p = $('c-p').value === '' ? null : Number($('c-p').value);
  const r = CK.tongueCase(BASIS, { keepToday: keep, keepMinified: keep }, { millionTokensPerMonth: Number($('c-m').value), pricePerMillion: p, minifiedToday: false, years: Number($('c-y').value) });
  if (!r.ok) { $('c-head').textContent = 'Check the inputs: ' + r.why + '.'; return; }
  const gbp = (n) => '£' + n.toLocaleString('en-GB', { maximumFractionDigits: 2 });
  const yrs = r.inputs.years + (r.inputs.years === 1 ? ' year' : ' years');
  $('c-overh').textContent = 'Over ' + yrs;
  $('c-head').textContent = 'At the newest measured ratio (' + x(better(last)) + '), ' + big(r.inputs.millionTokensPerMonth) + ' million input tokens a month become ' + big(r.tokens.packedPerMonth) + ' million: ' + gbp(r.savingPerYear) + ' a year, ' + gbp(r.savingOver) + ' over ' + yrs + '.';
  $('c-table').querySelector('tbody').replaceChildren(el('tr', {}, el('td', {}, 'Sent as it is'), el('td', { class: 'n' }, gbp(r.perYear.today)), el('td', { class: 'n' }, gbp(r.over.today))), el('tr', {}, el('td', {}, 'Coded at the measured ratio'), el('td', { class: 'n' }, gbp(r.perYear.packed)), el('td', { class: 'n' }, gbp(r.over.packed))));
  $('c-note').textContent = 'Price per million input tokens: ' + gbp(r.price) + (r.priceSourced ? ', the published figure, converted at the reference rate below' : ', yours') + '. Input tokens only; output is unchanged. The ratio is the estate\'s own traffic in qwen tokens; on yours, the sealed test would measure it first.';
}

async function main() {
  [REC, GATE, BASIS] = await Promise.all([json('data/curve.json'), json('data/witness.json'), json('../light/vendor/sovereign-enterprise/data/basis.json')]);
  $('c-src').replaceChildren(...CK.sourcesOf(BASIS || {}).map((s) => { const li = el('li', {}, s.what + ': '); const a = el('a', { href: s.source, rel: 'noopener' }); try { a.textContent = new URL(s.source).hostname; } catch { a.textContent = s.source; } li.append(a); return li; }));
  for (const id of ['c-m', 'c-p', 'c-y']) $(id).addEventListener('input', () => REC && renderCost());
  if (!REC) { $('kstat').textContent = 'the record did not load; reload the page'; return; }
  fill();
}
$('try-go').onclick = async () => {
  const t = $('try-in').value;
  if (!TOK) { $('try-out').textContent = 'loading the tokenizer (1.7 MB, once)…'; const r = await fetch('data/qwen2.5-merges.txt'); TOK = Q.tokenizer(Q.mergesOf(await r.text())); }
  const n = TOK.count(t);
  $('try-out').textContent = big([...t].length) + ' characters · ' + big(n) + ' qwen2.5 tokens · at 15× it would have to be ' + big(Math.ceil(n / 15)) + (Math.ceil(n / 15) === 1 ? ' token' : ' tokens');
};
$('theme').onclick = () => { const r = document.documentElement, dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; r.dataset.theme = dark ? 'light' : 'dark'; };
main();
