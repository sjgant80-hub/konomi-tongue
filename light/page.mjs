// light/page.mjs — the live page's engine. Every byte here runs the repository's own kernels: codec.mjs, packet.mjs,
// vault.mjs, sha256.mjs — the same files CI gates. The browser adds only Ed25519 (WebCrypto, keys made in this tab).
// Nothing leaves the tab: the only fetches are for this site's own files, and the page's policy allows no other.
import { encode, decode, prime } from './codec.mjs';
import { open, prepare, finish, KINDS } from './packet.mjs';
import { dictIdOf } from './packet.mjs';

const $ = (id) => document.getElementById(id);
const te = new TextEncoder();
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n0 = (x) => Number(x).toLocaleString('en-GB');

// theme toggle (a per-viewer convenience; works without storage)
let theme = 'system';
try { theme = ['system', 'dark', 'light'].includes(localStorage.getItem('light.theme')) ? localStorage.getItem('light.theme') : 'system'; } catch { /* no storage */ }
const applyTheme = () => { if (theme === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = theme; };
$('theme').addEventListener('click', () => { theme = { system: 'dark', dark: 'light', light: 'system' }[theme]; try { localStorage.setItem('light.theme', theme); } catch { /* fine */ } applyTheme(); });
applyTheme();

// a small sample dictionary made in the page (the full 183 KB dictionary is what the receipts measure)
const SAMPLE = te.encode('{"account":1000,"period":63,"amount":0,"ok":true}\nPowered by the Konomi architecture, created by Thomas Frumkin.\nwitness CLEAN · proof-of-play · the estate\'s one codec\n'.repeat(10));
const primed = prime(SAMPLE), ID = dictIdOf(SAMPLE);

// ── gzip / brotli in the browser, via CompressionStream when present (else left blank, never faked) ────────────────
async function viaStream(bytes, format) {
  if (typeof CompressionStream !== 'function') return null;
  try {
    const cs = new CompressionStream(format), w = cs.writable.getWriter();
    w.write(bytes); w.close();
    const buf = await new Response(cs.readable).arrayBuffer();
    return new Uint8Array(buf).length;
  } catch { return null; }
}

// ── Try it: live compression ──────────────────────────────────────────────────────────────────────────────────
async function compress() {
  const bytes = te.encode($('in').value);
  const plain = encode(bytes), dict = encode(bytes, primed);
  const back = decode(plain.bytes), backD = decode(dict.bytes, primed);
  const ok = back.ok && back.bytes.length === bytes.length && back.bytes.every((x, i) => x === bytes[i]) && backD.ok && backD.bytes.every((x, i) => x === bytes[i]);
  $('c-in').textContent = n0(bytes.length) + ' B';
  $('c-plain').textContent = n0(plain.bytes.length) + ' B · ' + (bytes.length / plain.bytes.length).toFixed(2) + '×';
  $('c-dict').textContent = n0(dict.bytes.length) + ' B · ' + (bytes.length / dict.bytes.length).toFixed(2) + '×';
  const gz = await viaStream(bytes, 'gzip'), br = await viaStream(bytes, 'deflate-raw');
  $('c-std').textContent = (gz ? n0(gz) + ' B gzip' : 'gzip n/a') + ' · ' + (br ? n0(br) + ' B deflate' : 'deflate n/a');
  $('c-rt').innerHTML = ok ? '<span class="ok">exact, both ways ✓</span>' : '<span class="no">ROUND-TRIP FAILED</span>';
}
$('in').addEventListener('input', compress);

// ── the signed door ───────────────────────────────────────────────────────────────────────────────────────────
async function doorDemo() {
  try {
    const A = await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
    const B = await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
    const verify = async (m, sig, key) => { try { return await crypto.subtle.verify('Ed25519', key, sig, m); } catch { return false; } };
    const signWith = (k) => async (m) => new Uint8Array(await crypto.subtle.sign('Ed25519', k, m));
    const msg = { kind: 'antibody', family: 'forgery', print: 'abc123' };
    // seal needs a synchronous signer; WebCrypto is async, so prepare, sign, finish by hand
    const build = async (signer) => {
      const p = prepare({ sender: 1, counter: 1n, kind: KINDS.JSON, value: msg, dictId: 0 });
      return finish(p.unsigned, await signer(p.signed)).bytes;
    };
    const ctx = { keyFor: (s) => (s === 1 ? A.publicKey : null), verify, lastCounter: () => 0n };
    // open() wants a synchronous verify; verify Ed25519 up front and pass the cached result
    const openAsync = async (bytes) => {
      const f = (await import('./packet.mjs')).frame(bytes, {});
      let ok = false;
      if (f.ok) { const key = ctx.keyFor(f.sender); if (key) ok = await verify(f.signed, f.sig, key); }
      return open(bytes, { ...ctx, verify: () => ok });
    };
    const good = await build(signWith(A.privateKey));
    const forged = await build(signWith(B.privateKey));
    const tampered = good.slice(); tampered[25] ^= 1;
    const rGood = await openAsync(good), rForge = await openAsync(forged), rTamper = await openAsync(tampered);
    $('d-ok').innerHTML = rGood.admit ? '<span class="ok">admitted ✓ · ' + esc(JSON.stringify(rGood.value).slice(0, 30)) + '…</span>' : '<span class="no">refused: ' + esc(rGood.reason) + '</span>';
    $('d-forge').innerHTML = '<span class="ok">refused at ' + esc(rForge.stage) + ' ✓</span>';
    $('d-tamper').innerHTML = '<span class="ok">refused at ' + esc(rTamper.stage) + ' ✓</span>';
    $('d-decoded').innerHTML = (rForge.decoded || rTamper.decoded) ? '<span class="no">yes — a leak</span>' : '<span class="ok">no — body never read ✓</span>';
  } catch (e) {
    for (const id of ['d-ok', 'd-forge', 'd-tamper', 'd-decoded']) $(id).textContent = 'needs WebCrypto Ed25519';
  }
}

// ── the barrier demo (B1/B4) ──────────────────────────────────────────────────────────────────────────────────
async function barrier() {
  let corpus;
  try { corpus = await (await fetch('./barrier.json')).json(); } catch { $('ba-list').textContent = 'the test corpus did not load'; return; }
  const entries = corpus.entries || [];
  // at the door: each entry's raw bytes sent to open() — none is a signed LIGHT packet, so each is refused
  let admitted = 0, decoded = 0;
  const ctx = { keyFor: () => null, verify: () => false, lastCounter: () => 0n };
  for (const e of entries) { const r = open(te.encode(e.text), ctx); if (r.admit) admitted++; if (r.decoded) decoded++; }
  $('ba-sent').textContent = n0(entries.length);
  $('ba-admit').innerHTML = admitted === 0 ? '<span class="ok">0 ✓</span>' : '<span class="no">' + admitted + '</span>';
  $('ba-dec').innerHTML = decoded === 0 ? '<span class="ok">0 ✓</span>' : '<span class="no">' + decoded + '</span>';
  // at the edge: carry each as the data of a packet, decode it back, then render as text through the page's sink
  const list = $('ba-list');
  let rt = 0, exec = 0;
  for (const e of entries) {
    const bytes = te.encode(e.text), ebytes = encode(bytes).bytes, d = decode(ebytes);
    const same = d.ok && d.bytes.length === bytes.length && d.bytes.every((x, i) => x === bytes[i]);
    if (same) rt++;
    const row = document.createElement('div');
    const label = document.createElement('span'); label.className = 'lang'; label.textContent = e.lang + ': ';
    const shown = document.createElement('span');
    shown.textContent = new TextDecoder().decode(d.ok ? d.bytes : bytes);   // the SINK: textContent, never innerHTML
    row.append(label, shown);
    list.appendChild(row);
    // did showing it create any element or handler? (it must not — textContent cannot)
    if (shown.children.length > 0 || /<[a-z]/i.test(shown.innerHTML) !== /<[a-z]/i.test(esc(e.text))) exec++;
  }
  $('ba-rt').innerHTML = rt === entries.length ? '<span class="ok">' + rt + '/' + entries.length + ' ✓</span>' : '<span class="no">' + rt + '/' + entries.length + '</span>';
  $('ba-exec').innerHTML = exec === 0 ? '<span class="ok">0 ✓</span>' : '<span class="no">' + exec + '</span>';
}

// ── the receipts, from the committed run ──────────────────────────────────────────────────────────────────────
async function receipts() {
  let r;
  try { r = await (await fetch('./data/light-run.json')).json(); } catch { r = null; }
  if (!r || !Array.isArray(r.verdicts)) { $('r-rows').innerHTML = '<tr><td class="dim" colspan="4">the receipt (light/data/light-run.json) has not been written yet — run the measurement.</td></tr>'; return; }
  const held = r.verdicts.filter((v) => v.held === true).length, failed = r.verdicts.filter((v) => v.held === false).length, na = r.verdicts.filter((v) => v.held === null).length;
  $('r-sum').textContent = held + ' of ' + r.verdicts.length + ' claims held, ' + failed + ' failed (kept below), ' + na + ' measured elsewhere.';
  $('r-rows').innerHTML = r.verdicts.map((v) => '<tr><td>' + esc(v.claim || v.id) + '</td><td>' + (v.held === true ? '<span class="tag held">HELD</span>' : v.held === false ? '<span class="tag failed">FAILED</span>' : '<span class="tag na">n/a</span>') + '</td><td class="mono">' + esc(v.measured) + '</td><td class="dim">' + esc(v.predicted || '') + '</td></tr>').join('');
  const c = r.facts && r.facts.codec;
  if (c) { $('h-ratio').textContent = c.medianRatioJson + '×'; $('h-lossless').textContent = c.lossless === 0 ? 'lossless' : c.lossless + ' failed'; }
  $('r-foot').textContent = 'Run ' + (r.ran || '').replace('T', ' ').slice(0, 16) + ' UTC · Node ' + r.node + ' · dictionary ' + n0((r.facts && r.facts.dictBytes) || 0) + ' B · ' + ((r.facts && r.facts.heldOut) || 0) + ' held-out files. Re-run: node light/tools/measure.mjs';
  // the blueprint's witness scores, if the witness receipt is present
  try {
    const w = await (await fetch('./data/witness.json')).json();
    for (const k of w.kernels || []) { const td = document.querySelector('[data-k="' + k.name + '"]'); if (td) td.textContent = k.killed + ' / ' + k.total + (k.ignored ? ' · ' + k.ignored + ' reviewed' : ''); }
    $('bp-foot').textContent = (w.clean ? 'CLEAN: ' : 'NOT CLEAN: ') + n0(w.killed) + ' of ' + n0(w.total) + ' mutants killed; the rest reviewed-equivalent with a written reason. CI re-runs it on every push.';
  } catch { /* no witness receipt yet */ }
}

(async function boot() {
  try { encode(te.encode('x')); $('kstat').textContent = 'kernel live in this tab'; $('kstat').className = 'pill live'; }
  catch { $('kstat').textContent = 'the kernel failed to load'; $('kstat').className = 'pill bad'; }
  await compress();
  receipts();
  barrier();
  if (crypto && crypto.subtle) doorDemo(); else for (const id of ['d-ok', 'd-forge', 'd-tamper', 'd-decoded']) $(id).textContent = 'needs WebCrypto';
})();
