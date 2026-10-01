// tongue-pack.mjs — THE TONGUE'S JSON MODE, SHIPPED. A value travels with its own small legend: a record shape that
// recurs becomes one glyph (S(v1,v2,…) is one record with those keys, in order), a key or a string that recurs becomes
// one glyph. No shared state is needed — the reader gets the legend with the records — so it can be switched on wherever
// records repeat, and only where it measurably costs fewer tokens than what is sent today.
// Pure; lossless by construction and by test (unpack(pack(v)) is v); unpack returns {ok:false} on garbage, never throws.
import { learnJson, encodeJson, decodeJson, str } from './tongue.mjs';

// the one line a reader needs to read a pack
export const NOTE = 'Packed by the Konomi Tongue: each legend line is glyph=kind:JSON; after the blank line, a schema glyph S(v1,v2,…) is one record with that schema\'s keys in order, and a key or string glyph stands for its value.';

const LINE = /^(.)=(schema|key|string):(.*)$/u;

// pack(value, alphabet) → { ok, text, entries }: the legend lines, a blank line, then the coded value. Only glyphs that
// never occur in the value's own JSON are used, so a glyph can only be a glyph.
export function pack(value, alphabet, min = 2) {
  let json;
  try { json = JSON.stringify(value); } catch { json = undefined; }
  if (typeof json !== 'string') return { ok: false, error: 'not JSON' };
  const used = new Set(json);
  const free = (Array.isArray(alphabet) ? alphabet : []).filter((g) => typeof g === 'string' && [...g].length === 1 && !used.has(g));
  const dict = learnJson([JSON.parse(json)], free, min);
  const legend = dict.map((e) => e.glyph + '=' + e.kind + ':' + JSON.stringify(e.value)).join('\n');
  return { ok: true, text: legend + '\n\n' + encodeJson(JSON.parse(json), dict), entries: dict.length };
}

// unpack(text) → { ok, value } — the legend, then the coded value
export function unpack(packed) {
  const s = str(packed), cut = s.indexOf('\n\n');
  if (cut < 0) return { ok: false, error: 'no legend' };
  const dict = [];
  for (const line of s.slice(0, cut).split('\n').filter(Boolean)) {
    const m = LINE.exec(line);
    if (!m) return { ok: false, error: 'bad legend line' };
    let value;
    try { value = JSON.parse(m[3]); } catch { return { ok: false, error: 'bad legend value' }; }
    if (typeof value !== 'string') return { ok: false, error: 'bad legend value' };
    dict.push({ glyph: m[1], kind: m[2], value });
  }
  return decodeJson(s.slice(cut + 2), dict);
}

// the switch: packed only where it is the cheaper of the two, by the counts given
export const wins = (plainTokens, packedTokens) => Number.isFinite(plainTokens) && Number.isFinite(packedTokens) && packedTokens < plainTokens;
