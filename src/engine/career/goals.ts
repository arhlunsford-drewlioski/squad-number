import type { Game, Offer } from '../game';
import { humanOf } from '../game';
import { avgRating, ovrOf } from '../player';
import { DIVISIONS } from '../world';
import { CUP_ROUNDS } from './cup';
import type { CupState, GoalResult, SeasonGoal } from './types';

const ROLE_FACTOR: Record<Offer['role'], number> = { Starter: 1, Rotation: 0.6, 'Squad player': 0.3 };
const GOALS_BASE = { ST: 13, W: 7, AM: 7 } as const;

/** The furthest round your club reached in the cup, as an index, or -1 if it never played a tie. */
export function cupReached(cup: CupState, clubId: string): number {
  let best = -1;
  cup.rounds.forEach((r, i) => { if (r.ties.some(t => t.h === clubId || t.a === clubId)) best = i; });
  return best;
}

/** Three targets from the agent for the season ahead, sized to your role and level. */
export function makeGoals(g: Game, role: Offer['role']): SeasonGoal[] {
  const me = humanOf(g);
  const club = g.clubs.find(c => c.id === me.clubId)!;
  const rf = ROLE_FACTOR[role];
  const div = DIVISIONS[club.division - 1];
  const mid = (div.rating[0] + div.rating[1]) / 2;
  const skill = Math.min(1.4, Math.max(0.6, 1 + (ovrOf(me) - mid) * 0.02));
  const goals: SeasonGoal[] = [];
  const apps = Math.max(3, Math.round(38 * rf * 0.75));
  goals.push({ id: 'apps', kind: 'apps', text: `Make ${apps} league appearances`, target: apps });

  const pos = me.position;
  if (pos === 'ST' || pos === 'W' || pos === 'AM') {
    const t = Math.max(1, Math.round(GOALS_BASE[pos] * rf * skill));
    goals.push({ id: 'goals', kind: 'goals', text: `Score ${t} league goal${t === 1 ? '' : 's'}`, target: t });
  } else if (pos === 'CM') {
    const t = Math.max(1, Math.round(5 * rf * skill));
    goals.push({ id: 'assists', kind: 'assists', text: `Set up ${t} league goal${t === 1 ? '' : 's'}`, target: t });
  } else if (pos === 'DM') {
    goals.push({ id: 'rating', kind: 'rating', text: 'Average a rating of 6.8 or better', target: 6.8 });
  } else {
    const t = Math.max(2, Math.round(9 * rf));
    goals.push({ id: 'cleanSheets', kind: 'cleanSheets', text: `Keep ${t} clean sheets`, target: t });
  }

  const pick = g.season % 3;
  if (pick === 0) {
    const t = club.division === 1 ? 4 : club.division === 2 ? 3 : 2;
    goals.push({ id: 'cup', kind: 'cup', text: `Take the club to the ${CUP_ROUNDS[t].name} of the Crown Cup`, target: t });
  } else if (pick === 1) {
    const t = ovrOf(me) + (me.age <= 21 ? 2 : me.age <= 26 ? 1 : 0);
    goals.push({ id: 'ovr', kind: 'ovr', text: `Reach an overall of ${t}`, target: t });
  } else {
    const rank = g.clubs.filter(c => c.division === club.division && c.rating > club.rating).length + 1;
    const t = Math.min(17, Math.max(1, rank - 2));
    goals.push({ id: 'finish', kind: 'finish', text: t === 1 ? 'Win the league with the club' : `Finish in the top ${t} with the club`, target: t });
  }
  return goals;
}

export function goalsMessage(goals: SeasonGoal[]): string {
  return `Your agent has agreed targets with you for the season:\n${goals.map(x => `- ${x.text}`).join('\n')}\nMeeting them raises your standing.`;
}

/** Marks the season's targets against what actually happened. */
export function evaluateGoals(g: Game, leaguePos: number, ovrEnd: number): GoalResult[] {
  const me = humanOf(g);
  const st = me.stats;
  return g.career.goals.map(x => {
    let actual = 0;
    switch (x.kind) {
      case 'apps': actual = st.apps; break;
      case 'goals': actual = st.goals; break;
      case 'assists': actual = st.assists; break;
      case 'cleanSheets': actual = st.cleanSheets; break;
      case 'rating': actual = st.apps >= 10 ? avgRating(st) : 0; break;
      case 'ovr': actual = ovrEnd; break;
      case 'finish': actual = leaguePos; break;
      case 'cup': actual = cupReached(g.cup, me.clubId ?? ''); break;
    }
    const met = x.kind === 'finish' ? actual <= x.target : actual >= x.target;
    return { ...x, actual, met };
  });
}
