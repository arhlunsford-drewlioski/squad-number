import { clamp, type Rng } from '../rng';
import { humanOf, pushMessage, type Game } from '../game';
import { ovrOf, type Player } from '../player';
import type { Position } from '../positions';
import { shootout } from './cup';
import type { IntlLevel } from './types';

export const HOME_NATION = 'Crownland';
export const TOURNAMENT_NAME = 'Continental Championship';
/** League matchdays after which international matches are played. */
export const INTL_WEEKS = [12, 24, 33];
/** A tournament is played every this many seasons, at the end of the season. */
export const TOURNAMENT_EVERY = 4;

/** Opponents, as a strength offset from Crownland's own level. */
export const NATIONS: [string, number][] = [
  ['Valdoria', 3], ['Estravia', 2], ['Norvik', 1], ['Casteria', 0], ['Brannock', 0], ['Ostmark', -1], ['Lusitane', -2], ['Veridia', -2],
  ['Karsovia', -3], ['Adriano', -4], ['Tallin Isles', -5], ['Merrow', -6], ['Qasrin', -7], ['Dunmere', -8], ['Port Lysander', -9],
];

const SLOTS: Record<Position, number> = { GK: 3, CB: 4, FB: 4, DM: 2, CM: 4, AM: 2, W: 4, ST: 3 };
const XI: Record<Position, number> = { GK: 1, CB: 2, FB: 2, DM: 1, CM: 1, AM: 1, W: 2, ST: 1 };
const POS: Position[] = ['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST'];
/** Share of a team's goals that comes from each position. */
const GOAL_SHARE: Record<Position, number> = { GK: 0, CB: 0.05, FB: 0.04, DM: 0.03, CM: 0.08, AM: 0.15, W: 0.14, ST: 0.32 };
const ASSIST_SHARE: Record<Position, number> = { GK: 0, CB: 0.02, FB: 0.08, DM: 0.03, CM: 0.12, AM: 0.18, W: 0.16, ST: 0.1 };

export interface Standing {
  level: IntlLevel;
  /** Rank among players of your position in the pool you are in. */
  rank: number;
  starts: boolean;
  inSquad: boolean;
  /** Average OVR of the national eleven. */
  strength: number;
}

const score = (g: Game, p: Player) => ovrOf(p) + (p.human ? (g.career.rep - 40) * 0.04 : 0);

interface Pool { byPos: Record<Position, Player[]>; strength: number }

function poolFor(g: Game, maxAge: number): Pool {
  const byPos = Object.fromEntries(POS.map(p => [p, [] as Player[]])) as Record<Position, Player[]>;
  for (const p of g.players) if (p.age <= maxAge) byPos[p.position].push(p);
  let sum = 0, n = 0;
  for (const pos of POS) {
    byPos[pos].sort((a, b) => score(g, b) - score(g, a));
    for (const p of byPos[pos].slice(0, XI[pos])) { sum += ovrOf(p); n++; }
  }
  return { byPos, strength: n ? sum / n : 50 };
}

/** Where the human stands in the national set-up. */
export function standing(g: Game): Standing {
  const me = humanOf(g);
  for (const [level, maxAge] of [['senior', 99], ['u21', 21]] as [IntlLevel, number][]) {
    if (me.age > maxAge) continue;
    const pool = poolFor(g, maxAge);
    const rank = pool.byPos[me.position].findIndex(p => p.id === me.id);
    if (rank >= 0 && rank < SLOTS[me.position]) return { level, rank, starts: rank < XI[me.position], inSquad: true, strength: pool.strength };
  }
  return { level: 'none', rank: -1, starts: false, inSquad: false, strength: poolFor(g, 99).strength };
}

const poisson = (rng: Rng, lambda: number) => { let k = 0, p = Math.exp(-lambda), s = p; const u = rng.next(); while (u > s && k < 9) { k++; p *= lambda / k; s += p; } return k; };

/** Goals for each side, from the gap in strength. */
export function scoreline(rng: Rng, us: number, them: number): [number, number] {
  const d = us - them;
  return [poisson(rng, 1.4 * Math.exp(0.06 * d)), poisson(rng, 1.3 * Math.exp(-0.06 * d))];
}

export interface HumanLine { min: number; goals: number; assists: number; rating: number; started: boolean }

