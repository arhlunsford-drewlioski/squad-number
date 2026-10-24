// Plays whole careers with the engine making every decision, then prints the legacy. Run with `npx tsx scripts/career-sim.ts [careers] [seed] [extra pool points]`.
import { createGame, joinClub, humanOf } from '../src/engine/game';
import { autoBuild, BASE_POOL } from '../src/engine/pointbuy';
import { startNextSeason } from '../src/engine/season';
import { playWeek } from '../src/engine/week';
import { legacyOf, retire } from '../src/engine/career';
import type { Position } from '../src/engine/positions';
import { trainSmart } from './bot';

const n = Number(process.argv[2] ?? 4);
const seed0 = Number(process.argv[3] ?? 11);
const bonus = Number(process.argv[4] ?? 0);
const smart = process.argv[5] === 'smart';
const POS: Position[] = ['ST', 'CM', 'CB', 'W', 'GK', 'FB', 'AM', 'DM'];

for (let k = 0; k < n; k++) {
  const pos = POS[k % POS.length];
  const g = createGame(seed0 + k * 101, { name: 'Test', position: pos, heightCm: 182, build: 'athletic', foot: 'right', weakFoot: 2, attrs: autoBuild(pos, 182, 'athletic', BASE_POOL + bonus), nowLater: 0 });
  joinClub(g, 0);
  if (bonus) { const me = humanOf(g); me.potential = 95; me.devRate = 1.35; for (const k of Object.keys(me.ceil) as (keyof typeof me.ceil)[]) me.ceil[k] = 20; }
  const t0 = Date.now();
  const log: string[] = [];
  for (let guard = 0; guard < 25 && g.phase !== 'retired'; guard++) {
    for (let w = 0; w < 38; w++) {
      if (smart) trainSmart(g);
      playWeek(g);
    }
    const me = humanOf(g);
    const s = g.summary!;
    const c = s.career;
    log.push(`S${s.season} age ${me.age} ${pos} ovr ${s.ovrEnd} d${s.division} pos ${s.pos} ${s.me.apps}a ${s.me.goals}g avg ${s.me.avg.toFixed(2)} cup r${c.cup.reached}${c.cup.won ? ' WON' : ''} goals ${c.goals.filter(x => x.met).length}/${c.goals.length} rep ${c.rep.to}${c.awards.length ? ' [' + c.awards.map(a => a.label).join(', ') + ']' : ''}${c.tournament ? ` | ${c.tournament.result}${c.tournament.you ? ` (${c.tournament.you.apps} apps)` : ''}` : ''}`);
    const quit = c.mustRetire || (c.canRetire && (me.age >= 35 || s.ovrEnd < 55));
    if (quit) { retire(g); break; }
    startNextSeason(g, s.contractExpired ? 0 : null);
  }
  const L = legacyOf(g);
  console.log(log.join('\n'));
  console.log(`=> ${pos}: score ${L.score} "${L.title}" | seasons ${L.seasons} apps ${L.apps} goals ${L.goals} | peak ${L.peak.ovr} at ${L.peak.age} | caps ${L.caps} | trophies ${L.trophies.map(t => `${t.label} ${t.count}`).join(', ') || 'none'} | achievements ${L.achievements} | ${((Date.now() - t0) / 1000).toFixed(0)}s\n   ${L.parts.map(p => `${p.label} ${p.points}`).join(', ')}\n`);
}
