// tongue.mjs — THE KONOMI TONGUE. A language the agents grow between themselves, measured in Claude tokens.
//
// Two channels share one alphabet of glyphs priced one by one through the CLI (data/prices.json):
//   TEXT     a nested dictionary grown by compression: the most valuable adjacent pair of units in what the agents
//            actually say becomes a new glyph, again and again — a glyph can stand for a phrase made of glyphs (the seed's
//            "compress, don't delete"; LIGHT's templates, a whole program called by name). JSON mode adds a shared schema:
//            a record's key list is one glyph, a repeated value is one glyph.
//   PICTURE  the same symbols drawn as a grid in an image (images are billed by area): payloads, grids and grading.
//
// Pure and deterministic: no clock, no randomness except a seeded stream, no I/O. Lossless: every encoding here decodes
// back to exactly what went in, or it is not used. The checked entry points return {ok:false} on garbage, never throw.

// ── units: the pieces text is cut into before anything is merged ───────────────────────────────────────────────────
const UNIT = /( ?[A-Za-z]+| ?[0-9]+|\s+|[\s\S])/gu;
// anything that is not a string reads as nothing (a hostile toString never runs)
export const str = (v) => (typeof v === 'string' ? v : '');
export const units = (text) => str(text).match(UNIT) || [];

// a unit's price in tokens before any glyph replaces it — an estimate that only ranks merges; every reported number
// is counted by the CLI. Words up to 8 letters ~1 token, digits ~3 per token, a priced glyph its price, else 1.
export function unitCost(u, prices) {
  const w = /^ ?([A-Za-z]+)$/.exec(u);
  if (w) return Math.ceil(w[1].length / 8);
  const d = /^ ?([0-9]+)$/.exec(u);
  if (d) return Math.ceil(d[1].length / 3);
  return prices.get(u) || 1;
}

// ── the seeded stream (mulberry32) ──────────────────────────────────────────────────────────────────────────────────
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const draw = (r, k) => Math.floor(r() * k);

// ── growing the dictionary ──────────────────────────────────────────────────────────────────────────────────────────
// The alphabet is the single glyphs that cost at most maxCost tokens and never occur in any text the tongue will carry
// (so a glyph in coded text can only be a glyph), the cheapest first. Merges are found on training text only.
export function alphabetFrom(prices, texts, maxCost = 1) {
  const used = new Set();
  for (const t of texts) for (const ch of t) used.add(ch);
  return prices.filter((p) => p.cost <= maxCost && [...p.g].length === 1 && !used.has(p.g)).sort((a, b) => a.cost - b.cost).map((p) => p.g);
}

const KEY = 2 ** 22;
// grow(texts, alphabet, rounds, batch, prices) → merges [{ left, right, glyph, count, saving }] in rank order.
// Each round counts every adjacent pair, then merges the best `batch` pairs that share no symbol (so the order inside a
// round cannot matter); saving = count × (cost(left) + cost(right) − cost(next glyph)), ties by first appearance. A pair
// that saves nothing with the next glyph (a two-token glyph for two one-token units) is passed over.
export function grow(texts, alphabet, rounds, batch, prices) {
  const vocab = new Map(), text = [], cost = [];
  const idOf = (u) => { if (!vocab.has(u)) { vocab.set(u, text.length); text.push(u); cost.push(unitCost(u, prices)); } return vocab.get(u); };
  let seqs = texts.map((t) => units(t).map(idOf));
  const merges = [];
  for (let round = 0; round < rounds; round++) {
    const counts = new Map();
    for (const s of seqs) s.forEach((x, i) => { if (i) { const k = s[i - 1] * KEY + x; counts.set(k, (counts.get(k) || 0) + 1); } });
    // ranked by what each pair would save with the glyph that comes next
    const next = prices.get(alphabet[merges.length]) || 1;
    const ranked = [...counts].map(([k, n]) => ({ a: Math.floor(k / KEY), b: k % KEY, n, save: n * (cost[Math.floor(k / KEY)] + cost[k % KEY] - next) }))
      .filter((p) => p.n > 1).sort((x, y) => y.save - x.save);
    const taken = new Set(), pick = new Map();
    for (const p of ranked) {
      if (pick.size === batch || merges.length === alphabet.length) break;
      if (taken.has(p.a) || taken.has(p.b)) continue;
      const gc = prices.get(alphabet[merges.length]) || 1, save = p.n * (cost[p.a] + cost[p.b] - gc);
      if (save <= 0) continue;
      taken.add(p.a); taken.add(p.b);
      const id = text.length;
      text.push(text[p.a] + text[p.b]); cost.push(gc);
      pick.set(p.a * KEY + p.b, id);
      merges.push({ left: p.a, right: p.b, id, glyph: alphabet[merges.length], count: p.n, saving: save, cost: gc });
    }
    if (!pick.size) break;
    seqs = seqs.map((s) => joinPairs(s, (a, b) => pick.get(a * KEY + b)));
  }
  return { merges, text };
}

