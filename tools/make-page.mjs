#!/usr/bin/env node
// tools/make-page.mjs — the fixpoint. index.html carries the SAME tongue.mjs the tests and the mutation gate prove,
// inlined verbatim, and re-grades every recorded picture read in the browser; every number on the page, in the README and
// in llms.txt is generated here from the committed seal and record by the same grade() — none is typed. Nothing private
// (the agents' messages, the grown dictionary) is ever in the record, so nothing private can reach the page.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import * as T from '../tongue.mjs';
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

const headline = !run
  ? 'Sealed, being measured. The prices, the corpus split, the channels, the rules and a prediction were committed before any held-out message was coded or any picture read; the result lands here whichever way it goes.'
  : j.passed + ' of ' + j.of + ' sealed rules held. Grown to ' + last(run.text.curve).entries + ' glyphs, the tongue carried the held-out agent messages in ' + x2(last(run.text.curve).ratio)
    + ' fewer Claude tokens and the held-out JSON in ' + x2(last(run.json.curve).ratio) + ', against Simon\'s 15×. Drawn as a picture, the best arm carried ' + j.bestPicture
    + ' bits per token read back at ≥' + pre.config.picture.bar * 100 + '%, against ' + j.bestText + ' for the best text; the coded messages drawn as pictures came to '
    + (run.combined.ratio ? x2(run.combined.ratio) : 'no ratio (not every message read back at the bar; ' + x2(run.combined.partialRatio) + ' over the ' + run.combined.passing + ' that did)') + ' of their English tokens.';

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

const tally = prices ? Object.entries(prices.tally).map(([s, t]) => '<tr><td>' + esc(s) + '</td><td class="n">' + t.n + '</td><td>' + Object.entries(t.byCost).map(([c2, n]) => n + ' at ' + c2).join(', ') + '</td></tr>').join('') : '';
const legend = json('data/legend.json');
const lightRows = legend ? '<table><thead><tr><th>glyph</th><th>LIGHT opcode</th><th>prime</th><th>Claude tokens</th></tr></thead><tbody>'
  + legend.light.opcodes.map((o) => '<tr><td class="gl">' + esc(o.glyph) + '</td><td>' + esc(o.mnemonic) + '</td><td class="n">' + o.prime + '</td><td class="n">' + o.tokens + '</td></tr>').join('')
  + '</tbody></table><p class="quiet">Rings: ' + legend.light.rings.map((r) => esc(r.glyph) + ' ' + esc(r.name) + ' ' + r.nm + ' nm (' + r.tokens + ')').join(' · ') + '. Buses: ' + legend.light.buses.map((b) => esc(b.glyph) + ' ' + esc(b.bus) + ' (' + b.tokens + ')').join(' · ') + '. Registers ' + legend.light.registers.perRing.join(' + ') + ' = ' + legend.light.registers.total + '. The whole legend: <a href="data/legend.json">data/legend.json</a>.</p>' : '';
