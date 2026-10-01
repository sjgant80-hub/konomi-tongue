# konomi-tongue — specification

## Purpose

The Konomi Tongue: a glyph language grown from what the estate's agents actually say, measured in Claude tokens against Simon's 15x - a nested dictionary, a shared JSON schema, and a picture channel read back blind. Sealed first.

## Contract

- **alphabetFrom** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **bitsOf** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **bitsPerToken** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **decode** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **decodeJson** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **depths** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **dictionary** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **draw** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **editRate** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **encode** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **encodeJson** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **evolveAlphabet** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **gradeGrid** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **gridText** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **grow** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **learnJson** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **legendText** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **misreads** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **payload** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **ratio** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **rng** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **squash** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **str** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **unfolded** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **unitCost** — part of the konomi-tongue public surface; deterministic, total (never throws).
- **units** — part of the konomi-tongue public surface; deterministic, total (never throws).

## Guarantees

- **Deterministic** — the same input yields the same output on any machine, any run.
- **Total** — hostile or malformed input returns a defined value, never an exception.
- **Zero-dependency** — no third-party runtime code inside the trust boundary.

## Verification

The suite exercises the public surface directly and is mutation-checked: a change to any guarded line makes a
test fail. konomify admits konomi-tongue only when both the structure rubric (acg-assessor) and the behaviour gate
(witness) pass.
