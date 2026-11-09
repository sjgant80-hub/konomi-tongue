# Seal 2 · the instrument frozen, before any week is measured

Committed after seal 1 (`curve/CLAIMS.md`, 06879b0), with no amendment. Nothing below has read a held message: the
counter was checked on public texts only, and no window has been coded. The next run of `curve/tools/curve.mjs`
snapshots the corpus and measures every complete week once.

## The counter (K3), checked before anything is measured

qwen2.5's merge table, read from the model file on this laptop (`curve/tools/qwen-tables.mjs`; Ollama blob
`sha256-2bada8a7…3730`, Qwen2.5 7B Instruct, Apache-2.0), run as a byte-level BPE in plain JavaScript
(`curve/src/qwentok.mjs`). On **48 texts** cut from this repository's own public files at fixed offsets and lengths,
the JavaScript count equals Ollama's `prompt_eval_count` (raw prompt) on **48 of 48** (`curve/data/tokverify.json`).
CI recounts all 48 in JavaScript on every push (`node curve/tools/tokverify.mjs --check`).

## What is frozen

| file | sha256 |
|---|---|
| `curve/src/qwentok.mjs` | f7939697067b462f3e8d559444ce02f0ee6aa5d18121f6218dd68042aaefffcb |
| `curve/src/curve.mjs` | 8e56260efc6bd79298334b4c030107ab0822129be6b9686d767432b070f9b345 |
| `curve/tools/curve.mjs` | 5443978365adbf9549465cb2fa38a76c6fcd50ccd9f44d20c5b2bff92957b5ce |
| `tongue.mjs` (line A's coder, unchanged) | 05064e0619b49be35ddc6ab11f87d469a79e5eb06600c90298e18796d2995978 |
| `light/codec.mjs` (line C's coder, unchanged) | 4f018272a05989fe8fbd0f675e0460b35365710a174a88dbf628165ef21f431d |
| `light/dict/v1.txt` (line C's dictionary, unchanged) | d9a1bb41709433c7329fb1b9427a98978334b23306fe7b9bcaaa84f628de7e65 |
| `tools/corpus.mjs` (adds `collect()`; `gather()` unchanged) | 3da0f442600eab614a10502cd54edceff52a4f0d5fce83ce839c9a1697939cca |
| `tools/run.mjs` (the sealed CONFIG: 512 rounds, batch 16) | 5a753e302549a01f8e5aa7c272a67a55204f5b5e2aabaa523a5290748b6161f5 |
| `curve/data/qwen2.5-merges.txt` (151,387 rules) | 599bab54075088774b1733fde865d5bd747cbcc7a547c5bc12610e874e26f5e3 |
| `curve/data/tokverify.json` (K3's receipt) | 110a384c9a90dae7b0a1e8eb0f6fe5c0516b7ad9980cb14836c09454e1fb8148 |

Every hash is of the file as git stores it (the repository pins `eol=lf`; no file has a carriage return).

## The gate on the code (G)

| kernel | witness v0.6 |
|---|---|
| `curve/src/qwentok.mjs` | 11 of 11 caught, 0 baselined |
| `curve/src/curve.mjs` | 43 of 43 caught, 0 baselined |

Closed by test or restructuring before this seal, never baselined: the BPE loop bound (a rule never matches past the end
of a piece), the climb check's redundant guard (one point cannot climb by itself), and the public-file walk over nulls.
