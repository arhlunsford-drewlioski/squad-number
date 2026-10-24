// Headless balance report. Run with `npm run sim`.
import { createGame } from '../src/engine/game';
import { ovrOf } from '../src/engine/player';
import { autoBuild, BASE_POOL, startAttrs, pointsSpent } from '../src/engine/pointbuy';
import { POSITIONS } from '../src/engine/positions';
import { ovrAt } from '../src/engine/rating';
import { DIVISIONS } from '../src/engine/world';
import { HEIGHT_AVG } from '../src/engine/body';

const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

console.log('--- point buy: auto build at the default pool, average height, athletic ---');
for (const pos of POSITIONS) {
  const a = autoBuild(pos.id, HEIGHT_AVG, 'athletic', BASE_POOL);
  const flat = startAttrs(pos.id);
  console.log(pos.id.padEnd(3), 'auto', ovrAt(a, pos.id).toFixed(1).padStart(5), ' untouched', ovrAt(flat, pos.id).toFixed(1).padStart(5), ' spent', pointsSpent(a, pos.id, 2));
}

console.log('\n--- world: OVR by division (all players, starters = top 11 by OVR per club) ---');
const g = createGame(12345, { name: 'Test', position: 'ST', heightCm: 182, build: 'athletic', foot: 'right', weakFoot: 2, attrs: autoBuild('ST', 182, 'athletic', BASE_POOL), nowLater: 0 });
for (const d of DIVISIONS) {
  const clubs = g.clubs.filter(c => c.division === d.id);
  const all: number[] = [];
  const starters: number[] = [];
  const best: number[] = [];
  for (const c of clubs) {
    const ovrs = g.players.filter(p => p.clubId === c.id).map(ovrOf).sort((a, b) => b - a);
    all.push(...ovrs);
    starters.push(...ovrs.slice(0, 11));
    best.push(ovrs[0]);
  }
  console.log(d.name.padEnd(22), 'all p10/p50/p90', q(all, 0.1), q(all, 0.5), q(all, 0.9), ' starters median', q(starters, 0.5), ' best player max', Math.max(...best));
}
const world = g.players.filter(p => !p.human).map(ovrOf);
console.log('\nplayers 85+:', world.filter(o => o >= 85).length, ' 80+:', world.filter(o => o >= 80).length, ' of', world.length);
const youth = g.players.filter(p => !p.human && p.age <= 19).map(ovrOf);
console.log('age<=19 median OVR', q(youth, 0.5), '(n=' + youth.length + ')');
console.log('human start OVR', ovrOf(g.players.find(p => p.human)!));
