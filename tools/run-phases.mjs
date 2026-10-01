// tools/run-phases.mjs — the phases of the sealed run, and CI's verification of its record (glue; see tools/run.mjs).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as T from '../tongue.mjs';

const sha = (s) => createHash('sha256').update(s).digest('hex');
const stable = (o) => JSON.stringify(o, null, 1) + '\n';
const jsonFiles = (ROOT, split) => readdirSync(join(ROOT, 'data/json', split)).filter((f) => f.endsWith('.json')).sort()
  .map((f) => ({ file: f, text: readFileSync(join(ROOT, 'data/json', split, f), 'utf8') }));
const r2 = (v) => Math.round(v * 100) / 100;

// ── the JSON channel, rebuilt the same way in the run and in CI ─────────────────────────────────────────────────────
export function jsonChannel(ROOT, CONFIG, alphabet) {
  const train = jsonFiles(ROOT, 'train').map((f) => JSON.parse(f.text));
  const held = jsonFiles(ROOT, 'held');
  const dict = T.learnJson(train, alphabet, CONFIG.json.min);
  const points = [...new Set([...CONFIG.json.checkpoints.filter((n) => n < dict.length), dict.length])];
  const coded = (n) => held.map((f) => T.encodeJson(JSON.parse(f.text), dict.slice(0, n)));
  const back = held.map((f, k) => { const d = T.decodeJson(coded(dict.length)[k], dict); return d.ok && JSON.stringify(d.value) === f.text; });
  return { dict, held, points, coded, lossless: { ok: back.filter(Boolean).length, n: held.length } };
}

// ── a picture read: payload → truth → image → the model reads it blind → graded ─────────────────────────────────────
function pictureJob(ctx, spec) {
  const { CONFIG, seedOf } = ctx;
  const P = CONFIG.picture;
  const seed = seedOf([spec.arm, spec.size, spec.split, spec.k, spec.gen || 0].join('|'));
  if (spec.kind === 'dots') {
    const side = spec.side || P.dots.cols;
    const bits = T.payload(side * side, 2, seed);
    return { ...spec, seed, cols: side, rows: side, cells: side * side, symbols: 2, truth: T.gridText(bits, side, ['0', '1']), bits: T.bitsOf(side * side, 2),
      job: { kind: 'dots', cols: side, dot: spec.size, gap: P.dots.gap, group: 3, groupGap: spec.size, pad: 8, bits } };
  }
  const cells = P.cols * P.rows, sym = T.payload(cells, spec.alphabet.length, seed);
  return { ...spec, seed, cols: P.cols, rows: P.rows, cells, symbols: spec.alphabet.length, truth: T.gridText(sym, P.cols, spec.alphabet), bits: T.bitsOf(cells, spec.alphabet.length),
    job: { kind: 'glyphs', rows: P.rows, cols: P.cols, cell: spec.size, pad: 8, scale: P.scale, font: P.font, glyphs: sym.map((x) => spec.alphabet[x]) } };
}