// left to right, each symbol either stays or joins the one before it (if that one is still free) into what join() gives
function joinPairs(seq, join) {
  const out = [];
  let free = false;
  for (const x of seq) {
    const m = free ? join(out[out.length - 1], x) : undefined;
    if (m === undefined) { out.push(x); free = true; }
    else { out[out.length - 1] = m; free = false; }
  }
  return out;
}

// The dictionary, portable: each entry is a glyph and its expansion one level down (left and right, each a glyph or
// plain text) — nesting kept, so a coarse read sees the glyph and a fine read unfolds it.
export function dictionary(grown) {
  const glyphOf = new Map(grown.merges.map((m) => [m.id, m.glyph]));
  const part = (id) => (glyphOf.has(id) ? glyphOf.get(id) : grown.text[id]);
  return grown.merges.map((m) => ({ glyph: m.glyph, left: part(m.left), right: part(m.right) }));
}

// encode(text, dict, n): apply the first n entries in order (each entry merges its left and right wherever they stand
// next to each other, left to right), then write glyphs for merged pieces and plain text for the rest.
export function encode(text, dict, n = dict.length) {
  let seq = units(text);
  for (const e of dict.slice(0, n)) seq = joinPairs(seq, (a, b) => (a === e.left && b === e.right ? e.glyph : undefined));
  return seq.join('');
}

// decode(coded, dict): every glyph unfolds all the way down (an entry only ever holds glyphs made before it)
export function unfolded(dict) {
  const flat = new Map();
  for (const e of (Array.isArray(dict) ? dict : []).filter(isObj)) flat.set(e.glyph, (flat.get(e.left) ?? e.left) + (flat.get(e.right) ?? e.right));
  return flat;
}
export function decode(coded, dict) {
  const flat = unfolded(dict);
  return [...str(coded)].map((ch) => flat.get(ch) ?? ch).join('');
}

// how deep an entry nests: a glyph of plain text is depth 1; a glyph holding a glyph of depth d is depth d + 1
export function depths(dict) {
  const d = new Map();
  for (const e of dict) d.set(e.glyph, 1 + Math.max(d.get(e.left) || 0, d.get(e.right) || 0));
  return dict.map((e) => d.get(e.glyph));
}

// the dictionary as a reader would hold it: one line per glyph, fully unfolded (flat) or one level down (nested)
export function legendText(dict, flat) {
  return dict.map((e) => e.glyph + '=' + JSON.stringify(flat ? decode(e.glyph, dict) : e.left + e.right)).join('\n');
}

// ── JSON mode: a shared schema plus glyph keys and values ───────────────────────────────────────────────────────────
// A record's ordered key list that recurs becomes one glyph; a key or a string value that recurs becomes one glyph.
// Written form: S(v1,v2,…) for a record of schema S; {k:v,…} otherwise (k a glyph or a JSON string); string values a
// glyph or a JSON string; numbers, true, false and null as JSON writes them; arrays [a,b,…].
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
export function learnJson(values, alphabet, min = 2) {
  const schemas = new Map(), keys = new Map(), strings = new Map();
  const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (isObj(v)) { const ks = Object.keys(v); bump(schemas, JSON.stringify(ks)); ks.forEach((k) => { bump(keys, k); walk(v[k]); }); }
    else if (typeof v === 'string' && v.length > 2) bump(strings, v);
  };
  values.forEach(walk);
  // most saved first; ties keep the order they were first met in (the walk is deterministic, the sort stable)
  const top = (m, worth) => [...m].filter(([, n]) => n >= min).map(([k, n]) => [k, n * worth(k)]).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const order = [
    ...top(schemas, (k) => k.length).map((k) => ['schema', k]),
    ...top(keys, (k) => k.length).map((k) => ['key', k]),
    ...top(strings, (k) => k.length).map((k) => ['string', k]),
  ].slice(0, alphabet.length);
  return order.map(([kind, value], i) => ({ kind, value, glyph: alphabet[i] }));
}

export function encodeJson(v, dict) {
  const schema = new Map(), key = new Map(), str = new Map();
  for (const e of dict) (e.kind === 'schema' ? schema : e.kind === 'key' ? key : str).set(e.value, e.glyph);
  const go = (x) => {
    if (Array.isArray(x)) return '[' + x.map(go).join(',') + ']';
    if (isObj(x)) {
      const ks = Object.keys(x), s = schema.get(JSON.stringify(ks));
      if (s) return s + '(' + ks.map((k) => go(x[k])).join(',') + ')';
      return '{' + ks.map((k) => (key.get(k) || JSON.stringify(k)) + ':' + go(x[k])).join(',') + '}';
    }
    if (typeof x === 'string') return str.get(x) || JSON.stringify(x);
    return JSON.stringify(x);
  };
  return go(v);
}

