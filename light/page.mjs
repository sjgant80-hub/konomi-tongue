// light/page.mjs — the live page's engine. Every byte here runs the repository's own kernels: codec.mjs, packet.mjs and
// cost.mjs — the same files CI gates. The browser adds only Ed25519 (WebCrypto, keys made in this tab).
// Nothing leaves the tab: the only fetches are for this site's own files, and the page's policy allows no other.
// The page is an edge, so it decodes LIGHT only through the door (claim E1): this file imports no decoder at all, and
// every body it reads back is a signed packet that open() admitted — size, magic, version, length, dictionary, sender,
// signature and counter checked on the raw bytes first.
import { encode, prime } from './codec.mjs';
import { open, frame, prepare, finish, KINDS } from './packet.mjs';
import { dictIdOf } from './packet.mjs';
import { lightCase, measuredOf, sourcesOf } from './cost.mjs';

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

// ── the door, as this tab runs it ─────────────────────────────────────────────────────────────────────────────
// Two Ed25519 keys made in this tab: A is pinned as sender 1, B is a stranger's. WebCrypto verifies asynchronously and
// open() wants a synchronous verify, so frame() checks the first stages on the raw bytes, the signature is verified for
// the pinned key, and open() then runs every stage again in order with that answer — the decoder still runs only inside
// open(), after the last check. Each door remembers the last counter it admitted from each sender, as a real one must.
let keysP = null;
const keys = () => (keysP ||= Promise.all([1, 2].map(() => crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']))).then(([A, B]) => ({ A, B })));
const verifyEd = async (m, sig, key) => { try { return await crypto.subtle.verify('Ed25519', key, sig, m); } catch { return false; } };
function door(pinned) {
  const last = new Map();
  const ctx = { keyFor: (s) => (s === 1 ? pinned : null), dictFor: (id) => (id === ID ? primed : null), lastCounter: (s) => last.get(s) || 0n };
  return async (bytes) => {
    const f = frame(bytes, ctx);
    let ok = false;
    if (f.ok) { const key = ctx.keyFor(f.sender); if (key) ok = await verifyEd(f.signed, f.sig, key); }
    const r = open(bytes, { ...ctx, verify: () => ok });
    if (r.admit) last.set(r.sender, r.counter);
    return r;
  };
}
/** a signed LIGHT packet from sender 1 ({ counter, kind, bytes | value, dictId }) signed with privateKey; null if it cannot be made */
async function packet(privateKey, p) {
  const q = prepare({ sender: 1, dictId: 0, ...p, primed: p.dictId ? primed : undefined });
  if (!q.ok) return null;
  return finish(q.unsigned, new Uint8Array(await crypto.subtle.sign('Ed25519', privateKey, q.signed))).bytes;
}
const same = (a, b) => a instanceof Uint8Array && a.length === b.length && a.every((x, i) => x === b[i]);

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
// The sizes are the codec's own output for the text; the round-trip is read back the only way this page reads LIGHT:
// each coded form sent as a signed packet (no dictionary, then the sample dictionary) and admitted by a door.
let tries = 0;
async function compress() {
  const run = ++tries;
  const bytes = te.encode($('in').value);
  const plain = encode(bytes), dict = encode(bytes, primed);
  let rt = null;
  try {
    const { A } = await keys(), d = door(A.publicKey);
    const pa = await packet(A.privateKey, { counter: 1n, kind: KINDS.BYTES, bytes }), pb = await packet(A.privateKey, { counter: 2n, kind: KINDS.BYTES, bytes, dictId: ID });
    if (!pa || !pb) rt = 'big';   // more than one packet holds (1 MiB): the door would refuse it at size, so it is not sent
    else { const a = await d(pa), b = await d(pb); rt = a.admit && b.admit && same(a.bytes, bytes) && same(b.bytes, bytes); }
  } catch { rt = null; }
  if (run !== tries) return;   // a newer keystroke has already replaced this one
  const ok = rt === true;
  $('c-in').textContent = n0(bytes.length) + ' B';
  $('c-plain').textContent = n0(plain.bytes.length) + ' B · ' + (bytes.length / plain.bytes.length).toFixed(2) + '×';
  $('c-dict').textContent = n0(dict.bytes.length) + ' B · ' + (bytes.length / dict.bytes.length).toFixed(2) + '×';
  const gz = await viaStream(bytes, 'gzip'), br = await viaStream(bytes, 'deflate-raw');
  $('c-std').textContent = (gz ? n0(gz) + ' B gzip' : 'gzip n/a') + ' · ' + (br ? n0(br) + ' B deflate' : 'deflate n/a');
  $('c-rt').innerHTML = ok ? '<span class="ok">exact, both ways, through the door ✓</span>' : rt === null ? '<span class="dim">needs WebCrypto Ed25519 to read it back through the door</span>' : rt === 'big' ? '<span class="dim">more than one packet holds (1 MiB), so it is not sent through the door</span>' : '<span class="no">ROUND-TRIP FAILED</span>';
}
$('in').addEventListener('input', compress);

// ── the signed door ───────────────────────────────────────────────────────────────────────────────────────────
async function doorDemo() {
  try {
    const { A, B } = await keys();
    const msg = { kind: 'antibody', family: 'forgery', print: 'abc123' };
    // the same message, counter 1, signed by the pinned key and by a stranger's; then the good one with a body byte changed
    const good = await packet(A.privateKey, { counter: 1n, kind: KINDS.JSON, value: msg });
    const forged = await packet(B.privateKey, { counter: 1n, kind: KINDS.JSON, value: msg });
    const tampered = good.slice(); tampered[25] ^= 1;
    // each through a fresh door, so a refusal is the stage's verdict and never the replay counter's
    const rForge = await door(A.publicKey)(forged), rTamper = await door(A.publicKey)(tampered), rGood = await door(A.publicKey)(good);
    const refused = (r) => (r.admit ? '<span class="no">ADMITTED — the door failed</span>' : '<span class="ok">refused at ' + esc(r.stage) + ' ✓</span>');
    $('d-ok').innerHTML = rGood.admit ? '<span class="ok">admitted ✓ · ' + esc(JSON.stringify(rGood.value).slice(0, 30)) + '…</span>' : '<span class="no">refused: ' + esc(rGood.reason) + '</span>';
    $('d-forge').innerHTML = refused(rForge);
    $('d-tamper').innerHTML = refused(rTamper);
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
  // at the edge (B3, B4): carry each as the data of a correctly signed packet, counters 1, 2, 3 … to one door that
  // remembers them, read it back only through the door, then render what came out as text through the page's sink
  const list = $('ba-list');
  let rt = 0, exec = 0, viaDoor = true, k = null, d = null, n = 0n;
  try { k = await keys(); d = door(k.A.publicKey); } catch { viaDoor = false; }
  for (const e of entries) {
    const bytes = te.encode(e.text);
    let r = null;
    if (viaDoor) { try { r = await d(await packet(k.A.privateKey, { counter: ++n, kind: KINDS.BYTES, bytes })); } catch { r = null; } }
    const back = r && r.admit ? r.bytes : null;
    if (same(back, bytes)) rt++;
    const row = document.createElement('div');
    const label = document.createElement('span'); label.className = 'lang'; label.textContent = e.lang + ': ';
    const shown = document.createElement('span');
    shown.textContent = new TextDecoder().decode(back || bytes);   // the SINK: textContent, never innerHTML
    row.append(label, shown);
    list.appendChild(row);
    // did showing it create any element or handler? (it must not — textContent cannot)
    if (shown.children.length > 0 || /<[a-z]/i.test(shown.innerHTML) !== /<[a-z]/i.test(esc(e.text))) exec++;
  }
  $('ba-rt').innerHTML = !viaDoor ? '<span class="dim">needs WebCrypto Ed25519</span>' : rt === entries.length ? '<span class="ok">' + rt + '/' + entries.length + ' ✓</span>' : '<span class="no">' + rt + '/' + entries.length + '</span>';
  $('ba-exec').innerHTML = exec === 0 ? '<span class="ok">0 ✓</span>' : '<span class="no">' + exec + '</span>';
}

// ── the receipts, from the committed runs ─────────────────────────────────────────────────────────────────────
const getJson = async (u) => { try { const r = await fetch(u); return r.ok ? await r.json() : null; } catch { return null; } };
const tag = (held) => (held === true ? '<span class="tag held">HELD</span>' : held === false ? '<span class="tag failed">FAILED</span>' : '<span class="tag na">n/a</span>');
async function receipts() {
  const [r, b, w] = await Promise.all([getJson('./data/light-run.json'), getJson('./data/barrier-run.json'), getJson('./data/witness.json')]);
  if (!r || !Array.isArray(r.verdicts)) { $('r-rows').innerHTML = '<tr><td class="dim" colspan="4">the receipt (light/data/light-run.json) did not load.</td></tr>'; return { run: null }; }
  // the barrier claims come from their own receipt; G1 (the mutation gate) from the CI-checked witness receipt
  const fromBarrier = new Map((b && Array.isArray(b.verdicts) ? b.verdicts : []).map((v) => [v.id, v]));
  const rows = r.verdicts.map((v) => (fromBarrier.has(v.id) ? { ...fromBarrier.get(v.id), src: 'barrier-run.json' } : { ...v, src: 'light-run.json' }));
  const gate = w && Array.isArray(w.kernels) ? w : null;
  const held = rows.filter((v) => v.held === true).length, failed = rows.filter((v) => v.held === false).length, na = rows.filter((v) => v.held === null);
  $('r-sum').textContent = held + ' of ' + rows.length + ' claims held, ' + failed + ' failed (kept below), ' + na.length + ' not measured in a receipt (' + na.map((v) => v.id).join(', ') + ')'
    + (gate && na.some((v) => v.id === 'G1') ? ' — G1 is the mutation gate itself, which CI runs on every push: ' + n0(gate.killed) + ' of ' + n0(gate.total) + ' mutants killed, the rest reviewed.' : '.');
  $('r-rows').innerHTML = rows.map((v) => '<tr><td><span class="mono">' + esc(v.id) + '</span> ' + esc(v.claim || '') + '</td><td>' + tag(v.held) + '</td><td class="mono">' + esc(v.measured)
    + (v.id === 'G1' && gate ? ' · on GitHub’s runner: ' + esc(gate.killed + '/' + gate.total + (gate.clean ? ', clean' : ', NOT clean')) : '') + ' <span class="dim">(' + esc(v.src) + ')</span></td><td class="dim">' + esc(v.predicted || '') + '</td></tr>').join('');
  const c = r.facts && r.facts.codec;
  if (c) {
    $('h-ratio').textContent = (Math.round(c.medianRatioJson * 10) / 10) + '×';
    $('h-lossless').textContent = c.lossless === 0 ? 'lossless' : c.lossless + ' failed';
    $('h-small').textContent = c.smallLightBeatsBrotliGzip + ' of ' + c.smallItems;
  }
  $('r-foot').textContent = 'Main receipt run ' + (r.ran || '').replace('T', ' ').slice(0, 16) + ' UTC · Node ' + r.node + ' · dictionary ' + n0((r.facts && r.facts.dictBytes) || 0) + ' B · ' + ((r.facts && r.facts.heldOut) || 0) + ' held-out files. Re-run: node light/tools/measure.mjs (needs the estate clones) · node light/tools/check.mjs (anywhere).'
    + (b ? ' Barrier receipt run ' + (b.ran || '').replace('T', ' ').slice(0, 16) + ' UTC · re-run: node light/tools/barrier.mjs --check.' : '');
  if (gate) {
    for (const k of gate.kernels) { const td = document.querySelector('[data-k="' + k.name + '"]'); if (td) td.textContent = k.killed + ' / ' + k.total + (k.ignored ? ' · ' + k.ignored + ' reviewed' : ''); }
    $('bp-foot').textContent = (gate.clean ? 'CLEAN: ' : 'NOT CLEAN: ') + n0(gate.killed) + ' of ' + n0(gate.total) + ' mutants killed; the other ' + n0(gate.total - gate.killed) + ' reviewed-equivalent, each with a written reason. GitHub’s runner re-derives these counts on every push.';
  }
  return { run: r };
}

// ── the cost case: the gated kernel, the sourced basis, the receipt, the reader's own numbers ────────────────────
const gbp = (x) => '£' + Number(x).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const gb = (x) => Number(x).toLocaleString('en-GB', { maximumFractionDigits: 2 }) + ' GB';
const USED = { electricityPencePerKwh: 'the price of each kWh the coding uses', laptopExtraWatts: 'the extra draw while one core codes, on a machine you own', cpi: 'the rise in every price for each year after the first' };
async function costCase(run) {
  const basis = await getJson('./vendor/sovereign-enterprise/data/basis.json');
  const m = measuredOf(run);
  if (!basis || !m) { $('cc-verdict').textContent = 'The sourced basis or the receipt did not load, so nothing is computed (and nothing is guessed).'; $('cc-rows').innerHTML = ''; return; }
  const src = $('cc-sources'); src.textContent = '';
  for (const s of sourcesOf(basis)) {
    const li = document.createElement('li'), a = document.createElement('a');
    li.textContent = s.key + ' = ' + s.value + ' — ' + (s.what || '') + ' — used here as ' + (USED[s.key] || 'an input') + ' — ';
    a.textContent = 'source'; if (/^https:\/\//.test(String(s.source))) a.href = s.source; a.rel = 'noreferrer';
    li.appendChild(a); src.appendChild(li);
  }
  const li = document.createElement('li');
  li.textContent = 'LIGHT, from light/data/light-run.json: median ratio ' + m.ratio + '× over ' + m.heldFiles + ' held-out files; LIGHT ÷ Brotli 11 on their totals ' + m.lightVsBrotli.toFixed(4) + '; raw ÷ Brotli ' + m.rawVsBrotli.toFixed(3) + '; one-thread speed ' + m.mbpsEncode + ' MB/s encode, ' + m.mbpsDecode + ' MB/s decode.';
  src.appendChild(li);
  const li2 = document.createElement('li'); li2.textContent = 'Everything else in the calculator is yours: what you keep, what you send, what you pay.'; src.appendChild(li2);
  const num = (id) => { const v = $(id).value.trim(); return v === '' ? NaN : Number(v); };
  const run1 = () => {
    const input = { storedGb: num('cc-stored'), movedGbPerMonth: num('cc-moved'), pricePerGbMonth: num('cc-pstore'), pricePerGbMoved: num('cc-pmove'), pricePerCoreHour: num('cc-pcpu'), years: num('cc-years'), compressedToday: $('cc-comp').value === 'yes' };
    const r = lightCase(basis, m, input);
    if (!r.ok) { $('cc-verdict').textContent = 'Check the inputs: ' + r.why + '.'; $('cc-rows').innerHTML = ''; return; }
    const priced = input.pricePerGbMonth > 0 || input.pricePerGbMoved > 0 || input.pricePerCoreHour > 0;
    const yrs = r.inputs.years + ' year' + (r.inputs.years === 1 ? '' : 's');
    $('cc-verdict').textContent = !priced
      ? 'With no prices typed, only the bytes and the CPU change: ' + gb(r.gb.storedSaved) + ' less to keep, ' + gb(r.gb.movedSavedPerMonth) + ' a month less to send, for ' + n0(r.cpu.coreHoursPerYear) + ' core-hours a year of coding. Type what you pay per GB to see money.'
      : r.savingPerYear > 0 ? 'On your figures LIGHT saves ' + gbp(r.savingPerYear) + ' a year, ' + gbp(r.savingOver) + ' over ' + yrs + ', after ' + (r.cpu.rented ? 'the CPU it uses at your core-hour price.' : 'the electricity it uses.')
        : 'On your figures LIGHT costs ' + gbp(-r.savingPerYear) + ' a year more than it saves — adopt it for the signed door and the checked stores, not the bill.';
    const row = (k, a, b2) => '<tr><td>' + esc(k) + '</td><td class="n">' + esc(a) + '</td><td class="n">' + esc(b2) + '</td></tr>';
    $('cc-rows').innerHTML = [
      row('data kept', gb(r.inputs.storedGb), gb(r.gb.storedLight)),
      row('data sent a month', gb(r.inputs.movedGbPerMonth), gb(r.gb.movedLightPerMonth)),
      row('keeping it, a year', gbp(r.lines.storage.today), gbp(r.lines.storage.light)),
      row('sending it, a year', gbp(r.lines.transfer.today), gbp(r.lines.transfer.light)),
      row('CPU to code what is sent, a year', '—', n0(r.cpu.coreHoursPerYear) + ' core-hours · ' + gbp(r.lines.cpuPerYear) + (r.cpu.rented ? ' rented' : ' of electricity')),
      row('CPU to convert the store, once', '—', n0(r.cpu.coreHoursOnce) + ' core-hours · ' + gbp(r.lines.cpuOnce) + (r.cpu.rented ? ' rented' : ' of electricity')),
      row('a year, all in', gbp(r.perYear.today), gbp(r.perYear.light)),
      row('over ' + yrs + ' (CPI each later year)', gbp(r.over.today), gbp(r.over.light)),
    ].join('');
  };
  for (const id of ['cc-stored', 'cc-moved', 'cc-pstore', 'cc-pmove', 'cc-pcpu', 'cc-years']) $(id).addEventListener('input', run1);
  $('cc-comp').addEventListener('change', run1);
  run1();
}

(async function boot() {
  try { encode(te.encode('x')); $('kstat').textContent = 'kernel live in this tab'; $('kstat').className = 'pill live'; }
  catch { $('kstat').textContent = 'the kernel failed to load'; $('kstat').className = 'pill bad'; }
  await compress();
  receipts().then(({ run }) => costCase(run));
  barrier();
  if (crypto && crypto.subtle) doorDemo(); else for (const id of ['d-ok', 'd-forge', 'd-tamper', 'd-decoded']) $(id).textContent = 'needs WebCrypto';
})();
