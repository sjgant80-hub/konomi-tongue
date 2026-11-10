# LIGHT, LAYERED — the sealed claims

Written and committed **before any code exists in `layered/`** (seal 1). The instrument is frozen by hash in
`layered/SEAL2.md` before any held item is read (seal 2). The measurement runs once; a claim that fails is kept as
failed, on the page, with what was measured. Nothing here is edited after seal 1.

## What is being built

Simon's spec, "LIGHT, LAYERED — a folded language, not a flat one": five compression dimensions, each folding the
one below, measured as they stack. Built as **one lossless codec** whose frame names the layers it used:

| Layer | Dimension | What it predicts from |
|---|---|---|
| D1 | symbol | how often each byte occurs (order 0) — the flat layer |
| D2 | token | the word being written, and the word before it |
| D3 | structure | the field a value belongs to, the same field in the previous record, the byte on the line above |
| D4 | prediction | the last 1, 2, 3, 4 and 6 bytes, the longest earlier repeat, and a second-stage refinement |
| D5 | shared context | nothing new: every layer is first taught what both ends already hold (the seed), and the seed can grow |

Every layer is a family of predictions over the same stream, mixed by learned weights, driving one integer
arithmetic coder. A frame says which layers it used (a mask; D1 is always on). D1 to D4 need no shared state; D5
needs the shared seed, named in the frame by its id.

**A note written at seal 1.** LIGHT v1 (`light/codec.mjs`, ~3.4× on held JSON) is already a predictive coder (orders
0 to 4, a word model, a match model) primed with a fixed shared dictionary. So it already holds parts of D1, D2, D4
and D5; it is not one-dimensional. This build separates the dimensions, adds the missing ones (D3, more of D4, a
grown seed in place of a fixed dictionary), and measures what each one adds.

## The material (sealed rule)

- **CUT = 2026-11-05T12:00:00.000Z** (the end of the 15× curve's last measured week). **END = the moment SEAL 2 is
  committed**, recorded in SEAL2.md. **HELD** = items dated in [CUT, END). **CONTEXT (the seed)** = items dated before
  CUT. Tuning, tests and development may read CONTEXT only; HELD is read first by the measurement.
- Five data types:
  - **T1 agent logs** (private): the messages `tools/corpus.mjs` collect() gathers (coordinator → Kar and Kar's
    replies), dated by their timestamp.
  - **T2 memory journal** (private): the `.md` files of the Kar memory directory, dated by last write.
  - **T3 call book** (private): the records of `~/.si-didy/brain/calls.lcb` (read with kar-mind `readBook`), each as
    its JSON text, dated by its `at`.
  - **T4 structured records** (public): every git-tracked `.json` file of at most 256 KB in the local clones of the
    estate's public repositories (LIGHT's corpus rule: origin sjgant80-hub, public in the estate index, excluding
    vendor/, node_modules/, data/img; de-duplicated by SHA-256), dated by its last commit. konomi-tongue's own
    `layered/` folder is excluded (it is this build).
  - **T5 prose** (public): the same rule for `.md` files.
- Public items that contain the name of a private estate repository, or a string shaped like a key or token, are
  dropped before anything is counted (the count dropped is published, never what was dropped).
- **Caps.** CONTEXT per type: the most recent items before CUT, whole items, up to 4 MiB; the seed is taught them
  oldest first. HELD per type: if over 1 MiB, the items in SHA-256 order up to 1 MiB.
- Each held item is coded **on its own** (a message, not an archive), against a **frozen** seed. Ratio = raw bytes ÷
  frame bytes, every header byte counted; **pooled** = Σ raw ÷ Σ frame over the held set (the headline); the median
  per-item ratio is shown beside it.
- The public held and context items (T4, T5) are committed so CI can re-derive every public number. Private types
  publish counts, sizes, ratios and a SHA-256 of their private snapshot, never text.

## The claims

Simon's six (L1–L6), as he wrote them, made measurable:

