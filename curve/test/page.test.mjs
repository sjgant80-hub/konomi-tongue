// The curve's page and public files, held to curve/CLAIMS.md: K9 (the public file holds only fixed labels, dates, hashes
// and counts), K11 (no measured number typed into the page), the merge table is the one read from the model file, the
// record is internally consistent, the page explains itself, talks only to itself, and carries its credits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import C from '../src/curve.mjs';

const ROOT = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const html = read('curve/index.html'), page = read('curve/page.mjs');
const rec = JSON.parse(read('curve/data/curve.json'));

test('K9: every string in the public file is a fixed label, a date, a hash, a claim id or a count', () => {
  assert.deepEqual(C.strayStrings(rec, C.fixedStrings()), []);
  for (const p of rec.points) assert.match(p.snapshot, /^[0-9a-f]{64}$/);
});
test('the record is consistent: every ratio is its own counts, every window complete, the verdicts re-derive', () => {
  assert.ok(rec.points.length >= 1);
  const ws = C.windows(C.START, C.DAYS, rec.points.at(-1).window.end);
  rec.points.forEach((p, i) => {
    assert.deepEqual(p.window, ws[i], 'point ' + i + ' is the ' + i + 'th complete week');
    assert.equal(p.A.ratio, C.ratio(p.held.tokens, p.A.tokens));
    assert.equal(p.B.ratio, C.ratio(p.held.tokens, p.B.tokens));
    assert.equal(p.C.ratio, C.ratio(p.held.bytes, p.C.bytes));
    assert.equal(p.gzip.ratio, C.ratio(p.held.bytes, p.gzip.bytes));
    assert.equal(p.split.inside, true);
    assert.equal(p.split.heldCount, p.held.messages);
  });
  assert.deepEqual(rec.verdicts, C.verdicts(rec.points));
  assert.deepEqual(rec.anchors, C.ANCHORS.map((a) => ({ ...a })));
  assert.deepEqual([rec.start, rec.days], [C.START, C.DAYS]);
});
test('the merge table is the one read from the model file, and the record names it', () => {
  const src = JSON.parse(read('curve/data/qwen2.5-source.json')), h = sha(read('curve/data/qwen2.5-merges.txt'));
  assert.equal(h, src.mergesSha256);
  assert.equal(rec.tokenizer.mergesSha256, h);
  assert.deepEqual([src.tokenizer.model, src.tokenizer.pre, src.tokenizer.merges, src.license], ['gpt2', 'qwen2', 151387, 'apache-2.0']);
  assert.match(read('curve/data/QWEN-LICENSE'), /Apache License\s+Version 2\.0/);
  const v = JSON.parse(read('curve/data/tokverify.json'));
  assert.deepEqual(rec.tokenizer.verify, { equal: v.equal, of: v.of });
});
test('K11: no measured number is typed into the page', () => {
  const visible = html.replace(/<style>[\s\S]*?<\/style>/, '').replace(/style="[^"]*"/g, '');
  const forms = new Set();
  for (const p of rec.points) for (const r of [p.A.ratio, p.B.ratio, p.C.ratio, p.gzip.ratio]) if (r !== 1) { forms.add(r.toFixed(2) + '×'); forms.add(String(r) + '×'); }
  for (const p of rec.points) if (p.held.messages > 9) forms.add(p.held.messages.toLocaleString('en-GB') + ' messages');
  for (const s of forms) assert.equal(visible.includes(s), false, 'the page has "' + s + '" typed in; it must come from the record');
  assert.match(page, /\$\('f-best'\)\.textContent = x\(better\(last\)\)/);
});
test('the page explains itself, keeps failures, talks only to itself, and carries its credits', () => {
  for (const id of ['what', 'start', 'curve', 'try', 'receipts', 'how', 'blueprint', 'scope', 'business', 'adoption', 'paper', 'faq']) assert.match(html, new RegExp('<section id="' + id + '"'), id);
  assert.match(html, /connect-src 'self'/);
  assert.match(html, /Powered by the Konomi architecture, created by Thomas Frumkin/);
  assert.match(html, /Qwen2\.5 \(Apache-2\.0, the Qwen team\)/);
  assert.match(html, /A claim that misses its bar is kept and shown as failed\./);
  assert.match(page, /v\.pass \? 'HELD' : 'FAILED'/);
  assert.equal(/£\s?\d|\$\s?\d|per seat|\/mo\b/i.test(html), false, 'no price of ours on the page');
  for (const imp of page.matchAll(/^import .* from '([^']+)';$/gm)) assert.match(imp[1], /^\.\.?\//, 'same-origin module: ' + imp[1]);
  for (const f of ['curve/CLAIMS.md', 'curve/SEAL2.md', 'curve/data/QWEN-LICENSE', 'light/vendor/sovereign-enterprise/data/basis.json', 'tongue-cost.mjs']) assert.ok(existsSync(new URL(f, ROOT)), f);
});
