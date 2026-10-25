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
  assert.ok(!/\son[a-z]+="/i.test(HTML.replace(/onclick="document\.getElementById\('[a-z]+'\)\.scrollIntoView\(\)"/g, '')), 'no inline handlers beyond the scroll buttons');
  for (const [, u] of HTML.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)) {
    if (/rel="canonical"/.test(HTML.slice(HTML.indexOf('"' + u + '"') - 60, HTML.indexOf('"' + u + '"')))) continue;
    assert.ok(!/^[a-z]+:|^\/\//i.test(u), 'no third-party script/style: ' + u);
  }
  // these are written by the measurement / witness at runtime; the page handles them missing with try/catch
  const runtime = new Set(['./data/light-run.json', './data/witness.json']);
  for (const [, u] of PAGE.matchAll(/fetch\('([^']+)'\)/g)) {
    assert.ok(!/^[a-z]+:\/\//i.test(u), 'the page fetches only its own files: ' + u);
    if (runtime.has(u)) continue;
    assert.ok(existsSync(new URL('../light/' + u.replace(/^\.\.\//, '').replace(/^\.\//, ''), import.meta.url)) || existsSync(new URL('../' + u.replace(/^\.\.\//, ''), import.meta.url)), 'a file the page fetches exists: ' + u);
  }
});

test('the page explains itself: what, start here, try, receipts, how, blueprint, barrier, honest scope, FAQ', () => {
  for (const id of ['what', 'start', 'try', 'receipts', 'how', 'blueprint', 'barrier', 'scope', 'faq']) assert.match(HTML, new RegExp('<section id="' + id + '"'), id);
  assert.ok(HTML.includes('<svg viewBox'), 'a how-it-works diagram');
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
  assert.deepEqual(keys.sort(), ['codec', 'packet', 'sha256', 'vault']);
});

test('the visible FAQ and the FAQPage schema say exactly the same thing', () => {
  const ld = JSON.parse(HTML.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const faq = ld['@graph'].find((g) => g['@type'] === 'FAQPage').mainEntity.map((q) => [q.name, q.acceptedAnswer.text]);
  const block = HTML.slice(HTML.indexOf('<section id="faq"'));
  const shown = [...block.matchAll(/<dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd>/g)].map((m) => [text(m[1]), text(m[2])]);
  assert.equal(faq.length, 5);
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
