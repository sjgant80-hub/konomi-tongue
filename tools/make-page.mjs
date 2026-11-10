#!/usr/bin/env node
// tools/make-page.mjs — the fixpoint. index.html carries the SAME tongue.mjs the tests and the mutation gate prove,
// inlined verbatim, and re-grades every recorded picture read in the browser; every number on the page, in the README and
// in llms.txt is generated here from the committed seal and record by the same grade() — none is typed. Nothing private
// (the agents' messages, the grown dictionary) is ever in the record, so nothing private can reach the page.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import * as T from '../tongue.mjs';
import * as K from '../tongue-cost.mjs';
import { CONFIG, PROMPTS, grade, seedOf } from './run.mjs';

const at = (f) => new URL('../' + f, import.meta.url);
const read = (f) => readFileSync(at(f), 'utf8').replace(/\r\n/g, '\n');
const json = (f) => (existsSync(at(f)) ? JSON.parse(read(f)) : null);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const URL_LIVE = 'https://sjgant80-hub.github.io/konomi-tongue/', REPO = 'https://github.com/sjgant80-hub/konomi-tongue';
const LIGHT = 'https://github.com/sjgant80-hub/smartstuffidontfullyget';
const CREDIT = 'Powered by the Konomi architecture, created by Thomas Frumkin';

const pre = json('data/prereg.json'), run = json('data/run.json'), ver = json('data/verify.json'), prices = json('data/prices.json');
if (!pre) { console.error('not sealed — run tools/seal.mjs first'); process.exit(1); }
const j = run && grade(pre, { ...run, verified: !!(ver && ver.verified) });
const last = (xs) => xs[xs.length - 1];
const x2 = (v) => (Math.round(v * 100) / 100) + '×';
// SHIPPED (2026-10-05): the JSON mode and LIGHT's templates, measured where they land
const shipPre = json('data/ship-prereg.json'), shipRun = json('data/ship-run.json');
const shipJ = shipPre && shipRun && (await import('./ship.mjs')).grade(shipPre, shipRun);

const headline = !run
  ? 'Sealed, being measured. The prices, the corpus split, the channels, the rules and a prediction were committed before any held-out message was coded or any picture read; the result lands here whichever way it goes.'
  : j.passed + ' of ' + j.of + ' sealed rules held. Grown to ' + last(run.text.curve).entries + ' glyphs, the tongue carried the held-out agent messages in ' + x2(last(run.text.curve).ratio)
    + ' fewer Claude tokens and the held-out JSON in ' + x2(last(run.json.curve).ratio) + ', against Simon\'s 15×. Drawn as a picture, the best arm carried ' + j.bestPicture
    + ' bits per token read back at ≥' + pre.config.picture.bar * 100 + '%, against ' + j.bestText + ' for the best text; the coded messages drawn as pictures cost '
    + (run.combined.ratio ? x2(run.combined.ratio) + ' fewer tokens than their English' : 'no ratio (not every message read back at the bar; ' + x2(run.combined.partialRatio) + ' fewer over the ' + run.combined.passing + ' that did)') + '.';

const curveSvg = (pts, label) => {
  const W = 560, H = 200, P = 34, xs = pts.map((p, k) => k), ys = pts.map((p) => p.ratio);
  const hi = Math.max(15, ...ys), x = (k) => P + (k * (W - 2 * P)) / Math.max(1, xs.length - 1), y = (v) => H - P - (v * (H - 2 * P)) / hi;
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(label) + '">'
    + '<line x1="' + P + '" y1="' + y(15) + '" x2="' + (W - P) + '" y2="' + y(15) + '" class="bar15"/><text x="' + (W - P) + '" y="' + (y(15) - 4) + '" class="ax" text-anchor="end">Simon\'s 15×</text>'
    + '<line x1="' + P + '" y1="' + (H - P) + '" x2="' + (W - P) + '" y2="' + (H - P) + '" class="axis"/>'
    + '<polyline fill="none" class="line" points="' + pts.map((p, k) => x(k).toFixed(1) + ',' + y(p.ratio).toFixed(1)).join(' ') + '"/>'
    + pts.map((p, k) => '<circle cx="' + x(k).toFixed(1) + '" cy="' + y(p.ratio).toFixed(1) + '" r="3.5" class="dot"><title>' + p.entries + ' glyphs: ' + p.ratio + '×</title></circle><text x="' + x(k).toFixed(1) + '" y="' + (H - P + 14) + '" class="ax" text-anchor="middle">' + p.entries + '</text><text x="' + x(k).toFixed(1) + '" y="' + (y(p.ratio) - 8).toFixed(1) + '" class="ax" text-anchor="middle">' + p.ratio + '×</text>').join('')
    + '</svg>';
};

let body = '';
if (run) {
  body += '<h2>The sealed rules</h2><div class="card"><table><thead><tr><th>rule</th><th>result</th><th></th><th>predicted before the run</th></tr></thead><tbody>'
    + j.rules.map((r) => '<tr><td>' + esc(pre.rules.find((x) => x.id === r.id).rule) + '</td><td>' + esc(r.value) + '</td><td class="' + (r.pass ? 'pass">PASS' : 'fail">FAIL') + '</td><td class="quiet">' + esc(pre.predictions[r.id]) + '</td></tr>').join('')
    + '</tbody></table></div>';
  body += '<h2>The text channel, growing</h2><div class="card"><p class="quiet" style="margin-top:0">Held-out agent messages (' + run.text.heldMessages + ', never seen while the dictionary grew): plain Claude tokens ÷ coded Claude tokens, as the dictionary grows. The reader holds the dictionary; holding it costs ' + run.text.legendTokens.nested + ' tokens nested (' + run.text.legendTokens.flat + ' unfolded), once. Glyphs nest ' + run.text.depth.max + ' deep at most. Every held-out message decodes back exactly: ' + run.text.lossless.ok + ' of ' + run.text.lossless.n + '.</p>' + curveSvg(run.text.curve, 'Text compression as the dictionary grows') + '</div>';
  body += '<div class="card"><p style="margin-top:0"><b>Can Claude read it?</b> ' + run.text.readback.length + ' coded held-out messages, each given to Claude with the unfolded legend: ' + run.text.readback.filter((r) => r.exact).length + ' decoded exactly; the median character match was ' + (Math.round([...run.text.readback.map((r) => r.rate)].sort((a, b) => a - b)[Math.floor(run.text.readback.length / 2)] * 1000) / 10) + '%.</p></div>';
  body += '<h2>The JSON channel</h2><div class="card"><p class="quiet" style="margin-top:0">Held-out estate JSON (each repo\'s most recently committed data file, plus 300 November–December shopper sessions as records): minified JSON tokens ÷ coded tokens, as the shared schema grows (' + run.json.kinds.schema + ' schemas, ' + run.json.kinds.key + ' keys, ' + run.json.kinds.string + ' strings; holding it costs ' + run.json.legendTokens + ' tokens). Every file decodes back exactly: ' + run.json.lossless.ok + ' of ' + run.json.lossless.n + '.</p>' + curveSvg(run.json.curve, 'JSON compression as the schema grows')
    + '<table><thead><tr><th>held-out file</th><th>JSON tokens</th><th>coded</th><th></th></tr></thead><tbody>' + run.json.perFile.map((f) => '<tr><td>' + esc(f.file.replace('__', ' · ')) + '</td><td class="n">' + f.plainTokens + '</td><td class="n">' + f.codedTokens + '</td><td class="n">' + f.ratio + '×</td></tr>').join('') + '</tbody></table></div>';
  const P = run.picture, armName = { A: 'A · raw dots', B: 'B · familiar glyphs', C: 'C · glyphs evolved against misreads' };
  body += '<h2>The picture channel</h2><div class="card"><p class="quiet" style="margin-top:0">Payloads drawn at shrinking sizes and read back blind by ' + esc(run.model) + '. Bits per token counts only where every held-out image read back at ≥' + pre.config.picture.bar * 100 + '%. The best text encoding of the same bits: ' + P.textBaselines.map((b) => esc(b.encoding) + ' ' + b.bitsPerToken).join(', ') + ' bits per token.</p><table><thead><tr><th>arm</th><th>size</th><th>read back</th><th>image tokens</th><th>bits per token</th></tr></thead><tbody>'
    + ['A', 'B', 'C'].flatMap((a) => [...new Set(P.reads.filter((r) => r.arm === a && r.split === 'held').map((r) => r.size))].map((s) => {
      const rs = P.reads.filter((r) => r.arm === a && r.split === 'held' && r.size === s);
      const rate = rs.reduce((x, r) => x + r.grade.right, 0) / rs.reduce((x, r) => x + r.grade.n, 0), tok = rs.reduce((x, r) => x + r.imageTokens, 0) / rs.length;
      const bits = rs[0].bits / tok;
      return '<tr' + (P.arms[a].best && P.arms[a].best.size === s ? ' class="best"' : '') + '><td>' + armName[a] + '</td><td class="n">' + s + ' px</td><td class="n">' + (Math.round(rate * 1000) / 10) + '%</td><td class="n">' + Math.round(tok) + '</td><td class="n">' + (rate >= pre.config.picture.bar ? (Math.round(bits * 100) / 100) : '—') + '</td></tr>';
    })).join('') + '</tbody></table>'
    + '<p class="quiet">Nesting (raw dots in blocks of 3, blocks of blocks …, ' + pre.config.picture.depth.dot + ' px dots): ' + P.depthCurve.map((d) => 'depth ' + d.depth + ' (' + d.dots + ' dots) ' + Math.round(d.rate * 1000) / 10 + '%').join(' · ') + '.</p>'
    + '<div class="thumbs">' + ['A', 'B', 'C'].map((a) => { const r = P.reads.find((x) => x.arm === a && x.split === 'held' && x.k === 0 && P.arms[a].best && x.size === P.arms[a].best.size) || P.reads.find((x) => x.arm === a && x.split === 'held'); return '<figure><img src="' + r.image + '" alt="' + armName[a] + ' payload at ' + r.size + ' px" loading="lazy"><figcaption>' + armName[a] + ', ' + r.size + ' px</figcaption></figure>'; }).join('') + '</div>'
    + '<p><button id="regrade" type="button">Re-grade every read in your browser</button> <span id="out" class="quiet" role="status" aria-live="polite"></span></p></div>';
  const c = run.combined, tc = last(run.text.curve);
  // priced as the run planned them (the last price listed for a glyph wins, as in the run)
  const planned = new Map(prices.glyphs.map((p) => [p.g, p.cost]));
  const ones = run.picture.alphabet.filter((g) => planned.get(g) === 1).length;
  const why = 'The held-out messages cost ' + tc.plainTokens + ' Claude tokens plain; the grown dictionary saved ' + (tc.plainTokens - tc.codedTokens) + ' of them ('
    + (Math.round(((tc.plainTokens - tc.codedTokens) / tc.plainTokens) * 1000) / 10) + '%). Four things hold it back. New information: most of what an agent says has not been said before, and a dictionary only saves what recurs. Cheap glyphs are scarce: of the ' + run.picture.alphabet.length
    + ' glyphs the tongue could write, only ' + ones + ' were planned at one token, so a two-token glyph pays only for a phrase of three tokens or more — and Claude\'s tokenizer already spends about one token on a common English word. Holding the dictionary costs ' + run.text.legendTokens.nested + ' tokens, ' + (run.text.legendTokens.nested > tc.plainTokens ? 'more' : 'less') + ' than the held-out messages themselves. And Claude decoded ' + run.text.readback.filter((r) => r.exact).length + ' of ' + run.text.readback.length
    + ' coded messages exactly. In pictures, dense grids of random symbols — raw dots or kanji — never read back at 99% at any size tried; plain text drawn at 12 px did, and that is where the picture gain comes from.';
  body += '<h2>What limits it</h2><div class="card"><p style="margin-top:0">' + esc(why) + '</p></div>';
  body += '<h2>Both at once</h2><div class="card"><p style="margin-top:0">' + c.of + ' held-out messages, coded with the full dictionary and drawn as text: ' + c.passing + ' read back at ≥' + pre.config.picture.bar * 100 + '%. ' + (c.ratio ? 'Plain English tokens ÷ image tokens: <b>' + x2(c.ratio) + '</b>.' : 'Not every message read back at the bar, so the rule has no ratio; over the ' + c.passing + ' that did: ' + x2(c.partialRatio) + '.') + '</p></div>';
}

