import { pushMessage, humanOf, type Game } from '../game';
import type { Rng } from '../rng';
import { tableFor } from '../table';
import { DIVISIONS, makeManager, type Club } from '../world';

const STYLE: Record<string, string> = { attacking: 'attacking', balanced: 'balanced', defensive: 'cautious' };
export const styleWord = (s: string) => STYLE[s] ?? s;

/** Where a club should finish in its division if it lived up to its squad. */
function expectedRank(g: Game, c: Club): number {
  return g.clubs.filter(x => x.division === c.division && x.rating > c.rating).length + 1;
}

function appoint(g: Game, club: Club, rng: Rng, why: string): void {
  const old = club.mgr;
  club.mgr = makeManager(rng, g.season, g.week);
  const mine = humanOf(g).clubId === club.id;
  if (mine) {
    g.trust = 0.5;
    g.promise = null;
    g.flags.newMgr = g.season * 40 + g.week;
    pushMessage(g, {
      week: g.week, from: 'Club', subject: `${club.mgr.name} is the new manager`,
      body: `${old.name} has left the club ${why}. ${club.mgr.name} takes over and prefers ${styleWord(club.mgr.style)} football in a ${club.mgr.formation}.`,
    });
  }
}

/**
 * Clubs that fall well short of what their squad should deliver replace their manager.
 * Weekly checks start from matchday 10. The season check runs before promotion and relegation are applied.
 */
export function reviewManagers(g: Game, rng: Rng, when: 'weekly' | 'season'): void {
  if (when === 'weekly' && g.week < 10) return;
  const tables = new Map(DIVISIONS.map(d => [d.id, tableFor(g, d.id)]));
  for (const club of g.clubs) {
    const table = tables.get(club.division)!;
    const rank = table.findIndex(r => r.id === club.id) + 1;
    const gap = rank - expectedRank(g, club);
    const tenure = club.mgr.since === g.season ? g.week - club.mgr.week : 99;
    if (when === 'weekly') {
      if (tenure < 8) continue;
      const p = gap >= 9 ? 0.12 : gap >= 7 ? 0.06 : gap >= 5 && g.week >= 25 ? 0.03 : 0;
      if (p > 0 && rng.chance(p)) appoint(g, club, rng, 'after a poor run of results');
    } else {
      const top = rank <= 3 && club.division > 1;
      const down = rank > table.length - 3 && club.division < DIVISIONS.length;
      const p = top ? 0 : down ? 0.6 : gap >= 8 ? 0.55 : gap >= 5 ? 0.3 : gap >= 3 ? 0.12 : 0.05;
      if (p > 0 && rng.chance(p)) appoint(g, club, rng, down ? 'after relegation' : 'at the end of the season');
    }
  }
}
