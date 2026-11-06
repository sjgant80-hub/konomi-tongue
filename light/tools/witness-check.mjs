#!/usr/bin/env node
// light/tools/witness-check.mjs — CI's last word on a kernel's mutation gate. witness (pinned v0.6) has just run on this
// runner and written its verdict; this checks that verdict is clean, not capped (every mutant run, not a sample), AND
// that it re-derives exactly the counts committed
// in light/data/witness.json (the same mutants, the same number killed, the same reviewed-equivalent survivors, each
// with its written reason in light/witness.baseline.json). A receipt that only says "clean" is not trusted on its own:
// the runner has to get the same answer.
//   node light/tools/witness-check.mjs <kernel> <witness-output.json>
import { readFileSync } from 'node:fs';

const [name, file] = process.argv.slice(2);
if (!name || !file) { console.error('usage: witness-check.mjs <kernel> <witness-output.json>'); process.exit(2); }
const committed = JSON.parse(readFileSync(new URL('../data/witness.json', import.meta.url), 'utf8'));
const want = (committed.kernels || []).find((k) => k.name === name);
let got = null;
try { got = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { console.error('::error::no verdict from witness for ' + name + ': ' + e.message); process.exit(1); }
const ignored = Array.isArray(got.ignored) ? got.ignored.length : -1, survived = Array.isArray(got.survived) ? got.survived : [];
for (const s of survived) console.error('  survived: line ' + s.line + ' ' + s.mutation + ' :: ' + s.snippet);
const problems = [];
if (!want) problems.push(name + ' is not in light/data/witness.json');
if (got.clean !== true) problems.push('not clean (' + survived.length + ' survived)');
if (got.capped !== false) problems.push('capped at ' + got.total + ' of ' + got.capped + ' mutants: a sample, not the whole kernel — raise --cap');
if (want && got.total !== want.total) problems.push('total ' + got.total + ' here, ' + want.total + ' committed');
if (want && got.killed !== want.killed) problems.push('killed ' + got.killed + ' here, ' + want.killed + ' committed');
if (want && ignored !== want.ignored) problems.push('reviewed-equivalent ' + ignored + ' here, ' + want.ignored + ' committed');
if (problems.length) { console.error('::error::witness ' + name + ': ' + problems.join('; ')); process.exit(1); }
console.log('witness ' + name + ': ' + got.killed + '/' + got.total + ' killed on this runner, ' + ignored + ' reviewed-equivalent — clean, and the committed receipt re-derived exactly');
