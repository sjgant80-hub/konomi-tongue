// the root page's gate: a stranger opening index.html must get a page that explains itself — what it is, start here,
// a live pack, how it works traced from the record, the receipts, the blueprint, the cost case, adoption, a white paper —
// whose every control is wired, whose every in-page link lands, whose numbers are the records' numbers, and whose own
// script, run against a small DOM, really packs, really computes the case with the gated kernel, and really re-grades.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as K from '../tongue-cost.mjs';
import { pack, unpack } from '../tongue-pack.mjs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const HTML = read('index.html');
const json = (p) => JSON.parse(read(p));
const RUN = json('data/run.json'), PRE = json('data/prereg.json'), SHIP = json('data/ship-run.json'), W = json('data/witness.json'), LW = json('light/data/witness.json');
const BASIS = json('light/vendor/sovereign-enterprise/data/basis.json');
const text = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const section = (id) => { const s = HTML.slice(HTML.indexOf('<section id="' + id + '"')); return s.slice(0, s.indexOf('</section>')); };
const last = (xs) => xs[xs.length - 1];
const x2 = (v) => (Math.round(v * 100) / 100) + '×';
const pct = (x) => (Math.round(x * 1000) / 10) + '%';
const g = (n) => n.toLocaleString('en-GB');

test('the page explains itself: what, start here, try, how, receipts, blueprint, for a team, adoption, white paper, questions', () => {
  for (const id of ['what', 'start', 'try', 'how', 'receipts', 'blueprint', 'business', 'adoption', 'paper', 'faq']) {
    assert.match(HTML, new RegExp('<section id="' + id + '" aria-labelledby="'), id);
    assert.ok(HTML.includes('href="#' + id + '"'), 'the nav reaches #' + id);
  }
  assert.ok((section('how').match(/<svg viewBox/g) || []).length >= 2, 'how it works has its two diagrams: the sealed run, and the pack');
  const items = (id) => (section(id).match(/<li>/g) || []).length;
  assert.ok(items('start') >= 6 && items('adoption') >= 8, 'start here and adoption are numbered steps');
  assert.ok(/<ol>/.test(section('start')) && /<ol>/.test(section('adoption')), 'numbered, not bulleted');
  // the 15× verdict, straight: reached only by repeated work (a LIGHT template called by name), never by new talk
  const best = [...SHIP.templates].sort((a, b) => b.ratio - a.ratio)[0];
  assert.ok(text(HTML).includes('the 15× target was reached only by repeated work — a LIGHT template called by name (best ' + x2(best.ratio) + ') — never by new talk'), 'the lede');
  assert.ok(text(HTML).includes('best ' + x2(best.ratio) + ' (' + best.name + ')'), 'the white paper names the template');
  assert.ok(/Why it falls short of 15×/.test(HTML) && !/nothing came near the 15× target/.test(HTML), 'no claim the record contradicts');
  assert.ok(HTML.includes('href="light/"'), 'LIGHT is reachable from the root page');
});