if (shipRun) {
  const recs = shipRun.places.filter((p) => p.kind === 'cockpit tool' || p.kind === 'run record');
  const tmpl = [...shipRun.templates].sort((a, b) => b.ratio - a.ratio);
  body += '<h2>Shipped, where it wins</h2><div class="card"><p style="margin-top:0">The parts that paid go into the estate. The JSON mode (a record\'s shape, keys and strings become glyphs, the legend travelling with it) is switched on only where it measured cheaper than today\'s pretty-printed JSON — <b>' + esc(shipRun.switchedOn.join(' and ')) + '</b> in the cockpit, and the run records. Every place decodes back exactly (' + shipJ.rules.find((r) => r.id === 'pack-lossless').value + '); Claude read the packed form as well as the plain (' + shipJ.rules.find((r) => r.id === 'claude-reads-packs').value + ').</p>'
    + '<div class="scroll"><table><thead><tr><th>record</th><th>as sent today</th><th>packed</th><th></th></tr></thead><tbody>'
    + recs.map((p) => '<tr' + (p.wins ? ' class="best"' : '') + '><td>' + esc(p.where) + '</td><td class="n">' + p.todayTokens + '</td><td class="n">' + p.packedTokens + '</td><td class="n">' + p.ratio + '×</td></tr>').join('')
    + '</tbody></table></div>'
    + '<p class="quiet" style="margin-top:.8rem">LIGHT\'s templates (Thomas Frumkin\'s language) called by name — the program never travels, so the call costs a fraction: best <b>' + x2(tmpl[0].ratio) + '</b> (' + esc(tmpl[0].name) + '), median ' + x2(shipJ.median) + ' over ' + tmpl.length + '. The 15× route is repeated work; new talk is not. The chase stays a standing, measured line: <a href="curve/">the 15× curve</a>.</p></div>';
}

const tally = prices ? Object.entries(prices.tally).map(([s, t]) => '<tr><td>' + esc(s) + '</td><td class="n">' + t.n + '</td><td>' + Object.entries(t.byCost).map(([c2, n]) => n + ' at ' + c2).join(', ') + '</td></tr>').join('') : '';
const legend = json('data/legend.json');
const lightRows = legend ? '<table><thead><tr><th>glyph</th><th>LIGHT opcode</th><th>prime</th><th>Claude tokens</th></tr></thead><tbody>'
  + legend.light.opcodes.map((o) => '<tr><td class="gl">' + esc(o.glyph) + '</td><td>' + esc(o.mnemonic) + '</td><td class="n">' + o.prime + '</td><td class="n">' + o.tokens + '</td></tr>').join('')
  + '</tbody></table><p class="quiet">Rings: ' + legend.light.rings.map((r) => esc(r.glyph) + ' ' + esc(r.name) + ' ' + r.nm + ' nm (' + r.tokens + ')').join(' · ') + '. Buses: ' + legend.light.buses.map((b) => esc(b.glyph) + ' ' + esc(b.bus) + ' (' + b.tokens + ')').join(' · ') + '. Registers ' + legend.light.registers.perRing.join(' + ') + ' = ' + legend.light.registers.total + '. The whole legend: <a href="data/legend.json">data/legend.json</a>.</p>' : '';
const kernelSrc = read('tongue.mjs').replace(/^export (function|const) /gm, '$1 ');
// the shipped JSON mode and the cost case, inlined the same way: the page runs the gated files themselves
const packSrc = read('tongue-pack.mjs').replace(/^import [^\n]*\n/m, '').replace(/^export (function|const) /gm, '$1 ');
const costSrc = read('tongue-cost.mjs').replace(/^export default [^\n]*\n/m, '').replace(/^export (function|const) /gm, '$1 ');
const inline = (s) => s.replace(/<\/script/gi, '<\\/script');