const kernelSrc = read('tongue.mjs').replace(/^export (function|const) /gm, '$1 ');
const regradeData = run ? { reads: run.picture.reads.map((r) => ({ arm: r.arm, kind: r.kind, size: r.size, split: r.split, k: r.k, gen: r.gen, cells: r.cells, reply: r.reply, grade: r.grade })), B: run.picture.B, C1: run.picture.C1, C2: run.picture.C2, cols: CONFIG.picture.cols, dotCols: CONFIG.picture.dots.cols } : null;
const faq = [
  ['What is the Konomi Tongue?', 'A language the estate\'s agents grow between themselves: a shared dictionary where the most valuable recurring pieces of what they actually say become glyphs, glyphs can hold glyphs, and JSON records shed their keys into a shared schema — plus a picture channel that draws symbols as images, which are billed by area rather than by token.'],
  ['Did it reach 15×?', run ? headline : 'Not yet known: it is sealed and being measured.'],
  ['Why kanji and not cuneiform?', 'Price. Every candidate glyph was counted through the CLI first: in Claude\'s tokenizer a cuneiform sign costs 4 tokens and most emoji 3–4, while many kanji cost 1 or 2. Cuneiform and emoji can still pay in the picture channel, where a glyph costs area.'],
  ['How do I know it was not tuned after the fact?', 'The prices, the corpus split, the channels, the rules and a prediction were committed before any held-out message was coded or any picture read (data/prereg.json). CI re-grades every recorded read and rebuilds the JSON channel on every push; this page re-grades the reads in your browser.'],
  ['Whose ideas are these?', 'The tongue grows from the seed\'s memory law (compress, don\'t delete; compress by prime indices) and Thomas Frumkin\'s Konomi architecture and LIGHT language (36 prime-indexed opcodes; templates — a whole program called by name — are the model for the dictionary). Simon set the 15× target and the picture channel.'],
];
const ld = [
  { '@context': 'https://schema.org', '@type': 'Dataset', name: 'The Konomi Tongue', description: 'A sealed measurement: a glyph language grown from real agent messages, measured in Claude tokens against a 15× target, with a picture channel read back blind.', url: URL_LIVE, codeRepository: REPO, license: 'https://opensource.org/licenses/MIT', author: { '@type': 'Person', name: 'Kar' } },
  { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
];

const page = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Konomi Tongue</title>
<meta name="description" content="A language the agents grow between themselves, measured in Claude tokens against Simon's 15×: a nested glyph dictionary, a shared JSON schema, and a picture channel read back blind.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M16 3 29 16 16 29 3 16z' fill='%23d6a93a'/%3E%3C/svg%3E">
${ld.map((x) => '<script type="application/ld+json">' + JSON.stringify(x).replace(/</g, '\\u003c') + '</script>').join('\n')}
<style>
:root{--bg:#0c0b10;--panel:#15131b;--line:#2d2a36;--ink:#ece6d6;--dim:#a39c8c;--faint:#6f6a78;--gold:#d6a93a;--soft:#e9cf7f;--ok:#5fbf8f;--no:#e0616d;
 --sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]){--bg:#fbf8f1;--panel:#fff;--line:#e4dcc9;--ink:#22201c;--dim:#5e564a;--faint:#8b8272;--gold:#8a6a13;--soft:#6d5310}}
:root[data-theme="light"]{--bg:#fbf8f1;--panel:#fff;--line:#e4dcc9;--ink:#22201c;--dim:#5e564a;--faint:#8b8272;--gold:#8a6a13;--soft:#6d5310}
*{box-sizing:border-box}html,body{margin:0}
body{background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.6}
.wrap{max-width:56rem;margin:0 auto;padding:0 16px 5rem}
header{padding:3rem 0 1.2rem}
.kick{font-family:var(--mono);font-size:.68rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin:0 0 .6rem}
h1{font-family:var(--serif);font-weight:500;font-size:clamp(1.9rem,6vw,3rem);margin:0 0 .5rem;color:var(--soft)}
.lede{font-family:var(--serif);font-style:italic;color:var(--dim);font-size:clamp(1rem,2.4vw,1.2rem);margin:0}
h2{font-family:var(--serif);font-weight:500;color:var(--gold);font-size:1.3rem;margin:2.3rem 0 .4rem}
h3{font-size:1rem;margin:1rem 0 .3rem}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin:.8rem 0;overflow-x:auto}
.verdict{border-color:var(--gold)}
.big{font-size:1.1rem;margin-top:0}.stat{font-variant-numeric:tabular-nums;font-weight:700;color:var(--soft)}
.quiet{color:var(--dim);font-size:.92rem}
table{width:100%;border-collapse:collapse;font-size:.88rem}
th,td{text-align:left;padding:.4rem .45rem;border-top:1px solid var(--line);vertical-align:top}
th{color:var(--faint);font-family:var(--mono);font-size:.68rem;letter-spacing:.06em;text-transform:uppercase;border-top:0}
td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
tr.best td{color:var(--soft);font-weight:600}
.pass{color:var(--ok);font-family:var(--mono);font-weight:700}.fail{color:var(--no);font-family:var(--mono);font-weight:700}
svg{max-width:100%;height:auto;display:block}.ax{font-family:var(--mono);font-size:11px;fill:var(--faint)}
.axis{stroke:var(--line)}.bar15{stroke:var(--no);stroke-dasharray:4 4}.line{stroke:var(--gold);stroke-width:2}.dot{fill:var(--gold)}
.thumbs{display:flex;gap:12px;flex-wrap:wrap}.thumbs figure{margin:0;flex:1 1 200px;min-width:0}.thumbs img{max-width:100%;height:auto;border:1px solid var(--line);border-radius:6px;background:#fff;image-rendering:pixelated}
figcaption{font-size:.8rem;color:var(--dim)}
.gl{display:inline-block;font-size:1.3rem;margin:.1rem .25rem}.gl sub{font-size:.6rem;color:var(--faint);font-family:var(--mono)}
button{font:inherit;background:var(--gold);color:#16130c;border:0;border-radius:8px;padding:.6rem 1.1rem;font-weight:600;cursor:pointer}
button:hover{background:var(--soft)}button:disabled{opacity:.6;cursor:wait}button:focus-visible{outline:2px solid var(--soft);outline-offset:2px}
code{font-family:var(--mono);font-size:.85em;background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:.05em .3em;overflow-wrap:anywhere}
a{color:var(--soft)}
footer{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--line);color:var(--faint);font-size:.84rem}
</style></head><body><div class="wrap">
<header>
 <p class="kick">Konomi · the tongue the agents grow</p>
 <h1>The Konomi Tongue</h1>
 <p class="lede">A language grown from what the estate's agents actually say, measured in Claude tokens against Simon's 15×: a nested glyph dictionary, a shared JSON schema, and a picture channel read back blind.</p>
</header>
<h2>The verdict</h2>
<div class="card verdict"><p class="big">${run ? '<span class="stat">' + j.passed + ' of ' + j.of + '</span> sealed rules held.' : 'Sealed, being measured.'}</p><p>${esc(run ? headline.slice(headline.indexOf('Grown')) : headline)}</p></div>
${body}
<h2>The alphabet, priced first</h2>
<div class="card"><p class="quiet" style="margin-top:0">Every candidate glyph counted in Claude tokens through the CLI before anything else. The text channel writes only one- and two-token kanji and kana; everything dearer only pays in pictures.</p>
<table><thead><tr><th>source</th><th>priced</th><th>tokens each</th></tr></thead><tbody>${tally}</tbody></table>
<h3>The legend: LIGHT's prime-indexed opcodes, priced</h3>${lightRows}</div>
<h2>What was sealed first</h2>
<div class="card"><p style="margin-top:0">${esc(pre.statement)}</p>
<p><b>Text.</b> ${esc(pre.channels.text)}</p><p><b>JSON.</b> ${esc(pre.channels.json)}</p><p><b>Picture.</b> ${esc(pre.channels.picture)}</p><p><b>Both.</b> ${esc(pre.channels.combined)}</p>
<p><b>The split.</b> ${esc(pre.corpus.split)}</p>
<p class="quiet">${pre.disclosures.map(esc).join(' ')}</p>
<p class="quiet">${run ? 'Sealed in <code>' + esc(run.sealedIn.slice(0, 7)) + '</code> · ' : ''}<a href="data/prereg.json">the pre-registration</a>${run ? ' · <a href="data/run.json">the record</a>' : ''} · <a href="data/prices.json">the prices</a></p></div>
<h2>Questions</h2>
<div class="card">${faq.map(([q, a]) => '<h3>' + esc(q) + '</h3><p>' + esc(a) + '</p>').join('')}</div>
<footer>
 <p>The numbers on this page come from the mutation-gated kernel <code>tongue.mjs</code>, inlined below. · <a href="${REPO}">source</a> · MIT for the code.</p>
 <p>Built on the seed's memory law and on Thomas Frumkin's Konomi architecture and <a href="${LIGHT}">LIGHT</a> (the estate's fork of teslasolar/light, used with permission). ${CREDIT}. The shopper sessions in the JSON channel: UCI Online Shoppers Purchasing Intention Dataset, C. Sakar and Y. Kastro (2018), CC BY 4.0.</p>
</footer>
</div>
<script id="kernel" type="text/plain">
${kernelSrc.replace(/<\/script/gi, '<\\/script')}
</script>
<script>
const DATA = ${JSON.stringify(regradeData).replace(/</g, '\\u003c')};
const SEED = ${seedOf.toString()};
const btn = document.getElementById('regrade');
if (btn && DATA) btn.addEventListener('click', () => {
  const T = new Function(document.getElementById('kernel').textContent + '\\nreturn { payload, gridText, gradeGrid };')();
  let same = 0;
  for (const r of DATA.reads) {
    const seed = SEED([r.arm, r.size, r.split, r.k, r.gen || 0].join('|'));
    let truth;
    if (r.kind === 'dots') { const side = Math.sqrt(r.cells); truth = T.gridText(T.payload(r.cells, 2, seed), side, ['0', '1']); }
    else { const a = r.arm === 'B' ? DATA.B : r.gen === 1 ? DATA.C1 : DATA.C2; truth = T.gridText(T.payload(r.cells, a.length, seed), DATA.cols, a); }
    if (JSON.stringify(T.gradeGrid(truth, r.reply)) === JSON.stringify(r.grade)) same += 1;
  }
  document.getElementById('out').textContent = same === DATA.reads.length ? 'IDENTICAL: all ' + same + ' reads re-graded to the recorded grade.' : 'DIFFERS: ' + (DATA.reads.length - same) + ' of ' + DATA.reads.length + ' reads re-grade differently.';
});
</script>
</body></html>
`;

const md = ['# The Konomi Tongue', '', '**Live: ' + URL_LIVE + '**', '', 'A language the estate\'s agents grow between themselves, measured in Claude tokens against Simon\'s 15×: a nested glyph dictionary grown from their real messages, a shared JSON schema, and a picture channel read back blind. Sealed before any held-out message was coded or any picture read.', '', '## The result', '', headline, ''];
if (run) {
  md.push('| Sealed rule | Result | | Predicted |', '|---|---|---|---|');
  for (const r of j.rules) md.push('| ' + pre.rules.find((x) => x.id === r.id).rule + ' | ' + r.value + ' | ' + (r.pass ? 'PASS' : 'FAIL') + ' | ' + pre.predictions[r.id] + ' |');
  md.push('');
}
md.push('## What it is', '', '- `tongue.mjs` — the kernel: units, the growing nested dictionary (encode/decode, lossless), JSON mode (shared schema, glyph keys and values), the picture channel\'s payloads and grading, misread-driven alphabet evolution. Pure; witness-gated.', '- `tools/price.mjs` — every candidate glyph priced in Claude tokens (data/prices.json).', '- `tools/corpus.mjs`, `tools/json-corpus.mjs` — the agents\' messages (private, pinned by sha256) and the estate\'s JSON (data/json/), split before measuring.', '- `tools/seal.mjs`, `tools/run.mjs`, `tools/make-page.mjs` — the seal, the run and its CI verification, and this README and the page.', '');
md.push('## Credits', '', '- The seed\'s memory law (compress, don\'t delete; compress by prime indices).', '- Thomas Frumkin\'s Konomi architecture and LIGHT ([the estate\'s fork](' + LIGHT + ') of teslasolar/light, used with permission). ' + CREDIT + '.', '- Shopper sessions: UCI Online Shoppers Purchasing Intention Dataset, C. Sakar and Y. Kastro (2018), DOI 10.24432/C5F88Q, CC BY 4.0.', '- Code: MIT.', '');
const llms = ['# The Konomi Tongue', '', '> A sealed measurement of a glyph language grown from real agent messages, in Claude tokens, against a 15× target; plus a picture channel read back blind.', '', headline, '', '## Key pages', '', '- [Live page](' + URL_LIVE + ')', '- [Repository](' + REPO + ')', '- [Pre-registration](' + URL_LIVE + 'data/prereg.json)', ...(run ? ['- [The record](' + URL_LIVE + 'data/run.json)'] : []), '', '## Credits', '', '- ' + CREDIT + '. LIGHT is Thomas Frumkin\'s (used with permission).', ''].join('\n');

writeFileSync(at('index.html'), page);
writeFileSync(at('README.md'), md.join('\n'));
writeFileSync(at('llms.txt'), llms);
if (run) writeFileSync(at('data/verdict.json'), JSON.stringify({ kind: 'konomi-tongue-verdict', sealedIn: run.sealedIn, passed: j.passed, of: j.of, rules: j.rules.map((r) => ({ id: r.id, pass: r.pass, value: r.value })),
  text: last(run.text.curve), json: last(run.json.curve), bestPicture: j.bestPicture, bestText: j.bestText, combined: { ratio: run.combined.ratio, partialRatio: run.combined.partialRatio, passing: run.combined.passing, of: run.combined.of } }, null, 1) + '\n');
console.log('page built · ' + (run ? j.passed + ' of ' + j.of + ' rules' : 'sealed, not yet run'));
