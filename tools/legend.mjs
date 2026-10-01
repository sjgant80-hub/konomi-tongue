#!/usr/bin/env node
// tools/legend.mjs — the public legend, one file (data/legend.json): LIGHT's opcodes with their primes, its rings with
// their wavelengths and its buses (read from the estate's fork, pinned by sha256), the seed's glyphs (their meanings stay
// in the private seed), each with its measured price in Claude tokens. The grown dictionary is private and is not here.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const LIGHT = 'C:/Users/sjgan/Downloads/light-fork';
const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ops = createRequire(import.meta.url)(LIGHT + '/src/ops.js');
const prices = JSON.parse(readFileSync(ROOT + '/data/prices.json', 'utf8'));
const cost = new Map(prices.glyphs.map((p) => [p.g, p.cost]));
const legend = {
  kind: 'konomi-tongue-legend', v: 1,
  source: { light: { repo: 'sjgant80-hub/smartstuffidontfullyget (fork of teslasolar/light, Thomas Frumkin, used with permission)', file: 'src/ops.js', sha256: createHash('sha256').update(readFileSync(LIGHT + '/src/ops.js', 'utf8')).digest('hex') } },
  light: {
    opcodes: Object.entries(ops.EMOJI_OPS).map(([g, [mnemonic, prime]]) => ({ glyph: g, mnemonic, prime, tokens: cost.get(g) })),
    rings: Object.entries(ops.RING_PRE).map(([g, k]) => ({ glyph: g, ring: k, name: ops.RING_NAMES[k], nm: ops.RING_LAMBDA[k], tokens: cost.get(g) })),
    buses: Object.entries(ops.BUS_GLY).map(([g, b]) => ({ glyph: g, bus: b, tokens: cost.get(g) })),
    registers: { perRing: [2, 3, 5, 11, 31, 127, 709], total: 888 },
  },
  seed: prices.glyphs.filter((p) => p.source === 'seed').map((p) => ({ glyph: p.g, tokens: p.cost })),
};
writeFileSync(ROOT + '/data/legend.json', JSON.stringify(legend, null, 1) + '\n');
console.log('legend: ' + legend.light.opcodes.length + ' opcodes, ' + legend.light.rings.length + ' rings, ' + legend.light.buses.length + ' buses, ' + legend.seed.length + ' seed glyphs');