// ── the explainer, every number generated from the committed seal, records and receipts ────────────────────────────
const W = json('data/witness.json'), LW = json('light/data/witness.json');
const basisAll = JSON.parse(read('light/vendor/sovereign-enterprise/data/basis.json'));
const BASIS = { frontier: basisAll.frontier, fxGbpPerUsd: basisAll.fxGbpPerUsd };
const PLACES = shipRun ? shipRun.places.map((p) => ({ todayTokens: p.todayTokens, minifiedTokens: p.minifiedTokens, packedTokens: p.packedTokens })) : [];
const MEAS = K.measuredOf({ places: PLACES }), PRICE = K.priceOf(BASIS), DEF = K.tongueCase(BASIS, MEAS, {});
const ALPHA = run ? run.picture.alphabet.filter((x) => [...x].length === 1).join('') : '';
const g = (n) => n.toLocaleString('en-GB');
const pct = (x) => (Math.round(x * 1000) / 10) + '%';
const A = pre.corpus.agents, tcL = run && last(run.text.curve), jcL = run && last(run.json.curve);
const heldJson = run ? run.json.perFile.length : 0, heldReads = run ? run.picture.reads.filter((r) => r.split === 'held').length : 0;
const shipWins = shipRun ? shipRun.places.filter((p) => p.wins).length : 0, shipLossless = shipRun ? shipRun.places.filter((p) => p.lossless).length : 0;
const readsOk = shipRun ? shipRun.readCheck.filter((r) => r.packedExact).length : 0, readsN = shipRun ? shipRun.readCheck.length : 0;
const tBest = shipRun ? [...shipRun.templates].sort((a, b) => b.ratio - a.ratio)[0] : null;
const exactReads = run ? run.text.readback.filter((r) => r.exact).length : 0;
const sealShort = run ? run.sealedIn.slice(0, 7) : '';
const cutoff = A.cutoff.slice(0, 10);
const wRow = (k) => (W ? W.kernels.find((x) => x.name === k) : null);
const wCell = (k) => { const r = wRow(k); return r ? '<td class="mono" data-k="' + k + '">' + r.killed + ' / ' + r.total + ' killed</td>' : '<td class="quiet">not gated</td>'; };
// a box with a title and up to two short lines under it (each ≤ 25 characters, so it fits a 170-wide box)
const box = (x, y, w, h, cls, l1, l2, l3) => {
  const subs = [l2, l3].filter(Boolean), top = y + h / 2 - (subs.length * 15) / 2 + 4;
  return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="8" class="b ' + cls + '"/><text x="' + (x + w / 2) + '" y="' + top + '" text-anchor="middle">' + esc(l1) + '</text>'
    + subs.map((s, k) => '<text x="' + (x + w / 2) + '" y="' + (top + 16 + k * 15) + '" text-anchor="middle" class="d">' + esc(s) + '</text>').join('');
};
const arrows = (pairs, id) => '<g class="ar">' + pairs.map(([x1, y1, x2, y2]) => '<path d="M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2 + '" marker-end="url(#' + id + ')"/>').join('') + '</g>';
const marker = (id) => '<defs><marker id="' + id + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>';

// diagram 1: the sealed run, three channels, traced with the record's own counts
const runSvg = !run ? '' : '<svg viewBox="0 0 980 420" role="img" aria-labelledby="dr-t"><title id="dr-t">The sealed run: the rules sealed first, then three channels each measured on held-out material in Claude tokens; CI re-derives every number from the record</title>' + marker('m1')
  + box(20, 14, 940, 40, 'bg', 'sealed first: data/prereg.json (' + sealShort + ') — prices, corpus split, channels, ' + pre.rules.length + ' rules and a prediction, before any held-out message was coded', '')
  + '<text x="20" y="84" class="a">TEXT</text>'
  + box(20, 92, 170, 66, '', 'agents\u2019 messages', A.trainMessages + ' train · ' + A.heldMessages + ' held-out', 'split ' + cutoff)
  + box(210, 92, 170, 66, 'ba', 'grow (tongue.mjs)', pre.config.text.rounds + ' rounds', '→ ' + run.text.glyphs + ' glyphs')
  + box(400, 92, 170, 66, '', 'encode the held-out', 'nested up to ' + run.text.depth.max + ' deep')
  + box(590, 92, 170, 66, 'bp', 'Claude tokens', g(tcL.plainTokens) + ' → ' + g(tcL.codedTokens))
  + box(780, 92, 180, 66, 'bg', x2(tcL.ratio) + ' fewer', run.text.lossless.ok + ' of ' + run.text.lossless.n + ' decode exactly')
  + '<text x="20" y="192" class="a">JSON</text>'
  + box(20, 200, 170, 66, '', heldJson + ' held-out files', 'estate JSON +', 'shopper sessions')
  + box(210, 200, 170, 66, 'ba', 'learnJson', run.json.kinds.schema + ' schemas · ' + run.json.kinds.key + ' keys', run.json.kinds.string + ' strings')
  + box(400, 200, 170, 66, '', 'encodeJson', run.json.glyphs + ' glyphs', 'schema held')
  + box(590, 200, 170, 66, 'bp', 'Claude tokens', g(jcL.plainTokens) + ' → ' + g(jcL.codedTokens))
  + box(780, 200, 180, 66, 'bg', x2(jcL.ratio) + ' fewer', run.json.lossless.ok + ' of ' + run.json.lossless.n + ' decode exactly')
  + '<text x="20" y="300" class="a">PICTURE</text>'
  + box(20, 308, 170, 66, '', 'seeded payloads', 'A dots · B glyphs', 'C evolved')
  + box(210, 308, 170, 66, 'ba', 'drawn, shrinking sizes', 'tools/render.ps1')
  + box(400, 308, 170, 66, '', 'read back blind', heldReads + ' held-out reads', run.model)
  + box(590, 308, 170, 66, 'bp', 'graded (gradeGrid)', 'bar ≥' + pre.config.picture.bar * 100 + '% read back')
  + box(780, 308, 180, 66, 'bg', j.bestPicture + ' bits / token', 'best text: ' + j.bestText)
  + arrows([125, 233, 341].flatMap((y) => [[190, y, 208, y], [380, y, 398, y], [570, y, 588, y], [760, y, 778, y]]), 'm1')
  + '<text x="20" y="404" class="d">CI on every push: tools/run.mjs --verify re-grades every read, rebuilds the JSON channel and re-derives every number above.</text></svg>';

// diagram 2: the shipped JSON pack, one record, and the switch
const packSvg = !shipRun ? '' : '<svg viewBox="0 0 980 250" role="img" aria-labelledby="dp-t"><title id="dp-t">The shipped JSON pack: a record learns its own small legend, travels as legend plus coded value, and is switched on only where it measured cheaper in Claude tokens</title>' + marker('m2')
  + box(20, 40, 160, 60, 'bg', 'a record', 'as a tool sends it today')
  + box(205, 40, 200, 60, 'ba', 'learn its own legend', 'recurring shapes, keys, strings')
  + box(430, 40, 190, 60, '', 'legend + coded value', 'glyphs the value never uses')
  + box(645, 40, 150, 60, 'bp', 'count tokens', 'today vs packed')
  + box(820, 40, 140, 60, 'bg', 'switch', 'on only if cheaper')
  + box(430, 150, 190, 60, '', 'unpack at the reader', 'legend → exact value')
  + box(205, 150, 200, 60, 'bg', shipLossless + ' of ' + shipRun.places.length + ' places', 'decode back exactly')
  + box(645, 150, 315, 60, 'bg', shipWins + ' of ' + shipRun.places.length + ' measured places cheaper packed', 'median place keeps ' + pct(MEAS.keepToday) + ' of its tokens')
  + arrows([[180, 70, 203, 70], [405, 70, 428, 70], [620, 70, 643, 70], [795, 70, 818, 70], [525, 100, 525, 148], [430, 180, 407, 180], [720, 100, 720, 148]], 'm2')
  + '<text x="20" y="240" class="d">tongue-pack.mjs · measured by tools/ship.mjs (sealed first in data/ship-prereg.json) · CI re-packs every public place</text></svg>';

const costRows = (r) => !r || !r.ok ? '<tr><td class="quiet" colspan="3">' + esc(r ? r.why : 'no case') + '</td></tr>'
  : '<tr><td>input tokens a month (million)</td><td class="n">' + r.inputs.millionTokensPerMonth + '</td><td class="n">' + r.tokens.packedPerMonth + '</td></tr>'
  + '<tr><td>a year (£)</td><td class="n">' + r.perYear.today.toFixed(2) + '</td><td class="n">' + r.perYear.packed.toFixed(2) + '</td></tr>'
  + '<tr><td>over ' + r.inputs.years + ' years (£)</td><td class="n">' + r.over.today.toFixed(2) + '</td><td class="n">' + r.over.packed.toFixed(2) + '</td></tr>'
  + '<tr class="best"><td>saved (£)</td><td class="n">' + r.savingPerYear.toFixed(2) + ' a year</td><td class="n">' + r.savingOver.toFixed(2) + ' over ' + r.inputs.years + ' years</td></tr>';
const costVerdict = (r) => !r || !r.ok ? 'The case cannot be computed: ' + (r ? r.why : 'no inputs') + '.'
  : 'Packed where it wins, the median measured place keeps ' + pct(r.keep) + ' of its input tokens, so ' + r.inputs.millionTokensPerMonth + ' million tokens a month becomes ' + r.tokens.packedPerMonth + ' million — about ' + r.savingPerYear.toFixed(2) + ' pounds a year at ' + r.price + ' pounds per million' + (r.priceSourced ? ' (the sourced list price)' : ' (your price)') + '.';
const sourcesList = K.sourcesOf(BASIS).map((s) => '<li><b>' + esc(s.key) + '</b> = ' + esc(String(s.value)) + ' — ' + esc(s.what) + (BASIS[s.key] && BASIS[s.key].via ? ' (taken ' + esc(String(BASIS[s.key].via).replace(/^estate basis /, '')) + ')' : '') + ' · <a href="' + esc(s.source) + '">source</a></li>').join('')
  + '<li><b>shares kept</b> — data/ship-run.json: ' + PLACES.length + ' places measured in Claude tokens (' + esc(shipRun ? shipRun.model : '') + '), legend included; the median place, the shipped switch (a place that is not cheaper packed keeps every token)</li>';
const regradeData = run ? { reads: run.picture.reads.map((r) => ({ arm: r.arm, kind: r.kind, size: r.size, split: r.split, k: r.k, gen: r.gen, cells: r.cells, reply: r.reply, grade: r.grade })), B: run.picture.B, C1: run.picture.C1, C2: run.picture.C2, cols: CONFIG.picture.cols, dotCols: CONFIG.picture.dots.cols } : null;
const faq = [
  ['What is the Konomi Tongue?', 'A language the estate\'s agents grow between themselves: a shared dictionary where the most valuable recurring pieces of what they actually say become glyphs, glyphs can hold glyphs, and JSON records shed their keys into a shared schema — plus a picture channel that draws symbols as images, which are billed by area rather than by token.'],
  ['Did it reach 15×?', run ? headline : 'Not yet known: it is sealed and being measured.'],
  ['Why kanji and not cuneiform?', 'Price. Every candidate glyph was counted through the CLI first: in Claude\'s tokenizer a cuneiform sign costs 4 tokens and most emoji 3–4, while many kanji cost 1 or 2. Cuneiform and emoji can still pay in the picture channel, where a glyph costs area.'],
  ['How do I know it was not tuned after the fact?', 'The prices, the corpus split, the channels, the rules and a prediction were committed before any held-out message was coded or any picture read (data/prereg.json). CI re-grades every recorded read and rebuilds the JSON channel on every push; this page re-grades the reads in your browser.'],
  ['Whose ideas are these?', 'The tongue grows from the seed\'s memory law (compress, don\'t delete; compress by prime indices) and Thomas Frumkin\'s Konomi architecture and LIGHT language (36 prime-indexed opcodes; templates — a whole program called by name — are the model for the dictionary). Simon set the 15× target and the picture channel.'],
  ['Can my team use it?', 'Yes, the part that paid: the JSON pack (tongue-pack.mjs), MIT and zero-dependency. It is worth switching on where your systems send a model records with recurring shapes, and only where it measures cheaper on your own records — the cost case and the adoption steps on this page say how. The text dictionary and the picture channel did not pay and are not offered for use. Supplied by AI Native Solutions; support is agreed per deployment.'],
];
const ld = [
  { '@context': 'https://schema.org', '@type': 'Dataset', name: 'The Konomi Tongue', description: 'A sealed measurement: a glyph language grown from real agent messages, measured in Claude tokens against a 15× target, with a picture channel read back blind.', url: URL_LIVE, codeRepository: REPO, license: 'https://opensource.org/licenses/MIT', author: { '@type': 'Person', name: 'Kar' } },
  { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
];

const sectionsBody = body.replace(/<h2>/g, '<h3 class="rh">').replace(/<\/h2>/g, '</h3>');
const page = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Konomi Tongue</title>
<meta name="description" content="Can AI agents talk in fewer tokens by sharing a dictionary? A sealed, open measurement against a 15× target${run ? ': new talk ' + x2(tcL.ratio) + ', JSON ' + x2(jcL.ratio) + ' with the schema held, symbol pictures never at the bar' : ''} — and the JSON pack that did pay, shipped where it measured cheaper. With the cost case, the adoption steps and a white paper.">
<link rel="canonical" href="${URL_LIVE}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M16 3 29 16 16 29 3 16z' fill='%23d6a93a'/%3E%3C/svg%3E">
${ld.map((x) => '<script type="application/ld+json">' + JSON.stringify(x).replace(/</g, '\\u003c') + '</script>').join('\n')}
<style>
:root{--bg:#0c0b10;--panel:#15131b;--line:#2d2a36;--ink:#ece6d6;--dim:#a39c8c;--faint:#6f6a78;--gold:#d6a93a;--soft:#e9cf7f;--ok:#5fbf8f;--no:#e0616d;--onbtn:#16130c;
 --sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color-scheme:dark}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]){--bg:#fbf8f1;--panel:#fff;--line:#e4dcc9;--ink:#22201c;--dim:#5e564a;--faint:#8b8272;--gold:#8a6a13;--soft:#6d5310;--ok:#1f7a48;--no:#b3261e;--onbtn:#ffffff;color-scheme:light}}
:root[data-theme="light"]{--bg:#fbf8f1;--panel:#fff;--line:#e4dcc9;--ink:#22201c;--dim:#5e564a;--faint:#8b8272;--gold:#8a6a13;--soft:#6d5310;--ok:#1f7a48;--no:#b3261e;--onbtn:#ffffff;color-scheme:light}
*{box-sizing:border-box}html,body{margin:0}html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.6}
.wrap{max-width:56rem;margin:0 auto;padding:0 16px 5rem}
.top{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line)}
.top .in{max-width:56rem;margin:0 auto;padding:0 16px;display:flex;align-items:center;gap:12px;height:46px}
.brand{font-family:var(--mono);font-size:.8rem;letter-spacing:.14em;color:var(--gold);text-decoration:none;white-space:nowrap}
nav.links{display:flex;gap:14px;overflow-x:auto;scrollbar-width:none;flex:1;min-width:0}nav.links::-webkit-scrollbar{display:none}
nav.links a{color:var(--dim);text-decoration:none;font-size:.82rem;white-space:nowrap}nav.links a:hover{color:var(--ink)}
header.hero{padding:2.4rem 0 1.2rem}
.kick{font-family:var(--mono);font-size:.68rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin:0 0 .6rem}
h1{font-family:var(--serif);font-weight:500;font-size:clamp(1.9rem,6vw,3rem);margin:0 0 .5rem;color:var(--soft)}
.lede{font-family:var(--serif);color:var(--ink);font-size:clamp(1.02rem,2.4vw,1.2rem);margin:0}
section{border-top:1px solid var(--line);margin-top:2.2rem;padding-top:.4rem;scroll-margin-top:54px}
h2{font-family:var(--serif);font-weight:500;color:var(--gold);font-size:1.45rem;margin:1.4rem 0 .4rem}
h2 small{display:block;font-family:var(--mono);font-size:.66rem;letter-spacing:.18em;text-transform:uppercase;color:var(--faint);margin-bottom:.2rem}
h3{font-size:1rem;margin:1rem 0 .3rem}h3.rh{font-family:var(--serif);font-weight:500;color:var(--gold);font-size:1.18rem;margin:1.8rem 0 .4rem}
h4{font-family:var(--mono);font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);margin:0 0 .5rem}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin:.8rem 0;overflow-x:auto}
.verdict{border-color:var(--gold)}
.big{font-size:1.1rem;margin-top:0}.stat{font-variant-numeric:tabular-nums;font-weight:700;color:var(--soft)}
.quiet{color:var(--dim);font-size:.92rem}
ol,ul{padding-left:1.4rem}li{margin:.3rem 0}
table{width:100%;border-collapse:collapse;font-size:.88rem}
th,td{text-align:left;padding:.4rem .45rem;border-top:1px solid var(--line);vertical-align:top}
th{color:var(--faint);font-family:var(--mono);font-size:.68rem;letter-spacing:.06em;text-transform:uppercase;border-top:0}
td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
tr.best td{color:var(--soft);font-weight:600}
.pass{color:var(--ok);font-family:var(--mono);font-weight:700}.fail{color:var(--no);font-family:var(--mono);font-weight:700}
svg{max-width:100%;height:auto;display:block}.ax{font-family:var(--mono);font-size:11px;fill:var(--faint)}
.axis{stroke:var(--line)}.bar15{stroke:var(--no);stroke-dasharray:4 4}.line{stroke:var(--gold);stroke-width:2}.dot{fill:var(--gold)}
.diagram{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:8px;margin:.8rem 0}
.diagram svg{min-width:720px;width:100%;color:var(--dim)}
.diagram .b{fill:var(--bg);stroke:var(--line)}.diagram .ba{stroke:var(--gold)}.diagram .bp{stroke:var(--soft)}.diagram .bg{stroke:var(--ok)}
.diagram text{font-family:var(--mono);font-size:12px;fill:var(--ink)}.diagram text.a{fill:var(--gold);font-weight:700}.diagram text.d{fill:var(--dim);font-size:11px}
.diagram .ar{fill:none;stroke:currentColor;stroke-width:1.4}
.thumbs{display:flex;gap:12px;flex-wrap:wrap}.thumbs figure{margin:0;flex:1 1 200px;min-width:0}.thumbs img{max-width:100%;height:auto;border:1px solid var(--line);border-radius:6px;background:#fff;image-rendering:pixelated}
figcaption{font-size:.8rem;color:var(--dim)}
.gl{display:inline-block;font-size:1.3rem;margin:.1rem .25rem}.gl sub{font-size:.6rem;color:var(--faint);font-family:var(--mono)}
button{font:inherit;background:var(--gold);color:var(--onbtn);border:0;border-radius:8px;padding:.6rem 1.1rem;font-weight:600;cursor:pointer}
button:hover{background:var(--soft)}button:disabled{opacity:.6;cursor:wait}button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid var(--soft);outline-offset:2px}
button.plain{background:transparent;color:var(--dim);border:1px solid var(--line);padding:.25rem .6rem;font-size:.78rem;font-weight:400}
code,.mono{font-family:var(--mono);font-size:.85em}code{background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:.05em .3em;overflow-wrap:anywhere}
a{color:var(--soft)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin:.8rem 0}.grid .card{margin:0}.grid .card p{margin:0;font-size:.93rem}
.inrow{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:6px 14px}
label{display:block;font-family:var(--mono);font-size:.68rem;letter-spacing:.05em;text-transform:uppercase;color:var(--dim);margin:.6rem 0 .25rem}
input,textarea,select{width:100%;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:.5rem .6rem;font-family:var(--mono);font-size:.85rem}
textarea{min-height:9rem;resize:vertical}
.row{display:flex;justify-content:space-between;gap:10px;font-family:var(--mono);font-size:.84rem;padding:.3rem 0;border-bottom:1px dashed var(--line)}.row b{color:var(--soft)}
pre.out{white-space:pre-wrap;overflow-wrap:anywhere;font-family:var(--mono);font-size:.8rem;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:.6rem;max-height:16rem;overflow:auto;margin:.6rem 0 0}
.callout{border-left:3px solid var(--gold)}
.paper h3{margin-top:1.2rem}
footer{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--line);color:var(--faint);font-size:.84rem}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style></head><body>
<div class="top"><div class="in">
 <a class="brand" href="#top">KONOMI TONGUE</a>
 <nav class="links" aria-label="Sections"><a href="#what">What it is</a><a href="#start">Start here</a><a href="#try">Try it</a><a href="#how">How it works</a><a href="#receipts">Receipts</a><a href="#blueprint">Blueprint</a><a href="#business">For a team</a><a href="#adoption">Adoption</a><a href="#paper">White paper</a><a href="#faq">Questions</a><a href="light/">LIGHT</a><a href="curve/">15× curve</a><a href="layered/">Layered</a></nav>
 <button id="theme" class="plain" type="button" aria-label="Switch between light and dark">theme</button>
