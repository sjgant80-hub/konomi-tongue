// light/fixtures.mjs — fixed inputs for LIGHT's tests: made-up text, records and bytes (no estate material), so the
// tests run anywhere and the golden outputs they pin never depend on a corpus.
const te = new TextEncoder();
export const text = te.encode('The gate verifies every packet before it parses a byte of it.\n'.repeat(24));
export const records = te.encode(JSON.stringify(Array.from({ length: 60 }, (_, i) => ({ account: 1000 + i, period: 63 + (i % 6), amount: (i * 7919) % 50000, ok: i % 3 !== 0 }))));
export const ramp = Uint8Array.from({ length: 1024 }, (_, i) => i & 255);
export function noise(n, seed = 1) {
  let x = seed >>> 0 || 1;
  return Uint8Array.from({ length: n }, () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x & 255; });
}
export const dict = te.encode('The gate verifies every packet before it parses. {"account":1000,"period":63,"amount":0,"ok":true}\n'.repeat(8));
// a 200-byte block repeated 30× — the match model fires hard, so a change to the match path shows in the bytes
export const repeated = (() => { const block = Uint8Array.from({ length: 200 }, (_, i) => (i * 37 + 11) & 255); const out = new Uint8Array(200 * 30); for (let i = 0; i < 30; i++) out.set(block, i * 200); return out; })();
