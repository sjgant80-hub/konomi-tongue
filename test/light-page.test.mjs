// the LIGHT page's gate: a stranger opening light/index.html must get a page that explains itself, wires every control,
// loads only its own files, keeps its FAQ equal to its schema, states the honest scope, and carries its credit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../light/' + p, import.meta.url), 'utf8');
const HTML = read('index.html'), PAGE = read('page.mjs');
const text = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

test('a self-only security policy, no inline handlers, scripts only from this origin', () => {
  const csp = (HTML.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1];
  assert.ok(csp, 'a CSP meta');
  for (const d of ["default-src 'self'", "script-src 'self'", "connect-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"]) assert.ok(csp.includes(d), d);
  assert.ok(!/script-src[^;]*unsafe-(inline|eval)/.test(csp), 'no unsafe script-src');
  assert.ok(!/frame-ancestors/.test(csp), 'no frame-ancestors in a meta CSP');
  for (const [, attrs, body] of HTML.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/application\/ld\+json/.test(attrs)) continue;
    assert.match(attrs, /src="\.\/page\.mjs"/, 'the only script is ./page.mjs');
    assert.equal(body.trim(), '');
  }
  // the policy above blocks inline handlers, so an inline handler is a dead control: there must be none at all
  assert.ok(!/\son[a-z]+="/i.test(HTML), 'no inline handlers');
  for (const [, u] of HTML.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)) {
    if (/rel="canonical"/.test(HTML.slice(HTML.indexOf('"' + u + '"') - 60, HTML.indexOf('"' + u + '"')))) continue;
    assert.ok(!/^[a-z]+:|^\/\//i.test(u), 'no third-party script/style: ' + u);
  }
  // these are written by the measurement / witness at runtime; the page handles them missing with try/catch
  const runtime = new Set(['./data/light-run.json', './data/witness.json']);
  for (const [, u] of PAGE.matchAll(/(?:fetch|getJson)\('([^']+)'\)/g)) {
    assert.ok(!/^[a-z]+:\/\//i.test(u), 'the page fetches only its own files: ' + u);
    if (runtime.has(u)) continue;
    assert.ok(existsSync(new URL('../light/' + u.replace(/^\.\.\//, '').replace(/^\.\//, ''), import.meta.url)) || existsSync(new URL('../' + u.replace(/^\.\.\//, ''), import.meta.url)), 'a file the page fetches exists: ' + u);
  }
});

test('the page explains itself: what, start here, try, receipts, how, blueprint, barrier, honest scope, business, adoption, white paper, FAQ', () => {
  for (const id of ['what', 'start', 'try', 'receipts', 'how', 'blueprint', 'barrier', 'scope', 'business', 'adoption', 'paper', 'faq']) {
    assert.match(HTML, new RegExp('<section id="' + id + '"'), id);
    assert.ok(HTML.includes('href="#' + id + '"'), 'the nav reaches #' + id);
  }
  assert.ok((HTML.match(/<svg viewBox/g) || []).length >= 3, 'how it works has its diagrams: the flow, the door traced, the codec');
  const steps = (id) => { const sec = HTML.slice(HTML.indexOf('<section id="' + id + '"')); return (sec.slice(0, sec.indexOf('</section>')).match(/<li>/g) || []).length; };
  assert.ok(steps('start') >= 5 && steps('adoption') >= 8, 'start here and adoption are numbered steps');
  assert.ok(/15×/.test(HTML) && /not 15×|is not 15/.test(HTML), 'the 15× claim is named and its honest verdict given');
  assert.ok(/defense-in-depth/i.test(HTML) && /hard floor/i.test(HTML), 'the honest security scope is stated');
});

test('every id the page script reaches for exists, and the barrier sink is textContent, never innerHTML', () => {
  const ids = new Set([...HTML.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  for (const [, id] of PAGE.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.has(id), 'the script uses #' + id);
  // the SINK — the element that holds decoded attack bytes — must be filled with textContent, never innerHTML
  assert.ok(/shown\.textContent = new TextDecoder/.test(PAGE), 'the barrier sink renders decoded bytes through textContent');
  assert.ok(!/shown\.innerHTML\s*=/.test(PAGE), 'the barrier sink is never filled via innerHTML');
  // data-k keys on the blueprint match what the script fills
  const keys = [...HTML.matchAll(/data-k="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(keys.sort(), ['codec', 'cost', 'judge', 'packet', 'sha256', 'vault']);
  const W = JSON.parse(read('data/witness.json'));
  assert.deepEqual(W.kernels.map((k) => k.name).sort(), keys.sort(), 'the blueprint lists every kernel the witness receipt gates');
  // every in-page link lands on something
  for (const [, id] of HTML.matchAll(/href="#([a-z0-9-]+)"/g)) assert.ok(ids.has(id), 'a link to #' + id + ' has a target');
});

test('the visible FAQ and the FAQPage schema say exactly the same thing', () => {
  const ld = JSON.parse(HTML.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const faq = ld['@graph'].find((g) => g['@type'] === 'FAQPage').mainEntity.map((q) => [q.name, q.acceptedAnswer.text]);
  const block = HTML.slice(HTML.indexOf('<section id="faq"'));
  const shown = [...block.matchAll(/<dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd>/g)].map((m) => [text(m[1]), text(m[2])]);
  assert.equal(faq.length, 6);
  assert.deepEqual(shown, faq);
});

test('the Konomi credit in full, a named supplier, and no price of our own anywhere', () => {
  assert.ok(/powered by the Konomi architecture, created by Thomas Frumkin/i.test(HTML), 'the Konomi credit');
  assert.ok(HTML.includes('AI Native Solutions'), 'a named supplier');
  assert.ok(/MIT, no licence fee|MIT · no licence|no licence fee/i.test(HTML), 'the licence fact');
  for (const re of [/priceCurrency/i, /"@type"\s*:\s*"Offer"/i, /\/mo\b/, /£\d/, /\$\d+\s*(?:a |per |\/)/]) assert.ok(!re.test(HTML), 'no pricing: ' + re);
});

test('both themes define every colour the page uses', () => {
  const style = HTML.match(/<style>([\s\S]*?)<\/style>/)[1];
  const used = new Set([...style.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]));
  const root = style.match(/:root\{([^}]*)\}/)[1], light = style.match(/:root\[data-theme="light"\]\{([^}]*)\}/)[1];
  for (const name of used) {
    if (['--mono', '--sans'].includes(name)) { assert.ok(root.includes(name + ':'), name); continue; }
    assert.ok(root.includes(name + ':'), name + ' in dark');
    assert.ok(light.includes(name + ':'), name + ' in light');
  }
  assert.ok(style.includes('@media (prefers-color-scheme:light)'), 'follows the system theme');
});

// ── every number the page states is the receipts' number ──────────────────────────────────────────────────────────
test('the numbers on the page are the receipts\' numbers, never typed from memory', () => {
  const R = JSON.parse(read('data/light-run.json')), B = JSON.parse(read('data/barrier-run.json')), W = JSON.parse(read('data/witness.json'));
  const C = JSON.parse(read('claims.json')), c = R.facts.codec, m = R.facts.memory, k3 = R.facts.mesh.k3.batch, b = B.facts.barrier;
  const g = (n) => n.toLocaleString('en-GB');
  const one = (x) => String(Math.round(x * 10) / 10);
  const want = [
    one(c.medianRatioJson) + '×', String(c.medianRatioJson) + '×', c.heldFiles + ' held-out', c.smallLightBeatsBrotliGzip + ' of ' + c.smallItems,
    'LIGHT ' + g(c.totalLight) + ' B', 'Brotli 11 ' + g(c.totalBrotli) + ' B', 'gzip −9 ' + g(c.totalGzip) + ' B', g(c.totalIn) + ' B raw',
    'LIGHT ' + c.smallMedianLight + ' B', 'Brotli ' + c.smallMedianBrotli + ' B', 'gzip ' + c.smallMedianGzip + ' B',
    c.mbpsEncode + ' MB/s', c.mbpsDecode + ' MB/s', (Math.round((1 - c.totalLight / c.totalBrotli) * 1000) / 10) + '%',
    'all ' + m.files + ' memory files', g(m.bytes) + ' B to ' + g(m.vaultBytes) + ' B', m.ratio + '×',
    g(k3.json) + ' B as JSON to ' + g(k3.light) + ' B as LIGHT', k3.ratio + '×', g(R.facts.dictBytes) + ' bytes', Math.round(R.facts.dictBytes / 1000) + ' KB',
    'All ' + C.claims.length + ' claims', b.b1.stages.size + ' refused', b.b1.stages.magic + ' refused', b.b3.exact + ' of ' + b.b3.sent,
    b.b2.filter((x) => x.stage === 'signature').length + ' refused', b.b2.filter((x) => x.stage === 'sender').length + ' refused',
    b.corpus + ' sealed test inputs', b.b2.length + ' forgeries', g(W.killed) + ' of ' + g(W.total), (W.total - W.killed) + ' reviewed-equivalent',
  ];
  for (const w of want) assert.ok(HTML.includes(w), 'the page states the receipt\'s number: ' + w);
  for (const k of W.kernels) assert.ok(HTML.includes('data-k="' + k.name + '">' + k.killed + ' / ' + k.total), 'the blueprint shows ' + k.name + "'s gate");
  for (const stale of ['3.5×', '~3.5', 'about 3.5']) assert.ok(!HTML.includes(stale), 'no stale figure: ' + stale);
  assert.ok(/failed its own 0\.5 MB\/s bar/.test(HTML), 'the speed failure (L5) is stated');
  assert.ok(/It failed its 15× target and its 0\.5 MB\/s speed target/.test(HTML), 'the white paper names both failed targets');
});

test('the primary button is legible: the accent fill wins over the plain button style, in both themes', () => {
  const style = HTML.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.match(style, /a\.btn\.go\{background:var\(--accent\);border-color:var\(--accent\);color:var\(--onaccent\)/);
  for (const block of [style.match(/:root\{([^}]*)\}/)[1], style.match(/:root\[data-theme="light"\]\{([^}]*)\}/)[1]]) assert.ok(block.includes('--onaccent:'), 'the text on the accent is set per theme');
});

test('the brochure a buyer needs is on the page: roles, cost case, security, roll-out, ownership, risks, board', () => {
  const sec = HTML.slice(HTML.indexOf('<section id="business"'), HTML.indexOf('<section id="adoption"'));
  for (const role of ['CEO', 'CFO', 'COO', 'CTO / CISO', 'Engineering teams', 'Security, data and compliance teams']) assert.ok(sec.includes('<h4>' + role + '</h4>'), role);
  for (const h of ['The cost case', 'Against what you use now', 'Security and data protection', 'Roll-out', 'Ownership, support, exit', 'Risks, answered straight', 'The case for the board']) assert.ok(sec.includes(h), h);
  assert.ok(sec.includes('href="https://www.ai-nativesolutions.com"') && /agreed per deployment/.test(sec) && /keeps running without us/.test(sec), 'supplier, terms, and that it runs without us');
  assert.ok(/UK GDPR/.test(sec) && /neither anonymisation nor encryption/.test(sec), 'data protection answered straight');
  for (const id of ['cc-stored', 'cc-moved', 'cc-pstore', 'cc-pmove', 'cc-pcpu', 'cc-years', 'cc-comp', 'cc-rows', 'cc-verdict', 'cc-sources']) assert.ok(sec.includes('id="' + id + '"'), id);
  assert.ok(/from '\.\/cost\.mjs'/.test(PAGE) && /lightCase\(basis, m, input\)/.test(PAGE), 'the calculator runs the gated kernel');
  assert.ok(/getJson\('\.\/vendor\/sovereign-enterprise\/data\/basis\.json'\)/.test(PAGE), 'the basis is the vendored one');
  for (const id of ['cc-pstore', 'cc-pmove', 'cc-pcpu']) assert.match(sec, new RegExp('id="' + id + '" type="number" min="0" step="any" value="0"'), id + ' starts at 0: we never guess the reader\'s price');
});

test('how far LIGHT has spread is the estate census\'s number, vendored byte for byte, never the stale "one organ"', async () => {
  const { createHash } = await import('node:crypto');
  const SOURCE = JSON.parse(read('vendor/SOURCE.json'));
  for (const f of SOURCE.files) {
    const bytes = readFileSync(new URL('../' + f.path, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), f.sha256, f.path + ' is byte for byte what SOURCE.json recorded');
  }
  const census = JSON.parse(read('vendor/fall-kit/core/receipts/phase2.json')).facts.local45.census;
  const risks = HTML.slice(HTML.indexOf('<h3>Risks, answered straight</h3>'), HTML.indexOf('<h3>The case for the board</h3>'));
  assert.ok(risks.includes(census.publicSpeaking + ' public repositories speak it in their own code and ' + census.throughKitOnly + ' more carry it only through a copy of the kit'), 'the census v2 numbers');
  assert.ok(risks.includes('light/vendor/fall-kit/core/receipts/phase2.json'), 'and where they come from');
  assert.ok(!/one organ's channel speaks it so far/.test(HTML), 'the stale count is gone');
  assert.ok(!/Every message between organs is a signed packet/.test(HTML), 'the lede claims the design, not that every message already is one');
});
