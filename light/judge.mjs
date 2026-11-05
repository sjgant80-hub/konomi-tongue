// light/judge.mjs — the LIGHT build's judge: each sealed claim (light/claims.json) held against the facts the
// measurement gathered, by a rule fixed here and gated like every other kernel. Pure, total: a missing or junk fact is
// a failed (or unmeasured) claim, never a throw. A claim measured and failed is reported FAILED and kept; a claim with no
// facts here (the barrier claims B1–B3 in the main receipt, measured by light/tools/barrier.mjs) is reported null, counted as unmeasured.
//   judge(claims, facts) → { held, failed, unmeasured, verdicts: [{ id, kind, claim, measured, held: true|false|null }] }
const obj = (x) => (x && typeof x === 'object' ? x : {});
const num = (x) => (Number.isFinite(x) ? x : NaN);
const near = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1;
// the door's refusals by stage, in a fixed order: 'size 26, magic 2'
const stagesOf = (st) => { const o = obj(st); return Object.keys(o).sort().map((k) => k + ' ' + o[k]).join(', '); };

// each rule → [held (true|false|null), measured text]. null = not measured by this tool.
const RULES = {
  L1: (f) => { const r = num(obj(f.codec).medianRatioJson); return [r >= 15, 'median ' + r + '× smaller than JSON over ' + obj(f.codec).heldFiles + ' held-out files (predicted FAIL; a shared-dictionary coder lands ~3–6×)']; },
  L2: (f) => { const c = obj(f.codec), m = obj(f.memory); const ok = c.lossless === 0 && c.heldFiles > 0 && m.ok === true && m.mismatched === 0; return [ok, c.lossless + ' held-out round-trip failures over ' + c.heldFiles + ' files; memory ' + (m.ok ? m.mismatched + ' mismatched of ' + m.files : 'NOT packed') + '; the feed is carried as records in the mesh (K)']; },
  L3: (f) => { const c = obj(f.codec); const ok = c.smallItems > 0 && c.smallMedianLight < c.smallMedianBrotli && c.smallMedianLight < c.smallMedianGzip; return [ok, 'median small item: LIGHT ' + c.smallMedianLight + ' B vs Brotli ' + c.smallMedianBrotli + ' vs gzip ' + c.smallMedianGzip + ' (' + c.smallLightBeatsBrotliGzip + '/' + c.smallItems + ' beat both)']; },
  L4: (f) => { const c = obj(f.codec); const ok = c.totalLight > 0 && c.totalLight <= c.totalBrotli; return [ok, 'over all held-out: LIGHT ' + c.totalLight + ' B vs Brotli ' + c.totalBrotli + ' B']; },
  L5: (f) => { const c = obj(f.codec); const ok = num(c.mbpsEncode) >= 0.5 && num(c.mbpsDecode) >= 0.5; return [ok, 'encode ' + c.mbpsEncode + ' MB/s, decode ' + c.mbpsDecode + ' MB/s (one thread, this laptop)']; },
  M1: (f) => { const m = obj(f.memory); return [m.ok === true && m.identical === true && m.files > 0, m.ok ? m.files + ' memory files, ' + (m.identical ? 'all byte-identical on unpack' : m.mismatched + ' mismatched, ' + m.extra + ' extra') : 'the vault did not pack: ' + m.why]; },
  M2: (f) => { const m = obj(f.memory); return [m.ok === true && num(m.ratio) >= 3, 'the memory vault is ' + m.ratio + '× smaller than its files (' + m.bytes + ' → ' + m.vaultBytes + ' B)']; },
  K1: (f) => { const k = obj(obj(f.mesh).k1); const ok = obj(f.mesh).ran === true && k.node0 !== 'admitted' && k.node1 === 'recognised' && k.node2 === 'recognised' && k.sentLight >= 1; return [obj(f.mesh).ran ? ok : null, obj(f.mesh).ran ? 'node 0 refused it, shared ' + k.sentLight + ' LIGHT packet(s); node 1 ' + k.node1 + ', node 2 ' + k.node2 : 'the mesh was not run here']; },
  K2: (f) => { const k = obj(obj(f.mesh).k2); const ok = obj(f.mesh).ran === true && obj(k.unpinned).status === 403 && obj(k.tampered).status === 403 && k.decodedAfter === k.decodedBefore; return [obj(f.mesh).ran ? ok : null, obj(f.mesh).ran ? 'unpinned ' + obj(k.unpinned).stage + ', tampered ' + obj(k.tampered).stage + '; decoded count ' + k.decodedBefore + '→' + k.decodedAfter + ' (unchanged = body never read)' : 'the mesh was not run here']; },
  K3: (f) => { const k = obj(obj(f.mesh).k3), one = obj(k.one), batch = obj(k.batch); const ok = obj(f.mesh).ran === true && num(batch.ratio) >= 2; return [obj(f.mesh).ran ? ok : null, obj(f.mesh).ran ? 'a 64-antigen share: JSON ' + batch.json + ' B vs LIGHT ' + batch.light + ' B = ' + batch.ratio + '× (one antigen: ' + one.ratio + '×)' : 'the mesh was not run here']; },
  // B1–B3 are measured by light/tools/barrier.mjs (its receipt light/data/barrier-run.json carries facts.barrier); a
  // receipt without those facts keeps the words it was written with, so the main receipt still re-checks exactly.
  B1: (f) => { const b = obj(f.barrier), x = obj(b.b1); if (b.ran !== true) return [null, 'the language-barrier claims are measured by light/tools/barrier.mjs, not here']; const ok = x.sent > 0 && x.admitted === 0 && x.decoded === 0 && x.named === x.sent; return [ok, x.sent + ' test inputs sent to the door as raw bytes: ' + x.admitted + ' admitted, ' + x.decoded + ' decoded, ' + x.named + ' refused with a named stage (' + stagesOf(x.stages) + ')']; },
  B2: (f) => { const b = obj(f.barrier); if (b.ran !== true) return [null, 'measured by light/tools/barrier.mjs']; const cs = Array.isArray(b.b2) ? b.b2.map(obj) : []; const ok = cs.length === 4 && cs.every((c) => c.admit === false && c.decoded === false && (c.stage === 'sender' || c.stage === 'signature')); return [ok, cs.map((c) => c.case + ': refused at ' + c.stage + (c.decoded ? ', BODY DECODED' : '')).join('; ') + '; ' + cs.filter((c) => c.decoded === true).length + ' decoded']; },
  B3: (f) => { const b = obj(f.barrier), x = obj(b.b3); if (b.ran !== true) return [null, 'measured by light/tools/barrier.mjs']; const ok = x.sent > 0 && x.exact === x.sent; return [ok, x.exact + ' of ' + x.sent + ' test inputs carried as data in a correctly signed packet decode back exactly: LIGHT does not change data, so the edge that shows or runs it must make it safe']; },
  B4: (f) => { const e = obj(f.edges); return [e.pageTest === 'pass' ? true : null, 'the page gate (test/light-page.test.mjs) is ' + e.pageTest]; },
  // T1 and T2 are judged on what the model ANSWERED, never on the prediction: a run that asked no questions is unmeasured.
  T1: (f) => { const l = obj(f.llm), a = obj(l.t1); if (l.ran !== true) return [null, 'the local model was not run here']; if (!(a.questions > 0)) return [null, 'the local model ran, but no questions were asked of records in binary LIGHT']; return [a.light > 0 && a.light >= a.json, a.light + ' of ' + a.questions + ' questions answered correctly from binary LIGHT (base64), ' + a.json + ' from the same records as JSON (' + l.model + ')']; },
  T2: (f) => { const l = obj(f.llm), a = obj(l.t2); if (l.ran !== true) return [null, 'the local model was not run here']; const tok = 'tongue-pack vs minified JSON on ' + l.items + ' record files: ' + l.packWins + ' cheaper in ' + l.model + ' tokens, median ' + l.medianRatio + '×'; if (!(l.items > 0 && num(l.medianRatio) > 1 && l.packWins >= Math.ceil(l.items / 2))) return [false, tok]; if (!(a.questions > 0)) return [null, tok + '; the questions were not asked, so the claim is not yet measured']; return [near(a.pack, a.json), tok + '; ' + a.pack + ' of ' + a.questions + ' questions answered correctly from the pack, ' + a.json + ' from JSON']; },
  E1: (f) => { const e = obj(f.edges); return [e.pageTest === 'pass', 'the page gate is ' + e.pageTest + '; every decode on the page goes through the LIGHT door (packet.mjs)']; },
  G1: (f) => { const g = obj(f.gate); return [g.clean === true ? true : null, g.clean === undefined ? 'the mutation gate is run by CI (light/*.mjs), not inside this tool' : g.killed + '/' + g.total + ' mutants killed']; },
  C1: (f) => { const c = obj(f.census); if (c.ran !== true) return [null, 'the census did not run: ' + c.why]; const ours = c.organs - c.organsHeldByOthers; if (c.organs > 0 && c.organsLight >= c.organs) return [true, 'every one of the ' + c.organs + ' organs that keep a store or a channel speaks LIGHT (' + c.repos + ' repos, ' + c.read + ' read here)']; return [false, c.repos + ' repos, ' + c.read + ' read here; ' + c.organs + ' keep a store or a channel; ' + c.organsLight + ' speak LIGHT; ' + c.organsHeldByOthers + ' of the organs are led by other sessions. Full-estate migration in one build is FAIL as predicted — ' + ours + ' organs are this window\'s to move, switched on where LIGHT wins']; },
};

export function judge(claims, facts) {
  const list = Array.isArray(obj(claims).claims) ? claims.claims : [];
  const f = obj(facts);
  const verdicts = list.map((c) => {
    const x = obj(c), rule = Object.prototype.hasOwnProperty.call(RULES, x.id) ? RULES[x.id] : null;
    let held = false, measured = 'no rule for this claim';
    if (rule) { const r = rule(f); held = r[0] === true ? true : r[0] === null ? null : false; measured = r[1]; }
    return { id: x.id, kind: x.kind, claim: x.claim, predicted: x.predicted, measured, held };
  });
  return { held: verdicts.filter((v) => v.held === true).length, failed: verdicts.filter((v) => v.held === false).length, unmeasured: verdicts.filter((v) => v.held === null).length, verdicts };
}
export { near };
