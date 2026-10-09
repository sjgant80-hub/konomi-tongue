#!/usr/bin/env node
// tools/corpus.mjs — the agents' real talk, gathered PRIVATELY (glue, local only). Nothing it gathers is published: the
// corpus goes to ~/.si-didy/tongue/corpus.json and only its sha256 and counts are sealed.
//
//   coordinator → Kar  every message claudedidy sent Kar (SendMessage / Agent prompts in the main session transcript)
//   Kar → coordinator  every reply Kar gave back (the last text of each turn in Kar's own transcripts, ≥ 200 characters)
//   shared memory      the estate's memory files (what every agent already holds), as they stood before the cutoff
//
//   THE SPLIT IS BY TIME. Every message before CUTOFF and every memory file last written before it is training; every
//   message at or after CUTOFF is held out. The dictionary never sees a held-out message.
//
//   node tools/corpus.mjs            write the corpus and print its counts and sha256
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, createReadStream, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

export const CUTOFF = '2026-10-01T12:00:00.000Z';
const PROJ = 'C:/Users/sjgan/.claude/projects/C--Users-sjgan--claude';
const MEM = PROJ + '/memory';
export const OUT = 'C:/Users/sjgan/.si-didy/tongue/corpus.json';
const sha = (s) => createHash('sha256').update(s).digest('hex');
const textOf = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n') : '');
const strip = (t) => t.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();

async function lines(file, fn) {
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const l of rl) { let o; try { o = JSON.parse(l); } catch { continue; } fn(o); }
}

// one transcript, both rules in one pass. The architecture moved since the first cut (Kar now
// speaks directly in main sessions rather than only through subagents), so the coordinator rule
// (SendMessage/Agent prompts >= 40 chars) and the kar rule (each turn's final assistant text
// >= 200 chars) run over EVERY transcript uniformly — the TIME split alone decides train vs held.
async function harvest(file, messages) {
  let last = null;
  const flush = () => { if (last && last.text.length >= 200) messages.push(last); last = null; };
  await lines(file, (o) => {
    const c = o.message && o.message.content;
    if (o.type === 'user') { if (typeof c === 'string' || (Array.isArray(c) && c.some((b) => b.type === 'text'))) flush(); return; }
    if (o.type !== 'assistant' || !Array.isArray(c)) return;
    const t = strip(textOf(c));
    if (t) last = { at: o.timestamp, from: 'kar', text: t };
    for (const b of c) {
      if (b.type !== 'tool_use') continue;
      const m = b.name === 'SendMessage' ? (typeof b.input.message === 'string' ? b.input.message : typeof b.input.content === 'string' ? b.input.content : '')
        : b.name === 'Agent' ? String(b.input.prompt || '') : '';
      if (m.trim().length >= 40) messages.push({ at: o.timestamp, from: 'coordinator', text: strip(m) });
    }
  });
  flush();
}

export async function gather() {
  const messages = [];
  for (const f of readdirSync(PROJ).filter((x) => x.endsWith('.jsonl')).sort()) {
    await harvest(join(PROJ, f), messages);
    const sub = join(PROJ, f.replace(/\.jsonl$/, ''), 'subagents');
    if (existsSync(sub)) for (const s of readdirSync(sub).filter((x) => x.endsWith('.jsonl')).sort()) await harvest(join(sub, s), messages);
  }
  messages.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const memory = readdirSync(MEM).filter((f) => f.endsWith('.md')).sort()
    .map((f) => ({ file: f, at: statSync(join(MEM, f)).mtime.toISOString(), text: readFileSync(join(MEM, f), 'utf8') }));
  const train = [...memory.filter((m) => m.at < CUTOFF).map((m) => m.text), ...messages.filter((m) => m.at < CUTOFF).map((m) => m.text)];
  const held = messages.filter((m) => m.at >= CUTOFF).map((m) => ({ from: m.from, text: m.text }));
  return { cutoff: CUTOFF, train, held, counts: {
    memoryFiles: memory.filter((m) => m.at < CUTOFF).length, memoryExcluded: memory.filter((m) => m.at >= CUTOFF).length,
    trainMessages: messages.filter((m) => m.at < CUTOFF).length, heldMessages: held.length,
    heldFrom: { coordinator: held.filter((m) => m.from === 'coordinator').length, kar: held.filter((m) => m.from === 'kar').length },
    trainChars: train.reduce((a, t) => a + t.length, 0), heldChars: held.reduce((a, m) => a + m.text.length, 0),
  } };
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/corpus.mjs')) {
  const c = await gather();
  mkdirSync('C:/Users/sjgan/.si-didy/tongue', { recursive: true });
  const text = JSON.stringify(c);
  writeFileSync(OUT, text);
  console.log(JSON.stringify(c.counts) + '\nsha256 ' + sha(text));
}