</div></div>
<div class="wrap" id="top">
<header class="hero">
 <p class="kick">Konomi · the tongue the agents grow</p>
 <h1>The Konomi Tongue</h1>
 <p class="lede">${run ? 'Can AI agents that work together talk in fewer tokens by sharing a dictionary? Tokens are what a language model reads and bills, so fewer is cheaper and faster. This is that question, measured in the open with the rules sealed first — and the answer: new conversation barely shrinks (' + x2(tcL.ratio) + '), JSON records shrink (' + x2(jcL.ratio) + ' with the schema held), dense symbol pictures never read back at the bar, and the 15× target was reached only by repeated work — a LIGHT template called by name (best ' + x2(tBest.ratio) + ') — never by new talk. The part that paid — a JSON pack that carries its own legend — is shipped where it measured cheaper.' : esc(headline)}</p>
</header>

<section id="what" aria-labelledby="what-h">
<h2 id="what-h"><small>What it is</small>A shared dictionary, measured in tokens</h2>
<p>Agents in the estate send each other, and a language model, a great deal of text and JSON. The tongue grows a <b>dictionary</b> from what they actually say: the most valuable recurring pair of pieces becomes a single glyph (a kanji or kana that costs one or two tokens), again and again, so a glyph can stand for a phrase made of glyphs. JSON gets a <b>shared schema</b>: a record shape, a key or a string that recurs becomes one glyph. And a <b>picture channel</b> tests whether symbols drawn as an image — billed by area, not by token — carry more per token. Every channel was measured on held-out material, in real Claude tokens, against Simon's 15× target.</p>
<div class="card verdict"><p class="big">${run ? '<span class="stat">' + j.passed + ' of ' + j.of + '</span> sealed rules held.' : 'Sealed, being measured.'}</p><p>${esc(run ? headline.slice(headline.indexOf('Grown')) : headline)}</p></div>
</section>

