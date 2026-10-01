#!/usr/bin/env node
// tools/seal.mjs — writes data/prereg.json, the Konomi Tongue's pre-registration: the sha256 of the kernel, the runner,
// the renderer, the glyph prices, the JSON corpus and the private agent corpus; the configuration, the prompts, eleven
// rules and a prediction. Committed and pushed BEFORE any held-out message is coded or any picture is read.
//   node tools/seal.mjs            write it (refuses to overwrite)
//   node tools/seal.mjs --check    exit 1 unless the committed file is exactly what this writes
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { CONFIG, PROMPTS } from './run.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const OUT = join(ROOT, 'data', 'prereg.json');
const text = (f) => readFileSync(join(ROOT, f), 'utf8');
const sha = (s) => createHash('sha256').update(s).digest('hex');
// the private corpus is pinned by the sha256 recorded at gathering (tools/corpus.mjs prints it); CI cannot read it
export const CORPUS = { sha256: '3479711e1ab1c6a5be4d116e751153605b1dde6940c7c71643de6eea8fa14144', cutoff: '2026-10-01T12:00:00.000Z', memoryFiles: 274, trainMessages: 361, heldMessages: 22, heldFrom: { coordinator: 17, kar: 5 }, trainChars: 2592024, heldChars: 43323 };

