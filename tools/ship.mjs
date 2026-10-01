#!/usr/bin/env node
// tools/ship.mjs — SHIPPING THE TONGUE (glue). Simon: "ship we will keep improving though 15 is out there we will emerge".
// Two things go into the estate, each measured where it lands, in Claude tokens through the CLI on Simon's login:
//   PACK      the JSON mode (tongue-pack.mjs) on the records the estate's agents really read or keep — the cockpit's
//             queue and estate tools, the brain's journal, ledgers, a receipt, run records. Per place: the text as it is
//             sent or stored today, minified, and packed (legend included). Switched on ONLY where packed is cheaper.
//   TEMPLATES LIGHT's templates called by name: the whole program's tokens against the call's tokens (plus the legend of
//             names, once) — the 15× route on repeated work.
// Plus a read check: does Claude answer the same question from a pack as from today's form?
//   node tools/ship.mjs --seal     write data/ship-prereg.json (refuses to overwrite)
//   node tools/ship.mjs --check    exit 1 unless the committed seal is what this writes
//   node tools/ship.mjs --run      measure (the seal must be committed) → data/ship-run.json
//   node tools/ship.mjs --verify   CI: re-pack every public place, check lossless and the packed sha, re-derive every ratio
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pack, unpack, wins, NOTE } from '../tongue-pack.mjs';
import { ratio } from '../tongue.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const stable = (o) => JSON.stringify(o, null, 1) + '\n';
const has = (f) => process.argv.includes(f);
const HOME = 'C:/Users/sjgan';
// LIGHT's templates, vendored from the estate's fork (Thomas Frumkin's, used with permission) so CI can read them too
export const LIGHT = ROOT + '/vendor/light';
export const QUERIES = ['kar', 'fall', 'organ', 'konomi'];
// every place, fixed before any count: [id, kind, where, public]
export const PLACES = [
  ['queue', 'cockpit tool', 'kar-mcp queue (the build queue)', false],
  ...QUERIES.map((q) => ['estate-' + q, 'cockpit tool', 'kar-mcp estate, "' + q + '", k 60', false]),
  ['journal', 'brain', '~/.si-didy/brain/mind-journal.json', false],
  ['lessons-ledger', 'ledger', 'si-didy-loop local-dna/lessons-ledger.json', false],
  ['scorecard-receipt', 'receipt', 'fallforgemint proof node commit-type/scorecard-receipt.json', false],
  ['estate-ledger', 'ledger', 'fallkard/estate-ledger.json', true],
  ['herd-ledger', 'ledger', 'fallkard/herd-ledger.json', true],
  ['run-pattern-organs', 'run record', 'pattern-organs/data/run.json', true],
  ['run-kard-evolve', 'run record', 'kard-evolve/data/run.json', true],
  ['run-konomi-tongue', 'run record', 'konomi-tongue/data/run.json', true],
];
const FILES = {
  journal: HOME + '/.si-didy/brain/mind-journal.json', 'lessons-ledger': HOME + '/Downloads/si-didy-loop/local-dna/lessons-ledger.json',
  'scorecard-receipt': HOME + '/Downloads/fallforgemint-proof-nodes/commit-type/scorecard-receipt.json', 'estate-ledger': HOME + '/Downloads/fallkard/estate-ledger.json',
  'herd-ledger': HOME + '/Downloads/fallkard/herd-ledger.json', 'run-pattern-organs': HOME + '/Downloads/pattern-organs/data/run.json',
  'run-kard-evolve': HOME + '/Downloads/kard-evolve/data/run.json', 'run-konomi-tongue': ROOT + '/data/run.json',
};

// the text of a place as it is sent (the cockpit pretty-prints with indent 1) or stored today, and its value
export async function placeOf(id) {
  if (FILES[id]) { const today = readFileSync(FILES[id], 'utf8'); return { today, value: JSON.parse(today) }; }
  const K = await import('file:///C:/Users/sjgan/si-didy/kar-mcp.mjs');
  const out = id === 'queue' ? await K.IMPL.queue() : await K.IMPL.estate({ q: id.slice('estate-'.length), k: 60 });
  return { today: JSON.stringify(out, null, 1), value: out };
}
export const alphabet = () => JSON.parse(readFileSync(join(ROOT, 'data/run.json'), 'utf8')).picture.alphabet;

// LIGHT's templates, each called with every placeholder set to 3
export function templates() {
  const T = createRequire(import.meta.url)(LIGHT + '/templates.cjs');
  return T.list().map((name) => {
    const params = Object.fromEntries([...new Set([...(T.resolve(name, {}) || '').matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))].map((p) => [p, 3]));
    return { name, params, program: T.resolve(name, params), call: JSON.stringify({ tool: 'template', name, params }) };
  });
}