/** What you did in a national team match, from the score and your level. */
export function humanLine(g: Game, rng: Rng, st: Standing, ours: number, theirs: number): HumanLine {
  const me = humanOf(g);
  let min = 0;
  if (st.starts) min = rng.chance(0.75) ? 90 : rng.int(55, 85);
  else if (rng.chance(0.65)) min = rng.int(12, 35);
  if (min === 0) return { min, goals: 0, assists: 0, rating: 0, started: false };
  const skill = Math.exp(0.05 * (ovrOf(me) - st.strength));
  const f = min / 90;
  let goals = 0, assists = 0;
  for (let i = 0; i < ours; i++) {
    if (rng.chance(clamp(GOAL_SHARE[me.position] * f * skill, 0, 0.7))) goals++;
    else if (rng.chance(clamp(ASSIST_SHARE[me.position] * f * skill, 0, 0.6))) assists++;
  }
  const rating = clamp(6.3 + 0.7 * goals + 0.35 * assists + (ours > theirs ? 0.3 : ours < theirs ? -0.3 : 0) + (ovrOf(me) - st.strength) * 0.04 + rng.gauss() * 0.45, 4.5, 9.8);
  return { min, goals, assists, rating, started: st.starts };
}

function applyLine(g: Game, st: Standing, line: HumanLine, rng: Rng): void {
  const me = humanOf(g), c = g.career.intl;
  if (line.min === 0) return;
  if (st.level === 'senior') { c.caps++; c.goals += line.goals; c.assists += line.assists; } else { c.u21Caps++; c.u21Goals += line.goals; }
  me.condition = clamp(me.condition - (line.min / 90) * 16 - 4, 20, 100);
  if (rng.chance(0.012 * (line.min / 90) * Math.exp(0.1 * (me.hidden.injuryProneness - 10)))) { me.injuredWeeks = Math.max(me.injuredWeeks, rng.pick([1, 2, 3, 4])); g.injuryHandled = false; g.flags['s:injuredAt'] = g.week; }
}

/** Plays an international break if one falls after this matchday. */
export function intlWindow(g: Game, played: number, rng: Rng): void {
  if (!INTL_WEEKS.includes(played)) return;
  const me = humanOf(g), c = g.career.intl;
  const st = standing(g);
  const was = c.level;
  c.level = st.level;
  if (st.level === 'none') {
    if (was !== 'none') pushMessage(g, { week: g.week, from: 'Federation', subject: 'Left out of the national squad', body: 'The national coach has named the squad and you are not in it. Better form and a higher level will bring you back.' });
    return;
  }
  const team = st.level === 'senior' ? HOME_NATION : `${HOME_NATION} Under-21s`;
  if (was !== st.level) pushMessage(g, { week: g.week, from: 'Federation', subject: st.level === 'senior' ? 'Called up for the senior team' : 'Called up for the Under-21s', body: `You are in the ${team} squad. ${st.starts ? 'You are in line to start.' : 'You are likely to begin on the bench.'}` });
  if (me.injuredWeeks > 0 || me.suspended > 0) {
    pushMessage(g, { week: g.week, from: 'Federation', subject: 'Withdrawn from the squad', body: me.injuredWeeks > 0 ? 'You are not fit enough to travel, so you have been withdrawn.' : 'You are suspended and cannot play for your country this break.' });
    return;
  }
  const [name, off] = rng.pick(NATIONS);
  const them = st.strength + off - (st.level === 'u21' ? 4 : 0);
  const [ours, theirs] = scoreline(rng, st.strength, them);
  const line = humanLine(g, rng, st, ours, theirs);
  applyLine(g, st, line, rng);
  const res = ours > theirs ? 'won' : ours < theirs ? 'lost' : 'drew';
  const what = line.min === 0 ? 'You were an unused substitute.' : `${line.started ? 'You started' : `You came on for ${line.min} minutes`}${line.goals ? ` and scored${line.goals > 1 ? ` ${line.goals}` : ''}` : ''}${line.assists ? `${line.goals ? ', and' : ' and'} set up ${line.assists === 1 ? 'a goal' : `${line.assists} goals`}` : ''}, rated ${line.rating.toFixed(1)}.`;
  pushMessage(g, { week: g.week, from: 'Federation', subject: `${team} ${ours}-${theirs} ${name}`, body: `${team} ${res} ${ours}-${theirs} against ${name}. ${what}` });
}

export interface TournamentMatch { stage: string; opp: string; ours: number; theirs: number; pens?: [number, number] }
export interface TournamentResult {
  season: number;
  name: string;
  result: string;
  stage: number;
  matches: TournamentMatch[];
  /** Your part in it. Absent when you were not in the squad. */
  you: { min: number; goals: number; assists: number; apps: number } | null;
}

const STAGES = ['Group stage', 'Quarter-final', 'Semi-final', 'Final'];
const RESULT = ['Out in the group stage', 'Beaten quarter-finalists', 'Beaten semi-finalists', 'Runners-up', 'Winners'];

