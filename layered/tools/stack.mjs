// layered/tools/stack.mjs — STACKED LIGHT levels 2-3, measured as sealed in layered/STACKED-CLAIMS.md (glue, local).
// The pattern library is the estate's own, a private organ: its module paths are read from
// layered/data/private.local.json (git-ignored), so no private name is in this public file. Its gate, answer, mine,
// parseProposals, makeCase, split and fnv are imported unchanged; the 7B is reached through the same organ's wire.
//
//   stackRun({ at, say }) → { counts, s1, s3, s4, s5, rules }   (rules: only those that pass the private-name filter)
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { frameOf, readFrame, settle, stackOf, resolve, ruleText } from '../src/settle.mjs';
import { encode } from '../src/fold.mjs';

const HERE = new URL('.', import.meta.url), te = new TextEncoder(), td = new TextDecoder();
export const MAX_7B = 12, MINE_K = 3;

function cfg() {
  const p = new URL('../data/private.local.json', HERE);
  if (!existsSync(p)) throw new Error('layered/data/private.local.json is missing: it names where the pattern library lives on this laptop');
  return JSON.parse(readFileSync(p, 'utf8'));
}
const line = (c) => c.tokens.slice(0, 14).join(' ');
// the night loop's prompt shape: one family's repositories against the others', rules in the library's two forms
function promptFor(L, label, train) {
  const order = (a, b) => L.fnv(a.id + ':0') - L.fnv(b.id + ':0');
  const mine = train.filter((c) => c.label === label && c.tokens.length).sort(order).slice(0, 20);
  const rest = train.filter((c) => c.label !== label && c.tokens.length).sort(order).slice(0, 20);
  return `You write classification rules for a list of software repositories. Each line below is one repository's words.\n\nRepositories in the family "${label}":\n${mine.map(line).join('\n')}\n\nRepositories in OTHER families:\n${rest.map(line).join('\n')}\n\nWrite up to 5 rules that pick out "${label}" repositories and not the others. One rule per line, exactly in one of these two forms and nothing else:\nWHEN word THEN ${label}\nWHEN word AND word THEN ${label}\nUse only words that appear in the "${label}" lines above.`;
}

