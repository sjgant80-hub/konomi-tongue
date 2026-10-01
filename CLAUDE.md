# konomi-tongue — agent instructions

The Konomi Tongue: a glyph language grown from what the estate's agents actually say, measured in Claude tokens against Simon's 15x - a nested dictionary, a shared JSON schema, and a picture channel read back blind. Sealed first.

## Boundaries

- Keep konomi-tongue zero-dependency and deterministic. Do not add runtime dependencies.
- Every change to a source line must be covered by a test that fails when the line changes (witness gate).
- Do not skip, disable, or weaken a test to make the suite green. Fix the code or the test's premise.
- Structure and behaviour are gated by konomify; a change ships only when it stays konomified.
