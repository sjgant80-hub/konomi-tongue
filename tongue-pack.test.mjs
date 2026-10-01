// tongue-pack.test.mjs — the shipped JSON mode: lossless, self-describing, refusing garbage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pack, unpack, wins, NOTE } from './tongue-pack.mjs';

const ALPHA = ['一', '丁', '七', '万', '丈', '三'];
const ROWS = [{ name: 'kar-mind', live: true, desc: 'brain' }, { name: 'fallworld', live: true, desc: 'game' }, { name: 'witness', live: false, desc: 'brain' }];

test('pack: a legend of the recurring shapes, keys and strings, then the coded value; unpack gives it back', () => {
  const p = pack(ROWS, ALPHA);
  assert.deepEqual(p, { ok: true, entries: 5, text: '一=schema:"[\\"name\\",\\"live\\",\\"desc\\"]"\n丁=key:"name"\n七=key:"live"\n万=key:"desc"\n丈=string:"brain"\n\n[一("kar-mind",true,丈),一("fallworld",true,"game"),一("witness",false,丈)]' });
  assert.deepEqual(unpack(p.text), { ok: true, value: ROWS });
  for (const v of [{ a: 1 }, [1, 2], 'x', 0, null, { k: [{ x: 'yyy' }, { x: 'yyy' }] }, []]) assert.equal(JSON.stringify(unpack(pack(v, ALPHA).text).value), JSON.stringify(v));
});

test('pack never uses a glyph the value already contains, nor anything but single glyphs', () => {
  const v = [{ 一: 1 }, { 一: 2 }];
  const p = pack(v, ['一', 'ab', 7, '丁', '七']);
  assert.ok(!p.text.split('\n\n')[0].includes('一='));
  assert.ok(p.text.startsWith('丁=schema:'));
  assert.deepEqual(unpack(p.text), { ok: true, value: v });
  assert.deepEqual(pack(v, null), { ok: true, entries: 0, text: '\n\n[{"一":1},{"一":2}]' });
  assert.deepEqual(pack(ROWS, ALPHA, 4).entries, 0);
});

test('pack refuses what is not JSON; unpack refuses what is not a pack', () => {
  assert.deepEqual(pack(undefined, ALPHA), { ok: false, error: 'not JSON' });
  const loop = {}; loop.self = loop;
  assert.deepEqual(pack(loop, ALPHA), { ok: false, error: 'not JSON' });
  assert.deepEqual(pack(() => 1, ALPHA), { ok: false, error: 'not JSON' });
  assert.deepEqual(unpack('[1]'), { ok: false, error: 'no legend' });
  assert.deepEqual(unpack(42), { ok: false, error: 'no legend' });
  assert.deepEqual(unpack('一=nope:"x"\n\n1'), { ok: false, error: 'bad legend line' });
  assert.deepEqual(unpack('一=key:x\n\n1'), { ok: false, error: 'bad legend value' });
  assert.deepEqual(unpack('一=key:5\n\n1'), { ok: false, error: 'bad legend value' });
  assert.deepEqual(unpack('\n\n[1,2]'), { ok: true, value: [1, 2] });
  assert.equal(unpack('一=key:"a"\n\n{一:1').ok, false);
});

test('wins: packed only where it costs fewer tokens', () => {
  assert.equal(wins(100, 60), true);
  assert.equal(wins(100, 100), false);
  assert.equal(wins(100, 120), false);
  assert.equal(wins(NaN, 1), false);
  assert.equal(wins(1, undefined), false);
  assert.ok(NOTE.includes('glyph=kind:JSON'));
});