test('every id the script reaches for exists, every label has its control, every in-page link has a target', () => {
  const ids = new Set([...HTML.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const script = HTML.slice(HTML.lastIndexOf('<script>'));
  for (const [, id] of script.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.has(id), 'the script uses #' + id);
  for (const [, id] of script.matchAll(/src\('([^']+)'\)/g)) assert.ok(ids.has(id), 'the script reads #' + id);
  for (const id of ['tc-tokens', 'tc-price', 'tc-min', 'tc-years']) assert.ok(script.includes("'" + id + "'"), id + ' is listened to');
  for (const [, id] of HTML.matchAll(/<label for="([^"]+)"/g)) assert.ok(ids.has(id), 'a label points at #' + id);
  for (const [, id] of HTML.matchAll(/href="#([A-Za-z0-9-]+)"/g)) assert.ok(ids.has(id), 'a link to #' + id + ' has a target');
  assert.ok(!/\son[a-z]+="/i.test(HTML), 'no inline handlers: every control is wired by addEventListener');
  const dup = [...HTML.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]).filter((id, i, a) => a.indexOf(id) !== i);
  assert.deepEqual(dup, [], 'no id is used twice');
});

test('the page runs the gated files themselves: the three kernels are inlined exactly', () => {
  const block = (id) => { const m = HTML.match(new RegExp('<script id="' + id + '" type="text/plain">\\n([\\s\\S]*?)\\n</script>')); assert.ok(m, id); return m[1]; };
  const strip = (s) => s.replace(/\r\n/g, '\n').replace(/^export (function|const) /gm, '$1 ');
  assert.equal(block('kernel'), strip(read('tongue.mjs')).replace(/<\/script/gi, '<\\/script'));
  assert.equal(block('kernel-pack'), strip(read('tongue-pack.mjs')).replace(/^import [^\n]*\n/m, ''));
  assert.equal(block('kernel-cost'), strip(read('tongue-cost.mjs')).replace(/^export default [^\n]*\n/m, ''));
});

test('the blueprint lists every gated kernel with the counts CI re-derives, and LIGHT\'s receipt', () => {
  const bp = section('blueprint');
  const keys = [...bp.matchAll(/data-k="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(keys.sort(), W.kernels.map((k) => k.name).sort(), 'every kernel the witness receipt gates is in the blueprint');
  for (const k of W.kernels) {
    assert.ok(bp.includes('data-k="' + k.name + '">' + k.killed + ' / ' + k.total + ' killed'), k.name + "'s gate");
    assert.ok(bp.includes(k.file), k.file);
  }
  assert.equal(W.killed, W.kernels.reduce((s, k) => s + k.killed, 0));
  assert.equal(W.total, W.kernels.reduce((s, k) => s + k.total, 0));
  assert.ok(W.kernels.every((k) => k.ignored === 0 && k.clean === true), 'no root survivor is baselined');
  assert.ok(bp.includes(W.killed + ' of ' + W.total + ' mutants killed, none baselined'));
  assert.ok(bp.includes(LW.kernels.length + ' kernels, ' + LW.killed + ' of ' + LW.total + ' mutants killed on the runner'));
  for (const f of ['tools/price.mjs', 'tools/seal.mjs', 'tools/ship.mjs', 'tools/point.mjs', 'tools/legend.mjs', 'tools/make-page.mjs', 'tools/witness-check.mjs', 'vendor/light/templates.cjs', 'test/tongue-page.test.mjs', 'gate.yml']) assert.ok(bp.includes(f), 'the blueprint names ' + f);
});

test('the numbers on the page are the records\' numbers, never typed from memory', () => {
  const t = last(RUN.text.curve), jj = last(RUN.json.curve), A = PRE.corpus.agents;
  const M = K.measuredOf(SHIP), wins = SHIP.places.filter((p) => p.wins).length, n = SHIP.places.length;
  const page = text(HTML);
  const want = [
    x2(t.ratio), x2(jj.ratio), g(t.plainTokens) + ' → ' + g(t.codedTokens), g(jj.plainTokens) + ' → ' + g(jj.codedTokens),
    A.trainMessages + ' train · ' + A.heldMessages + ' held-out', RUN.text.glyphs + ' glyphs', 'nested up to ' + RUN.text.depth.max + ' deep',
    RUN.json.kinds.schema + ' schemas · ' + RUN.json.kinds.key + ' keys', RUN.json.kinds.string + ' strings', 'split ' + A.cutoff.slice(0, 10),
    RUN.text.lossless.ok + ' of ' + RUN.text.lossless.n + ' decode exactly', RUN.json.lossless.ok + ' of ' + RUN.json.lossless.n + ' decode exactly',
    PRE.config.text.rounds + ' rounds', RUN.picture.reads.filter((r) => r.split === 'held').length + ' held-out reads',
    wins + ' of ' + n + ' places cheaper packed', wins + ' of ' + n + ' measured places cheaper packed', 'median place keeps ' + pct(M.keepToday),
    'median ' + pct(M.keepMinified) + ' kept', 'the best place kept ' + pct(M.bestToday), RUN.sealedIn.slice(0, 7),
    g(RUN.json.legendTokens) + ' tokens to send once', 'split ' + A.cutoff.slice(0, 10), PRE.rules.length + ' rules and a prediction',
    SHIP.readCheck.filter((r) => r.packedExact).length + ' of ' + SHIP.readCheck.length + ' questions exactly',
  ];
  for (const w of want) assert.ok(page.includes(w), 'the page states the record\'s number: ' + w);
  const passed = (page.match(/(\d+) of (\d+) sealed rules held/) || []).slice(1).map(Number);
  const grade = json('data/verdict.json');
  assert.deepEqual(passed, [grade.passed, grade.of], 'the verdict is the graded one');
  assert.ok(page.includes('including the ' + (grade.of - grade.passed) + ' that failed'), 'the failures are counted, not typed');
});

test('the brochure a buyer needs is on the page: roles, cost case, comparison, security, roll-out, ownership, risks, board', () => {
  const sec = section('business');
  for (const role of ['CEO', 'CFO', 'COO', 'CTO / CISO', 'Engineering teams', 'Data and compliance teams']) assert.ok(sec.includes('<h4>' + role + '</h4>'), role);
  for (const h of ['The cost case', 'Against what you use now', 'Security and data protection', 'Roll-out', 'Ownership, support, exit', 'Risks, answered straight', 'The case for the board']) assert.ok(sec.includes(h), h);
  assert.ok(sec.includes('href="https://www.ai-nativesolutions.com"') && /agreed per deployment/.test(sec) && /keeps running without us/.test(sec), 'supplier, terms, and that it runs without us');
  assert.ok(/UK GDPR/.test(sec) && /Not encryption, not anonymisation/.test(sec), 'data protection answered straight');
  for (const id of ['tc-tokens', 'tc-price', 'tc-min', 'tc-years', 'tc-rows', 'tc-verdict', 'tc-sources']) assert.ok(sec.includes('id="' + id + '"'), id);
  // every external figure is cited, and it is the vendored basis's figure
  for (const s of K.sourcesOf(BASIS)) assert.ok(sec.includes('<b>' + s.key + '</b> = ' + s.value) && sec.includes('href="' + s.source + '"'), s.key + ' cited');
  assert.match(sec, new RegExp('id="tc-price" type="number" min="0" step="any" value="' + K.priceOf(BASIS) + '"'), 'the price starts at the sourced figure');
  assert.ok(/not inflated/.test(sec) && /Not counted: output tokens/.test(sec), 'what the case leaves out is said');
});

test('the visible questions and the FAQPage schema say exactly the same thing; credit and supplier named; no price of ours', () => {
  const lds = [...HTML.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const faq = lds.find((x) => x['@type'] === 'FAQPage').mainEntity.map((q) => [q.name, q.acceptedAnswer.text]);
  const shown = [...section('faq').matchAll(/<h3>([\s\S]*?)<\/h3><p>([\s\S]*?)<\/p>/g)].map((m) => [text(m[1]), text(m[2])]);
  assert.ok(faq.length >= 6);
  assert.deepEqual(shown, faq);
  assert.ok(/Powered by the Konomi architecture, created by Thomas Frumkin/.test(HTML), 'the Konomi credit');
  assert.ok(HTML.includes('AI Native Solutions') && /MIT/.test(HTML), 'supplier and licence');
  for (const re of [/priceCurrency/i, /"@type"\s*:\s*"Offer"/i, /\/mo\b/, /£\d/, /per seat/i, /subscription/i, /\btiers?\b/i]) assert.ok(!re.test(HTML), 'no pricing of ours: ' + re);
});

test('both themes define every colour the page uses, and the theme can be switched', () => {
  const style = HTML.match(/<style>([\s\S]*?)<\/style>/)[1];
  const used = new Set([...style.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]));
  const root = style.match(/:root\{([^}]*)\}/)[1], light = style.match(/:root\[data-theme="light"\]\{([^}]*)\}/)[1];
  for (const name of used) {
    assert.ok(root.includes(name + ':'), name + ' in dark');
    if (!['--sans', '--serif', '--mono'].includes(name)) assert.ok(light.includes(name + ':'), name + ' in light');
  }
  assert.ok(style.includes('@media (prefers-color-scheme:light)'), 'follows the system theme');
  assert.ok(HTML.includes('id="theme"'), 'a theme switch');
  assert.ok(/\.wrap\{max-width:56rem;margin:0 auto;padding:0 16px/.test(style) && /\.diagram\{overflow-x:auto/.test(style), 'a 16px gutter, and wide diagrams scroll inside themselves on a phone');
});

// ── the page's own script, run against a small DOM ────────────────────────────────────────────────────────────────
function domFor(html) {
  const els = new Map();
  const make = (id, value) => {
    const el = { id, value, textContent: '', className: '', children: [], listeners: {}, attrs: {},
      addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
      appendChild(c) { this.children.push(c); return c; },
      fire(type) { for (const fn of this.listeners[type] || []) fn({ target: this }); } };
    Object.defineProperty(el, 'textContent', { get() { return this._t || ''; }, set(v) { this._t = String(v); if (v === '') this.children = []; } });
    return el;
  };
  // elements with a closing tag; <input> is void and is read separately below
  for (const [, tag, attrs, inner] of html.matchAll(/<(textarea|select|script|b|p|span|tbody|ul|pre|button)\b([^>]*\bid="[^"]+"[^>]*)>([\s\S]*?)(?=<\/\1>)/g)) {
    const id = attrs.match(/\bid="([^"]+)"/)[1];
    let value = '';
    if (tag === 'textarea') value = inner.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    else if (tag === 'select') value = (inner.match(/<option value="([^"]+)"/) || [])[1] || '';
    const el = make(id, value);
    if (tag === 'script') el._t = inner;
    els.set(id, el);
  }
  for (const [, tag, attrs] of html.matchAll(/<(input)\b([^>]*\bid="[^"]+"[^>]*)>/g)) {
    const id = attrs.match(/\bid="([^"]+)"/)[1];
    if (!els.has(id)) els.set(id, make(id, (attrs.match(/\bvalue="([^"]*)"/) || [])[1] || ''));
  }
  const root = { attrs: {}, getAttribute(k) { return this.attrs[k] ?? null; }, setAttribute(k, v) { this.attrs[k] = v; } };
  const document = { documentElement: root, getElementById: (id) => els.get(id) || null,
    createElement: (tag) => ({ tag, className: '', textContent: '', children: [], appendChild(c) { this.children.push(c); return c; } }) };
  return { els, document, root };
}
function runPage() {
  const d = domFor(HTML);
  const script = HTML.slice(HTML.lastIndexOf('<script>') + 8, HTML.lastIndexOf('</script>'));
  new Function('document', 'matchMedia', script)(d.document, () => ({ matches: false }));
  return d;
}

test('the page\'s own script packs the sample exactly, with the shipped kernel and alphabet', () => {
  const { els } = runPage();
  const sample = els.get('pk-in').value, value = JSON.parse(sample), min = JSON.stringify(value);
  const p = pack(value, RUN.picture.alphabet);
  assert.equal(els.get('pk-chars').textContent, String(sample.length));
  assert.equal(els.get('pk-min').textContent, String(min.length));
  assert.equal(els.get('pk-packed').textContent, String(p.text.length));
  assert.equal(els.get('pk-entries').textContent, String(p.entries));
  assert.ok(p.entries > 0 && p.text.length < min.length, 'the sample has something recurring to learn, and shrinks');
  assert.equal(els.get('pk-rt').textContent, 'exact');
  assert.equal(els.get('pk-out').textContent, p.text, 'the page shows the same pack Node makes');
  assert.equal(JSON.stringify(unpack(p.text).value), min);
  // the note's own claim: half the sample, and the legend costs more than it saves
  assert.ok(/Delete half the records above and watch the legend cost more than it saves/.test(HTML));
  const half = value.slice(0, value.length / 2), hp = pack(half, RUN.picture.alphabet);
  assert.ok(hp.text.length > JSON.stringify(half).length, 'half the sample packs longer than it is minified');
  // garbage in the box: said plainly, nothing claimed
  els.get('pk-in').value = '{"open": ';
  els.get('pk-in').fire('input');
  assert.equal(els.get('pk-rt').textContent, '—');
  assert.match(els.get('pk-out').textContent, /^Not JSON yet/);
});

test('the page\'s own script computes the cost case with the gated kernel, and follows the reader\'s inputs', () => {
  const { els } = runPage();
  const M = K.measuredOf(SHIP), def = K.tongueCase(BASIS, M, {});
  const cells = () => els.get('tc-rows').children.map((tr) => tr.children.map((td) => td.textContent));
  assert.deepEqual(cells()[1], ['a year (£)', def.perYear.today.toFixed(2), def.perYear.packed.toFixed(2)]);
  assert.match(els.get('tc-verdict').textContent, new RegExp('keeps ' + pct(def.keep).replace('.', '\\.') + ' of its input tokens'));
  assert.match(els.get('tc-verdict').textContent, /\(the sourced list price\)/);
  // the static rows (no script) say the same as the script's first run
  const rows = section('business').match(/<tbody id="tc-rows">([\s\S]*?)<\/tbody>/)[1];
  assert.ok(rows.includes('<td class="n">' + def.perYear.today.toFixed(2) + '</td><td class="n">' + def.perYear.packed.toFixed(2) + '</td>'), 'the page without script shows the default case');
  // the reader's own volume and price
  els.get('tc-tokens').value = '250'; els.get('tc-price').value = '3'; els.get('tc-years').value = '5'; els.get('tc-min').value = 'yes';
  els.get('tc-years').fire('input');
  const own = K.tongueCase(BASIS, M, { millionTokensPerMonth: 250, pricePerMillion: 3, minifiedToday: true, years: 5 });
  assert.deepEqual(cells()[3], ['saved (£)', own.savingPerYear.toFixed(2) + ' a year', own.savingOver.toFixed(2) + ' over 5 years']);
  assert.match(els.get('tc-verdict').textContent, /\(your price\)/);
  // a bad input gives the kernel's reason, never a broken table
  els.get('tc-years').value = '0'; els.get('tc-years').fire('input');
  assert.match(els.get('tc-verdict').textContent, /cannot be computed: years: 1 to 10/);
});

test('the page\'s own script re-grades every recorded read IDENTICAL, and the theme switch flips the theme', () => {
  const { els, root } = runPage();
  els.get('regrade').fire('click');
  assert.equal(els.get('out').textContent, 'IDENTICAL: all ' + RUN.picture.reads.length + ' reads re-graded to the recorded grade.');
  els.get('theme').fire('click');
  assert.equal(root.getAttribute('data-theme'), 'light', 'from the system dark, the switch goes light');
  els.get('theme').fire('click');
  assert.equal(root.getAttribute('data-theme'), 'dark');
});
