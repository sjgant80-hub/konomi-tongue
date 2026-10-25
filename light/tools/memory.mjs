#!/usr/bin/env node
// light/tools/memory.mjs — Kar's memory, kept in LIGHT. Every file of the memory directory is packed into one LIGHT
// vault with dictionary v1 (light/vault.mjs), the vault is unpacked into a fresh folder, and every file is compared
// byte for byte with the original. The markdown files themselves stay where they are: they are the EDGE the harness
// reads at every session start, and LIGHT translates only at edges. The vault is private (it never leaves this
// machine); only its totals are printed or published.
//
//   node light/tools/memory.mjs            pack, unpack, compare; write the vault; print the totals as JSON
//   node light/tools/memory.mjs --check    compare the existing vault with the files as they are now (is it current?)
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { prime } from '../codec.mjs';
import { pack, unpack } from '../vault.mjs';
import { dictIdOf } from '../packet.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const MEMORY = process.env.KAR_MEMORY || join(homedir(), '.claude', 'projects', 'C--Users-sjgan--claude', 'memory');
export const VAULT = process.env.KAR_MEMORY_VAULT || join(homedir(), '.light-vault', 'memory.light');
const dict = new Uint8Array(readFileSync(join(HERE, '..', 'dict', 'v1.txt')));
const ID = dictIdOf(dict);
let primed = null;
const model = () => (primed || (primed = prime(dict)));

/** every regular file under `root`, as { path (relative, forward slashes), bytes }, in sorted order */
export function readTree(root) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name), st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (st.isFile()) out.push({ path: relative(root, full).split('\\').join('/'), bytes: new Uint8Array(readFileSync(full)) });
    }
  };
  walk(root);
  return out;
}
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

export function packMemory(root = MEMORY) {
  const files = readTree(root);
  const t0 = performance.now(), v = pack(files, { dictId: ID, primed: model() }), packMs = performance.now() - t0;
  if (!v.ok) return { ok: false, why: v.why };
  // unpack into a FRESH folder and compare every file there, so the proof reads back from disk, not from memory
  const t1 = performance.now(), u = unpack(v.bytes, (id) => (id === ID ? model() : null)), unpackMs = performance.now() - t1;
  if (!u.ok) return { ok: false, why: 'the vault does not unpack: ' + u.why };
  const fresh = mkdtempSync(join(tmpdir(), 'light-memory-'));
  try {
    for (const e of u.entries) { const p = join(fresh, ...e.path.split('/')); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, e.bytes); }
    const back = readTree(fresh);
    const byPath = new Map(back.map((f) => [f.path, f.bytes]));
    const mismatched = files.filter((f) => !byPath.has(f.path) || !same(byPath.get(f.path), f.bytes)).map((f) => f.path);
    const extra = back.filter((f) => !files.some((g) => g.path === f.path)).map((f) => f.path);
    const bytes = files.reduce((s, f) => s + f.bytes.length, 0);
    return { ok: true, vault: v.bytes, files: files.length, bytes, vaultBytes: v.bytes.length, ratio: Math.round((bytes / v.bytes.length) * 1000) / 1000,
      identical: mismatched.length === 0 && extra.length === 0, mismatched: mismatched.length, extra: extra.length, packMs: Math.round(packMs), unpackMs: Math.round(unpackMs), dictId: ID };
  } finally { rmSync(fresh, { recursive: true, force: true }); }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).replace(/\\/g, '/') === process.argv[1].replace(/\\/g, '/');
if (isMain) {
  if (process.argv.includes('--check')) {
    if (!existsSync(VAULT)) { console.log(JSON.stringify({ ok: false, why: 'no vault yet' })); process.exit(1); }
    const u = unpack(new Uint8Array(readFileSync(VAULT)), (id) => (id === ID ? model() : null));
    if (!u.ok) { console.log(JSON.stringify({ ok: false, why: u.why })); process.exit(1); }
    const now = readTree(MEMORY), held = new Map(u.entries.map((e) => [e.path, e.bytes]));
    const stale = now.filter((f) => !held.has(f.path) || !same(held.get(f.path), f.bytes)).length + u.entries.filter((e) => !now.some((f) => f.path === e.path)).length;
    console.log(JSON.stringify({ ok: true, current: stale === 0, stale, files: now.length, held: u.entries.length }));
    process.exit(stale === 0 ? 0 : 2);
  }
  const r = packMemory();
  if (!r.ok) { console.log(JSON.stringify(r)); process.exit(1); }
  mkdirSync(dirname(VAULT), { recursive: true });
  writeFileSync(VAULT, r.vault);
  const { vault, ...totals } = r;
  console.log(JSON.stringify(totals));
  process.exit(r.identical ? 0 : 1);
}
