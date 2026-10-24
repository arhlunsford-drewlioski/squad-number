// Multi-season world run: checks progression, ageing, youth intake and promotion churn. Run with `npx tsx scripts/world-sim.ts [seasons]`.
// eslint-disable-next-line
import { createGame, joinClub, humanOf } from '../src/engine/game';
import { ovrOf } from '../src/engine/player';
import { autoBuild, BASE_POOL } from '../src/engine/pointbuy';
import { startNextSeason } from '../src/engine/season';
import { playWeek } from '../src/engine/week';
import { DIVISIONS } from '../src/engine/world';

const seasons = Number(process.argv[2] ?? 12);
const pos = (process.argv[3] ?? 'ST') as 'ST';
const g = createGame(2024, { name: 'Test', position: pos, heightCm: 182, build: 'athletic', foot: 'right', weakFoot: 2, attrs: autoBuild(pos, 182, 'athletic', BASE_POOL), nowLater: 0 });
joinClub(g, 0);
const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const t0 = Date.now();

for (let s = 1; s <= seasons; s++) {
  for (let w = 0; w < 38; w++) playWeek(g);
  const me = humanOf(g);
  const meOvr = ovrOf(me);
  const sum = g.summary!;
  const line: string[] = [];
  for (const d of DIVISIONS) {
    const st = g.clubs.filter(c => c.division === d.id).flatMap(c => g.players.filter(p => p.clubId === c.id).map(ovrOf).sort((a, b) => b - a).slice(0, 11));
    line.push(`D${d.id} ${q(st, 0.5)}`);
  }
  const all = g.players.filter(p => !p.human).map(ovrOf);
  const young = g.players.filter(p => !p.human && p.age <= 20).map(ovrOf);
  console.log(`S${String(s).padStart(2)} age ${me.age} ovr ${meOvr} (start ${Math.round(sum.ovrStart)}) pos ${sum.pos} apps ${me.stats.apps} g ${me.stats.goals} avg ${sum.me.avg.toFixed(2)} pot ${me.potential} | starters median ${line.join(' ')} | 80+ ${all.filter(o => o >= 80).length} 85+ ${all.filter(o => o >= 85).length} 90+ ${all.filter(o => o >= 90).length} | u20 median ${q(young, 0.5)} max ${Math.max(...young)} | ${g.players.length} players`);
  startNextSeason(g, g.summary!.contractExpired ? 0 : null);
}

console.log('\nOVR by age (all non-human players):');
const byAge = new Map<number, number[]>();
for (const p of g.players) if (!p.human) { const a = byAge.get(p.age) ?? []; a.push(ovrOf(p)); byAge.set(p.age, a); }
console.log([...byAge.keys()].sort((a, b) => a - b).map(a => `${a}:${Math.round(byAge.get(a)!.reduce((x, y) => x + y, 0) / byAge.get(a)!.length)}(${byAge.get(a)!.length})`).join('  '));
console.log(`\n${seasons} seasons in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
