#!/usr/bin/env node
// layered/tools/seal2.mjs — writes layered/SEAL2.md: the instrument frozen by hash before any held item is read.
// Every file the measurement runs is hashed as git stores it (LF); the private inputs (the pattern library's module,
// its wire, its feed, the library as sealed) by hash only. Commit SEAL2.md; its commit time is END.
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const lf = (p) => Buffer.from(readFileSync(join(ROOT, p)).toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
export const FILES = ['layered/src/fold.mjs', 'layered/src/settle.mjs', 'layered/src/verdict.mjs',
  'layered/tools/gather.mjs', 'layered/tools/lab.mjs', 'layered/tools/measure.mjs', 'layered/tools/stack.mjs',
  'layered/test/fold.test.mjs', 'layered/test/settle.test.mjs', 'layered/test/verdict.test.mjs', 'layered/test/fixtures.mjs', 'layered/test/golden.json',
  'layered/data/witness.json', 'layered/CLAIMS.md', 'layered/STACKED-CLAIMS.md',
  'light/codec.mjs', 'light/sha256.mjs', 'light/dict/v1.txt', 'tools/corpus.mjs'];

const local = JSON.parse(readFileSync(join(ROOT, 'layered/data/private.local.json'), 'utf8'));
// the library is copied as it stands now, so the nightly loop growing it tonight cannot change what is measured
const sealedLib = 'C:/Users/sjgan/.si-didy/layered/library-sealed.json';
mkdirSync(dirname(sealedLib), { recursive: true });
copyFileSync(local.library, sealedLib);
local.library = sealedLib;
writeFileSync(join(ROOT, 'layered/data/private.local.json'), JSON.stringify(local, null, 2) + '\n');
const files = Object.fromEntries(FILES.map((p) => [p, sha(lf(p))]));
const priv = Object.fromEntries(['patlib', 'wire', 'feed', 'library'].map((k) => [k, sha(readFileSync(local[k]))]));
const gate = JSON.parse(readFileSync(join(ROOT, 'layered/data/witness.json'), 'utf8'));
const block = { cut: '2026-11-05T12:00:00.000Z', end: 'the commit time of this file', files, private: priv,
  gate: Object.fromEntries(gate.kernels.map((k) => [k.name, k.killed + '/' + k.total + ', ' + k.ignored + ' baselined'])) };
const md = `# SEAL 2 — LIGHT, LAYERED and STACKED LIGHT: the instrument, frozen

Committed after the kernels, their tests, the mutation gate and the measurement tools were finished, and **before any
held item is read**. \`layered/tools/measure.mjs\` refuses to run unless every hash below matches the committed file and
the working copy, and every private input matches its hash. **END is this file's commit time**: held items are those dated
in [CUT, END).

- **What was read before this seal:** the seed side only (items dated before CUT), for the tests' fixtures (made by
  rule, no data), a tuning pass on the seed side (older seed items taught, the newest 128 KiB coded; six settings on agent
  logs, records and prose; the best moved the full stack by under 1% and cost cold frames about as much, so the
  constants chosen in advance were kept), and a dry run of the whole pipeline on seed-side items with the stack measured
  on its gate's own slice (FINAL-A) and no model called. No held item and no FINAL-B case was read.
- **Seen in the dry run, before this seal:** the gate, given only FINAL-A as its final exam, kept none of the library's
  rule and the miner's 39 proposals (the library's one rule covers 3 cases of the whole final slice, none of them in
  FINAL-A). The sealed design is not changed for it: S1 and S4 will fail if the 7B proposes nothing that passes.
- **A change to a seal before anything was published:** the first commit of \`layered/STACKED-CLAIMS.md\` named a
  private repository. Before any push it was amended to say "a private organ's \`patlib.mjs\`"; no claim, prediction or
  rule changed. Private names never appear on a public page.
- **The gate:** witness v0.6 (pinned), run on copies of the kernels; nothing baselined.

\`\`\`json
${JSON.stringify(block, null, 1)}
\`\`\`
`;
writeFileSync(join(ROOT, 'layered/SEAL2.md'), md);
console.log('SEAL2.md written: ' + FILES.length + ' files, 4 private inputs; gate ' + JSON.stringify(block.gate));