// decodeJson(text, dict) → { ok, value } — a small recursive reader of the written form
export function decodeJson(text, dict) {
  const by = new Map((Array.isArray(dict) ? dict : []).filter(isObj).map((e) => [e.glyph, e]));
  // read as UTF-16 positions: every glyph is one BMP character; literals are matched in place by sticky patterns
  const s = str(text), STR = /"(?:[^"\\]|\\.)*"/y, BARE = /[^,)\]}:]*/y;
  let i = 0;
  const fail = (why) => { throw new Error(why + ' at ' + i); };
  const literal = () => {
    // a JSON string (escapes and all), or everything up to the next delimiter
    const re = s[i] === '"' ? STR : BARE;
    re.lastIndex = i;
    const raw = (re.exec(s) || [''])[0];
    i += raw.length;
    try { return JSON.parse(raw); } catch { return fail('bad literal'); }
  };
  const list = (close, item) => {
    const out = [];
    if (s[i] === close) { i += 1; return out; }
    for (;;) {
      out.push(item());
      if (s[i] === ',') i += 1;
      else if (s[i] === close) { i += 1; return out; }
      else fail('expected , or ' + close);
    }
  };
  const value = () => {
    const c = s[i], e = by.get(c);
    if (e && e.kind === 'schema') {
      i += 1;
      if (s[i] !== '(') fail('expected (');
      i += 1;
      const ks = JSON.parse(e.value), vs = list(')', value);
      if (vs.length !== ks.length) fail('record length');
      return Object.fromEntries(ks.map((k, n) => [k, vs[n]]));
    }
    if (e && e.kind === 'string') { i += 1; return e.value; }
    if (c === '[') { i += 1; return list(']', value); }
    if (c === '{') {
      i += 1;
      const pairs = list('}', () => {
        const ke = by.get(s[i]);
        const k = ke && ke.kind === 'key' ? (i += 1, ke.value) : literal();
        if (s[i] !== ':') fail('expected :');
        i += 1;
        return [k, value()];
      });
      return Object.fromEntries(pairs);
    }
    return literal();
  };
  try {
    const v = value();
    if (i !== s.length) fail('trailing');
    return { ok: true, value: v };
  } catch (err) { return { ok: false, error: String(err.message) }; }
}

// ── the picture channel: payloads, grids and grading ────────────────────────────────────────────────────────────────
// A payload is `cells` symbols, each drawn uniformly from an alphabet of `size` (seeded); a dot payload has size 2.
export function payload(cells, size, seed) {
  const r = rng(seed);
  return Array.from({ length: cells }, () => draw(r, size));
}
export const bitsOf = (cells, size) => cells * Math.log2(size);

// the grid the model must write back: rows of `cols` symbols, as glyphs (or 0/1 for dots)
export function gridText(symbols, cols, glyphs) {
  const rows = [];
  for (let k = 0; k < symbols.length; k += cols) rows.push(symbols.slice(k, k + cols).map((x) => glyphs[x]).join(''));
  return rows.join('\n');
}

// grade a read-back against the truth, row by row and position by position: a missing or extra symbol is wrong
export function gradeGrid(truth, reply) {
  const want = str(truth).split('\n'), got = str(reply).trim().split('\n').map((l) => l.replace(/\s+/g, ''));
  let right = 0, n = 0;
  want.forEach((row, k) => {
    const a = [...row], b = [...(got[k] || '')];
    n += Math.max(a.length, b.length);
    a.forEach((ch, j) => { if (b[j] === ch) right += 1; });
  });
  return { right, n, rate: n ? right / n : 0, exact: right === n && got.length === want.length };
}

// bits a token carries: bits read back right, per token billed — counted only where the read clears the bar
export const bitsPerToken = (bits, tokens) => (tokens > 0 ? bits / tokens : 0);

// ── ratios ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export const ratio = (plain, coded) => (coded > 0 ? Math.round((plain / coded) * 100) / 100 : 0);

// the truth glyphs read wrong, position by position (what the next generation's alphabet steers away from)
export function misreads(truth, reply) {
  const want = str(truth).split('\n'), got = str(reply).trim().split('\n').map((l) => [...l.replace(/\s+/g, '')]);
  const out = [];
  want.forEach((row, k) => [...row].forEach((ch, j) => { if ((got[k] || [])[j] !== ch) out.push(ch); }));
  return out;
}
// one generation: every glyph that was misread is replaced by a fresh one drawn (seeded) from the pool — the way the
// creatures of kard-evolve found U→V, selection by the model's own misreads
export function evolveAlphabet(alphabet, bad, pool, seed) {
  const r = rng(seed), avoid = new Set(bad), fresh = pool.filter((g) => !alphabet.includes(g));
  return alphabet.map((g) => (avoid.has(g) && fresh.length ? fresh.splice(draw(r, fresh.length), 1)[0] : g));
}

// ── reading text back: whitespace runs count as one space; the rest is compared character by character ───────────
export const squash = (s) => str(s).replace(/\s+/g, ' ').trim();
export function editRate(truth, reply) {
  const a = [...squash(truth)], b = [...squash(reply)];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  a.forEach((ca, i) => {
    const row = [i + 1];
    b.forEach((cb, j) => row.push(Math.min(prev[j + 1] + 1, row[j] + 1, prev[j] + (ca === cb ? 0 : 1))));
    prev = row;
  });
  const n = Math.max(a.length, b.length);
  return { exact: prev[b.length] === 0, distance: prev[b.length], rate: n ? 1 - prev[b.length] / n : 1 };
}
