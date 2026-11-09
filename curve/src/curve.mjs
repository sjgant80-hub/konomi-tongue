// curve/src/curve.mjs — the 15x curve's own logic (pure; no I/O). Weekly windows from the sealed cut; the time split
// per window, checked; the held-reference coder (line B: lines the reader already holds go as a short reference);
// ratios; the verdicts against curve/CLAIMS.md; and the public view, which carries no message text.

export const START = '2026-10-01T12:00:00.000Z';
export const DAY = 86400000;
export const DAYS = 7;
export const MIN_LINE = 24;
export const MARK = '§';

/** windows(start, days, asOf) → every complete window [start + k·days, start + (k+1)·days) that ends at or before asOf. */
export function windows(start = START, days = DAYS, asOf) {
  const t0 = Date.parse(start), end = Date.parse(asOf), out = [];
  for (let k = 0; t0 + (k + 1) * days * DAY <= end; k++) out.push({ start: new Date(t0 + k * days * DAY).toISOString(), end: new Date(t0 + (k + 1) * days * DAY).toISOString() });
  return out;
}

/** split(messages, memory, w) → train texts (messages and memory written before w.start) and held messages (inside w). */
export function split(messages, memory, w) {
  const train = [...memory.filter((m) => m.at < w.start).map((m) => m.text), ...messages.filter((m) => m.at < w.start).map((m) => m.text)];
  const held = messages.filter((m) => m.at >= w.start && m.at < w.end);
  return { train, held, check: splitHolds(messages, memory, w, held) };
}
/** splitHolds → K2 on one window: every held message lies inside it, and train is exactly what came before it. */
export function splitHolds(messages, memory, w, held) {
  const inside = held.every((m) => m.at >= w.start && m.at < w.end);
  const before = messages.filter((m) => m.at < w.start).length + memory.filter((m) => m.at < w.start).length;
  const after = messages.filter((m) => m.at >= w.end).length;
  return { inside, trainCount: before, heldCount: held.length, laterExcluded: after };
}

/** heldIndex(texts) → the lines the reader holds (at least MIN_LINE characters, first occurrence order) and their positions. */
export function heldIndex(texts, min = MIN_LINE) {
  const list = [], at = new Map();
  for (const t of texts) for (const line of String(t).split('\n')) if (line.length >= min && !at.has(line)) { at.set(line, list.length); list.push(line); }
  return { list, at };
}
/** refEncode(text, index) → each held line as MARK + its base-36 position; a line that starts with MARK is escaped (MARK twice). */
export function refEncode(text, index) {
  return String(text).split('\n').map((line) => {
    const k = index.at.get(line);
    if (k !== undefined) return MARK + k.toString(36);
    return line.startsWith(MARK) ? MARK + line : line;
  }).join('\n');
}
/** refDecode(coded, index) → the text back: MARK MARK … is an escaped line, MARK + base-36 is a reference. */
export function refDecode(coded, index) {
  return String(coded).split('\n').map((line) => {
    if (!line.startsWith(MARK)) return line;
    const rest = line.slice(MARK.length);
    if (rest.startsWith(MARK)) return rest;
    return index.list[parseInt(rest, 36)];
  }).join('\n');
}

/** ratio(before, after) → before ÷ after to 3 places (0 when after is 0, which no real coding produces). */
export const ratio = (before, after) => (after > 0 ? Math.round((before / after) * 1000) / 1000 : 0);

