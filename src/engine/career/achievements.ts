import type { Game } from '../game';
import { humanOf, pushMessage } from '../game';
import { ovrOf } from '../player';
import type { MatchReport } from '../match/report';

export interface Totals { apps: number; starts: number; goals: number; assists: number; motm: number; red: number; seasons: number }

export function totals(g: Game): Totals {
  const st = humanOf(g).stats;
  const t: Totals = { apps: st.apps, starts: st.starts, goals: st.goals, assists: st.assists, motm: st.motm, red: st.red, seasons: g.history.length };
  for (const h of g.history) { t.apps += h.apps; t.goals += h.goals; t.assists += h.assists; }
  return t;
}

interface Ctx { g: Game; t: Totals; rep?: MatchReport; cupFinalGoal?: boolean }
interface Def { id: string; label: string; desc: string; when: 'match' | 'season'; check(c: Ctx): boolean }

const honours = (g: Game, kind: string) => g.career.honours.filter(h => h.kind === kind).length;

export const ACHIEVEMENTS: Def[] = [
  { id: 'debut', label: 'Professional debut', desc: 'Play a league match.', when: 'match', check: c => c.t.apps >= 1 },
  { id: 'firstStart', label: 'In from the start', desc: 'Start a league match.', when: 'match', check: c => c.t.starts >= 1 },
  { id: 'firstGoal', label: 'Off the mark', desc: 'Score a league goal.', when: 'match', check: c => c.t.goals >= 1 },
  { id: 'firstAssist', label: 'The final ball', desc: 'Set up a league goal.', when: 'match', check: c => c.t.assists >= 1 },
  { id: 'brace', label: 'A brace', desc: 'Score twice in a match.', when: 'match', check: c => (c.rep?.me?.g ?? 0) >= 2 },
  { id: 'hatTrick', label: 'Hat-trick', desc: 'Score three in a match.', when: 'match', check: c => (c.rep?.me?.g ?? 0) >= 3 },
  { id: 'motm', label: 'Player of the match', desc: 'Be the best player on the pitch.', when: 'match', check: c => c.t.motm >= 1 },
  { id: 'perfect', label: 'Near perfect', desc: 'Rate 9.0 or better in a match.', when: 'match', check: c => (c.rep?.me?.rating ?? 0) >= 9 },
  { id: 'sentOff', label: 'Early bath', desc: 'Get sent off.', when: 'match', check: c => c.t.red >= 1 },
  { id: 'cupFinalGoal', label: 'Cup final scorer', desc: 'Score in the cup final.', when: 'match', check: c => !!c.cupFinalGoal },
  { id: 'tenGoals', label: 'Ten in a season', desc: 'Score ten league goals in a season.', when: 'season', check: c => humanOf(c.g).stats.goals >= 10 },
  { id: 'twentyGoals', label: 'Twenty in a season', desc: 'Score twenty league goals in a season.', when: 'season', check: c => humanOf(c.g).stats.goals >= 20 },
  { id: 'hundredApps', label: 'Centurion', desc: 'Make 100 league appearances.', when: 'season', check: c => c.t.apps >= 100 },
  { id: 'hundredGoals', label: 'Century of goals', desc: 'Score 100 league goals.', when: 'season', check: c => c.t.goals >= 100 },
  { id: 'ironman', label: 'Ever present', desc: 'Start 36 or more league matches in a season.', when: 'season', check: c => humanOf(c.g).stats.starts >= 36 },
  { id: 'promoted', label: 'Going up', desc: 'Win promotion.', when: 'season', check: c => honours(c.g, 'promotion') >= 1 },
  { id: 'champion', label: 'Champion', desc: 'Win the league.', when: 'season', check: c => honours(c.g, 'league') >= 1 },
  { id: 'cupWinner', label: 'Cup winner', desc: 'Win the Crown Cup.', when: 'season', check: c => honours(c.g, 'cup') >= 1 },
  { id: 'topFlight', label: 'Top flight', desc: 'Play in the Crown League.', when: 'season', check: c => c.g.history.some(h => h.division === 'Crown League') || c.g.clubs.find(x => x.id === humanOf(c.g).clubId)?.division === 1 },
  { id: 'premier', label: 'Premier level', desc: 'Reach an overall of 80.', when: 'season', check: c => ovrOf(humanOf(c.g)) >= 80 },
  { id: 'worldClass', label: 'World class', desc: 'Reach an overall of 90.', when: 'season', check: c => ovrOf(humanOf(c.g)) >= 90 },
  { id: 'firstCap', label: 'Capped', desc: 'Play for the senior national team.', when: 'season', check: c => c.g.career.intl.caps >= 1 },
  { id: 'twentyFiveCaps', label: '25 caps', desc: 'Win 25 senior caps.', when: 'season', check: c => c.g.career.intl.caps >= 25 },
  { id: 'tournament', label: 'Continental winner', desc: 'Win the Continental Championship.', when: 'season', check: c => honours(c.g, 'tournament') >= 1 },
  { id: 'target', label: 'Hitting targets', desc: 'Meet all three of your agent\'s targets in a season.', when: 'season', check: c => { const l = c.g.career.goalLog[c.g.career.goalLog.length - 1]; return !!l && l.met === l.total; } },
];

export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

/** Unlocks whatever has been earned. Returns the newly unlocked ones. */
export function checkAchievements(g: Game, when: 'match' | 'season', extra: { rep?: MatchReport; cupFinalGoal?: boolean } = {}): string[] {
  const done = new Set(g.career.achievements.map(a => a.id));
  const ctx: Ctx = { g, t: totals(g), ...extra };
  const fresh: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (done.has(a.id) || a.when !== when) continue;
    if (a.check(ctx)) { g.career.achievements.push({ id: a.id, season: g.season }); fresh.push(a.id); }
  }
  for (const id of fresh) pushMessage(g, { week: g.week, from: 'Achievement', subject: ACHIEVEMENT_BY_ID[id].label, body: ACHIEVEMENT_BY_ID[id].desc });
  return fresh;
}
