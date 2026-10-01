#!/usr/bin/env node
// tools/json-corpus.mjs — the real JSON the estate writes, copied in (all of it already public in its own repo) and split
// before anything is measured. Rule, per repo: every JSON data file up to 200 KB; the one most recently committed is
// HELD OUT, the rest train. Plus the UCI shopper sessions as JSON records: February–October rows train (the first 1,500),
// November–December rows held out (the first 300). Writes data/json/{train,held}/ and data/json/manifest.json.
import { readFileSync, writeFileSync, mkdirSync, statSync, readdirSync, rmSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const REPOS = [
  ['kar-mind', 'C:/Users/sjgan/kar-mind', 'data'],
  ['pattern-organs', 'C:/Users/sjgan/Downloads/pattern-organs', 'data'],
  ['kard-evolve', 'C:/Users/sjgan/Downloads/kard-evolve', 'data'],
  ['fallkard-forge', 'C:/Users/sjgan/Downloads/fallkard-forge', 'data'],
  ['fallworld', 'C:/Users/sjgan/fallworld', '.'],
];
const SKIP = /^(package|package-lock|compliance|.*baseline)\.json$/;

rmSync(join(ROOT, 'data/json'), { recursive: true, force: true });
mkdirSync(join(ROOT, 'data/json/train'), { recursive: true });
mkdirSync(join(ROOT, 'data/json/held'), { recursive: true });
const manifest = [];
const put = (split, name, text, from) => { writeFileSync(join(ROOT, 'data/json', split, name), text); manifest.push({ split, file: name, bytes: Buffer.byteLength(text), sha256: sha(text), from }); };

for (const [repo, dir, sub] of REPOS) {
  const files = readdirSync(join(dir, sub)).filter((f) => f.endsWith('.json') && !SKIP.test(f) && statSync(join(dir, sub, f)).size <= 200 * 1024);
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
  const when = (f) => Number(execFileSync('git', ['log', '-1', '--format=%ct', '--', join(sub, f)], { cwd: dir, encoding: 'utf8' }).trim() || 0);
  const ranked = files.map((f) => [f, when(f)]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  ranked.forEach(([f], k) => put(k === 0 ? 'held' : 'train', repo + '__' + f, JSON.stringify(JSON.parse(readFileSync(join(dir, sub, f), 'utf8'))), { repo, path: join(sub, f).replace(/\\/g, '/'), commit }));
}

const csv = readFileSync('C:/Users/sjgan/Downloads/pattern-organs/data/online_shoppers_intention.csv', 'utf8').trim().split(/\r?\n/);
const head = csv[0].split(',');
const rows = csv.slice(1).map((l) => Object.fromEntries(l.split(',').map((v, k) => [head[k], ['Month', 'VisitorType'].includes(head[k]) ? v : v === 'TRUE' ? true : v === 'FALSE' ? false : Number(v)])));
const late = (r) => r.Month === 'Nov' || r.Month === 'Dec';
put('train', 'sessions__feb-oct.json', JSON.stringify(rows.filter((r) => !late(r)).slice(0, 1500)), { repo: 'pattern-organs', path: 'data/online_shoppers_intention.csv (UCI, CC BY 4.0)', rows: 'Feb–Oct, first 1500' });
put('held', 'sessions__nov-dec.json', JSON.stringify(rows.filter(late).slice(0, 300)), { repo: 'pattern-organs', path: 'data/online_shoppers_intention.csv (UCI, CC BY 4.0)', rows: 'Nov–Dec, first 300' });

writeFileSync(join(ROOT, 'data/json/manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
const sum = (s) => manifest.filter((m) => m.split === s);
console.log('train ' + sum('train').length + ' files ' + sum('train').reduce((a, m) => a + m.bytes, 0) + ' B · held ' + sum('held').length + ' files ' + sum('held').reduce((a, m) => a + m.bytes, 0) + ' B');
console.log(sum('held').map((m) => m.file + ' ' + m.bytes).join('\n'));
