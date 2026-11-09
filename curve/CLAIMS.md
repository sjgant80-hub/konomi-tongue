# The 15× curve · sealed claims (seal 1, before any code in `curve/`)

Queue #14, Simon's standing line: *"15 is out there, we will emerge."* The points so far were single measurements
(text 1.05×, JSON 2.72×, picture at chance, LIGHT templates by name median 3.75× / best 50.1×, all in Claude tokens, at
the 2026-10-01 cut; one partial point on 2026-10-09). This turns them into a **standing measured curve**: the same methods,
re-measured on each new week of messages, with the dictionary and the shared library grown only on what came before.
Every bar is fixed here. A claim that misses its bar is kept and published as failed.

## The unit (stated before anything is measured)

- **Tokens are qwen2.5:7b tokens, counted locally.** The Claude CLI's counter reports zero usage (found 2026-10-09), so
  it is not used. The counter is the local model's own tokenizer: its merge table read from the model file on this
  laptop (Apache-2.0, credited), run as a byte-level BPE in plain JavaScript. qwen tokens are **not Claude tokens**; the
  earlier Claude-token points are shown as dated anchors in their own unit, never joined to this line.
- **LIGHT's output is bytes**, a binary arithmetic code no model can read. Its line is labelled bytes, for storage and
  transport, never tokens.

## The windows

- The first window starts at the sealed run's cut, **2026-10-01T12:00:00.000Z**; each window is **7 days**. A point is
  measured only for a **complete** window (its end is before the snapshot time). This first run has five:
  10-01, 10-08, 10-15, 10-22 and 10-29 (ending 2026-11-05T12:00Z).
- The messages are the ones `tools/corpus.mjs` already harvests (each turn's final reply of at least 200 characters, and
  coordinator messages of at least 40), with their timestamps. **Train for a window** = every message before the window's
  start, plus every memory file last written before it. **Held** = every message inside the window. No subsampling.
- The corpus is private. It is read from a snapshot pinned by SHA-256 (kept on this laptop, never published).

## The lines, per window

- **A · the tongue's dictionary**: grown on train with the sealed settings (`tools/run.mjs` CONFIG: 512 rounds, batch
  16, the priced alphabet), applied to each held message.
- **B · held reference**: the reader holds the train messages; every line of a held message (at least 24 characters) that
  appears verbatim in train is sent as a short reference instead (§ plus a base-36 index; a line that itself starts
  with § is escaped). This is the "material both sides already hold" route.
- **C · LIGHT's codec** (bytes): each held message coded on its own with LIGHT's committed dictionary `light/dict/v1.txt`.
  gzip-9 per message is shown beside it as the plain baseline.
- Ratio = the held messages' size as written ÷ their size as coded (tokens for A and B, bytes for C).

## The claims

- **K1 · lossless.** Every held message of every point decodes byte-identical under A, B and C.
- **K2 · the time split holds.** Every point's train precedes its window's start and every held message lies inside its
  window; checked in code on every point, and by test.
- **K3 · the counter is the local model's own.** On a committed set of at least 40 public texts, the JavaScript tokenizer's
  count equals Ollama's `prompt_eval_count` (raw prompt) for every text.
- **K4 · prediction:** line A stays **below 1.5×** at every point.
- **K5 · prediction:** line B lies **between 1.0× and 1.5×** at every point.
- **K6 · prediction:** **no line reaches 15×** at any point, in its own unit.
- **K7 · the chase: does the curve climb?** The better token line (A or B) at the last point is above the better token line
  at the first point. **Predicted to FAIL** (flat): sealed so that a climb, if it comes, is visible.
- **K8 · LIGHT** (bytes): at least **2.0×** at every point, and above gzip-9 at every point.
- **K9 · privacy.** The public file `curve/data/curve.json` holds only numbers, dates, fixed labels and hashes. Checked when
  it is written (no 24-character run of any message appears in it) and in CI (every string is from a fixed list).
- **K10 · deterministic.** `node curve/tools/curve.mjs --check` re-derives `curve.json` byte for byte from the pinned
  snapshot (on this laptop, where the snapshot is).
- **K11 · the page.** No measured number is typed into `curve/index.html`.
- **G · the gate.** witness v0.6 on `curve/src/*.mjs`: CLEAN, nothing baselined. CI green.

## Standing

The same command adds each new complete week as a new point; recorded points are never rewritten. Running it on a
schedule is a standing switch on this laptop, so that is Simon's yes, asked once with the command ready.

## What this is not

Not a Claude-token measurement; not the picture channel (that needs paid vision calls); not a claim about other people's
traffic. The 15× figure is Simon's; it is found nowhere written.
