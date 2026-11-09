#!/usr/bin/env node
// curve/tools/tokverify.mjs — claim K3: the JavaScript tokenizer counts exactly what the local model counts (glue).
// 48 texts cut from this repository's own PUBLIC files (prose, code, JSON, the glyph legend, HTML), at fixed offsets and
// lengths, each counted by Ollama's qwen2.5:7b (raw prompt, prompt_eval_count, a different prompt between texts so no
// cached prefix is skipped) and by curve/src/qwentok.mjs. Writes curve/data/tokverify.json: file, offset, length, sha256,
// both counts. CI rebuilds every text from the repo and recounts it in JavaScript (it has no Ollama); the committed
// Ollama counts are what it is checked against.
//
//   node curve/tools/tokverify.mjs           count with Ollama and JavaScript, write the receipt
//   node curve/tools/tokverify.mjs --check   recount in JavaScript only, compare with the receipt (CI)
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Q from '../src/qwentok.mjs';

const ROOT = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const sha = (s) => createHash('sha256').update(s).digest('hex');
// files that do not change (sealed or committed records), so CI can always rebuild the same texts
export const SOURCES = ['data/prereg.json', 'SPEC.md', 'curve/CLAIMS.md', 'tongue.mjs', 'data/run.json', 'data/legend.json', 'light/dict/v1.txt', 'light/claims.json'];
export const LENGTHS = [60, 240, 700, 1500, 3000, 5200];
export function samples() {
  const out = [];
  SOURCES.forEach((file, s) => {
    const chars = [...read(file)];
    LENGTHS.forEach((len, k) => {
      const at = Math.floor(((s * 7 + k * 13) % 97) / 97 * Math.max(0, chars.length - len));
      out.push({ file, offset: at, length: len, text: chars.slice(at, at + len).join('') });
    });
  });
  return out;
}
const tok = Q.tokenizer(Q.mergesOf(read('curve/data/qwen2.5-merges.txt')));
const items = samples();
if (process.argv.includes('--check')) {
  const want = JSON.parse(read('curve/data/tokverify.json'));
  let bad = 0;
  want.texts.forEach((w, i) => {
    const t = items[i];
    const same = t && t.file === w.file && t.offset === w.offset && sha(t.text) === w.sha256 && tok.count(t.text) === w.js && w.js === w.ollama;
    if (!same) { bad++; console.error('DIFFERS: ' + w.file + ' @' + w.offset + '+' + w.length); }
  });
  if (want.texts.length !== items.length) bad++;
  console.log(bad ? 'TOKENIZER CHECK FAILED · ' + bad : 'TOKENIZER CHECK HOLDS · ' + want.texts.length + ' texts, JavaScript = Ollama on every one');
  process.exit(bad ? 1 : 0);
}
async function ollama(prompt) {
  const r = await (await fetch('http://127.0.0.1:11434/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'qwen2.5:7b', prompt, raw: true, stream: false, options: { num_predict: 1, num_ctx: 8192 } }) })).json();
  return r.prompt_eval_count;
}
const texts = [];
for (const [i, t] of items.entries()) {
  await ollama('flush ' + i + ' ' + sha(t.text).slice(0, 8));
  const o = await ollama(t.text), j = tok.count(t.text);
  texts.push({ file: t.file, offset: t.offset, length: t.length, sha256: sha(t.text), ollama: o, js: j });
  process.stderr.write('  ' + (o === j ? 'same' : 'DIFF') + ' ' + t.file + ' +' + t.length + ': ollama ' + o + ', js ' + j + '\n');
}
const equal = texts.filter((t) => t.ollama === t.js).length;
const out = { model: 'qwen2.5:7b (Ollama, raw prompt, prompt_eval_count)', mergesSha256: sha(read('curve/data/qwen2.5-merges.txt')), equal, of: texts.length, texts };
writeFileSync(new URL('curve/data/tokverify.json', ROOT), JSON.stringify(out, null, 1) + '\n');
console.log('K3: ' + equal + ' of ' + texts.length + ' texts counted the same by JavaScript and by the local model');
