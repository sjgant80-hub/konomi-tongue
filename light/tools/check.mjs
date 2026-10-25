#!/usr/bin/env node
// light/tools/check.mjs — what CI can re-check without the local clones the measurement read. It proves the receipt is
// internally honest and the seals are intact:
//   · light/claims.json and light/barrier.json each still hash to what the receipt says was sealed, and to their commit
//   · the dictionary (light/dict/v1.txt) still has the SHA-256 and the id the receipt recorded
//   · the judge (light/judge.mjs), re-run on the receipt's OWN facts, gives exactly the receipt's verdicts
//   · the LIGHT codec round-trips light/fixtures.mjs (a lossless smoke-check that needs no corpus)
// Exit 0 only if all of it holds. The full measurement over held-out files is `node light/tools/measure.mjs`.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { judge } from '../judge.mjs';
import { sha256, hex } from '../sha256.mjs';
import { encode, decode, prime } from '../codec.mjs';
import { dictIdOf } from '../packet.mjs';
import * as F from '../fixtures.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..', '..');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const fails = [];
const check = (ok, what) => { console.log((ok ? '  ok  ' : '  ✗  ') + what); if (!ok) fails.push(what); };

const RUN = join(HERE, '..', 'data', 'light-run.json');
if (!existsSync(RUN)) { console.log('no light/data/light-run.json yet — sealed, not yet measured'); process.exit(0); }
const r = JSON.parse(readFileSync(RUN, 'utf8'));

for (const s of r.sealed) {
  const text = readFileSync(join(ROOT, s.path), 'utf8');
  check(hex(sha256(new TextEncoder().encode(text))) === s.sha256, s.path + ' still hashes to what the receipt sealed');
  let atCommit = null;
  try { atCommit = git('show', s.commit + ':' + s.path); } catch { atCommit = null; }
  check(atCommit === text, s.path + ' matches its sealing commit ' + s.commit.slice(0, 7));
}

const dict = new Uint8Array(readFileSync(join(HERE, '..', 'dict', 'v1.txt')));
check(hex(sha256(dict)) === r.facts.dictSha256, 'the dictionary still has the receipt\'s SHA-256');
check(dictIdOf(dict) === r.facts.dictId && dict.length === r.facts.dictBytes, 'the dictionary id and size match the receipt');

const again = judge({ claims: r.sealed.map((s) => JSON.parse(readFileSync(join(ROOT, s.path), 'utf8')).claims).filter(Array.isArray).flat() }, r.facts);
check(JSON.stringify(again.verdicts) === JSON.stringify(r.verdicts) && again.held === r.held, 'the judge, re-run on the receipt\'s facts, gives the receipt\'s verdicts (' + again.held + ' held, ' + again.failed + ' failed)');

const P = prime(dict);
let lossless = true;
for (const v of [F.text, F.records, F.ramp, F.noise(2048), new Uint8Array(0)]) {
  for (const primed of [undefined, P]) { const d = decode(encode(v, primed).bytes, primed); if (!d.ok || d.bytes.length !== v.length || d.bytes.some((x, i) => x !== v[i])) lossless = false; }
}
check(lossless, 'the codec round-trips the fixtures exactly, with and without the dictionary');

console.log(fails.length ? '\nLIGHT CHECK FAILED — ' + fails.length + ' of the checks above' : '\nLIGHT CHECK CLEAN — the receipt stands');
process.exit(fails.length ? 1 : 0);