<section id="start" aria-labelledby="start-h">
<h2 id="start-h"><small>Start here</small>Six steps, the first three in this tab</h2>
<ol>
 <li><b>Read the verdict</b> just above, then <a href="#receipts">the receipts</a>: every sealed rule beside what was predicted before the run, the passes and the fails.</li>
 <li><b>Pack your own JSON</b> in <a href="#try">Try it</a>: paste a list of records and see the legend it learns, the coded form and the exact round-trip. The page runs the shipped <code>tongue-pack.mjs</code> itself; nothing leaves the tab.</li>
 <li><b>Re-grade every recorded picture read</b> with the button in <a href="#picture">the picture channel</a>: the same gated kernel, in your browser, against the record.</li>
 <li><b>Check it on your own machine.</b> Clone <a href="${REPO}">the repository</a> and run, with Node 20 or later and nothing installed: <code>node --test</code> (every test), <code>node tools/seal.mjs --check</code> (the seal matches its inputs), <code>node tools/run.mjs --verify</code> (every read re-graded, every number re-derived), <code>node tools/ship.mjs --verify</code> (every public place re-packed).</li>
 <li><b>For a team:</b> put your own token volume and price into <a href="#business">the cost case</a>, then follow <a href="#adoption">Adoption</a> to measure your own records first.</li>
 <li><b>Five folds, measured:</b> <a href="layered/">LIGHT, layered</a> stacks five dimensions of compression in one codec and tests them on five kinds of the estate's data; one level up, verified rules kept as frames settle to decisions with no model in the loop.</li>
 <li><b>The standing line:</b> <a href="curve/">the 15× curve</a> re-measures the codings every week, on messages newer than anything they learned from, counted by the local model's own tokenizer.</li>
 <li><b>Next door:</b> <a href="light/">LIGHT</a> is the byte-level codec of the same estate — smaller files, signed packets checked before they are read — with its own receipts and business case.</li>
</ol>
</section>

<section id="try" aria-labelledby="try-h">
<h2 id="try-h"><small>Try it</small>The shipped JSON pack, live</h2>
<div class="card">
 <label for="pk-in">your JSON — a list of records works best</label>
 <textarea id="pk-in" spellcheck="false">[
  {"id": 101, "status": "done", "owner": "kar", "repo": "konomi-tongue", "kind": "build"},
  {"id": 102, "status": "open", "owner": "grok", "repo": "liveware", "kind": "build"},
  {"id": 103, "status": "open", "owner": "kar", "repo": "fall-kit", "kind": "audit"},
  {"id": 104, "status": "done", "owner": "grok", "repo": "konomi-tongue", "kind": "audit"},
  {"id": 105, "status": "open", "owner": "kar", "repo": "liveware", "kind": "build"},
  {"id": 106, "status": "open", "owner": "grok", "repo": "fall-kit", "kind": "build"},
  {"id": 107, "status": "done", "owner": "kar", "repo": "konomi-tongue", "kind": "audit"},
  {"id": 108, "status": "open", "owner": "grok", "repo": "liveware", "kind": "audit"}
]</textarea>
 <div class="row"><span>characters as given</span><b id="pk-chars">—</b></div>
 <div class="row"><span>characters minified</span><b id="pk-min">—</b></div>
 <div class="row"><span>characters packed, legend included</span><b id="pk-packed">—</b></div>
 <div class="row"><span>legend entries learned</span><b id="pk-entries">—</b></div>
 <div class="row"><span>unpacks back to the exact minified JSON</span><b id="pk-rt">—</b></div>
 <pre class="out" id="pk-out" aria-live="polite"></pre>
 <p class="quiet">Characters are not tokens: a glyph here is one character but one or two tokens, and the receipts count real Claude tokens. In the estate the pack is switched on only where the token count measured lower — <a href="#shipped">${shipWins} places of ${shipRun ? shipRun.places.length : 0}</a>. Delete half the records above and watch the legend cost more than it saves: a small value with little recurring is exactly where the switch stays off.</p>
</div>
</section>