export async function runAll(ctx) {
  const { ROOT, PRIV, CONFIG, PROMPTS, alphabetB, bestOf } = ctx;
  const { ask } = await import('./cli.mjs');
  const { claudeCounter } = await import('file:///C:/Users/sjgan/kar-mind/tools/claude-count.mjs');
  const sealedIn = execFileSync('git', ['log', '-1', '--format=%H', '--', 'data/prereg.json'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (!sealedIn) throw new Error('the seal is not committed — commit and push it first');
  mkdirSync(PRIV + '/img', { recursive: true });
  mkdirSync(join(ROOT, 'data/img'), { recursive: true });
  const cacheFile = PRIV + '/calls.json';
  const cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};
  const save = () => writeFileSync(cacheFile, JSON.stringify(cache));
  const counter = await claudeCounter(CONFIG.model);
  const tokens = async (t) => { const k = 'count|' + sha(t); if (!(k in cache)) { cache[k] = (await counter.count(t)) + 1; save(); } return cache[k]; };
  const paid = async (req) => {
    const k = 'ask|' + sha(JSON.stringify({ ...req, image: req.image ? sha(readFileSync(req.image).toString('base64')) : null }));
    if (!(k in cache)) { cache[k] = await ask({ ...req, model: CONFIG.model }); save(); }
    return cache[k];
  };
  const log = (m) => process.stderr.write('  ' + m + '\n');

  // inputs
  const corpus = JSON.parse(readFileSync(PRIV + '/corpus.json', 'utf8'));
  const prices = JSON.parse(readFileSync(join(ROOT, 'data/prices.json'), 'utf8'));
  const priceMap = new Map(prices.glyphs.map((p) => [p.g, p.cost]));
  const jsonTexts = [...jsonFiles(ROOT, 'train'), ...jsonFiles(ROOT, 'held')].map((f) => f.text);
  // one- and two-token kanji and kana, the cheapest first, none that occurs in anything the tongue carries
  const alphabet = T.alphabetFrom(prices.glyphs.filter((p) => ['kanji', 'kana', 'kanji-wide'].includes(p.source)), [...corpus.train, ...corpus.held.map((m) => m.text), ...jsonTexts], 2);
  log('alphabet ' + alphabet.length + ' glyphs (' + alphabet.filter((g) => priceMap.get(g) === 1).length + ' of one token)');

  // ── TEXT ──
  const t0 = Date.now();
  const grown = T.grow(corpus.train, alphabet, CONFIG.text.rounds, CONFIG.text.batch, priceMap);
  const dict = T.dictionary(grown);
  log('grew ' + dict.length + ' glyphs in ' + Math.round((Date.now() - t0) / 1000) + ' s');
  const held = corpus.held.map((m) => m.text);
  const points = [...new Set([...CONFIG.text.checkpoints.filter((n) => n < dict.length), dict.length])];
  const plainTokens = await tokens(held.join('\n\n'));
  const curve = [];
  for (const n of points) {
    const coded = held.map((m) => T.encode(m, dict, n)).join('\n\n');
    const c = await tokens(coded);
    curve.push({ entries: n, plainTokens, codedTokens: c, ratio: T.ratio(plainTokens, c), chars: [...coded].length });
    log('text ' + n + ' glyphs → ' + T.ratio(plainTokens, c) + '×');
  }
  const codedHeld = held.map((m) => T.encode(m, dict));
  const lossless = { ok: held.filter((m, k) => T.decode(codedHeld[k], dict) === m).length, n: held.length };
  const legendNested = await tokens(T.legendText(dict, false)), legendFlat = await tokens(T.legendText(dict, true));
  const dep = T.depths(dict), hist = {};
  for (const d of dep) hist[d] = (hist[d] || 0) + 1;
  const rr = T.rng(CONFIG.text.readback.seed), idx = held.map((_, k) => k), pickR = [];
  while (pickR.length < Math.min(CONFIG.text.readback.n, held.length)) pickR.push(idx.splice(T.draw(rr, idx.length), 1)[0]);
  const flat = T.legendText(dict, true);
  const readback = [];
  for (const k of pickR) {
    const a = await paid({ text: PROMPTS.readback(flat, codedHeld[k]), system: PROMPTS.readSystem });
    const g = T.editRate(held[k], a.reply);
    readback.push({ message: k, exact: g.exact, rate: r2(g.rate), input: a.input, output: a.output });
    log('read back message ' + k + ': ' + (g.exact ? 'exact' : Math.round(g.rate * 1000) / 10 + '%'));
  }

  // ── JSON ──
  const J = jsonChannel(ROOT, CONFIG, alphabet);
  const jPlain = await tokens(J.held.map((f) => f.text).join('\n'));
  const jcurve = [];
  for (const n of J.points) {
    const c = await tokens(J.coded(n).join('\n'));
    jcurve.push({ entries: n, plainTokens: jPlain, codedTokens: c, ratio: T.ratio(jPlain, c) });
    log('json ' + n + ' glyphs → ' + T.ratio(jPlain, c) + '×');
  }
  const perFile = [];
  for (const [k, f] of J.held.entries()) {
    const p = await tokens(f.text), c = await tokens(J.coded(J.dict.length)[k]);
    perFile.push({ file: f.file, plainTokens: p, codedTokens: c, ratio: T.ratio(p, c) });
  }
  const jLegend = await tokens(J.dict.map((e) => e.glyph + '=' + e.kind + ':' + e.value).join('\n'));

  // ── PICTURE ──
  const P = CONFIG.picture;
  const B = alphabetB(alphabet, P.alphabet), pool = alphabet.filter((g) => !B.includes(g));
  const baseline = {};
  const reads = [];
  const read = async (spec) => {
    const j = pictureJob(ctx, spec);
    const name = [j.arm, j.size, j.split, j.k, 'g' + (j.gen || 0)].join('-') + '.png';
    const file = join(ROOT, 'data/img', name).replace(/\\/g, '/');
    const jobs = join(PRIV, 'render.json');
    writeFileSync(jobs, JSON.stringify([{ ...j.job, out: file }]));
    execFileSync('powershell', ['-NoProfile', '-File', join(ROOT, 'tools/render.ps1'), jobs], { encoding: 'utf8' });
    const prompt = j.kind === 'dots' ? PROMPTS.dots(j.rows, j.cols) : PROMPTS.glyphs(j.rows, j.cols);
    if (!(prompt in baseline)) baseline[prompt] = (await paid({ text: prompt, system: PROMPTS.system })).input;
    const a = await paid({ text: prompt, image: file, system: PROMPTS.system });
    const grade = T.gradeGrid(j.truth, a.reply);
    const rec = { arm: j.arm, kind: j.kind, size: j.size, split: j.split, k: j.k, gen: j.gen || 0, seed: j.seed, image: 'data/img/' + name,
      imageSha256: sha(readFileSync(file)), cells: j.cells, symbols: j.symbols, bits: j.bits, reply: a.reply, grade,
      input: a.input, imageTokens: a.input - baseline[prompt], output: a.output };
    reads.push(rec);
    log('read ' + name + ': ' + Math.round(grade.rate * 1000) / 10 + '% · ' + rec.imageTokens + ' image tokens');
    return { rec, truth: j.truth };
  };
  for (const s of P.dots.sizes) for (let k = 0; k < P.perSize; k++) await read({ arm: 'A', kind: 'dots', size: s, split: 'held', k });
  const trainB = [];
  for (const s of P.glyphSizes) for (let k = 0; k < P.perSize; k++) {
    trainB.push(await read({ arm: 'B', kind: 'glyphs', size: s, split: 'train', k, alphabet: B }));
    await read({ arm: 'B', kind: 'glyphs', size: s, split: 'held', k, alphabet: B });
  }
  const C1 = T.evolveAlphabet(B, trainB.flatMap((x) => T.misreads(x.truth, x.rec.reply)), pool, P.seed);
  const trainC = [];
  for (const s of P.evolveSizes) for (let k = 0; k < P.perSize; k++) trainC.push(await read({ arm: 'C', kind: 'glyphs', size: s, split: 'train', k, gen: 1, alphabet: C1 }));
  const C2 = T.evolveAlphabet(C1, trainC.flatMap((x) => T.misreads(x.truth, x.rec.reply)), pool, P.seed + 1);
  for (const s of P.glyphSizes) for (let k = 0; k < P.perSize; k++) await read({ arm: 'C', kind: 'glyphs', size: s, split: 'held', k, gen: 2, alphabet: C2 });
  for (const d of P.depth.levels) for (let k = 0; k < P.depth.images; k++) await read({ arm: 'D' + d, kind: 'dots', size: P.depth.dot, split: 'depth', k, side: 3 ** d });
  const pay = T.payload(288, 256, ctx.seedOf('text-baseline'));
  const bytes = Buffer.from(pay);
  const textBaselines = [];
  // the same 2,304 bits as text: base64, hex, and 7-bit symbols written with 128 one-token glyphs (the last padded)
  const one = alphabet.filter((g) => priceMap.get(g) === 1).slice(0, 128);
  const bitstr = [...bytes].map((b) => b.toString(2).padStart(8, '0')).join('');
  const sevens = (bitstr.match(/.{1,7}/g) || []).map((c) => one[parseInt(c.padEnd(7, '0'), 2)]).join('');
  for (const [name, s] of [['base64', bytes.toString('base64')], ['hex', bytes.toString('hex')], ['one-token glyphs', sevens]]) {
    const n = await tokens(s);
    textBaselines.push({ encoding: name, bits: 2304, tokens: n, bitsPerToken: r2(2304 / n) });
  }
  const heldOf = (a) => reads.filter((r) => r.arm === a && r.split === 'held');
  const arms = Object.fromEntries(['A', 'B', 'C'].map((a) => [a, { best: bestOf(heldOf(a), P.bar) }]));
  const depthCurve = P.depth.levels.map((d) => { const rs = reads.filter((r) => r.arm === 'D' + d); return { depth: d, dots: 9 ** d, rate: r2(rs.reduce((a, r) => a + r.grade.right, 0) / rs.reduce((a, r) => a + r.grade.n, 0)), exact: rs.filter((r) => r.grade.exact).length, of: rs.length }; });

  // ── COMBINED: the coded message, drawn ──
  const C = CONFIG.combined;
  const rc = T.rng(C.seed), idx2 = held.map((_, k) => k), pickC = [];
  while (pickC.length < Math.min(C.n, held.length)) pickC.push(idx2.splice(T.draw(rc, idx2.length), 1)[0]);
  const combinedReads = [];
  let cBase = null;
  for (const k of pickC) {
    const english = await tokens(held[k]);
    const sizes = [];
    for (const size of C.sizes) {
      const file = join(PRIV, 'img', 'combined-' + k + '-' + size + '.png').replace(/\\/g, '/');
      const jobs = join(PRIV, 'render.json');
      writeFileSync(jobs, JSON.stringify([{ kind: 'text', out: file, text: codedHeld[k], width: C.width, size, font: C.font, pad: 8 }]));
      execFileSync('powershell', ['-NoProfile', '-File', join(ROOT, 'tools/render.ps1'), jobs], { encoding: 'utf8' });
      if (cBase === null) cBase = (await paid({ text: PROMPTS.combined, system: PROMPTS.system })).input;
      const a = await paid({ text: PROMPTS.combined, image: file, system: PROMPTS.system });
      const g = T.editRate(codedHeld[k], a.reply);
      const decodedOk = T.squash(T.decode(T.squash(a.reply), dict)) === T.squash(held[k]);
      sizes.push({ size, rate: r2(g.rate), exact: g.exact, decodes: decodedOk, imageTokens: a.input - cBase, private: sha(a.reply) });
      log('combined message ' + k + ' at ' + size + 'px: ' + Math.round(g.rate * 1000) / 10 + '%');
    }
    combinedReads.push({ message: k, englishTokens: english, sizes });
  }
  const combined = combinedSummary(combinedReads, CONFIG.picture.bar);

  const run = {
    kind: 'konomi-tongue-run', v: 1, sealedIn, model: CONFIG.model,
    text: { glyphs: dict.length, curve, lossless, legendTokens: { nested: legendNested, flat: legendFlat }, depth: { max: Math.max(...dep), histogram: hist },
      heldMessages: held.length, readback },
    json: { glyphs: J.dict.length, kinds: { schema: J.dict.filter((e) => e.kind === 'schema').length, key: J.dict.filter((e) => e.kind === 'key').length, string: J.dict.filter((e) => e.kind === 'string').length },
      curve: jcurve, perFile, lossless: J.lossless, legendTokens: jLegend, codedSha256: J.coded(J.dict.length).map(sha) },
    picture: { alphabet, B, C1, C2, baseline, reads, arms, depthCurve, textBaselines },
    combined,
  };
  writeFileSync(join(ROOT, 'data/run.json'), stable(run));
  writeFileSync(PRIV + '/private-run.json', JSON.stringify({ dict, codedHeld, readback: pickR, combinedPick: pickC }));
  console.log('ran · text ' + curve[curve.length - 1].ratio + '× · json ' + jcurve[jcurve.length - 1].ratio + '× · combined ' + combined.ratio + '×');
}

// the combined ratio: each message at the smallest size that read back at the bar; all must pass for the rule
export function combinedSummary(reads, bar) {
  const per = reads.map((m) => {
    const ok = m.sizes.filter((s) => s.rate >= bar).sort((a, b) => a.imageTokens - b.imageTokens)[0] || null;
    return { message: m.message, englishTokens: m.englishTokens, best: ok, sizes: m.sizes };
  });
  const passing = per.filter((m) => m.best);
  const eng = passing.reduce((a, m) => a + m.englishTokens, 0), img = passing.reduce((a, m) => a + m.best.imageTokens, 0);
  return { messages: per, passing: passing.length, of: per.length, ratio: passing.length === per.length ? T.ratio(eng, img) : 0, partialRatio: T.ratio(eng, img) };
}

// ── CI: re-grade every read, rebuild the JSON channel, re-derive every number ─────────────────────────────────────
export async function verify(ctx) {
  const { ROOT, CONFIG, alphabetB, bestOf } = ctx;
  const run = JSON.parse(readFileSync(join(ROOT, 'data/run.json'), 'utf8'));
  const P = run.picture, bad = [];
  const check = (what, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(what); };
  check('alphabet B', alphabetB(P.alphabet, CONFIG.picture.alphabet), P.B);
  const pool = P.alphabet.filter((g) => !P.B.includes(g));
  const truthOf = (r) => pictureJob(ctx, { arm: r.arm, kind: r.kind, size: r.size, split: r.split, k: r.k, gen: r.gen, side: r.kind === 'dots' && r.arm !== 'A' ? Math.sqrt(r.cells) : undefined,
    alphabet: r.arm === 'B' ? P.B : r.gen === 1 ? P.C1 : P.C2 }).truth;
  for (const r of P.reads) check('grade ' + r.image, T.gradeGrid(truthOf(r), r.reply), r.grade);
  const trainB = P.reads.filter((r) => r.arm === 'B' && r.split === 'train'), trainC = P.reads.filter((r) => r.arm === 'C' && r.split === 'train');
  check('evolution C1', T.evolveAlphabet(P.B, trainB.flatMap((r) => T.misreads(truthOf(r), r.reply)), pool, CONFIG.picture.seed), P.C1);
  check('evolution C2', T.evolveAlphabet(P.C1, trainC.flatMap((r) => T.misreads(truthOf(r), r.reply)), pool, CONFIG.picture.seed + 1), P.C2);
  for (const r of P.reads) { check('image tokens ' + r.image, r.input - P.baseline[r.kind === 'dots' ? ctx.PROMPTS.dots(Math.sqrt(r.cells), Math.sqrt(r.cells)) : ctx.PROMPTS.glyphs(CONFIG.picture.rows, CONFIG.picture.cols)], r.imageTokens); if (existsSync(join(ROOT, r.image))) check('image ' + r.image, sha(readFileSync(join(ROOT, r.image))), r.imageSha256); else bad.push('missing ' + r.image); }
  for (const a of ['A', 'B', 'C']) check('best ' + a, bestOf(P.reads.filter((r) => r.arm === a && r.split === 'held'), CONFIG.picture.bar), P.arms[a].best);
  for (const b of P.textBaselines) check('text baseline ' + b.encoding, r2(b.bits / b.tokens), b.bitsPerToken);
  const J = jsonChannel(ROOT, CONFIG, P.alphabet);
  check('json coded', J.coded(J.dict.length).map(sha), run.json.codedSha256);
  check('json lossless', J.lossless, run.json.lossless);
  for (const x of [...run.text.curve, ...run.json.curve, ...run.json.perFile]) check('ratio', T.ratio(x.plainTokens, x.codedTokens), x.ratio);
  check('combined', combinedSummary(run.combined.messages.map((m) => ({ message: m.message, englishTokens: m.englishTokens, sizes: m.sizes })), CONFIG.picture.bar), run.combined);
  console.log(bad.length ? 'DIFFERS — ' + bad.join('; ') : 'VERIFIED — every read re-graded, the JSON channel rebuilt, every number re-derived from the record');
  if (bad.length === 0 && process.argv.includes('--record')) writeFileSync(join(ROOT, 'data/verify.json'), stable({ verified: true, node: process.version, on: new Date().toISOString().slice(0, 10) }));
  process.exitCode = bad.length ? 1 : 0;
}
