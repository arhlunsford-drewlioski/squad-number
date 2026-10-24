// How far does a diligent player get? Plays the first seasons with smart training and prints overall by age against potential.
// `npx tsx scripts/growth-sim.ts [nowLater] [seasons] [seeds] [humanGrowth] [focusedRoom] [default]`
import { createGame, humanOf, joinClub } from '../src/engine/game';
import { ovrOf } from '../src/engine/player';
import { autoBuild, poolFor } from '../src/engine/pointbuy';
import type { Position } from '../src/engine/positions';
import { trainSmart } from './bot';
import { TUNING } from '../src/engine/training';
import { startNextSeason } from '../src/engine/season';
import { playWeek } from '../src/engine/week';

const nl = Number(process.argv[2] ?? 0);
const seasons = Number(process.argv[3] ?? 9);
const seeds = Number(process.argv[4] ?? 3);
TUNING.humanGrowth = Number(process.argv[5] ?? TUNING.humanGrowth);
TUNING.focusedRoom = Number(process.argv[6] ?? TUNING.focusedRoom);
const careless = process.argv[7] === 'default';
const POS: Position[] = ['ST', 'CM', 'CB', 'W'];
const rows: number[][] = [];
const pots: number[] = [];
const t0 = Date.now();
for (let k = 0; k < seeds; k++) {
  const pos = POS[k % POS.length];
  const g = createGame(500 + k * 37, { name: 'T', position: pos, heightCm: 182, build: 'athletic', foot: 'right', weakFoot: 2, attrs: autoBuild(pos, 182, 'athletic', poolFor(nl)), nowLater: nl });
  joinClub(g, 0);
  const me = humanOf(g);
  pots.push(me.potential);
  const row = [ovrOf(me)];
  for (let s = 0; s < seasons; s++) {
    for (let w = 0; w < 38; w++) {
      if (!careless) trainSmart(g);
      playWeek(g);
    }
    row.push(ovrOf(me));
    startNextSeason(g, g.summary!.contractExpired ? 0 : null);
  }
  rows.push(row);
}
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`${careless ? 'default plan' : 'smart bot'}, humanGrowth ${TUNING.humanGrowth}, nowLater ${nl}: potential avg ${avg(pots).toFixed(1)} (${pots.join(',')})`);
console.log('age  ' + rows[0].map((_, i) => String(17 + i).padStart(4)).join(''));
console.log('ovr  ' + rows[0].map((_, i) => avg(rows.map(r => r[i])).toFixed(0).padStart(4)).join(''));
console.log(`${seeds} careers x ${seasons} seasons in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