<section id="how" aria-labelledby="how-h">
<h2 id="how-h"><small>How it works</small>Seal, grow, code, count — traced from the record</h2>
<p>The diagram is the sealed run in <code>tools/run.mjs</code>, with the counts it recorded in <code>data/run.json</code>. Everything private (the agents' messages, the grown dictionary) stays on the laptop; only hashes and counts are published.</p>
<div class="diagram">${runSvg}</div>
<ol>
 <li><b>Price the alphabet.</b> Every candidate glyph was counted in Claude tokens first (<code>tools/price.mjs</code> → <code>data/prices.json</code>): kanji and kana at one or two tokens make the text alphabet; dearer glyphs only pay in pictures.</li>
 <li><b>Seal.</b> The kernel's hash, the prices, the corpus split by date, the prompts, ${pre.rules.length} rules and a prediction went into <code>data/prereg.json</code> and were pushed before any held-out message was coded.</li>
 <li><b>Grow on the train split only.</b> <code>grow()</code> counts every adjacent pair of units and merges the most valuable ones that share no symbol, ${pre.config.text.batch} a round for ${pre.config.text.rounds} rounds; <code>learnJson()</code> collects the recurring schemas, keys and strings.</li>
 <li><b>Code the held-out material and count it.</b> Plain Claude tokens ÷ coded Claude tokens, at each checkpoint of the growth; every held-out message and file must decode back exactly.</li>
 <li><b>Pictures, read back blind.</b> Seeded payloads are drawn at shrinking sizes and read back blind — the model is told only the grid's shape; <code>gradeGrid()</code> scores position by position, and bits per token count only at ≥${pre.config.picture.bar * 100}% read back.</li>
 <li><b>Re-derive in CI.</b> On every push, the seal is re-checked against its inputs, every read is re-graded and every number on this page is regenerated from the record — a page that differs fails the build.</li>
</ol>
<h3>The part that shipped: one record through the pack</h3>
<div class="diagram">${packSvg}</div>
<p class="quiet">The shared-schema result needs the reader to hold the schema (${run ? g(run.json.legendTokens) : ''} tokens to send once). The shipped pack does not: each value learns its own small legend from itself and carries it, so it can be switched on wherever records repeat, and its token counts include the legend.</p>
</section>

<section id="receipts" aria-labelledby="receipts-h">
<h2 id="receipts-h"><small>The receipts</small>Sealed first, measured second, failures kept</h2>
${sectionsBody.replace('<h3 class="rh">The picture channel</h3>', '<h3 class="rh" id="picture">The picture channel</h3>').replace('<h3 class="rh">Shipped, where it wins</h3>', '<h3 class="rh" id="shipped">Shipped, where it wins</h3>')}
<h3 class="rh">The alphabet, priced first</h3>
<div class="card"><p class="quiet" style="margin-top:0">Every candidate glyph counted in Claude tokens through the CLI before anything else. The text channel writes only one- and two-token kanji and kana; everything dearer only pays in pictures.</p>
<table><thead><tr><th>source</th><th>priced</th><th>tokens each</th></tr></thead><tbody>${tally}</tbody></table>
<h3>The legend: LIGHT's prime-indexed opcodes, priced</h3>${lightRows}</div>
<h3 class="rh">What was sealed first</h3>
<div class="card"><p style="margin-top:0">${esc(pre.statement)}</p>
<p><b>Text.</b> ${esc(pre.channels.text)}</p><p><b>JSON.</b> ${esc(pre.channels.json)}</p><p><b>Picture.</b> ${esc(pre.channels.picture)}</p><p><b>Both.</b> ${esc(pre.channels.combined)}</p>
<p><b>The split.</b> ${esc(pre.corpus.split)}</p>
<p class="quiet">${pre.disclosures.map(esc).join(' ')}</p>
<p class="quiet">${run ? 'Sealed in <code>' + esc(run.sealedIn.slice(0, 7)) + '</code> · ' : ''}<a href="data/prereg.json">the pre-registration</a>${run ? ' · <a href="data/run.json">the record</a>' : ''} · <a href="data/prices.json">the prices</a></p></div>
</section>

<section id="blueprint" aria-labelledby="bp-h">
<h2 id="bp-h"><small>Blueprint</small>${W ? W.kernels.length : 0} gated kernels, and every organ around them</h2>
<p>Each kernel is pure — no I/O, no clock, no network — with its own tests, under a mutation gate: <a href="https://github.com/sjgant80-hub/witness">witness</a>, pinned at v0.6, changes the code one operator at a time and the tests must catch every change. It runs on GitHub's runner on every push, and the run must re-derive exactly the counts committed in <code>data/witness.json</code>: ${W ? W.killed + ' of ' + W.total + ' mutants killed, none baselined' : 'not yet recorded'}.</p>
<div class="card"><table><thead><tr><th>kernel</th><th>what it is</th><th>tests</th><th>mutation gate</th></tr></thead><tbody>
<tr><td class="mono">tongue.mjs</td><td>the tongue: units, the growing nested dictionary (encode, decode, lossless), JSON mode, the picture channel's payloads and grading, misread-driven alphabet evolution; sealed by hash in the pre-registration</td><td class="mono">tongue.test.mjs</td>${wCell('tongue')}</tr>
<tr><td class="mono">tongue-pack.mjs</td><td>the shipped JSON mode: pack, unpack, and the switch <code>wins()</code>; sealed by hash in the ship pre-registration</td><td class="mono">tongue-pack.test.mjs</td>${wCell('pack')}</tr>
<tr><td class="mono">tongue-cost.mjs</td><td>the cost case below: the sourced model price, the ship record's shares, your inputs</td><td class="mono">tongue-cost.test.mjs</td>${wCell('cost')}</tr>
</tbody></table></div>
<h3>Around the kernels</h3>
<div class="card"><table><thead><tr><th>organ</th><th>what it does</th><th>how it is checked</th></tr></thead><tbody>
<tr><td class="mono">tools/price.mjs</td><td>prices every candidate glyph in Claude tokens through the official CLI → <code>data/prices.json</code></td><td>run where the CLI login is; its output is sealed by hash</td></tr>
<tr><td class="mono">tools/corpus.mjs · tools/json-corpus.mjs</td><td>gather the agents' messages privately (only sha256 and counts published) and the estate's public JSON plus the shopper sessions, split by date before anything is measured</td><td>the private corpus and the JSON manifest are sealed by hash</td></tr>
<tr><td class="mono">tools/seal.mjs</td><td>writes the pre-registration, refusing to overwrite it</td><td>CI: <code>--check</code> on every push</td></tr>
<tr><td class="mono">tools/run.mjs · run-phases.mjs · cli.mjs · render.ps1</td><td>the sealed run: paid calls through the official CLI, each cached by hash so a stopped run never pays twice; pictures drawn with Windows GDI+</td><td>CI: <code>run.mjs --verify</code> re-grades every read and re-derives every number</td></tr>
<tr><td class="mono">tools/ship.mjs</td><td>measures the pack where it lands, in today's text, minified and packed, and LIGHT's templates called by name</td><td>CI: <code>--check</code> (the seal) and <code>--verify</code> (every public place re-packed)</td></tr>
<tr><td class="mono">tools/point.mjs</td><td>a standing-curve point for the 15× chase: regrow and re-count the text channel on later messages</td><td>local; no seal claimed</td></tr>
<tr><td class="mono">tools/legend.mjs</td><td>the public legend <code>data/legend.json</code>: LIGHT's opcodes, rings and buses, priced</td><td>read from the estate's fork, pinned by sha256</td></tr>
<tr><td class="mono">tools/make-page.mjs</td><td>this page, the README and llms.txt, every number generated from the seal, the records and the receipts</td><td>CI: regenerated on every push, and any difference fails the build</td></tr>
<tr><td class="mono">tools/witness-check.mjs</td><td>each kernel's mutation run must equal <code>data/witness.json</code>, clean and uncapped</td><td>CI, every push</td></tr>
<tr><td class="mono">vendor/light/templates.cjs</td><td>LIGHT's templates byte for byte — Thomas Frumkin's language, MIT, used with permission</td><td>sealed by hash in the ship pre-registration</td></tr>
<tr><td class="mono">light/vendor/…/basis.json</td><td>the sourced external figures the cost case reads</td><td>copied byte for byte with git; its hash is tested against <code>light/vendor/SOURCE.json</code></td></tr>
<tr><td class="mono">test/tongue-page.test.mjs</td><td>this page's own gate: every section, every control wired, every in-page link landing, every number the record's</td><td>CI, every push</td></tr>
<tr><td class="mono">.github/workflows/</td><td><code>gate.yml</code> (proof-of-play: all of the above), <code>ci.yml</code> (every test), <code>light.yml</code> (LIGHT)</td><td>every run is public: <a href="${REPO}/actions">the workflow runs</a></td></tr>
<tr><td class="mono">light/</td><td>LIGHT, the estate's byte codec: ${LW ? LW.kernels.length + ' kernels, ' + LW.killed + ' of ' + LW.total + ' mutants killed on the runner' : 'its own receipts'}</td><td><a href="light/#blueprint">its own blueprint</a></td></tr>
</tbody></table></div>
</section>

<section id="business" aria-labelledby="bz-h">
<h2 id="bz-h"><small>For a team</small>What the tongue does for a company that sends records to a model</h2>
<p class="lede">If your systems send structured records — tool results, queues, ledgers, run records — to a language model, the shipped JSON pack can cut the input tokens they cost, with no shared state to keep in step: the legend travels with the record, and the reader gets back exactly what was sent. Measured in the estate: ${shipWins} of ${shipRun ? shipRun.places.length : 0} places cheaper packed. It is MIT, zero-dependency and runs on your own machines.</p>
<h3>What it does for each role</h3>
<div class="grid">
 <div class="card"><h4>CEO</h4><p>A small, owned saving on the model bill, from a method whose every claim was written down before it was measured — including the ${j ? j.of - j.passed : 0} that failed. What the board hears is what was measured.</p></div>
 <div class="card"><h4>CFO</h4><p>The money is input tokens, computed below from your own volume and your own price. Straight: the saving scales with volume, and at modest volumes it is small. Minifying JSON is free and takes part of the same gain first.</p></div>
 <div class="card"><h4>COO</h4><p>Switch it on one place at a time, only where it measures cheaper, and keep the plain form as the fallback; the reader unpacks to the exact record, so nothing downstream changes.</p></div>
 <div class="card"><h4>CTO / CISO</h4><p>A pure, zero-dependency ES module, mutation-gated on GitHub's runner on every push. It does no I/O and calls no network; it changes how a record is written, not who receives it.</p></div>
 <div class="card"><h4>Engineering teams</h4><p><code>pack(value, alphabet)</code>, <code>unpack(text)</code> and <code>wins(today, packed)</code> — three functions. Lossless by construction and by test; garbage in gives <code>{ ok: false }</code>, never a throw.</p></div>
 <div class="card"><h4>Data and compliance teams</h4><p>A packed record holds the same data as the plain one, in a reversible form: personal data stays personal data, and it reaches the same model provider it reached before.</p></div>
</div>

<h3 id="cost-h">The cost case — your volume, your price</h3>
<p>Computed in this tab by <code>tongue-cost.mjs</code> (mutation-gated, like the kernel). The model price and the exchange rate come only from the sourced basis listed under the result; the shares of tokens kept come only from the ship record; the volume, the price and the years are yours, and stay in this tab. The price starts at the sourced list price of a frontier model's input tokens — type yours if you use another model or pay a different rate.</p>
<div class="card">
 <div class="inrow">
  <div><label for="tc-tokens">million input tokens of records sent to a model, a month</label><input id="tc-tokens" type="number" min="0" step="any" value="${K.DEFAULTS.millionTokensPerMonth}"></div>
  <div><label for="tc-price">your price per million input tokens (£)</label><input id="tc-price" type="number" min="0" step="any" value="${PRICE}"></div>
  <div><label for="tc-min">already minified today?</label><select id="tc-min"><option value="no">no — as a tool returns it, pretty-printed</option><option value="yes">yes — minified JSON</option></select></div>
  <div><label for="tc-years">years</label><input id="tc-years" type="number" min="1" max="10" step="1" value="${K.DEFAULTS.years}"></div>
 </div>
 <p id="tc-verdict" class="stat" role="status" aria-live="polite">${esc(costVerdict(DEF))}</p>
 <table><thead><tr><th>line</th><th>today</th><th>packed where it wins</th></tr></thead><tbody id="tc-rows">${costRows(DEF)}</tbody></table>
 <p class="quiet">How it is worked out: the ship record measured ${PLACES.length} real places in Claude tokens — as sent today, minified, and packed with the legend included. Where packing was not cheaper the place stays as it is and keeps every token. The case uses the median place (a floor: the best place kept ${pct(MEAS.bestToday)}), against today's text or, if you already minify, against minified JSON (median ${pct(MEAS.keepMinified)} kept). The price is held at today's figure, not inflated. Not counted: output tokens (packing changes what is sent, not what comes back), the CPU to pack (not measured), and your team's time to roll it out (the <a href="#adoption">Adoption</a> steps).</p>
 <h4>where every figure comes from</h4>
 <ul id="tc-sources" class="quiet">${sourcesList}</ul>
</div>

<h3>Against what you use now</h3>
<p>The standard alternative is free: send minified JSON instead of pretty-printed. On the same ${PLACES.length} places, minifying alone is where part of the gain comes from; packing goes further on ${MEAS.winsMinified} of the ${PLACES.length} even against minified JSON (median place ${pct(MEAS.keepMinified)} of the minified tokens), and on ${MEAS.winsToday} against what is sent today (median ${pct(MEAS.keepToday)}). The model must read the legend: in the read check Claude answered ${readsOk} of ${readsN} questions exactly from the packed form, as it did from the plain — a small check, so measure it on your own questions. The text dictionary does not pay against plain English (${run ? x2(tcL.ratio) : ''}), and on new talk nothing here reaches 15×.</p>

<h3>Security and data protection</h3>
<ul>
 <li><b>Where the data is.</b> The kernels run on your machines and in this tab; they do no I/O, read no clock and call no network. Packing changes how a record is written, not where it goes.</li>
 <li><b>Exactly what was sent.</b> <code>unpack(pack(v))</code> is <code>v</code> — by construction and by test, and on every measured place (${shipLossless} of ${shipRun ? shipRun.places.length : 0}). A pack uses only glyphs that never occur in the value, so a glyph can only be a glyph. Garbage is refused with a reason, never a throw.</li>
 <li><b>It does not sanitise.</b> Whatever a record carries — including text written to steer a model — the model reads after unpacking, exactly as it would read the plain record. Treat packed input with the same controls as plain input.</li>
 <li><b>Not encryption, not anonymisation.</b> The legend travels with the record, so anyone who reads the pack can read the data. Personal data in a pack is still personal data under UK GDPR, your controller duties are unchanged, and the model provider you send it to receives the same data as before.</li>
 <li><b>Assurance you can re-run.</b> The source is MIT and open; the tests, the seals, the record re-derivation and the mutation gate run on GitHub's runner on every push, and on your machine with the commands in <a href="#start">Start here</a>.</li>
</ul>

<h3>Roll-out</h3>
<p>Measure first, then one place at a time, only where it wins, with the plain form kept as the fallback. The steps are in <a href="#adoption">Adoption</a>.</p>

<h3>Ownership, support, exit</h3>
<ul>
 <li><b>Supplied by</b> <a href="https://www.ai-nativesolutions.com">AI Native Solutions</a>; contact is through that site.</li>
 <li><b>Support, SLA, warranty and liability</b> are agreed per deployment, in each deployment's agreement.</li>
 <li><b>Licence:</b> MIT — no licence fee (LICENSE and NOTICE in the repository). You hold the source; it keeps running without us.</li>
 <li><b>No data comes to us.</b> The code runs on your machines and calls no service of ours, so using it puts none of your data in our hands; if a deployment’s support needs access to your systems, that is set out in its agreement.</li>
 <li><b>Versions.</b> There are no tagged releases yet: pin the commit you reviewed and gated. A pack carries its own legend, so unpacking needs no shared dictionary, only the tongue-pack.mjs it was packed with.</li>
 <li><b>Exit:</b> stop packing. Every pack unpacks to the exact record, so nothing is lost and nothing downstream has to change back.</li>
</ul>

<h3>Risks, answered straight</h3>
<ul>
 <li><b>The saving is proportional and modest.</b> The median place keeps ${pct(MEAS.keepToday)} of its tokens; at small volumes that is a small bill to begin with.</li>
 <li><b>Your records are not ours.</b> The shares come from the estate's own records; yours will differ. That is why the switch measures each place first and stays off where it does not win — as it did on ${(shipRun ? shipRun.places.length : 0) - shipWins} of the ${shipRun ? shipRun.places.length : 0} places here.</li>
 <li><b>Tokens are counted with Claude's tokenizer</b> (${esc(shipRun ? shipRun.model : '')}). Another model's tokenizer will count differently; measure with yours.</li>
 <li><b>The model has to read the legend.</b> ${readsOk} of ${readsN} read-check questions came back exact from the pack — a small sample; check your own questions before you switch a place on.</li>
 <li><b>No independent review yet.</b> No outside party has audited it. The assurance is what you can re-run yourself — the tests, the seals, the record re-derivation and the mutation gate — so commission your own review before it carries anything that matters.</li>
 <li><b>It is not 15×, and new conversation barely shrinks.</b> ${j ? j.passed + ' of ' + j.of : ''} sealed rules held. A dictionary only saves what recurs, and most of what an agent says is new.</li>
</ul>

<h3>The case for the board</h3>
<div class="card callout"><p style="margin:0">The tongue is a measured answer, not a promise: a shared dictionary does not make new conversation meaningfully cheaper, and the record says so. What did pay is small, owned and safe to try — a JSON pack that carries its own legend, cuts the input tokens of repetitive records (the median measured place keeps ${pct(MEAS.keepToday)}), returns exactly what was sent, and is switched on only where it measures cheaper. It costs nothing to licence and runs without a supplier. Adopt it where your systems send a model the same shapes again and again, measure it on your own records first, and treat the method — rules sealed before the measurement, failures kept — as the larger asset.</p></div>
</section>

<section id="adoption" aria-labelledby="ad-h">
<h2 id="ad-h"><small>Adoption</small>How a team rolls it out</h2>
<p>The pack fits a team whose systems send a language model structured records with recurring shapes: tool results, queues, ledgers, run records. It is not for free text, and it does not replace minifying — do that first.</p>
<ol>
 <li><b>Try it on your own records, here.</b> Paste one into <a href="#try">Try it</a>. Nothing leaves the tab.</li>
 <li><b>Run the gates on your own machine.</b> Clone the repository and run the commands in <a href="#start">Start here</a>, and the mutation gate as <code>gate.yml</code> runs it. You are trusting what you just re-ran, not this page.</li>
 <li><b>List the places.</b> Each tool result, file or message your systems send a model is one place, as <code>tools/ship.mjs</code> lists the estate's.</li>
 <li><b>Write down what you expect before you measure.</b> Commit the places and the rule for switching on — as <code>data/ship-prereg.json</code> was sealed — so the result cannot be tuned after the fact.</li>
 <li><b>Measure each place three ways in your model's tokens:</b> as sent today, minified, and packed with the legend included. Keep every result, including the places where it loses.</li>
 <li><b>Check the model reads it.</b> Ask a question with a fixed answer from the plain form and from the pack, as the ship run's read check did.</li>
 <li><b>Switch on only where it wins.</b> Use <code>wins(today, packed)</code>; leave every other place as it is, and keep the plain form as the fallback.</li>
 <li><b>Gate it in your CI.</b> Copy <code>.github/workflows/gate.yml</code>: the tests, the seal check, the record re-derivation and the pinned mutation gate.</li>
</ol>
<p><b>What success looks like:</b> on your own places, the tokens against your baseline, measured; every pack unpacking to the exact record; in CI, every kernel clean on every push.</p>
</section>

<section id="paper" aria-labelledby="wp-h">
<h2 id="wp-h"><small>White paper</small>A language grown between agents, measured against its own target</h2>
<div class="paper">
<h3>Abstract</h3>
<p>${run ? 'We grew a nested glyph dictionary from ' + A.trainMessages + ' real messages between two of the estate\'s agents, a shared JSON schema from the estate\'s own data, and a picture channel read back blind, and measured each in Claude tokens on held-out material against a 15× target, with ' + pre.rules.length + ' rules and a prediction sealed in git before any held-out message was coded. ' + j.passed + ' of ' + j.of + ' rules held. The dictionary carried ' + A.heldMessages + ' held-out messages in ' + x2(tcL.ratio) + ' fewer tokens; the schema carried ' + heldJson + ' held-out JSON files in ' + x2(jcL.ratio) + '; the best picture arm carried ' + j.bestPicture + ' bits per token at the read-back bar, against ' + j.bestText + ' for the best text. Every held-out message and file decoded exactly. A per-value JSON pack, measured where it lands, was cheaper on ' + shipWins + ' of ' + (shipRun ? shipRun.places.length : 0) + ' places and is shipped there.' : esc(headline)}</p>
<h3>1 · The question</h3>
<p>Agents that work together repeat themselves: the same headings, the same record shapes, the same names. A language model bills by the token, so a vocabulary both sides already hold should make a message cheaper, the way a template — a whole program called by name — makes a call cheap. The question is how much cheaper on what they actually say next, which they have not said before.</p>
<h3>2 · Method</h3>
<p>Every candidate glyph was priced in Claude tokens first, so the alphabet is chosen by cost. The material was split by time: everything before ${cutoff} trains, everything after is held out. The rules, the prices, the split, the prompts and a prediction were sealed (${sealShort}) before any held-out message was coded or any picture read. The dictionary grows by merging the most valuable adjacent pair of units, where value is how many tokens the merge saves at the glyph's real price; JSON keys, strings and record shapes become glyphs by length times count. Pictures are seeded payloads drawn at shrinking sizes and read back blind; a size counts only if every held-out image reads back at ≥${pre.config.picture.bar * 100}%. CI re-grades every recorded read and re-derives every number on every push.</p>
<h3>3 · Results</h3>
<p>${run ? 'Text: ' + x2(tcL.ratio) + ' (' + g(tcL.plainTokens) + ' → ' + g(tcL.codedTokens) + ' tokens), climbing slowly with the dictionary and not at every step. Claude decoded ' + exactReads + ' of ' + run.text.readback.length + ' coded messages exactly from the legend. JSON: ' + x2(jcL.ratio) + ' (' + g(jcL.plainTokens) + ' → ' + g(jcL.codedTokens) + '), all ' + heldJson + ' files exact. Pictures: no arm of dots or glyphs read back at the bar at any size tried, so the best arm carried ' + j.bestPicture + ' bits per token. The coded messages drawn as plain text pictures cost ' + x2(run.combined.ratio || run.combined.partialRatio) + ' fewer tokens than their English, ' + run.combined.passing + ' of ' + run.combined.of + ' read back at ≥' + pre.config.picture.bar * 100 + '%. Shipped: the pack was cheaper than today\'s text on ' + shipWins + ' of ' + (shipRun ? shipRun.places.length : 0) + ' places (median place ' + pct(MEAS.keepToday) + ' of its tokens), lossless on all, and read as well as the plain form in the read check.' : ''}</p>
<h3>4 · Why it falls short of 15×</h3>
<p>New information: most of what an agent says next has not been said before, and a dictionary saves only what recurs. Cheap glyphs are scarce, so a two-token glyph pays only for a phrase of three tokens or more, while Claude's tokenizer already spends about one token on a common English word. Holding the dictionary costs more tokens than the held-out messages themselves. And in pictures, dense grids of unfamiliar symbols never read back at ${pre.config.picture.bar * 100}% at the sizes tried.</p>
<h3>5 · What shipped</h3>
<p>The JSON pack: a value learns its own legend from itself, so no shared state is needed; it is switched on only where it measured cheaper than what is sent today. LIGHT's templates, called by name, show where large ratios do live — on repeated work, a program both sides already hold: best ${tBest ? x2(tBest.ratio) + ' (' + esc(tBest.name) + ')' : ''}, median ${shipJ ? x2(shipJ.median) : ''} over ${shipRun ? shipRun.templates.length : 0}.</p>
<h3>6 · Limits</h3>
<p>One pair of agents, one tokenizer, one model reading pictures. The held-out set is small (${A.heldMessages} messages, ${heldJson} JSON files). The pack's read check is two questions. The 15× chase stays a standing, measured line (<code>tools/point.mjs</code>), never a claim.</p>
</div>
</section>

<section id="faq" aria-labelledby="faq-h">
<h2 id="faq-h"><small>Questions</small>Asked and answered</h2>
<div class="card">${faq.map(([q, a]) => '<h3>' + esc(q) + '</h3><p>' + esc(a) + '</p>').join('')}</div>
</section>
<footer>
 <p>Next door: <a href="light/">LIGHT, the estate's inner codec</a> — one lossless, signed, mutation-gated codec for the estate's organs to speak between themselves, with its own sealed claims, receipts, business case and white paper.</p>
 <p>The numbers on this page come from the mutation-gated kernels <code>tongue.mjs</code>, <code>tongue-pack.mjs</code> and <code>tongue-cost.mjs</code>, inlined below, and the committed records. · <a href="${REPO}">source</a> · MIT for the code · supplied by <a href="https://www.ai-nativesolutions.com">AI Native Solutions</a>.</p>
 <p>Built on the seed's memory law and on Thomas Frumkin's Konomi architecture and <a href="${LIGHT}">LIGHT</a> (the estate's fork of teslasolar/light, used with permission). ${CREDIT}. The shopper sessions in the JSON channel: UCI Online Shoppers Purchasing Intention Dataset, C. Sakar and Y. Kastro (2018), CC BY 4.0.</p>
</footer>
</div>
<script id="kernel" type="text/plain">
${inline(kernelSrc)}
</script>
<script id="kernel-pack" type="text/plain">
${inline(packSrc)}
</script>
<script id="kernel-cost" type="text/plain">
${inline(costSrc)}
</script>
<script>
const DATA = ${JSON.stringify(regradeData).replace(/</g, '\\u003c')};
const SEED = ${seedOf.toString()};
const ALPHA = ${JSON.stringify(ALPHA)};
const BASIS = ${JSON.stringify(BASIS).replace(/</g, '\\u003c')};
const PLACES = ${JSON.stringify(PLACES)};
const SOURCED_PRICE = ${JSON.stringify(PRICE)};
const $ = (id) => document.getElementById(id);
const src = (id) => $(id).textContent;
const TK = new Function(src('kernel') + '\\n' + src('kernel-pack') + '\\nreturn { payload, gridText, gradeGrid, pack, unpack };')();
const CK = new Function(src('kernel-cost') + '\\nreturn { measuredOf, tongueCase };')();

// the theme: follow the system until the reader picks one
$('theme').addEventListener('click', () => {
  const now = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', now === 'light' ? 'dark' : 'light');
});

// re-grade every recorded picture read with the same kernel
const btn = $('regrade');
if (btn && DATA) btn.addEventListener('click', () => {
  let same = 0;
  for (const r of DATA.reads) {
    const seed = SEED([r.arm, r.size, r.split, r.k, r.gen || 0].join('|'));
    let truth;
    if (r.kind === 'dots') { const side = Math.sqrt(r.cells); truth = TK.gridText(TK.payload(r.cells, 2, seed), side, ['0', '1']); }
    else { const a = r.arm === 'B' ? DATA.B : r.gen === 1 ? DATA.C1 : DATA.C2; truth = TK.gridText(TK.payload(r.cells, a.length, seed), DATA.cols, a); }
    if (JSON.stringify(TK.gradeGrid(truth, r.reply)) === JSON.stringify(r.grade)) same += 1;
  }
  $('out').textContent = same === DATA.reads.length ? 'IDENTICAL: all ' + same + ' reads re-graded to the recorded grade.' : 'DIFFERS: ' + (DATA.reads.length - same) + ' of ' + DATA.reads.length + ' reads re-grade differently.';
});

// the shipped JSON pack on the reader's own JSON
const glyphs = [...ALPHA];
const packIt = () => {
  const raw = $('pk-in').value;
  let value;
  try { value = JSON.parse(raw); } catch { value = undefined; }
  if (value === undefined) { for (const id of ['pk-min', 'pk-packed', 'pk-entries', 'pk-rt']) $(id).textContent = '—'; $('pk-chars').textContent = String(raw.length); $('pk-out').textContent = 'Not JSON yet — the pack takes any JSON value.'; return; }
  const min = JSON.stringify(value), p = TK.pack(value, glyphs), back = p.ok ? TK.unpack(p.text) : { ok: false };
  $('pk-chars').textContent = String(raw.length);
  $('pk-min').textContent = String(min.length);
  $('pk-packed').textContent = p.ok ? String(p.text.length) : '—';
  $('pk-entries').textContent = p.ok ? String(p.entries) : '—';
  $('pk-rt').textContent = back.ok && JSON.stringify(back.value) === min ? 'exact' : 'NO';
  $('pk-out').textContent = p.ok ? p.text : 'could not pack: ' + (p.error || 'unknown');
};
$('pk-in').addEventListener('input', packIt);
packIt();

// the cost case, recomputed by the gated kernel on every change
const MEAS = CK.measuredOf({ places: PLACES });
const money = (x) => x.toFixed(2);
const costIt = () => {
  const price = Number($('tc-price').value);
  const input = { millionTokensPerMonth: Number($('tc-tokens').value), pricePerMillion: price === SOURCED_PRICE ? null : price, minifiedToday: $('tc-min').value === 'yes', years: Number($('tc-years').value) };
  const r = CK.tongueCase(BASIS, MEAS, input), rows = $('tc-rows');
  rows.textContent = '';
  const row = (cells, best) => { const tr = document.createElement('tr'); if (best) tr.className = 'best'; cells.forEach((c, i) => { const td = document.createElement('td'); if (i) td.className = 'n'; td.textContent = c; tr.appendChild(td); }); rows.appendChild(tr); };
  if (!r.ok) { $('tc-verdict').textContent = 'The case cannot be computed: ' + r.why + '.'; row(['check the inputs', '', '']); return; }
  $('tc-verdict').textContent = 'Packed where it wins, the median measured place keeps ' + (Math.round(r.keep * 1000) / 10) + '% of its input tokens, so ' + r.inputs.millionTokensPerMonth + ' million tokens a month becomes ' + r.tokens.packedPerMonth + ' million — about ' + money(r.savingPerYear) + ' pounds a year at ' + r.price + ' pounds per million' + (r.priceSourced ? ' (the sourced list price)' : ' (your price)') + '.';
  row(['input tokens a month (million)', String(r.inputs.millionTokensPerMonth), String(r.tokens.packedPerMonth)]);
  row(['a year (£)', money(r.perYear.today), money(r.perYear.packed)]);
  row(['over ' + r.inputs.years + ' years (£)', money(r.over.today), money(r.over.packed)]);
  row(['saved (£)', money(r.savingPerYear) + ' a year', money(r.savingOver) + ' over ' + r.inputs.years + ' years'], true);
};
for (const id of ['tc-tokens', 'tc-price', 'tc-min', 'tc-years']) $(id).addEventListener('input', costIt);
costIt();
</script>
</body></html>
`;
const md = ['# The Konomi Tongue', '', '**Live: ' + URL_LIVE + '**', '', '**LIGHT, the estate\'s inner codec (in `light/`): ' + URL_LIVE + 'light/**', '', '**The 15× curve, re-measured every week (in `curve/`): ' + URL_LIVE + 'curve/**', '', '**LIGHT, layered: five folds and a stack, measured (in `layered/`): ' + URL_LIVE + 'layered/**', '', 'A language the estate\'s agents grow between themselves, measured in Claude tokens against Simon\'s 15×: a nested glyph dictionary grown from their real messages, a shared JSON schema, and a picture channel read back blind. Sealed before any held-out message was coded or any picture read.', '', '## The result', '', headline, ''];
if (run) {
  md.push('| Sealed rule | Result | | Predicted |', '|---|---|---|---|');
  for (const r of j.rules) md.push('| ' + pre.rules.find((x) => x.id === r.id).rule + ' | ' + r.value + ' | ' + (r.pass ? 'PASS' : 'FAIL') + ' | ' + pre.predictions[r.id] + ' |');
  md.push('');
}
md.push('## What it is', '', 'The live page explains it end to end — what it is, start here, a live JSON pack, how it works (diagrams traced from the record), the receipts, the blueprint, the cost case for a team, adoption steps and a white paper: ' + URL_LIVE, '',
  '- `tongue.mjs` — the kernel: units, the growing nested dictionary (encode/decode, lossless), JSON mode (shared schema, glyph keys and values), the picture channel\'s payloads and grading, misread-driven alphabet evolution. Pure; witness-gated.',
  '- `tongue-pack.mjs` — the shipped JSON mode: a value packed with its own legend, switched on only where it measured cheaper. Pure; witness-gated.',
  '- `tongue-cost.mjs` — the page\'s cost case: the sourced model price, the ship record\'s shares, the reader\'s inputs. Pure; witness-gated.',
  '- `tools/price.mjs` — every candidate glyph priced in Claude tokens (data/prices.json).', '- `tools/corpus.mjs`, `tools/json-corpus.mjs` — the agents\' messages (private, pinned by sha256) and the estate\'s JSON (data/json/), split before measuring.',
  '- `tools/seal.mjs`, `tools/run.mjs`, `tools/ship.mjs`, `tools/make-page.mjs` — the seal, the run and its CI verification, the ship measurement, and this README and the page.',
  '- `tools/witness-check.mjs` — CI fails unless each kernel\'s mutation run on GitHub\'s runner is clean and re-derives `data/witness.json`' + (W ? ' (' + W.killed + ' of ' + W.total + ' killed, none baselined)' : '') + '.', '');
md.push('## LIGHT', '', 'The repository also holds LIGHT (`light/`): one lossless, integer-only, context-mixing codec primed with a shared dictionary, a signed packet door that verifies sender, signature and counter on the raw bytes before anything is decoded, and a vault that packs many files into one hash-checked stream. Its claims were sealed in `light/claims.json` before any code; its receipts are `light/data/light-run.json`, `light/data/barrier-run.json` and `light/data/witness.json`; every kernel is mutation-gated on GitHub\'s runner on every push (`.github/workflows/light.yml`). The live page explains it, with the receipts, a business case, adoption steps and a white paper: ' + URL_LIVE + 'light/', '');
md.push('## Credits', '', '- The seed\'s memory law (compress, don\'t delete; compress by prime indices).', '- Thomas Frumkin\'s Konomi architecture and LIGHT ([the estate\'s fork](' + LIGHT + ') of teslasolar/light, used with permission). ' + CREDIT + '.', '- Shopper sessions: UCI Online Shoppers Purchasing Intention Dataset, C. Sakar and Y. Kastro (2018), DOI 10.24432/C5F88Q, CC BY 4.0.', '- Code: MIT.', '');
const llms = ['# The Konomi Tongue', '', '> A sealed measurement of a glyph language grown from real agent messages, in Claude tokens, against a 15× target; plus a picture channel read back blind.', '', headline, '', '## Key pages', '', '- [Live page](' + URL_LIVE + ')', '- [Repository](' + REPO + ')', '- [LIGHT, the inner codec](' + URL_LIVE + 'light/)', '- [The 15× curve, re-measured weekly](' + URL_LIVE + 'curve/)', '- [LIGHT, layered: five folds and a stack](' + URL_LIVE + 'layered/)', '- [Pre-registration](' + URL_LIVE + 'data/prereg.json)', ...(run ? ['- [The record](' + URL_LIVE + 'data/run.json)'] : []), '', '## Credits', '', '- ' + CREDIT + '. LIGHT is Thomas Frumkin\'s (used with permission).', ''].join('\n');

writeFileSync(at('index.html'), page);
writeFileSync(at('README.md'), md.join('\n'));
writeFileSync(at('llms.txt'), llms);
if (run) writeFileSync(at('data/verdict.json'), JSON.stringify({ kind: 'konomi-tongue-verdict', sealedIn: run.sealedIn, passed: j.passed, of: j.of, rules: j.rules.map((r) => ({ id: r.id, pass: r.pass, value: r.value })),
  text: last(run.text.curve), json: last(run.json.curve), bestPicture: j.bestPicture, bestText: j.bestText, combined: { ratio: run.combined.ratio, partialRatio: run.combined.partialRatio, passing: run.combined.passing, of: run.combined.of } }, null, 1) + '\n');
console.log('page built · ' + (run ? j.passed + ' of ' + j.of + ' rules' : 'sealed, not yet run'));