/** verdicts(points) → each sealed claim beside its bar (K1, K2, K4–K8; K3 has its own receipt, K9–K11 are checked in CI). */
export function verdicts(points) {
  const all = (f) => points.length > 0 && points.every(f);
  const best = (p) => Math.max(p.A.ratio, p.B.ratio);
  const first = points[0], last = points[points.length - 1];
  return [
    { id: 'K1', what: 'every held message decodes byte-identical under A, B and C, at every point', measured: points.map((p) => p.A.lossless + p.B.lossless + p.C.lossless + '/' + 3 * p.held.messages), bar: 'all', pass: all((p) => p.A.lossless === p.held.messages && p.B.lossless === p.held.messages && p.C.lossless === p.held.messages) },
    { id: 'K2', what: 'every window: held messages inside it, train only from before it', measured: points.map((p) => p.split.inside), bar: 'all true', pass: all((p) => p.split.inside === true) },
    { id: 'K4', what: 'line A (the dictionary), qwen tokens', measured: points.map((p) => p.A.ratio), bar: 'below 1.5 at every point', pass: all((p) => p.A.ratio < 1.5) },
    { id: 'K5', what: 'line B (held reference), qwen tokens', measured: points.map((p) => p.B.ratio), bar: 'between 1.0 and 1.5 at every point', pass: all((p) => p.B.ratio >= 1 && p.B.ratio <= 1.5) },
    { id: 'K6', what: 'no line reaches 15x at any point, in its own unit', measured: points.map((p) => Math.max(p.A.ratio, p.B.ratio, p.C.ratio)), bar: 'below 15 everywhere', pass: all((p) => Math.max(p.A.ratio, p.B.ratio, p.C.ratio) < 15) },
    { id: 'K7', what: 'the chase: the better token line climbs from the first point to the last', measured: points.length ? [best(first), best(last)] : [], bar: 'last above first (predicted to fail)', pass: points.length !== 0 && best(last) > best(first) },
    { id: 'K8', what: 'line C (LIGHT, bytes): at least 2.0x and above gzip-9, at every point', measured: points.map((p) => [p.C.ratio, p.gzip.ratio]), bar: 'C at least 2.0 and above gzip at every point', pass: all((p) => p.C.ratio >= 2 && p.C.ratio > p.gzip.ratio) },
  ];
}

/** The dated anchors: the sealed 2026-10-01 points, in their own unit (Claude tokens), never joined to the qwen line. */
export const ANCHORS = Object.freeze([
  Object.freeze({ label: 'tongue text, sealed run', ratio: 1.05, unit: 'Claude tokens', at: START }),
  Object.freeze({ label: 'tongue JSON, sealed run', ratio: 2.72, unit: 'Claude tokens', at: START }),
  Object.freeze({ label: 'LIGHT templates by name, median', ratio: 3.75, unit: 'Claude tokens', at: START }),
  Object.freeze({ label: 'LIGHT templates by name, best', ratio: 50.1, unit: 'Claude tokens', at: START }),
]);
/** fixedStrings() → every string the code itself writes into the public file besides LABELS: the claims path, the
 *  anchors' labels, and the verdicts' fixed wording. */
export const fixedStrings = () => ['curve/CLAIMS.md', ...ANCHORS.map((a) => a.label), ...verdicts([]).flatMap((v) => [v.what, v.bar])];

/** The only strings the public file may hold (K9): these labels, ISO dates, hex hashes, and claim ids. */
export const LABELS = Object.freeze(['qwen2.5:7b tokens (local tokenizer)', 'bytes', 'tongue dictionary', 'held reference', 'LIGHT codec', 'gzip-9 per message', 'Claude tokens', 'all', 'all true', 'below 1.5 at every point', 'between 1.0 and 1.5 at every point', 'below 15 everywhere', 'last above first (predicted to fail)', 'C at least 2.0 and above gzip at every point']);
const SAFE = [/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, /^[0-9a-f]{64}$/, /^K\d{1,2}$/, /^\d+\/\d+$/];
/** publicStrings(obj) → every string anywhere in obj that is neither a fixed label nor a date, hash, claim id or count. */
export function strayStrings(obj, extra = []) {
  const out = [], ok = (s) => LABELS.includes(s) || extra.includes(s) || SAFE.some((r) => r.test(s));
  (function walk(v) {
    if (typeof v === 'string') { if (!ok(v)) out.push(v); return; }
    if (v && typeof v === 'object') for (const x of Array.isArray(v) ? v : Object.values(v)) walk(x);
  })(obj);
  return out;
}

export default { START, DAY, DAYS, MIN_LINE, MARK, ANCHORS, fixedStrings, windows, split, splitHolds, heldIndex, refEncode, refDecode, ratio, verdicts, LABELS, strayStrings };
