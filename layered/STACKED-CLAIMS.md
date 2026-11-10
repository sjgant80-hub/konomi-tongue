# STACKED LIGHT — the sealed claims (levels 2 to 4, on top of LIGHT, LAYERED)

Written and committed **before any code for levels 2 to 4 exists** (its own seal 1). `layered/CLAIMS.md` (level 1, the
five compression dimensions) is sealed separately and not edited. The instrument for both is frozen by hash in
`layered/SEAL2.md` before any held item is read; each claim is measured once; a failure is kept, on the page.

## What is being built (Simon's spec "STACKED LIGHT — one substance", adapted to what can be proven on this laptop)

- **Level 1 · stored = data.** The layered codec (`layered/CLAIMS.md`).
- **Level 2 · settled = code.** A verified pattern is held as one fold frame: decoded, it is the rule's exact bytes
  (readable: WHEN token [AND token] THEN label); settled against a case, the same frame is a decision or an honest
  "unknown". Settling is exact pure code (the spec allows "pure code where exact").
- **Level 3 · stacked = a node.** A node's behaviour is its stack of pattern frames settling, first rule that fires
  wins. No model is in the running loop. The model is demoted to an offline proposer; nothing enters the stack
  without passing the pattern library's own gate.
- **Level 4 · sent = speech.** Two nodes that exchange items grow one shared seed; the measured question is whether
  their messages get smaller as their shared context grows.

**Konomified in place.** The stack is the estate's real pattern library (a private organ's `patlib.mjs`: its `gate`,
`answer`, `mine` and `parseProposals` imported unchanged, run on this laptop) over its real feed, Kar's own
repo-to-family decisions, **restricted to the estate's public repositories**. Only counts, receipts and rules that
pass the private-name filter are published.

**Held as the STAR, not claims:** analog or quantum settling, the mesh becoming one mind, compression "approaching
infinity". New information always costs bits; shared context can only remove what both ends already hold.

## The material

- **Cases:** every repository in the feed that is public in the estate index, each a case { id, tokens of its
  description, label = its family } made by `patlib.makeCase`, sliced by `patlib.sliceOf` (train / held / final).
- **The untouched slice:** the final slice is split again by FNV-1a of `id + '#B'`: even → **FINAL-A** (given to the
  gate as its final exam), odd → **FINAL-B** (never shown to the gate, the miner or the model; read first by the
  measurement).
- **Proposers:** the library's existing rules, `patlib.mine` (deterministic, k = 3 per label), and the local 7B
  (qwen2.5:7b through Ollama, at most 12 calls, the same prompt shape the night loop uses) if it is up; if it is
  down, that is recorded and the 7B proposes nothing.
- **The pair (level 4):** the held items of T1 (agent logs), T4 (records) and T5 (prose) in time order. Two nodes
  start with an empty seed (a fresh pair); each item is coded with the full stack against the shared seed, decoded by
  the other node, then both grow the seed with it.

## The claims

- **S1 · one blob, two faces.** Every rule in the final stack, held as a fold frame: (a) decodes to bytes identical
  to the rule's canonical JSON; (b) settled against every FINAL-B case, gives exactly `patlib.answer([rule], case)`,
  and settling twice gives the same answers; (c) a frame that is not a rule (any other decodable bytes) settles to
  "unknown", never to a label. *Predicted: HOLD.*
- **S2 · the ratio compounds across dimensions on structured data.** This is L3 of `layered/CLAIMS.md`, one
  measurement, not two. *Predicted: as L3.*
- **S3 · zero model calls in the hot path.** The node answers every FINAL-B case by settling its stack while
  `globalThis.fetch` is replaced by a recorder: the recorder counts 0 calls; and the node's source imports only the
  fold codec and the settle kernel (checked by the test). *Predicted: HOLD.*
- **S4 · capability = stack depth.** On FINAL-B, the number of cases the node answers right is non-decreasing as the
  admitted rules are stacked in admission order, and is strictly higher with the full stack than with its first rule
  alone. *Predicted: FAIL — the gate is strict (it kept 1 of 56 proposals on its first night); a stack of one rule
  cannot be strictly better than itself.*
- **S5 · the model only proposes, and the gate decides.** Every rule in the stack carries a gate receipt from
  `patlib.gate` run on train / held / FINAL-A; every proposal, from each proposer, is counted; at least one is
  dropped with its reason; no rule enters without a receipt. *Predicted: HOLD.*
- **S6 · speech deepens as the pair shares more.** For each of T1, T4, T5: the fresh pair's pooled ratio over the last
  third of the items is higher than over the first third; a cold pair (D1..D4, no shared state) decodes every item;
  every item round-trips byte-identical. *Predicted: HOLD on all three.*

Gates: the settle kernel (`layered/src/settle.mjs`) is pure, total and witness CLEAN; the private run's record holds
counts, receipts and filtered rules only; every number on the page is read from the record.
