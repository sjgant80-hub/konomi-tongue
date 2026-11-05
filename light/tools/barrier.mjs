#!/usr/bin/env node
// light/tools/barrier.mjs — the three language-barrier claims B1–B3, measured. They were sealed in light/claims.json
// (commit ac90c1e) with their corpus light/barrier.json, before the codec, the door or any measuring code existed; this
// tool came later and refuses to run if either file differs from the commit that sealed it.
//
// What it does, and all it does: our own door (light/packet.mjs) is handed the sealed corpus of classic, publicly
// documented test inputs, on this machine, with keys made here by Node's own Ed25519. Nothing is sent anywhere.
//   B1  each input as raw bytes at a door that pins EVERY sender id → refused before decode, each with a named stage
//   B2  a well-formed LIGHT packet from someone who knows the format but not the key → refused at sender or signature
//   B3  each input carried as the data of a correctly signed packet → it decodes back exactly (LIGHT does not change
//       data; making it safe is the job of the edge that shows or runs it — B4, the page's own gate)
//
//   node light/tools/barrier.mjs           measure, judge (light/judge.mjs), write light/data/barrier-run.json
//   node light/tools/barrier.mjs --check   measure again; exit 1 unless the facts and verdicts equal the committed receipt
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateKeyPairSync, sign as edSign, verify as edVerify } from 'node:crypto';
import { open, seal, KINDS } from '../packet.mjs';
import { sha256, hex } from '../sha256.mjs';
import { judge } from '../judge.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..', '..');
const RECEIPT = join(HERE, '..', 'data', 'barrier-run.json');
const checking = process.argv.includes('--check');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const te = new TextEncoder();

// the seals: both files exactly as committed when they were sealed
function sealed(path) {
  const text = readFileSync(join(ROOT, path), 'utf8');
  const commit = git('log', '-1', '--format=%H', '--', path).trim();
  if (!commit || git('show', commit + ':' + path) !== text) throw new Error(path + ' differs from the commit that sealed it — refusing to measure');
  return { path, commit, sha256: hex(sha256(te.encode(text))), parsed: JSON.parse(text) };
}
const seals = [sealed('light/claims.json'), sealed('light/barrier.json')];
const claims = { claims: seals[0].parsed.claims.filter((c) => ['B1', 'B2', 'B3'].includes(c.id)) };
const entries = seals[1].parsed.entries;

// keys made here; the door pins `pinned` for every sender id, so the only thing between a byte and the decoder is the door
const pinned = generateKeyPairSync('ed25519'), stranger = generateKeyPairSync('ed25519');
const signer = (k) => (m) => new Uint8Array(edSign(null, m, k.privateKey));
const verify = (m, s, key) => { try { return edVerify(null, m, key, s); } catch { return false; } };
const ctx = { keyFor: () => pinned.publicKey, verify, lastCounter: () => 0n };

// B1 — raw bytes at the door
const b1 = { sent: 0, admitted: 0, decoded: 0, named: 0, stages: {} };
for (const e of entries) {
  const r = open(te.encode(e.text), ctx);
  b1.sent++;
  if (r.admit) b1.admitted++;
  if (r.decoded) b1.decoded++;
  if (!r.admit && typeof r.stage === 'string' && typeof r.reason === 'string' && r.reason.length > 0) { b1.named++; b1.stages[r.stage] = (b1.stages[r.stage] || 0) + 1; }
}

// B2 — the format without the key. The same message four ways; only the last line of defence differs.
const msg = { kind: 'antibody', family: 'forgery', print: 'abc123' };
const good = seal({ sender: 1, counter: 1n, kind: KINDS.JSON, value: msg, dictId: 0 }, signer(pinned)).bytes;
const forged = seal({ sender: 1, counter: 1n, kind: KINDS.JSON, value: msg, dictId: 0 }, signer(stranger)).bytes;
const zeroed = good.slice(); zeroed.fill(0, zeroed.length - 64);
const flipped = good.slice(); flipped[25] ^= 1;                                    // byte 25 is inside the body (it starts at 23)
const onlyOne = { ...ctx, keyFor: (s) => (s === 2 ? pinned.publicKey : null) };    // sender 1 is not pinned at this door
const control = open(good, ctx);
if (!control.admit) throw new Error('the control packet was refused (' + control.stage + ') — the measurement is broken, not the door');
const b2 = [
  ['sender not pinned', open(good, onlyOne)],
  ["a stranger's key", open(forged, ctx)],
  ['signature zeroed', open(zeroed, ctx)],
  ['one body byte flipped', open(flipped, ctx)],
].map(([c, r]) => ({ case: c, admit: r.admit === true, decoded: r.decoded === true, stage: r.stage }));

// B3 — each input as the data of a correctly signed packet, decoded and compared byte for byte
const b3 = { sent: 0, exact: 0 };
let counter = 0n;
for (const e of entries) {
  const bytes = te.encode(e.text);
  counter++;
  const p = seal({ sender: 1, counter, kind: KINDS.BYTES, bytes, dictId: 0 }, signer(pinned));
  const r = p.ok ? open(p.bytes, { ...ctx, lastCounter: () => counter - 1n }) : { admit: false };
  b3.sent++;
  if (r.admit && r.bytes instanceof Uint8Array && r.bytes.length === bytes.length && r.bytes.every((x, i) => x === bytes[i])) b3.exact++;
}

const facts = { barrier: { ran: true, corpus: entries.length, b1, b2, b3 } };
const verdict = judge(claims, facts);
for (const v of verdict.verdicts) console.log((v.held === true ? '  HELD    ' : v.held === null ? '  (unmeasured) ' : '  FAILED  ') + v.id + ' — ' + v.measured);

if (checking) {
  if (!existsSync(RECEIPT)) { console.log('no light/data/barrier-run.json committed yet'); process.exit(1); }
  const was = JSON.parse(readFileSync(RECEIPT, 'utf8'));
  const same = JSON.stringify(was.facts) === JSON.stringify(facts) && JSON.stringify(was.verdicts) === JSON.stringify(verdict.verdicts);
  console.log(same ? 'BARRIER CHECK CLEAN — measured again here, the committed receipt stands' : 'BARRIER CHECK FAILED — measured again here, the result differs from light/data/barrier-run.json');
  process.exit(same ? 0 : 1);
}
const receipt = { kind: 'konomi-tongue.light.barrier-receipt', v: 1, ran: new Date().toISOString(), node: process.version,
  sealed: seals.map(({ parsed, ...s }) => s), facts, verdicts: verdict.verdicts, held: verdict.held, failed: verdict.failed, unmeasured: verdict.unmeasured };
writeFileSync(RECEIPT, JSON.stringify(receipt, null, 1) + '\n');
console.log(verdict.held + ' held, ' + verdict.failed + ' failed — wrote light/data/barrier-run.json');