export async function stackRun({ at, say, privateNames, dry }) {
  const log = typeof say === 'function' ? say : () => {};
  const c = cfg(), L = await import('file:///' + c.patlib.replace(/\\/g, '/'));
  const idx = JSON.parse(readFileSync(c.index, 'utf8')), feed = JSON.parse(readFileSync(c.feed, 'utf8'));
  const byName = new Map(idx.nodes.map((n) => [n.name, n]));
  // the cases: every repository in the feed that is public in the estate index
  const cases = [];
  let skippedPrivate = 0;
  for (const r of feed.repos) {
    const n = byName.get(r.n);
    if (!n || n.private === true) { skippedPrivate++; continue; }
    const k = L.makeCase({ id: r.n, text: [r.n.replace(/[-_.]/g, ' '), n.desc || '', (Array.isArray(n.topics) ? n.topics : []).join(' ')].join(' '), label: r.fam });
    if (k) cases.push(k);
  }
  const sl = L.split(cases), finalA = sl.final.filter((k) => L.fnv(k.id + '#B') % 2 === 0), finalB = sl.final.filter((k) => L.fnv(k.id + '#B') % 2 === 1);
  const slices = { train: sl.train, held: sl.held, final: finalA };
  // the slice measured: FINAL-B, which nothing above sees (a dry run measures on FINAL-A instead and reads no FINAL-B case)
  const measured = dry ? finalA : finalB;
  const labels = [...new Set(cases.map((k) => k.label))].sort();
  const base = L.majority(sl.train), count = (l) => sl.train.filter((k) => k.label === l).length;
  log('stack: ' + cases.length + ' public cases (train ' + sl.train.length + ', held ' + sl.held.length + ', final-A ' + finalA.length + ', final-B ' + finalB.length + '), ' + labels.length + ' families');
  // the proposers
  const prov = (source, model) => ({ source, model, proposedAt: at, feed: 'estate-map', trainN: sl.train.length });
  const proposals = [];
  const lib = existsSync(c.library) ? JSON.parse(readFileSync(c.library, 'utf8')) : { rules: [] };
  for (const r of lib.rules || []) proposals.push({ when: r.when, then: r.then, prov: { ...r.prov, source: 'library' } });
  const targets = labels.filter((l) => l !== base && count(l) >= 5).sort((a, b) => count(a) - count(b) || (a < b ? -1 : 1));
  let calls7b = 0, model = null, why7b = '';
  try {
    const W = await import('file:///' + c.wire.replace(/\\/g, '/'));
    const chosen = dry ? { ok: false, why: 'a dry run calls no model' } : await W.pickModel(['qwen2.5:7b']);
    if (chosen.ok && chosen.model === 'qwen2.5:7b') model = chosen.model; else why7b = 'the 7B did not fit: ' + String(chosen.why || '').slice(0, 120);
    for (const label of targets) {
      if (!model || calls7b >= MAX_7B) break;
      calls7b++;
      let text = '';
      try { text = await W.generate(model, promptFor(L, label, sl.train), { numPredict: 160, seed: 7 }); } catch (e) { why7b = String((e && e.message) || e).slice(0, 120); }
      for (const r of L.parseProposals(text, labels)) proposals.push({ ...r, prov: prov('7b', model) });
      log('stack: 7B call ' + calls7b + ' (' + label + ')');
    }
    if (model) await W.unload(model);
  } catch (e) { why7b = 'the 7B could not be reached: ' + String((e && e.message) || e).slice(0, 120); }
  for (const label of targets) for (const r of L.mine(sl.train, label, MINE_K)) proposals.push({ ...r, prov: prov('mined', 'none') });
  // the gate decides, one proposal at a time, against the stack so far
  const stack = [], dropped = [], proposed = {};
  for (const p of proposals) {
    proposed[p.prov.source] = (proposed[p.prov.source] || 0) + 1;
    const g = L.gate(p, slices, stack);
    if (g.ok) stack.push({ when: p.when, then: p.then, receipt: g.receipt, source: p.prov.source, scores: g.scores });
    else dropped.push({ rule: L.ruleKey(p), source: p.prov.source, why: g.why });
  }
  log('stack: ' + proposals.length + ' proposed, ' + stack.length + ' kept, ' + dropped.length + ' dropped');
  // level 2: each rule as one frame — data (its exact bytes) and code (settled, its decision)
  const frames = stack.map((r) => frameOf(r).bytes);
  let identical = 0, settled = 0, agree = 0;
  const first = [], second = [];
  for (let i = 0; i < stack.length; i++) {
    const d = readFrame(frames[i]);
    if (d.ok && ruleText(d.rule) === ruleText(stack[i])) identical++;
    for (const k of measured) {
      const a = settle(frames[i], k.tokens).answer, want = L.answer([stack[i]], k).answer;
      settled++; if (a === want) agree++;
      first.push(a);
    }
  }
  for (let i = 0; i < stack.length; i++) for (const k of measured) second.push(settle(frames[i], k.tokens).answer);
  let nonRuleLabels = 0;
  for (const k of measured) { const f = encode(te.encode(line(k)), { mask: 15, bits: 18 }).bytes; if (settle(f, k.tokens).answer !== 'unknown') nonRuleLabels++; }
  const s1 = { rules: stack.length, identical, settled, agree, twice: JSON.stringify(first) === JSON.stringify(second), nonRuleLabels, nonRuleTried: measured.length,
    frameBytes: frames.reduce((a, f) => a + f.length, 0), ruleBytes: stack.reduce((a, r) => a + te.encode(ruleText(r)).length, 0) };
  // level 3: the node settles its stack with every way out of it recorded
  const node = stackOf(frames).node, real = globalThis.fetch;
  let fetchCalls = 0, resolved = 0, sameAsLibrary = 0;
  globalThis.fetch = () => { fetchCalls++; throw new Error('no model in the hot path'); };
  try {
    for (const k of measured) {
      const r = resolve(node, k.tokens);
      if (r && typeof r.answer === 'string') resolved++;
      if (r.answer === L.answer(stack, k).answer) sameAsLibrary++;
    }
  } finally { globalThis.fetch = real; }
  const s3 = { cases: measured.length, resolved, fetchCalls, sameAsLibrary };
  // capability = stack depth, on the slice nothing above has seen
  const byDepth = [];
  for (let d = 0; d <= stack.length; d++) {
    const nd = stackOf(frames.slice(0, d)).node;
    let answered = 0, right = 0;
    for (const k of measured) { const r = resolve(nd, k.tokens); if (r.answer !== 'unknown') { answered++; if (r.answer === k.label) right++; } }
    byDepth.push({ depth: d, answered, right });
  }
  const s5 = { proposed, dropped: dropped.length, stack: stack.length, receipts: stack.filter((r) => /^[0-9a-f]{8}$/.test(r.receipt)).length,
    unreceipted: stack.filter((r) => !/^[0-9a-f]{8}$/.test(r.receipt)).length, calls7b, model7b: model, why7b: why7b || null,
    droppedWhy: dropped.reduce((m, x) => { const k = x.why.split(':')[0]; m[k] = (m[k] || 0) + 1; return m; }, {}) };
  const priv = privateNames || [];
  const safe = (r) => ![...r.when, r.then].some((t) => priv.includes(t));
  const rules = stack.filter(safe).map((r) => ({ when: r.when, then: r.then, receipt: r.receipt, source: r.source,
    held: { cover: r.scores.held.cover, right: r.scores.held.right }, finalA: { cover: r.scores.final.cover, right: r.scores.final.right } }));
  // the library as it stands (its own nightly gate admitted these on its whole final slice): shown on the page beside
  // the measured stack, never counted in S1-S5
  const libraryRules = (lib.rules || []).filter((r) => Array.isArray(r.when) && typeof r.then === 'string' && /^[0-9a-f]{8}$/.test(r.receipt) && safe(r)).map((r) => ({ when: r.when, then: r.then, receipt: r.receipt }));
  return { libraryRules, counts: { cases: cases.length, skippedPrivate, train: sl.train.length, held: sl.held.length, finalA: finalA.length, finalB: finalB.length, measuredSlice: dry ? 'final-A (dry)' : 'final-B', families: labels.length, baseline: base },
    s1, s3, s4: { byDepth }, s5, rules, rulesWithheld: stack.length - rules.length };
}
