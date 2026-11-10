# SEAL 2 — LIGHT, LAYERED and STACKED LIGHT: the instrument, frozen

Committed after the kernels, their tests, the mutation gate and the measurement tools were finished, and **before any
held item is read**. `layered/tools/measure.mjs` refuses to run unless every hash below matches the committed file and
the working copy, and every private input matches its hash. **END is this file's commit time**: held items are those dated
in [CUT, END).

- **What was read before this seal:** the seed side only (items dated before CUT), for the tests' fixtures (made by
  rule, no data), a tuning pass on the seed side (older seed items taught, the newest 128 KiB coded; six settings on agent
  logs, records and prose; the best moved the full stack by under 1% and cost cold frames about as much, so the
  constants chosen in advance were kept), and a dry run of the whole pipeline on seed-side items with the stack measured
  on its gate's own slice (FINAL-A) and no model called. No held item and no FINAL-B case was read.
- **Seen in the dry run, before this seal:** the gate, given only FINAL-A as its final exam, kept none of the library's
  rule and the miner's 39 proposals (the library's one rule covers 3 cases of the whole final slice, none of them in
  FINAL-A). The sealed design is not changed for it: S1 and S4 will fail if the 7B proposes nothing that passes.
- **A change to a seal before anything was published:** the first commit of `layered/STACKED-CLAIMS.md` named a
  private repository. Before any push it was amended to say "a private organ's `patlib.mjs`"; no claim, prediction or
  rule changed. Private names never appear on a public page.
- **The gate:** witness v0.6 (pinned), run on copies of the kernels; nothing baselined.

```json
{
 "cut": "2026-11-05T12:00:00.000Z",
 "end": "the commit time of this file",
 "files": {
  "layered/src/fold.mjs": "fa06321c2394eb6436c317ea712d24f8f5376d6f8e1d81eeca6e4233e3a5ec9e",
  "layered/src/settle.mjs": "460abe891e075918e522388eeac83ba47f782785ac34fb41f53b99f3697b58c1",
  "layered/src/verdict.mjs": "940ca1c9a7bc7c1de185de5395dd2df2e32d1a8930fdfbf134f05c26a3077f0d",
  "layered/tools/gather.mjs": "116aa6eb3bc3e8be6ad42dda2c8326b4c76e3f7456bb0bf674547c52a015cf9a",
  "layered/tools/lab.mjs": "972e526ee866737c880ee0c2210a004255a21a51bda12380a5b3642acc4dcd48",
  "layered/tools/measure.mjs": "e6779780a788e750d666b92c190b851ee10db3386a272d6eb75c4b498447ee76",
  "layered/tools/stack.mjs": "252996b062e3ffb52942ca15cfe0e6dcbcd0225743f0efcc5b0e07d1e10d91ce",
  "layered/test/fold.test.mjs": "3646d9a2ed123c3a6b4cbcf2ecde6dfbd906e35320892dd55c97004b8ddb7b2d",
  "layered/test/settle.test.mjs": "72d7cde35cd935f36a9907e3759047cecc9410183e110097fd17dc852152f131",
  "layered/test/verdict.test.mjs": "07ee4a715d2188b5956a16c2293bbf093a8fbe92de16021c278072b8fbd612a6",
  "layered/test/fixtures.mjs": "9a132a0bea637714c9f668f61bab38d5eaeaa148cf321042da8742f75c9d49c8",
  "layered/test/golden.json": "f9f03639fd15603cf13a789a30bf442311c0d1f3ecf7b8622fb0d62ca54f3a56",
  "layered/data/witness.json": "763cc456640313e03b4b628f3eb64add59d06bf500196acb447b96ecbb4aef09",
  "layered/CLAIMS.md": "7857cab4e01c1933264164dfa536a65892170d9f2483d361a2cc83a72d77197e",
  "layered/STACKED-CLAIMS.md": "b52515ec0a99370282e03d154db83ac862431c60327fb07d901a6711178fb598",
  "light/codec.mjs": "4f018272a05989fe8fbd0f675e0460b35365710a174a88dbf628165ef21f431d",
  "light/sha256.mjs": "cf60afffd36df071b277da214ed61a7b3f4923e443bfadb06656bb7da4756bc1",
  "light/dict/v1.txt": "d9a1bb41709433c7329fb1b9427a98978334b23306fe7b9bcaaa84f628de7e65",
  "tools/corpus.mjs": "3da0f442600eab614a10502cd54edceff52a4f0d5fce83ce839c9a1697939cca"
 },
 "private": {
  "patlib": "b04c5e35a3612f353906ed84a6f0f4e316f30d645735779e191f9f9cebbfe73b",
  "wire": "7bb548f257ce102b3959fc379a6482c2516e2f840726ce2ced938492c6175a06",
  "feed": "0d184118c25508e5fae183ed8bd72d9ef1a4f94f762d1803f5277fd320f76f99",
  "library": "0e20a94b70b9a34bb37841dad9caffd46d981663f81cb0a7aa455c1424577fc3"
 },
 "gate": {
  "fold": "179/179, 0 baselined",
  "settle": "43/43, 0 baselined",
  "verdict": "127/127, 0 baselined"
 }
}
```
