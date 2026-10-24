// Multi-season market run: squads, money, free agents, deals and managers. Run with `npx tsx scripts/market-sim.ts [seasons]`.
import { chooseEvent, describeEvent } from '../src/engine/events/events';
import { createGame, joinClub } from '../src/engine/game';
import { ovrOf } from '../src/engine/player';
import { autoBuild, BASE_POOL } from '../src/engine/pointbuy';
import { endOfSeason as _e, startNextSeason } from '../src/engine/season';
import { wageBill, weeklyIncome } from '../src/engine/economy';
import { playWeek } from '../src/engine/week';
import { DIVISIONS } from '../src/engine/world';

void _e;
const seasons = Number(process.argv[2] ?? 8);
const g = createGame(2025, { name: 'T', position: 'CM', heightCm: 182, build: 'athletic', foot: 'right', weakFoot: 2, attrs: autoBuild('CM', 182, 'athletic', BASE_POOL), nowLater: 0 });
joinClub(g, g.offers.length - 1);
const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const m = (v: number) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'm' : Math.round(v / 1e3) + 'k');
const t0 = Date.now();

for (let s = 1; s <= seasons; s++) {
  const startDeals = g.deals.length;
  const mgrs0 = g.clubs.map(c => c.mgr.name).join('|');
  for (let w = 0; w < 38; w++) { if (g.event) chooseEvent(g, describeEvent(g)!.options[0].id); playWeek(g); }
  const kinds: Record<string, number> = {};
  for (const d of g.deals.slice(0, g.deals.length)) if (d.season === g.season) kinds[d.kind] = (kinds[d.kind] ?? 0) + 1;
  const mgrChanged = g.clubs.filter(c => c.mgr.since === g.season).length;
  const sizes = g.clubs.map(c => g.players.filter(p => p.clubId === c.id).length);
  const funds = g.clubs.map(c => c.funds);
  const fa = g.players.filter(p => p.clubId === null && !p.human);
  const loans = g.players.filter(p => p.loanFrom).length;
  const meds = DIVISIONS.map(d => q(g.clubs.filter(c => c.division === d.id).flatMap(c => g.players.filter(p => p.clubId === c.id).map(ovrOf).sort((a, b) => b - a).slice(0, 11)), 0.5));
  const over = g.clubs.filter(c => wageBill(g, c.id) > weeklyIncome(g, c.id) * 1.15).length;
  console.log(`S${s} deals ${JSON.stringify(kinds)} | squads ${Math.min(...sizes)}-${q(sizes, 0.5)}-${Math.max(...sizes)} | funds ${m(Math.min(...funds))} ${m(q(funds, 0.5))} ${m(Math.max(...funds))} | FA ${fa.length} loans ${loans} | starters ${meds.join(' ')} | new managers ${mgrChanged} | clubs over budget ${over}`);
  void startDeals; void mgrs0;
  startNextSeason(g, g.summary!.contractExpired ? 0 : null);
}
console.log(`${seasons} seasons in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${g.players.length} players, ${g.deals.length} deals kept`);
