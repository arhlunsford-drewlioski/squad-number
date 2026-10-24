// Compares your match ratings with your team-mates', and shows what your decisions are worth. `npx tsx scripts/rating-check.ts [seasons] [seeds]`
import { createGame, joinClub, humanOf } from '../src/engine/game';
import { autoBuild, BASE_POOL } from '../src/engine/pointbuy';
import { playWeek } from '../src/engine/week';
import type { Position } from '../src/engine/positions';

const seasons = Number(process.argv[2] ?? 1), seeds = Number(process.argv[3] ?? 3);
const POS: Position[] = ['ST', 'CM', 'CB', 'W'];
const mine: number[] = [], mates: number[] = [], good: number[] = [], bad: number[] = [], allMates: number[] = [], noise: number[] = [], short: number[] = [];
let moments = 0, great = 0, goodN = 0, poor = 0, disaster = 0;
for (let k = 0; k < seeds; k++) {
  const pos = POS[k % POS.length];
  const g = createGame(900 + k * 13, { name: 'T', position: pos, heightCm: 182, build: 'athletic', foot: 'right', weakFoot: 2, attrs: autoBuild('CM', 182, 'athletic', BASE_POOL), nowLater: 0 });
  joinClub(g, 1);
  for (let w = 0; w < 38 * seasons; w++) {
    if (g.event) g.event = null;
    const before = g.reports[0];
    playWeek(g);
    const r = g.reports[0];
    if (!r || r === before || r.comp === 'cup' || !r.me || r.me.min < 15) continue;
    const side = r.mySide;
    const others = r.ratings[side].filter(x => !x.human && x.min >= 45).map(x => x.rating);
    for (const x of r.ratings[side]) if (!x.human && x.min >= 45) allMates.push(x.rating);
    if (r.me.min < 45) { short.push(r.me.rating); continue; }
    for (const p of r.me.parts ?? []) if (p[0] === 'Form on the day') noise.push(p[1]);
    mine.push(r.me.rating); mates.push(others.reduce((a, b) => a + b, 0) / Math.max(1, others.length));
    for (const m of r.moments ?? []) { moments++; if (m.tier === 'great') great++; else if (m.tier === 'good') goodN++; else if (m.tier === 'poor') poor++; else disaster++; }
    const ms = r.moments ?? [];
    const share = ms.length ? ms.filter(m => m.tier === 'great' || m.tier === 'good').length / ms.length : -1;
    if (share >= 0.75) good.push(r.me.rating); else if (share >= 0 && share <= 0.34) bad.push(r.me.rating);
  }
  void humanOf;
}
const avg = (a: number[]) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : '-');
console.log(`matches ${mine.length}: you ${avg(mine)} vs team-mates ${avg(mates)}`);
console.log(`moments ${moments} (${((moments / Math.max(1, mine.length))).toFixed(1)} a match): great ${great}, good ${goodN}, poor ${poor}, disaster ${disaster}`);
console.log(`rating when 3 in 4 or better went well (${good.length} matches): ${avg(good)}; when one in three or fewer (${bad.length}): ${avg(bad)}`);

const sd = (a: number[]) => { const m = a.reduce((x, y) => x + y, 0) / Math.max(1, a.length); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length)); };
const pc = (a: number[], q: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(q * a.length))]?.toFixed(1);
console.log(`you: sd ${sd(mine).toFixed(2)}, p10 ${pc(mine, 0.1)} p50 ${pc(mine, 0.5)} p90 ${pc(mine, 0.9)}`);
console.log(`team-mates (all, 45+ minutes): sd ${sd(allMates).toFixed(2)}, p10 ${pc(allMates, 0.1)} p50 ${pc(allMates, 0.5)} p90 ${pc(allMates, 0.9)}`);
console.log(`'everything else' (luck on the day) for you: sd ${sd(noise).toFixed(2)}; short appearances (${short.length}): avg ${avg(short)} sd ${sd(short).toFixed(2)}`);