/** The tournament, played at the end of every fourth season. Returns null in other years. */
export function playTournament(g: Game, rng: Rng): TournamentResult | null {
  if (g.season % TOURNAMENT_EVERY !== 0) return null;
  const me = humanOf(g);
  const st = standing(g);
  const home = st.strength;
  const nations = [...NATIONS].sort(() => rng.next() - 0.5);
  // Four groups of four: Crownland with three nations, then twelve more nations.
  const groups: { name: string; s: number }[][] = [[{ name: HOME_NATION, s: home }], [], [], []];
  nations.forEach(([name, off], i) => groups[i < 3 ? 0 : 1 + Math.floor((i - 3) / 4)].push({ name, s: home + off }));
  const matches: TournamentMatch[] = [];
  const fit = me.injuredWeeks === 0 && me.suspended === 0 && st.level === 'senior';
  const you = fit ? { min: 0, goals: 0, assists: 0, apps: 0 } : null;
  const human = (ours: number, theirs: number) => {
    if (!you) return;
    const line = humanLine(g, rng, st, ours, theirs);
    you.min += line.min; you.goals += line.goals; you.assists += line.assists; if (line.min > 0) you.apps++;
  };

  const table = groups.map(grp => {
    const rows = grp.map(t => ({ ...t, pts: 0, gd: 0, gf: 0 }));
    for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
      const [a, b] = scoreline(rng, rows[i].s, rows[j].s);
      rows[i].gf += a; rows[j].gf += b; rows[i].gd += a - b; rows[j].gd += b - a;
      if (a > b) rows[i].pts += 3; else if (a < b) rows[j].pts += 3; else { rows[i].pts++; rows[j].pts++; }
      if (grp === groups[0] && (i === 0 || j === 0)) {
        const [o, t, opp] = i === 0 ? [a, b, rows[j]] : [b, a, rows[i]];
        matches.push({ stage: 'Group stage', opp: opp.name, ours: o, theirs: t });
        human(o, t);
      }
    }
    return rows.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || y.s - x.s);
  });

  let stage: number;
  const ours = table[0].findIndex(t => t.name === HOME_NATION);
  if (ours > 1) return finish(g, rng, 0, matches, you, st);
  // Quarter-finals: A1-B2, B1-A2, C1-D2, D1-C2.
  const qf: [typeof table[0][0], typeof table[0][0]][] = [[table[0][0], table[1][1]], [table[1][0], table[0][1]], [table[2][0], table[3][1]], [table[3][0], table[2][1]]];
  const ko = (a: { name: string; s: number }, b: { name: string; s: number }) => {
    let [x, y] = scoreline(rng, a.s, b.s);
    let pens: [number, number] | undefined;
    if (x === y) { pens = shootout(rng, a.s - b.s); }
    return { x, y, win: x > y || (x === y && pens![0] > pens![1]) ? a : b, pens };
  };
  const play = (tie: [{ name: string; s: number }, { name: string; s: number }], label: string) => {
    const r = ko(tie[0], tie[1]);
    if (tie[0].name === HOME_NATION || tie[1].name === HOME_NATION) {
      const usFirst = tie[0].name === HOME_NATION;
      const o = usFirst ? r.x : r.y, t = usFirst ? r.y : r.x;
      matches.push({ stage: label, opp: usFirst ? tie[1].name : tie[0].name, ours: o, theirs: t, pens: r.pens ? (usFirst ? r.pens : [r.pens[1], r.pens[0]]) : undefined });
      human(o, t);
    }
    return r.win;
  };
  let alive = qf.map(t => play(t, 'Quarter-final'));
  stage = 1;
  if (!alive.some(t => t.name === HOME_NATION)) return finish(g, rng, 1, matches, you, st);
  alive = [play([alive[0], alive[1]], 'Semi-final'), play([alive[2], alive[3]], 'Semi-final')];
  stage = 2;
  if (!alive.some(t => t.name === HOME_NATION)) return finish(g, rng, 2, matches, you, st);
  const champ = play([alive[0], alive[1]], 'Final');
  stage = champ.name === HOME_NATION ? 4 : 3;
  return finish(g, rng, stage, matches, you, st);
}

function finish(g: Game, rng: Rng, stage: number, matches: TournamentMatch[], you: TournamentResult['you'], st: Standing): TournamentResult {
  const c = g.career.intl;
  if (you && you.apps > 0) { c.caps += you.apps; c.goals += you.goals; c.assists += you.assists; }
  c.tournaments.push({ season: g.season, result: RESULT[stage], goals: you?.goals ?? 0, played: !!you });
  if (you) humanOf(g).condition = clamp(humanOf(g).condition - 10, 20, 100);
  void rng; void st;
  return { season: g.season, name: TOURNAMENT_NAME, result: RESULT[stage], stage, matches, you };
}

export { STAGES };