export function prereg() {
  return {
    kind: 'konomi-tongue-ship-prereg', v: 1, written: '2026-10-01',
    approvedBy: 'Simon, relayed verbatim: "ship we will keep improving though 15 is out there we will emerge"',
    statement: 'Sealed and pushed before any place is counted. Pack is switched on only where it measures cheaper than today.',
    sealed: { 'tongue-pack.mjs': sha(readFileSync(join(ROOT, 'tongue-pack.mjs'), 'utf8')), 'tools/ship.mjs': sha(readFileSync(join(ROOT, 'tools/ship.mjs'), 'utf8')), 'vendor/light/templates.cjs': sha(readFileSync(LIGHT + '/templates.cjs', 'utf8')) },
    places: PLACES.map(([id, kind, where, pub]) => ({ id, kind, where, public: pub })),
    method: 'Claude tokens (claude-sonnet-5-5, the official CLI on Simon\'s login) of today\'s text, the minified JSON and the pack (legend included); pack uses the tongue\'s alphabet (one-token glyphs first), only glyphs absent from the value',
    switch: 'a cockpit tool returns packs only if its pack is cheaper than today\'s text on every measured call of that tool; files are reported, and switched only where a model reads them',
    templates: 'each of LIGHT\'s templates with every placeholder set to 3: tokens of the resolved program ÷ tokens of the call {"tool":"template","name","params"}; the legend of names and parameters counted once',
    readCheck: 'for the queue and one estate search, Claude answers one question with a fixed answer from today\'s text and from the pack (with the one-line note); graded by exact set match',
    rules: [
      { id: 'pack-lossless', rule: 'every place unpacks to exactly its value' },
      { id: 'pack-wins-on-records', rule: 'the pack is cheaper than today at every cockpit tool and every run record' },
      { id: 'claude-reads-packs', rule: 'Claude answers both read-check questions exactly from the pack' },
      { id: 'templates-some-15x', rule: 'at least one LIGHT template is 15× cheaper to call by name than to send' },
      { id: 'templates-median-15x', rule: 'the median template is 15× cheaper to call by name' },
    ],
    predictions: {
      said: 'before any place was counted, by Kar',
      'pack-lossless': 'pass',
      'pack-wins-on-records': 'pass — today\'s text is pretty-printed with every key repeated; the estate rows and run records repeat their shapes',
      'claude-reads-packs': 'pass — a pack is a header and rows',
      'templates-some-15x': 'pass — translate is 98 lines',
      'templates-median-15x': 'fail — most templates are 5–15 lines; about 4–8×',
    },
  };
}

export function grade(pre, run) {
  const rows = run.places, cockpit = rows.filter((p) => p.kind === 'cockpit tool' || p.kind === 'run record');
  const t = [...run.templates.map((x) => x.ratio)].sort((a, b) => a - b), med = t[Math.floor(t.length / 2)];
  const rules = [
    { id: 'pack-lossless', value: rows.filter((p) => p.lossless).length + ' of ' + rows.length + ' places', pass: rows.every((p) => p.lossless) },
    { id: 'pack-wins-on-records', value: cockpit.filter((p) => p.wins).length + ' of ' + cockpit.length + ' cockpit calls and run records cheaper packed', pass: cockpit.every((p) => p.wins) },
    { id: 'claude-reads-packs', value: run.readCheck.filter((r) => r.packedExact).length + ' of ' + run.readCheck.length + ' exact from the pack (' + run.readCheck.filter((r) => r.todayExact).length + ' from today\'s text)', pass: run.readCheck.every((r) => r.packedExact) },
    { id: 'templates-some-15x', value: 'best ' + t[t.length - 1] + '× (' + run.templates.find((x) => x.ratio === t[t.length - 1]).name + ')', pass: t[t.length - 1] >= 15 },
    { id: 'templates-median-15x', value: 'median ' + med + '× over ' + t.length + ' templates', pass: med >= 15 },
  ];
  return { rules, passed: rules.filter((r) => r.pass).length, of: rules.length, median: med };
}

// the read check: a question with a fixed answer, from the value
export function readQuestions(queue, estate) {
  return [
    { place: 'queue', ask: 'From the tool output below, list the id of every item whose status is open, one per line, nothing else.', answer: queue.filter((x) => (x.status || 'open') === 'open').map((x) => String(x.id)) },
    { place: 'estate-kar', ask: 'From the tool output below, list the name of every row whose live address is not null, one per line, nothing else.', answer: estate.rows.filter((r) => r.live).map((r) => r.name) },
  ];
}
const sameSet = (reply, answer) => { const got = String(reply).trim().split('\n').map((s) => s.trim()).filter(Boolean); return got.length === answer.length && answer.every((a) => got.includes(a)); };

