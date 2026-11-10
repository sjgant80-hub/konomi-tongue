// ════════════════════════════════════════════════════════════════
// layered/src/settle.mjs — STACKED LIGHT, levels 2 and 3: a verified pattern is ONE fold frame. Kept, it is data
// (it decodes to the rule's exact bytes, readable by anyone); settled against a case, the same frame is a decision,
// or an honest "unknown" when the rule does not fire. A node is a stack of such frames: the first rule that fires
// answers, with the receipt the pattern library's gate gave it. No model is called anywhere in this file: it imports
// the fold codec and nothing else.
//
// A rule is the pattern library's form: WHEN token [AND token] THEN label (tokens: 3+ of a-z0-9; at most two).
//   ruleText(rule)            → the canonical bytes of a rule: {"kind":"pattern","when":[...],"then":"...","receipt":"..."}
//   frameOf(rule)             → { ok, bytes }   the rule as a cold fold frame (D1..D4: it decodes anywhere, no seed)
//   readFrame(frame)          → { ok, rule } | { ok:false, why }   decode, parse, and check it is a rule
//   settle(frame, tokens)     → { answer, rule }   the rule's label if every WHEN token is in `tokens`, else 'unknown'
//   stackOf(frames)           → { ok, node } | { ok:false, why, at }   a node: every frame read once and checked
//   resolve(node, tokens)     → { answer, at, receipt }   the first rule that fires, or 'unknown' (at = -1)
//   tokensOf(text)            → the case's tokens, as the pattern library makes them
// Pure and total: junk in is a reason or 'unknown', never a throw.
// ════════════════════════════════════════════════════════════════
import { encode, decode, COLD } from './fold.mjs';

const TOKEN = /^[a-z0-9]{3,}$/, LABEL = /^[a-z0-9][a-z0-9-]*$/, RECEIPT = /^[0-9a-f]{8}$/;
const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'your', 'you', 'are', 'its', 'one',
  'all', 'any', 'not', 'but', 'own', 'via', 'per', 'out', 'every', 'each', 'what', 'who', 'how', 'can', 'has', 'have', 'was']);
const te = new TextEncoder(), td = new TextDecoder('utf-8', { fatal: true });
const UNKNOWN = Object.freeze({ answer: 'unknown', rule: null });

/** the pattern library's tokens: lower case, split on anything not a-z0-9, 3+ characters, no stop words, each once */
export function tokensOf(text) {
  return [...new Set((typeof text === 'string' ? text : '').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP.has(t)))];
}

function checkRule(r) {
  if (r === null || typeof r !== 'object' || Array.isArray(r)) return 'not a rule';
  if (!Array.isArray(r.when) || r.when.length < 1 || r.when.length > 2) return 'WHEN is one or two tokens';
  if (!r.when.every((t) => typeof t === 'string' && TOKEN.test(t))) return 'a WHEN token is 3+ of a-z0-9';
  if (r.when.length === 2 && r.when[0] === r.when[1]) return 'the two WHEN tokens are the same';
  if (typeof r.then !== 'string' || !LABEL.test(r.then)) return 'THEN is a label';
  if (r.receipt !== undefined && (typeof r.receipt !== 'string' || !RECEIPT.test(r.receipt))) return 'a receipt is 8 hex';
  return null;
}

/** The canonical bytes of a rule (the same rule always the same bytes). */
export function ruleText(r) {
  const bad = checkRule(r);
  if (bad) return null;
  return JSON.stringify({ kind: 'pattern', when: [...r.when], then: r.then, receipt: r.receipt === undefined ? '' : r.receipt });
}

/** A rule → one cold fold frame. */
export function frameOf(r) {
  const t = ruleText(r);
  if (t === null) return { ok: false, why: checkRule(r) };
  return encode(te.encode(t), { mask: COLD, bits: 18 });
}

/** A frame → its rule, or why not. Only a frame whose bytes are exactly a canonical rule is a rule. */
export function readFrame(frame) {
  const d = decode(frame, { max: 4096 });
  if (!d.ok) return { ok: false, why: d.why };
  let text, o;
  try { text = td.decode(d.bytes); o = JSON.parse(text); } catch { return { ok: false, why: 'not a rule: not JSON text' }; }
  if (o === null || typeof o !== 'object' || o.kind !== 'pattern') return { ok: false, why: 'not a rule: no pattern kind' };
  const r = { when: o.when, then: o.then, receipt: o.receipt === '' ? undefined : o.receipt };
  if (checkRule(r)) return { ok: false, why: 'not a rule: ' + checkRule(r) };
  if (ruleText(r) !== text) return { ok: false, why: 'not a rule: not in canonical form' };
  return { ok: true, rule: r };
}

const fires = (r, tokens) => Array.isArray(tokens) && tokens.length !== 0 && r.when.every((t) => tokens.includes(t));

/** Settle one frame against a case's tokens: the decision, read from the frame itself. */
export function settle(frame, tokens) {
  const r = readFrame(frame);
  if (!r.ok) return UNKNOWN;
  return fires(r.rule, tokens) ? { answer: r.rule.then, rule: r.rule } : UNKNOWN;
}

/** A node: a stack of frames, every one read and checked once, in the order given (the order the gate admitted them). */
export function stackOf(frames) {
  if (!Array.isArray(frames)) return { ok: false, why: 'frames are an array', at: -1 };
  const rules = [];
  for (let i = 0; i < frames.length; i++) {
    const r = readFrame(frames[i]);
    if (!r.ok) return { ok: false, why: r.why, at: i };
    rules.push(r.rule);
  }
  return { ok: true, node: { kind: 'stack.node', rules: Object.freeze(rules), depth: rules.length } };
}

/** The node decides: the first rule in its stack that fires, with its receipt; 'unknown' when none does. */
export function resolve(node, tokens) {
  const rules = node !== null && typeof node === 'object' && node.kind === 'stack.node' && Array.isArray(node.rules) ? node.rules : [];
  for (let i = 0; i < rules.length; i++) {
    if (fires(rules[i], tokens)) return { answer: rules[i].then, at: i, receipt: rules[i].receipt === undefined ? null : rules[i].receipt };
  }
  return { answer: 'unknown', at: -1, receipt: null };
}
