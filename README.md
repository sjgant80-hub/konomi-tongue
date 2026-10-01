# The Konomi Tongue

**Live: https://sjgant80-hub.github.io/konomi-tongue/**

A language the estate's agents grow between themselves, measured in Claude tokens against Simon's 15×: a nested glyph dictionary grown from their real messages, a shared JSON schema, and a picture channel read back blind. Sealed before any held-out message was coded or any picture read.

## The result

Sealed, being measured. The prices, the corpus split, the channels, the rules and a prediction were committed before any held-out message was coded or any picture read; the result lands here whichever way it goes.

## What it is

- `tongue.mjs` — the kernel: units, the growing nested dictionary (encode/decode, lossless), JSON mode (shared schema, glyph keys and values), the picture channel's payloads and grading, misread-driven alphabet evolution. Pure; witness-gated.
- `tools/price.mjs` — every candidate glyph priced in Claude tokens (data/prices.json).
- `tools/corpus.mjs`, `tools/json-corpus.mjs` — the agents' messages (private, pinned by sha256) and the estate's JSON (data/json/), split before measuring.
- `tools/seal.mjs`, `tools/run.mjs`, `tools/make-page.mjs` — the seal, the run and its CI verification, and this README and the page.

## Credits

- The seed's memory law (compress, don't delete; compress by prime indices).
- Thomas Frumkin's Konomi architecture and LIGHT ([the estate's fork](https://github.com/sjgant80-hub/smartstuffidontfullyget) of teslasolar/light, used with permission). Powered by the Konomi architecture, created by Thomas Frumkin.
- Shopper sessions: UCI Online Shoppers Purchasing Intention Dataset, C. Sakar and Y. Kastro (2018), DOI 10.24432/C5F88Q, CC BY 4.0.
- Code: MIT.