- **L1 · each layer round-trips in isolation.** Every layer set measured (the ladder and each layer alone over D1)
  decodes every held item back to identical bytes; and the mutation gate kills every mutant of the codec kernel, or
  a survivor carries a written reason. *Predicted: HOLD.*
- **L2 · the full stack round-trips byte-identical.** Every held item of every type, coded with all five layers,
  decodes to bytes whose SHA-256 equals the original's. *Predicted: HOLD.*
- **L3 · the ratio climbs as layers stack, on structured data.** On T3 and T4, pooled: D1 < D1+D2 < D1..D3 < D1..D4 <
  D1..D5, each step strictly higher. Measured and shown for all five types; the bar is T3 and T4. *Predicted: HOLD.*
- **L4 · a cold message and a whisper are the same codec.** One decode function reads every frame; a D1-only frame
  decodes with no shared state at all; a full-stack frame decodes with the seed; both lossless on every held item.
  *Predicted: HOLD.*
- **L5 · drift degrades compression, never correctness.** For every held item: (a) a full-stack frame given to a
  decoder whose seed has drifted (its most recent context item missing) is refused with a reason, never decoded into
  other bytes; (b) the sender, told the peer's seed id, falls back to D1..D4 and that frame decodes; (c) a frame with
  one byte changed is refused or decodes to the exact original, never to other bytes. *Predicted: HOLD.*
- **L6 · every quoted ratio names its data type and its fold depth; where a type plateaus is shown.** Checked by the
  page test: no ratio on the page is typed by hand, each is read from the record with its type and depth.
  *Predicted: HOLD.*

The spec's two theses, tested directly:

- **L7 · the folds multiply.** On every type, the full stack's pooled ratio is at least D1's ratio times the product
  of each upper layer's fold *alone* (ratio(D1+Dk) ÷ ratio(D1), for k = 2..5). *Predicted: FAIL — the layers
  overlap (a word model and a 4-byte context both catch the same words), so their gains do not simply stack;
  the telescoping product of the ladder's marginal folds is shown instead, which multiplies by construction.*
- **L8 · 15× falls out of the fold.** On at least one type, the full stack's pooled ratio is 15× or more.
  *Predicted: HOLD on the call book only (the nightly loop asks near-identical questions every night); FAIL on the
  other four, which are mostly new words.*

Did the build get better:

- **L9 · beats the standard coders, including when they are given the same seed.** On every type, the full stack's
  pooled frame total is smaller than gzip -9, Brotli 11 and zstd 19 per item, smaller than deflate given the last
  32 KiB of the same seed as its preset dictionary, and smaller than zstd 19 given the whole same seed as its
  dictionary. (Brotli in Node takes no custom dictionary; said on the page.) *Predicted: HOLD.*
- **L10 · beats LIGHT v1.** On every type, the full stack's pooled total is smaller than LIGHT v1's (light/codec.mjs
  primed with light/dict/v1.txt), item by item. *Predicted: HOLD.*
- **L11 · the seed grows.** On every type, the full stack's pooled ratio is no lower at each larger seed: 0, 64 KiB,
  256 KiB, 1 MiB, 4 MiB (the most recent context, taught oldest first). *Predicted: HOLD, with diminishing returns.*
- **L12 · the flat layer is the low one.** On every type, D1 alone is at most 2.0× pooled: the symbol axis is not
  where LIGHT's 3.4× came from. *Predicted: HOLD.*

Gates (as every estate build):

- **G1** the codec kernel `layered/src/fold.mjs` is pure and total (junk in is `{ ok:false, why }`, never a throw)
  and integer-only (Node and a browser make the same prediction for every bit); witness CLEAN on it.
- **G2** `--check` re-derives every public number (T4, T5) exactly from the committed items, in CI; the private types
  re-derive locally from their snapshot.
- **G3** the public record holds only fixed labels, dates, hashes and counts; no private text or name.
- **G4** the live page explains itself, every number on it comes from the record, and it carries the Konomi credit.
