// Moment balance report. Run with `npx tsx scripts/moment-lab.ts [matches]`.
import { ATTR_IDS, emptyAttrs } from '../src/engine/attributes';
import { createGame } from '../src/engine/game';
import { bestLineup } from '../src/engine/match/lineup';
import { simulateMatch } from '../src/engine/match/sim';
import { check, expectedValue } from '../src/engine/moments/resolver';
import { TEMPLATES } from '../src/engine/moments/templates';
import type { MomentCtx } from '../src/engine/moments/types';
import { generatePlayer } from '../src/engine/player';
import { autoBuild, BASE_POOL } from '../src/engine/pointbuy';
import { POSITIONS, type Position } from '../src/engine/positions';
import { makeRng } from '../src/engine/rng';

const N = Number(process.argv[2] ?? 300);

function flat(level: number) { const a = emptyAttrs(level); return a; }
const rng0 = makeRng(5);
const mk = (level: number, pos: Position = 'ST') => { const p = generatePlayer(rng0, { id: 'x' + level, position: pos, age: 24, targetOvr: 50, clubId: 'c' }); for (const k of ATTR_IDS) p.attrs[k] = level; return p; };

console.log('--- option success chance (s) by skill level, versus an average opponent at level 10 ---');
console.log('template'.padEnd(18), 'option'.padEnd(10), 'risk'.padEnd(9), 's@6  s@10  s@14   EV@6   EV@10  EV@14');
for (const t of TEMPLATES) {
  for (const o of t.options) {
    const row: number[] = [], ev: number[] = [];
    for (const L of [6, 10, 14]) {
      const me = mk(L), opp = mk(10);
      const c: MomentCtx = { minute: 50, lead: 0, slot: 'ST', me, fat: 1, conf: 50, opp, oppFat: 1, mate: mk(10), gk: mk(10), teamShield: 10, oppAvg: flat(10) };
      const r = check(c, t, o);
      row.push(r.s); ev.push(expectedValue(o, r.s));
    }
    console.log(t.id.padEnd(18), o.id.padEnd(10), o.risk.padEnd(9), row.map(x => x.toFixed(2)).join('  '), ' ', ev.map(x => x.toFixed(2).padStart(5)).join('  '));
  }
}

console.log('\n--- in a match: auto-decided moments vs none, 17+ matches of a mid-table side ---');
const g = createGame(99, { name: 'T', position: 'ST', heightCm: 182, build: 'athletic', foot: 'right', weakFoot: 2, attrs: autoBuild('ST', 182, 'athletic', BASE_POOL), nowLater: 0 });
for (const pos of POSITIONS.map(p => p.id)) {
  let withG = 0, withoutG = 0, momentsN = 0, runs = 0, hGoals = 0, hAst = 0, ratingW = 0, ratingN = 0;
  const tiers: Record<string, number> = { great: 0, good: 0, poor: 0, disaster: 0 };
  const results: Record<string, number> = {};
  const rng = makeRng(1234);
  for (let i = 0; i < N; i++) {
    const clubs = g.clubs.filter(c => c.division === 2);
    const home = clubs[i % clubs.length], away = clubs[(i * 7 + 3) % clubs.length];
    if (home.id === away.id) continue;
    const H = bestLineup(g.players, home.id, { week: 1, trust: 0 }), A = bestLineup(g.players, away.id, { week: 1, trust: 0 });
    const slot = H.xi.find(s => s.slot === pos);
    if (!slot) continue;
    const prev = slot.player.human;
    slot.player.human = true;
    const seed = 777 + i;
    const base = simulateMatch(H, A, makeRng(seed));
    const r = simulateMatch(H, A, makeRng(seed), { humanId: slot.player.id, moments: { confidence: 50, recent: [] } });
    slot.player.human = prev;
    withoutG += base.hg; withG += r.hg; runs++;
    momentsN += r.moments?.logs.length ?? 0;
    for (const l of r.moments?.logs ?? []) { tiers[l.tier]++; results[l.result] = (results[l.result] ?? 0) + 1; }
    const pm = r.players[slot.player.id];
    if (pm) { hGoals += pm.g; hAst += pm.a; ratingW += pm.rating; ratingN++; }
    void rng;
  }
  const tot = Object.values(tiers).reduce((a, b) => a + b, 0) || 1;
  console.log(pos.padEnd(3), `moments/match ${(momentsN / runs).toFixed(2)}  home goals with ${(withG / runs).toFixed(2)} without ${(withoutG / runs).toFixed(2)}  human g ${(hGoals / runs).toFixed(2)} a ${(hAst / runs).toFixed(2)} rating ${(ratingW / ratingN).toFixed(2)}  tiers G/g/p/d ${['great', 'good', 'poor', 'disaster'].map(k => ((100 * tiers[k]) / tot).toFixed(0) + '%').join('/')}`);
  if (pos === 'ST' || pos === 'CB' || pos === 'GK') console.log('     results', Object.entries(results).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
}
