// layered/test/fixtures.mjs — the kernel's test material, made here from fixed rules (no file, no held item): JSON
// records with keys, escapes and a ':' inside a string; prose with capitals, digits, UTF-8 and "Note:" lines; an aligned
// log for the line-above layer; repeats short, early and long for the match model; noise; and the edge cases.
const te = new TextEncoder();
let s = 12345;
const rnd = (n) => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 8) % n; };
const pick = (a) => a[rnd(a.length)];
const WORDS = ['seed', 'light', 'fold', 'layer', 'Kar', 'witness', 'gate', 'record', 'prose', 'symbol', 'token', 'the', 'and', 'of', 'grows', 'Prediction', 'context', 'shape', 'ZETA_9', 'mesh-node', 'café', 'naïve'];

function records() {
  const out = [];
  for (let i = 0; i < 40; i++) {
    const name = pick(['fall', 'kar', 'light', 'seed']) + '-' + pick(['x', 'mesh', 'gate', 'card']) + '-' + (i * 7 % 23);
    out.push({ name, url: 'https://sjgant80-hub.github.io/' + name + '/', topics: [pick(WORDS), pick(WORDS)],
      note: i % 5 === 0 ? 'say "hi" \\ ok: done' : pick(WORDS) + ' ' + pick(WORDS), n: i * 13, Held: i % 3 === 0, pi_0: 9.75 });
  }
  return JSON.stringify(out, null, 2);
}
function prose() {
  const lines = [];
  for (let i = 0; i < 60; i++) {
    const n = 4 + rnd(9), w = [];
    for (let j = 0; j < n; j++) w.push(pick(WORDS));
    lines.push((i % 7 === 0 ? 'Note: ' : i % 11 === 0 ? '- **' + pick(WORDS) + '**: ' : '') + w.join(' ') + (i % 3 === 0 ? '. ◊ — 2026' : '.'));
  }
  return lines.join('\n');
}
function log() {
  const rows = [];
  for (let i = 0; i < 50; i++) rows.push('2026-11-0' + (1 + i % 9) + ' 12:' + String(i % 60).padStart(2, '0') + '  ' + pick(['ok  ', 'FAIL', 'held']) + '  ' + pick(['witness', 'curve  ', 'gate   ']) + ' ' + (40 + i % 9) + '/' + (43 + i % 3));
  return rows.join('\n') + '\n';
}
function repeats() {
  const block = [];
  for (let i = 0; i < 300; i++) block.push(String.fromCharCode(97 + rnd(26)));
  const b = block.join('');
  return 'abcdefghabcdefghabcdefgh|' + b + '|' + b.slice(0, 120) + 'Q' + b.slice(121) + '|' + b + b;
}
function noise() { const u = new Uint8Array(2000); for (let i = 0; i < u.length; i++) u[i] = rnd(256); return u; }

export const FIX = Object.freeze({
  records: te.encode(records()),
  prose: te.encode(prose()),
  log: te.encode(log()),
  repeats: te.encode(repeats()),
  noise: noise(),
  empty: new Uint8Array(0),
  one: te.encode('a'),
  bytes: Uint8Array.from({ length: 256 }, (_, i) => i),
});
