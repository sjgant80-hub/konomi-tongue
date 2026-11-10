// layered/test/page.test.mjs — the page and its public record: L6 (no measured number typed into the page: every ratio
// is read from the record), the record's verdicts follow from its numbers, the record holds no private text (G3), the
// page explains itself, carries the credit, blocks outside connections and names no price. The private-name check runs
// where the estate index is (this laptop); CI runs the rest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { verdicts } from '../src/verdict.mjs';

const HERE = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, HERE), 'utf8');
const html = read('index.html'), page = read('page.mjs');
const recPath = new URL('data/record.json', HERE), REC = existsSync(recPath) ? JSON.parse(readFileSync(recPath, 'utf8')) : null;

test('L6: the only ratios typed into the page are the sealed bar, the spec\'s claim and the glossary example', () => {
  const typed = [...html.replace(/<style>[\s\S]*?<\/style>/, '').matchAll(/(\d+(?:\.\d+)?)×/g)].map((m) => m[1] + '×');
  assert.deepEqual([...new Set(typed)].sort(), ['15×', '4×', '75×']);
  assert.equal(/\d+\.\d+×/.test(html), false, 'no decimal ratio is typed');
});

test('the record: its verdicts follow from its numbers, and no measured total is typed into the page', { skip: !REC && 'no record yet' }, () => {
  assert.equal(REC.kind, 'konomi-tongue.layered.record'); assert.equal(REC.v, 1); assert.equal(REC.dry, false);
  assert.deepEqual(verdicts(REC), REC.verdicts);
  assert.deepEqual(REC.types.map((t) => t.key), ['agent', 'memory', 'callbook', 'records', 'prose']);
  for (const s of REC.sealed) assert.match(s.commit, /^[0-9a-f]{40}$/);
  const body = html.replace(/<style>[\s\S]*?<\/style>/, '');
  for (const t of REC.types) for (const n of [t.raw, t.items > 99 ? t.items : null, t.ladder['31'].frame, t.ladder['1'].frame, t.baselines.zstd19].filter((v) => v !== null)) {
    assert.equal(new RegExp('(^|[^0-9])' + n + '([^0-9]|$)').test(body), false, t.key + ': ' + n + ' is typed into the page');
  }
});

test('G3: the record holds fixed labels, dates, hashes, counts, verdict text and published rules only', { skip: !REC && 'no record yet' }, () => {
  const strings = [];
  const walk = (o, path) => {
    if (typeof o === 'string') strings.push([path, o]);
    else if (Array.isArray(o)) o.forEach((v, i) => walk(v, path + '[' + i + ']'));
    else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, path + '.' + k);
  };
  walk(REC, '');
  const ok = [/^[LS][0-9]{1,2}$/, /^[0-9a-f]{8,64}$/, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/, /^v\d+\.\d+\.\d+$/, /^[a-z0-9][a-z0-9.:-]*$/, /^T[1-5]$/];
  const labels = new Set(['agent logs', 'memory journal', 'call book', 'structured records', 'prose', 'private', 'public', 'konomi-tongue.layered.record', 'final-B', 'final-A (dry)',
    'layered/CLAIMS.md', 'layered/STACKED-CLAIMS.md', 'layered/SEAL2.md']);
  const verdictText = new Set(REC.verdicts.map((v) => v.measured));
  for (const [p, s] of strings) {
    if (labels.has(s) || verdictText.has(s) || ok.some((r) => r.test(s))) continue;
    if (/^\.stacked\.s5\.(why7b|droppedWhy)/.test(p) && /^[A-Za-z0-9 :,.'()\-]+$/.test(s)) continue;
    if (/^\.stacked\.(rules|libraryRules)\[\d+\]\.(when\[\d\]|then|source|receipt)$/.test(p)) continue;
    assert.fail('an unexpected string in the record at ' + p + ': ' + s.slice(0, 60));
  }
});

test('the page explains itself, is sellable, and is safe', () => {
  for (const id of ['words', 'start', 'ladder', 'multiply', 'seed', 'try', 'stacked', 'receipts', 'how', 'blueprint', 'scope', 'business', 'adoption', 'paper', 'faq']) assert.ok(html.includes('id="' + id + '"'), 'section ' + id);
  assert.ok(html.includes('Powered by the Konomi architecture, created by Thomas Frumkin'));
  assert.ok(html.includes('https://www.ai-nativesolutions.com'));
  assert.match(html, /Content-Security-Policy" content="default-src 'self'; script-src 'self';[^"]*connect-src 'self'/);
  assert.equal(/[$£€]\s?\d|per seat|\/month|per month/i.test(html.replace(/<style>[\s\S]*?<\/style>/, '')), false, 'no price on the page');
  for (const w of ['CEO', 'CFO', 'COO', 'CTO / CISO', 'Risks, answered straight', 'The case for the board']) assert.ok(html.includes(w), w);
  const imports = [...page.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['./src/fold.mjs', './src/settle.mjs', './src/verdict.mjs']);
  for (const m of page.matchAll(/fetch\('([^']+)'/g)) assert.match(m[1], /^(data\/|\.\.\/light\/data\/)/, 'the page fetches only its own files');
  for (const m of page.matchAll(/\$\('([a-z0-9-]+)'\)/g)) assert.ok(html.includes('id="' + m[1] + '"'), 'page.mjs fills #' + m[1] + ', which exists');
});

const INDEX = 'C:/Users/sjgan/.claude/projects/C--Users-sjgan--claude/memory/estate-index.json';
test('no private repository is named anywhere this build publishes', { skip: !existsSync(INDEX) && 'the estate index lives on the laptop' }, () => {
  const priv = JSON.parse(readFileSync(INDEX, 'utf8')).nodes.filter((n) => n.private === true).map((n) => n.name.toLowerCase());
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = d + '/' + f; if (statSync(p).isDirectory()) walk(p); else if (!f.endsWith('.local.json')) files.push(p); } };
  walk(new URL('.', HERE).pathname.replace(/^\/([A-Z]:)/, '$1'));
  const hit = (text) => { const low = text.toLowerCase(); return priv.filter((n) => { let at = low.indexOf(n); while (at !== -1) { const b = at === 0 ? '' : low[at - 1], a = low[at + n.length] || ''; if (!/[a-z0-9-]/.test(b) && !/[a-z0-9-]/.test(a) && b !== '.') return true; at = low.indexOf(n, at + 1); } return false; }); };
  for (const f of files) {
    const text = f.endsWith('.gz') ? gunzipSync(readFileSync(f)).toString('utf8') : readFileSync(f, 'utf8');
    const decoded = f.endsWith('.gz') ? JSON.parse(text).held.concat(JSON.parse(text).context).map((x) => Buffer.from(x.b64, 'base64').toString('utf8')).join('\n') : text;
    assert.deepEqual(hit(decoded), [], f + ' names a private repository');
  }
});
