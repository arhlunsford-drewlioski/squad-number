// Match engine balance report. Run with `npx tsx scripts/match-calibrate.ts`.
import { createGame } from '../src/engine/game';
import { autoBuild, BASE_POOL } from '../src/engine/pointbuy';
import { bestLineup } from '../src/engine/match/lineup';
import { simulateMatch } from '../src/engine/match/sim';
import { makeRng } from '../src/engine/rng';
import { DIVISIONS } from '../src/engine/world';

const g = createGame(777, { name: 'T', position: 'ST', heightCm: 182, build: 'athletic', foot: 'right', weakFoot: 2, attrs: autoBuild('ST', 182, 'athletic', BASE_POOL), nowLater: 0 });
const rng = makeRng(99);
const ctx = { week: 1, trust: 0 };
const lineups = new Map(g.clubs.map(c => [c.id, bestLineup(g.players, c.id, ctx)]));

function sim(h: string, a: string) { return simulateMatch(lineups.get(h)!, lineups.get(a)!, rng); }
const pct = (n: number, d: number) => ((100 * n) / d).toFixed(1) + '%';

console.log('--- full-season fixture list, every division, 5 seasons ---');
for (const d of DIVISIONS) {
  let n = 0, goals = 0, hw = 0, dr = 0, aw = 0, shots = 0, sot = 0, poss = 0, yel = 0, red = 0, zeroZero = 0, xg = 0;
  const ratings: number[] = [];
  for (let s = 0; s < 5; s++) for (const rd of g.fixtures[d.id]) for (const f of rd) {
    const r = sim(f.h, f.a);
    n++; goals += r.hg + r.ag; if (r.hg > r.ag) hw++; else if (r.hg < r.ag) aw++; else dr++;
    if (r.hg + r.ag === 0) zeroZero++;
    shots += r.team.h.shots + r.team.a.shots; sot += r.team.h.onTarget + r.team.a.onTarget; xg += r.team.h.xg + r.team.a.xg;
    poss += Math.abs(r.team.h.possession - 50); yel += r.team.h.yellow + r.team.a.yellow; red += r.team.h.red + r.team.a.red;
    for (const p of Object.values(r.players)) if (p.min >= 60) ratings.push(p.rating);
  }
  const avgR = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  console.log(d.name.padEnd(22), 'goals/m', (goals / n).toFixed(2), ' H/D/A', pct(hw, n), pct(dr, n), pct(aw, n), ' shots/team', (shots / n / 2).toFixed(1), ' sot%', pct(sot, shots), ' xG/team', (xg / n / 2).toFixed(2), ' |poss-50|', (poss / n).toFixed(1), ' yel/m', (yel / n).toFixed(2), ' red/m', (red / n).toFixed(3), ' 0-0', pct(zeroZero, n), ' avg rating', avgR.toFixed(2));
}

console.log('\n--- strength gap: best vs worst club in each division, 600 matches each way ---');
for (const d of DIVISIONS) {
  const cs = g.clubs.filter(c => c.division === d.id).sort((a, b) => b.rating - a.rating);
  const top = cs[0], bot = cs[cs.length - 1];
  let w = 0, dr = 0, l = 0, gf = 0, ga = 0; const N = 600;
  for (let i = 0; i < N; i++) { const r = i % 2 ? sim(top.id, bot.id) : sim(bot.id, top.id); const tg = i % 2 ? r.hg : r.ag, bg = i % 2 ? r.ag : r.hg; gf += tg; ga += bg; if (tg > bg) w++; else if (tg < bg) l++; else dr++; }
  console.log(d.name.padEnd(22), `top ${top.rating.toFixed(0)} vs bottom ${bot.rating.toFixed(0)}: W/D/L`, pct(w, N), pct(dr, N), pct(l, N), ' goals', (gf / N).toFixed(2), '-', (ga / N).toFixed(2));
}

console.log('\n--- across divisions: a top-flight bottom club vs best of division 4, 400 matches ---');
{
  const d1 = g.clubs.filter(c => c.division === 1).sort((a, b) => a.rating - b.rating)[0];
  const d4 = g.clubs.filter(c => c.division === 4).sort((a, b) => b.rating - a.rating)[0];
  let w = 0, dr = 0, l = 0; const N = 400;
  for (let i = 0; i < N; i++) { const r = i % 2 ? sim(d1.id, d4.id) : sim(d4.id, d1.id); const a = i % 2 ? r.hg : r.ag, b = i % 2 ? r.ag : r.hg; if (a > b) w++; else if (a < b) l++; else dr++; }
  console.log(`D1 bottom (${d1.rating.toFixed(0)}) vs D4 best (${d4.rating.toFixed(0)}): W/D/L`, pct(w, N), pct(dr, N), pct(l, N));
}
