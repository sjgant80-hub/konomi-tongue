// curve/src/qwentok.mjs — qwen2.5's own tokenizer, counting tokens in plain JavaScript (pure; no I/O).
// The model's tokenizer is a GPT-2-style byte-level BPE: split the text with the "qwen2" pre-tokenizer pattern, turn
// each piece's UTF-8 bytes into GPT-2's printable byte alphabet, then repeatedly merge the adjacent pair with the lowest
// rank in the model's merge table until no pair is in it. The number of symbols left is the number of tokens.
// The merge table comes from the model file on this laptop (curve/data/qwen2.5-merges.txt, Apache-2.0, Qwen).
// Special tokens (<|im_start|> and the like) are not recognised: counted as ordinary text.

/** The "qwen2" pre-tokenizer, as llama.cpp applies it for this model. */
export const PRE = /(?:'[sS]|'[tT]|'[rR][eE]|'[vV][eE]|'[mM]|'[lL][lL]|'[dD])|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+/gu;

/** GPT-2's byte → printable character map: 256 distinct one-character strings. */
export function byteMap() {
  const keep = [];
  for (let b = 33; b !== 127; b++) keep.push(b);
  for (let b = 161; b !== 173; b++) keep.push(b);
  for (let b = 174; b !== 256; b++) keep.push(b);
  const map = new Array(256);
  for (const b of keep) map[b] = String.fromCodePoint(b);
  let n = 0;
  for (let b = 0; b !== 256; b++) if (map[b] === undefined) { map[b] = String.fromCodePoint(256 + n); n++; }
  return map;
}

/** The pieces the pre-tokenizer cuts a text into, in order. */
export const pieces = (text) => Array.from(String(text).matchAll(PRE), (m) => m[0]);

/** tokenizer(merges) → { count(text), tokens(text) } from merge rules in rank order ("a b" per rule). */
export function tokenizer(merges) {
  const ranks = new Map();
  merges.forEach((m, i) => { if (!ranks.has(m)) ranks.set(m, i); });
  const map = byteMap(), cache = new Map();
  const bpe = (piece) => {
    const hit = cache.get(piece);
    if (hit) return hit;
    let syms = Array.from(new TextEncoder().encode(piece), (b) => map[b]);
    for (;;) {
      let best = -1, rank = Infinity;
      for (let i = 0; i !== syms.length - 1; i++) {
        const r = ranks.get(syms[i] + ' ' + syms[i + 1]);
        if (r < rank) { rank = r; best = i; }
      }
      if (best === -1) break;
      syms = [...syms.slice(0, best), syms[best] + syms[best + 1], ...syms.slice(best + 2)];
    }
    cache.set(piece, syms);
    return syms;
  };
  const tokens = (text) => pieces(text).flatMap(bpe);
  const count = (text) => { let n = 0; for (const p of pieces(text)) n += bpe(p).length; return n; };
  return { tokens, count };
}

/** mergesOf(text) → the merge rules of a committed table: one per line, blank lines dropped. */
export const mergesOf = (text) => String(text).split('\n').filter((l) => l.length);

export default { PRE, byteMap, pieces, tokenizer, mergesOf };
