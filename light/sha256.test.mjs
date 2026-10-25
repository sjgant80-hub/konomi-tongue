import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sha256, hex } from './sha256.mjs';

const ref = (u8) => createHash('sha256').update(u8).digest('hex');
const te = new TextEncoder();

test('the FIPS 180-4 test vectors', () => {
  assert.equal(hex(sha256(new Uint8Array(0))), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(hex(sha256(te.encode('abc'))), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(hex(sha256(te.encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))), '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
});

test('every length across the block and padding edges agrees with node:crypto', () => {
  for (let n = 0; n <= 200; n++) {
    const b = Uint8Array.from({ length: n }, (_, i) => (i * 31 + n) & 255);
    assert.equal(hex(sha256(b)), ref(b), 'length ' + n);
  }
  const big = Uint8Array.from({ length: 70000 }, (_, i) => (i * 131) & 255);
  assert.equal(hex(sha256(big)), ref(big));
});

test('total: anything that is not bytes hashes as no bytes; hex of junk is empty', () => {
  for (const junk of [null, undefined, 'abc', [1, 2], 5]) assert.equal(hex(sha256(junk)), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(hex(null), ''); assert.equal(hex('ab'), ''); assert.equal(hex(Uint8Array.of(0, 15, 255)), '000fff');
});
