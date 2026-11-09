#!/usr/bin/env node
// curve/tools/qwen-tables.mjs — reads qwen2.5's tokenizer tables out of the model file on this laptop (glue, run once).
// The GGUF header carries the tokenizer: tokenizer.ggml.model "gpt2" (a byte-level BPE), tokenizer.ggml.pre "qwen2",
// and tokenizer.ggml.merges (151,387 rules). Counting needs only the merges, in rank order. Writes:
//   curve/data/qwen2.5-merges.txt   one merge per line, rank = line number (Apache-2.0, Qwen; see curve/data/QWEN-LICENSE)
//   curve/data/qwen2.5-source.json  where it came from: the model blob's sha256 name, the header's own fields, the file's sha256
//
//   node curve/tools/qwen-tables.mjs [path-to-gguf]
import { openSync, readSync, closeSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const BLOB = 'sha256-2bada8a7450677000f678be90653b85d364de7db25eb5ea54136ada5f3933730';   // ollama qwen2.5:7b, application/vnd.ollama.image.model
const FILE = process.argv[2] || 'C:/Users/sjgan/.ollama/models/blobs/' + BLOB;
const LICENSE = 'C:/Users/sjgan/.ollama/models/blobs/sha256-832dd9e00a68dd83b3c3fb9f5588dad7dcf337a0db50f7d9483f310cd292e92e';
const OUT = new URL('../data/', import.meta.url);

const fd = openSync(FILE, 'r'), N = 16 * 1024 * 1024, buf = Buffer.alloc(N);
readSync(fd, buf, 0, N, 0); closeSync(fd);
if (buf.toString('ascii', 0, 4) !== 'GGUF') throw new Error('not a GGUF file: ' + FILE);
let o = 4;
const u32 = () => { const v = buf.readUInt32LE(o); o += 4; return v; };
const u64 = () => { const v = Number(buf.readBigUInt64LE(o)); o += 8; return v; };
const str = () => { const n = u64(); const s = buf.toString('utf8', o, o + n); o += n; return s; };
const SIZE = { 0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 4, 7: 1, 10: 8, 11: 8, 12: 8 };
function val(t) {
  if (t === 8) return str();
  if (t === 9) { const et = u32(), n = u64(), a = new Array(n); for (let i = 0; i !== n; i++) a[i] = val(et); return a; }
  if (t === 4) return u32();
  if (t === 7) { const v = buf.readUInt8(o) !== 0; o += 1; return v; }
  if (!(t in SIZE)) throw new Error('unknown GGUF value type ' + t);
  o += SIZE[t]; return null;   // numbers this tool does not need are skipped by size
}
const version = u32(); u64(); const kvs = u64(), meta = {};
for (let i = 0; i !== kvs; i++) { const k = str(), t = u32(); meta[k] = val(t); }
const merges = meta['tokenizer.ggml.merges'];
if (meta['tokenizer.ggml.model'] !== 'gpt2' || meta['tokenizer.ggml.pre'] !== 'qwen2' || !Array.isArray(merges)) throw new Error('not the expected tokenizer');
if (merges.some((m) => m.includes('\n') || m.split(' ').length !== 2)) throw new Error('a merge rule is not two symbols');
const text = merges.join('\n') + '\n';
writeFileSync(new URL('qwen2.5-merges.txt', OUT), text);
writeFileSync(new URL('QWEN-LICENSE', OUT), readFileSync(LICENSE));
const source = {
  model: meta['general.name'], license: meta['general.license'], licenseLink: meta['general.license.link'], gguf: 'v' + version,
  ollamaBlob: BLOB, tokenizer: { model: meta['tokenizer.ggml.model'], pre: meta['tokenizer.ggml.pre'], vocab: meta['tokenizer.ggml.tokens'].length, merges: merges.length, addBos: meta['tokenizer.ggml.add_bos_token'] ?? null },
  mergesSha256: createHash('sha256').update(text).digest('hex'),
};
writeFileSync(new URL('qwen2.5-source.json', OUT), JSON.stringify(source, null, 1) + '\n');
console.log(JSON.stringify(source));