export function prereg() {
  const prices = JSON.parse(text('data/prices.json'));
  const cost = (src) => { const t = prices.tally[src]; return t.n + ' priced: ' + Object.entries(t.byCost).map(([c, n]) => n + ' at ' + c + ' token' + (c === '1' ? '' : 's')).join(', '); };
  return {
    kind: 'konomi-tongue-prereg', v: 1, written: '2026-10-01',
    approvedBy: 'Simon, relayed verbatim: "no there is 15x maybe im not explaining its ai language from the seed how our brain and agents tal it can also im prove json by 15x leets grow the use cunifirm glyps its konomi lol come one we cabn do this its somewhere lol"; the LIGHT fork and his KONOMI-AS-RUNTIME spec ("15x is the TARGET; WIN = the ratio climbs toward 15x; LEARN = encode/decode overhead eats the saving"); the picture channel ("grid dot language like cuniform with glyphs numbs some japanese and emojies … ultra comprsed ai language") with the paid read-back: "yes lets done this".',
    statement: 'Sealed, committed and pushed before any held-out message is coded or any picture is read. The result is published whichever way it lands; where it falls short of 15×, this says how far it got and what limits it.',
    question: 'Grown from what the agents actually say, does the Konomi Tongue carry held-out agent messages and real JSON in 15× fewer Claude tokens — and does drawing it as a picture (raw dots, familiar glyphs, glyphs evolved against the model\'s own misreads) carry more bits per token than the best text?',
    sealed: {
      'tongue.mjs': sha(text('tongue.mjs')), 'tools/run.mjs': sha(text('tools/run.mjs')), 'tools/run-phases.mjs': sha(text('tools/run-phases.mjs')),
      'tools/cli.mjs': sha(text('tools/cli.mjs')), 'tools/render.ps1': sha(text('tools/render.ps1')), 'data/prices.json': sha(text('data/prices.json')),
      'data/json/manifest.json': sha(text('data/json/manifest.json')), 'private corpus (~/.si-didy/tongue/corpus.json)': CORPUS.sha256,
    },
    alphabet: {
      how: 'every candidate glyph priced in Claude tokens through the CLI on Simon’s login before anything else (data/prices.json); the text and JSON channels write only kanji and kana that cost one or two tokens and never occur in any text the tongue carries (so a glyph in coded text can only be a glyph), one-token glyphs first; a two-token glyph is only used where it still saves',
      priced: prices.tally,
    },
    corpus: {
      agents: CORPUS,
      split: 'by time: every coordinator↔Kar message before ' + CORPUS.cutoff + ' and every memory file last written before it trains the dictionary; every message at or after it is held out. The corpus stays on the laptop — only its sha256 and counts are published.',
      json: 'data/json/: per repo, every JSON data file up to 200 KB, the most recently committed held out (tools/json-corpus.mjs), plus the UCI shopper sessions as records (Feb–Oct train, Nov–Dec held out)',
    },
    channels: {
      text: 'units (words with one leading space, digit runs, whitespace runs, single characters) merged pair by pair: each round the ' + CONFIG.text.batch + ' most valuable pairs that share no symbol (count × tokens saved, priced) become new glyphs, for ' + CONFIG.text.rounds + ' rounds or until the alphabet runs out; a glyph may hold glyphs (nesting). The curve is read at ' + CONFIG.text.checkpoints.join(', ') + ' glyphs and at the full dictionary.',
      json: 'a recurring ordered key list (schema), key or string value becomes one glyph; records write as S(v1,v2,…); every held-out file must decode to its exact minified JSON',
      picture: 'arm A raw dots (48×48 black/white squares in nested blocks of 3, dot sizes ' + CONFIG.picture.dots.sizes.join('/') + ' px); arm B familiar glyphs (24×16 grid of 256 one-token kanji spread across the priced range, cell sizes ' + CONFIG.picture.glyphSizes.join('/') + ' px, Yu Gothic); arm C the same grid with the alphabet evolved two generations against the model\'s own training misreads (every misread glyph replaced by a fresh one-token kanji, seeded). ' + CONFIG.picture.perSize + ' held-out images per arm and size, payloads seeded and never seen before the read. Bits per token = payload bits ÷ image tokens (the read\'s input tokens minus the same prompt without the image), at the smallest size where every held-out image reads back at ≥' + CONFIG.picture.bar * 100 + '%. Nesting depth curve: raw dots at ' + CONFIG.picture.depth.dot + ' px, depth 1–4 (3^d × 3^d dots).',
      combined: CONFIG.combined.n + ' held-out messages (seeded) coded with the full dictionary and drawn as text at ' + CONFIG.combined.sizes.join('/') + ' px; each read back blind; the ratio is their English tokens ÷ the image tokens at each one\'s smallest size read back at ≥' + CONFIG.picture.bar * 100 + '% (whitespace runs count as one space)',
      readback: CONFIG.text.readback.n + ' held-out messages (seeded), coded, given to Claude with the flat legend: decode exactly',
    },
    config: CONFIG,
    prompts: { system: PROMPTS.system, glyphs: PROMPTS.glyphs(CONFIG.picture.rows, CONFIG.picture.cols), dots: PROMPTS.dots(CONFIG.picture.dots.rows, CONFIG.picture.dots.cols), combined: PROMPTS.combined, readSystem: PROMPTS.readSystem },
    rules: [
      { id: 'text-15x', rule: 'held-out agent messages cost at least 15× fewer Claude tokens coded with the grown dictionary (the reader already holding it)' },
      { id: 'text-climbs', rule: 'the ratio climbs at every step of the growth curve' },
      { id: 'text-lossless', rule: 'every held-out message decodes back exactly' },
      { id: 'claude-reads-tongue', rule: 'Claude, given the legend, decodes at least 6 of the 8 sampled coded messages exactly' },
      { id: 'json-15x', rule: 'the held-out JSON costs at least 15× fewer Claude tokens coded with the shared schema (held)' },
      { id: 'json-lossless', rule: 'every held-out JSON file decodes back to its exact minified JSON' },
      { id: 'picture-beats-text', rule: 'the best picture arm carries more bits per token, read back at ≥99%, than the best text encoding of the same bits' },
      { id: 'familiar-beats-dots', rule: 'familiar glyphs (arm B or C) carry more bits per token than raw dots (arm A)' },
      { id: 'evolved-beats-familiar', rule: 'the evolved glyphs (arm C) carry more bits per token than the familiar ones (arm B)' },
      { id: 'combined-15x', rule: 'the coded messages drawn as pictures cost at least 15× fewer tokens than the plain English, every one read back at ≥99%' },
      { id: 'reproducible', rule: 'CI re-grades every recorded read, rebuilds the JSON channel from the committed files and re-derives every number from the record' },
    ],
    predictions: {
      said: 'before any held-out message was coded or any picture read, by Kar',
      'text-15x': 'fail — about 2–3×: most of a new message is new information, and a dictionary only saves what recurs',
      'text-climbs': 'pass',
      'text-lossless': 'pass',
      'claude-reads-tongue': 'fail — a long flat legend invites slips; 2–4 of 8 exact',
      'json-15x': 'fail — about 4–8×: the shopper records shed their keys, but numbers do not shrink',
      'json-lossless': 'pass',
      'picture-beats-text': 'pass — familiar glyphs at 10–14 px near 25–45 bits per token, against about 10–15 for text',
      'familiar-beats-dots': 'pass — raw dots will not hold 99% below the largest size',
      'evolved-beats-familiar': 'fail — two generations rarely buy a whole size step',
      'combined-15x': 'fail — about 4–7×',
      reproducible: 'pass',
    },
    disclosures: [
      'Before the seal: the glyph prices (their own measurement, committed), a plumbing check of the CLI image path on two images of known content (an 8-kanji grid read exactly; an 18-square dot grid misread — raw dots at 6 px with outlines), and the corpus counts. No held-out message was coded and no payload picture was read.',
      'The alphabet was decided by price. In Claude’s tokenizer: cuneiform ' + cost('cuneiform') + '; LIGHT’s opcodes, rings and buses ' + cost('light') + '; the seed’s glyphs ' + cost('seed') + '; kanji U+4E00–U+51FF ' + cost('kanji') + '; kana ' + cost('kana') + '; kanji U+5200–U+61FF (batches only, admitted at ≤2 on average, planned as 2) ' + cost('kanji-wide') + '. So the text channel writes kanji and kana; cuneiform and emoji only ever pay off in the picture channel, where a glyph costs area, not tokens. Pricing was stopped at these ranges for time (one CLI call per glyph is about 2.6 s).',
      'LIGHT (Thomas Frumkin, teslasolar/light, used with permission) has 36 opcodes in src/ops.js at the forked commit (its README says 38); its prime mapping is carried in the legend. The tongue\'s dictionary is modelled on LIGHT\'s templates (a whole program called by name); LIGHT\'s runtime itself is not on the measured path.',
      'A mock run of the whole pipeline (no paid calls: counts as characters ÷ 4, every reply empty, the 22 held-out messages replaced by the last 22 training messages) checked the plumbing end to end before the seal; it did touch the held-out JSON files, whose character ratio (3.45×, not tokens) was therefore seen. No prediction was changed after it.',
      'The 15× is Simon\'s target, sealed as the bar. Claude tokens are counted for claude-sonnet-5-5; the picture reads use the same model.',
    ],
  };
}

const stable = (o) => JSON.stringify(o, null, 1) + '\n';
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/seal.mjs')) {
  if (process.argv.includes('--check')) {
    const same = existsSync(OUT) && text('data/prereg.json') === stable(prereg());
    console.log(same ? 'the pre-registration matches its inputs' : 'data/prereg.json differs from what the committed inputs give');
    process.exitCode = same ? 0 : 1;
  } else if (existsSync(OUT)) { console.error('data/prereg.json exists — it is sealed'); process.exitCode = 1; }
  else { writeFileSync(OUT, stable(prereg())); console.log('sealed data/prereg.json · sha256 ' + sha(stable(prereg()))); }
}
