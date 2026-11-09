# The Konomi Tongue

**Live: https://sjgant80-hub.github.io/konomi-tongue/**

**LIGHT, the estate's inner codec (in `light/`): https://sjgant80-hub.github.io/konomi-tongue/light/**

**The 15× curve, re-measured every week (in `curve/`): https://sjgant80-hub.github.io/konomi-tongue/curve/**

A language the estate's agents grow between themselves, measured in Claude tokens against Simon's 15×: a nested glyph dictionary grown from their real messages, a shared JSON schema, and a picture channel read back blind. Sealed before any held-out message was coded or any picture read.

## The result

3 of 11 sealed rules held. Grown to 4723 glyphs, the tongue carried the held-out agent messages in 1.05× fewer Claude tokens and the held-out JSON in 2.72×, against Simon's 15×. Drawn as a picture, the best arm carried 0 bits per token read back at ≥99%, against 6.98 for the best text; the coded messages drawn as pictures cost 2.07× fewer tokens than their English.

| Sealed rule | Result | | Predicted |
|---|---|---|---|
| held-out agent messages cost at least 15× fewer Claude tokens coded with the grown dictionary (the reader already holding it) | held-out agent messages 1.05× with the grown dictionary held (4723 glyphs) | FAIL | fail — about 2–3×: most of a new message is new information, and a dictionary only saves what recurs |
| the ratio climbs at every step of the growth curve | 0: 1× → 64: 1.01× → 256: 1.03× → 1024: 1.04× → 4096: 1.05× → 4723: 1.05× | FAIL | pass |
| every held-out message decodes back exactly | 22 of 22 held-out messages decode exactly | PASS | pass |
| Claude, given the legend, decodes at least 6 of the 8 sampled coded messages exactly | 2 of 8 decoded exactly by Claude from the legend | FAIL | fail — a long flat legend invites slips; 2–4 of 8 exact |
| the held-out JSON costs at least 15× fewer Claude tokens coded with the shared schema (held) | held-out JSON 2.72× with the shared schema held (2076 glyphs) | FAIL | fail — about 4–8×: the shopper records shed their keys, but numbers do not shrink |
| every held-out JSON file decodes back to its exact minified JSON | 6 of 6 held-out files decode exactly | PASS | pass |
| the best picture arm carries more bits per token, read back at ≥99%, than the best text encoding of the same bits | best picture 0 bits/token vs best text 6.98 | FAIL | pass — familiar glyphs at 10–14 px near 25–45 bits per token, against about 10–15 for text |
| familiar glyphs (arm B or C) carry more bits per token than raw dots (arm A) | familiar glyphs 0 vs raw dots 0 bits/token | FAIL | pass — raw dots will not hold 99% below the largest size |
| the evolved glyphs (arm C) carry more bits per token than the familiar ones (arm B) | evolved 0 vs familiar 0 bits/token | FAIL | fail — two generations rarely buy a whole size step |
| the coded messages drawn as pictures cost at least 15× fewer tokens than the plain English, every one read back at ≥99% | plain English ÷ picture of the coded message 2.07× at ≥99% read-back | FAIL | fail — about 4–7× |
| CI re-grades every recorded read, rebuilds the JSON channel from the committed files and re-derives every number from the record | CI re-grades every read and re-derives every number from the record; the JSON channel is rebuilt from committed files | PASS | pass |

## What it is

The live page explains it end to end — what it is, start here, a live JSON pack, how it works (diagrams traced from the record), the receipts, the blueprint, the cost case for a team, adoption steps and a white paper: https://sjgant80-hub.github.io/konomi-tongue/

- `tongue.mjs` — the kernel: units, the growing nested dictionary (encode/decode, lossless), JSON mode (shared schema, glyph keys and values), the picture channel's payloads and grading, misread-driven alphabet evolution. Pure; witness-gated.
- `tongue-pack.mjs` — the shipped JSON mode: a value packed with its own legend, switched on only where it measured cheaper. Pure; witness-gated.
- `tongue-cost.mjs` — the page's cost case: the sourced model price, the ship record's shares, the reader's inputs. Pure; witness-gated.
- `tools/price.mjs` — every candidate glyph priced in Claude tokens (data/prices.json).
- `tools/corpus.mjs`, `tools/json-corpus.mjs` — the agents' messages (private, pinned by sha256) and the estate's JSON (data/json/), split before measuring.
- `tools/seal.mjs`, `tools/run.mjs`, `tools/ship.mjs`, `tools/make-page.mjs` — the seal, the run and its CI verification, the ship measurement, and this README and the page.
- `tools/witness-check.mjs` — CI fails unless each kernel's mutation run on GitHub's runner is clean and re-derives `data/witness.json` (118 of 118 killed, none baselined).

## LIGHT

The repository also holds LIGHT (`light/`): one lossless, integer-only, context-mixing codec primed with a shared dictionary, a signed packet door that verifies sender, signature and counter on the raw bytes before anything is decoded, and a vault that packs many files into one hash-checked stream. Its claims were sealed in `light/claims.json` before any code; its receipts are `light/data/light-run.json`, `light/data/barrier-run.json` and `light/data/witness.json`; every kernel is mutation-gated on GitHub's runner on every push (`.github/workflows/light.yml`). The live page explains it, with the receipts, a business case, adoption steps and a white paper: https://sjgant80-hub.github.io/konomi-tongue/light/

## Credits

- The seed's memory law (compress, don't delete; compress by prime indices).
- Thomas Frumkin's Konomi architecture and LIGHT ([the estate's fork](https://github.com/sjgant80-hub/smartstuffidontfullyget) of teslasolar/light, used with permission). Powered by the Konomi architecture, created by Thomas Frumkin.
- Shopper sessions: UCI Online Shoppers Purchasing Intention Dataset, C. Sakar and Y. Kastro (2018), DOI 10.24432/C5F88Q, CC BY 4.0.
- Code: MIT.