async function run() {
  const sealedIn = execFileSync('git', ['log', '-1', '--format=%H', '--', 'data/ship-prereg.json'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (!sealedIn) throw new Error('commit and push the seal first');
  const { claudeCounter } = await import('file:///C:/Users/sjgan/kar-mind/tools/claude-count.mjs');
  const { ask } = await import('./cli.mjs');
  const c = await claudeCounter();
  const tok = async (t) => (await c.count(t)) + 1;
  const A = alphabet();
  mkdirSync(join(ROOT, 'data/ship'), { recursive: true });
  const places = [];
  for (const [id, kind, where, pub] of PLACES) {
    const { today, value } = await placeOf(id);
    const min = JSON.stringify(value), p = pack(value, A);
    const back = unpack(p.text);
    const lossless = back.ok && JSON.stringify(back.value) === min;
    const [tt, tm, tp] = [await tok(today), await tok(min), await tok(p.text)];
    if (pub) writeFileSync(join(ROOT, 'data/ship', id + '.json'), today);
    places.push({ id, kind, where, public: pub, todayTokens: tt, minifiedTokens: tm, packedTokens: tp, entries: p.entries, lossless, wins: wins(tt, tp),
      ratio: ratio(tt, tp), ...(pub ? { packedSha256: sha(p.text) } : {}) });
    process.stderr.write('  ' + id + ': today ' + tt + ' · minified ' + tm + ' · packed ' + tp + '\n');
  }
  const T = templates();
  const legend = T.map((x) => x.name + '(' + Object.keys(x.params).join(',') + ')').join('\n');
  const legendTokens = await tok(legend);
  const tmpl = [];
  for (const x of T) { const p = await tok(x.program), k = await tok(x.call); tmpl.push({ name: x.name, programTokens: p, callTokens: k, ratio: ratio(p, k), lines: x.program.split('\n').length }); }
  const queue = (await placeOf('queue')).value, estate = (await placeOf('estate-kar')).value;
  const readCheck = [];
  for (const q of readQuestions(queue, estate)) {
    const v = q.place === 'queue' ? queue : estate;
    const a1 = await ask({ text: q.ask + '\n\n' + JSON.stringify(v, null, 1), system: 'You answer exactly from the tool output given.' });
    const a2 = await ask({ text: q.ask + '\n\n' + NOTE + '\n\n' + pack(v, A).text, system: 'You answer exactly from the tool output given.' });
    readCheck.push({ place: q.place, todayExact: sameSet(a1.reply, q.answer), packedExact: sameSet(a2.reply, q.answer), todayInput: a1.input, packedInput: a2.input });
  }
  writeFileSync(join(ROOT, 'data/ship-run.json'), stable({ kind: 'konomi-tongue-ship-run', v: 1, sealedIn, model: c.base.model, places, templates: tmpl, templateLegendTokens: legendTokens, readCheck,
    switchedOn: [...new Set(places.filter((p) => p.kind === 'cockpit tool').map((p) => p.id.split('-')[0]))].filter((tool) => places.filter((p) => p.kind === 'cockpit tool' && p.id.split('-')[0] === tool).every((p) => p.wins)) }));
  console.log('measured ' + places.length + ' places and ' + tmpl.length + ' templates');
}

async function verify() {
  const run = JSON.parse(readFileSync(join(ROOT, 'data/ship-run.json'), 'utf8'));
  const A = alphabet(), bad = [];
  for (const p of run.places) {
    if (p.ratio !== ratio(p.todayTokens, p.packedTokens) || p.wins !== wins(p.todayTokens, p.packedTokens)) bad.push('ratio ' + p.id);
    const copy = join(ROOT, 'data/ship', p.id + '.json');
    if (p.public && !existsSync(copy)) bad.push('missing ' + p.id);
    if (p.public && existsSync(copy)) {
      const v = JSON.parse(readFileSync(copy, 'utf8')), pk = pack(v, A), back = unpack(pk.text);
      if (sha(pk.text) !== p.packedSha256) bad.push('packed ' + p.id);
      if (!(back.ok && JSON.stringify(back.value) === JSON.stringify(v))) bad.push('lossless ' + p.id);
    }
  }
  for (const t of run.templates) if (t.ratio !== ratio(t.programTokens, t.callTokens)) bad.push('template ' + t.name);
  console.log(bad.length ? 'DIFFERS — ' + bad.join('; ') : 'VERIFIED — every public place re-packed and unpacked, every ratio re-derived');
  process.exitCode = bad.length ? 1 : 0;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/ship.mjs')) {
  const OUT = join(ROOT, 'data/ship-prereg.json');
  if (has('--check')) { const same = existsSync(OUT) && readFileSync(OUT, 'utf8') === stable(prereg()); console.log(same ? 'the ship seal matches its inputs' : 'data/ship-prereg.json differs'); process.exitCode = same ? 0 : 1; }
  else if (has('--seal')) { if (existsSync(OUT)) { console.error('sealed already'); process.exitCode = 1; } else { writeFileSync(OUT, stable(prereg())); console.log('sealed data/ship-prereg.json'); } }
  else if (has('--run')) await run();
  else if (has('--verify')) await verify();
}
