import { clamp, type Rng } from './rng';
import { clubOf, pushMessage, type Game } from './game';
import { applyMatchExperience } from './training';
import { explainSelection, type Status } from './match/lineup';
import type { Lineup, MatchResult } from './match/types';
import { buildLines, rowsFor, type MatchReport } from './match/report';
import { buildReplay, type ReplayTeam } from './match/replay';
import type { Fixture } from './world';
import type { Player } from './player';

const INJURY_WEEKS = [1, 1, 1, 2, 2, 3, 4, 6, 10];

/** Everything about a match that has been decided before the human's match is played. */
export interface WeekState {
  rng: Rng;
  me: Player;
  fx: Fixture;
  division: string;
  H: Lineup;
  A: Lineup;
  mySide: 'h' | 'a';
  status: Status;
  justInjured: Set<string>;
  justSuspended: Set<string>;
  played: Set<string>;
  coach: Map<string, number>;
  hard: number;
}

export type MatchCommon = Pick<WeekState, 'rng' | 'justInjured' | 'justSuspended' | 'played' | 'coach' | 'hard'>;

export const byIdOf = (g: Game) => { const m = new Map(g.players.map(p => [p.id, p])); return (id: string) => m.get(id)!; };

/**
 * Records a played match: scores, fitness, injuries, bans. Returns the player of the match.
 * League matches also count towards season stats; cup matches leave the league stats alone.
 */
export function applyMatch(g: Game, ws: MatchCommon, fx: Fixture, r: MatchResult, league = true): { id: string; rating: number } | null {
  const P = byIdOf(g);
  fx.hg = r.hg;
  fx.ag = r.ag;
  let motm: { id: string; rating: number } | null = null;
  for (const pm of Object.values(r.players)) {
    const p = P(pm.id);
    ws.played.add(p.id);
    const st = p.stats;
    if (league) {
      st.apps++; if (pm.start) st.starts++;
      st.mins += pm.min; st.goals += pm.g; st.assists += pm.a; st.yellow += pm.yellow; st.red += pm.red;
      st.ratingSum += pm.rating; st.ratingN++;
      const conceded = pm.side === 'h' ? r.ag : r.hg;
      if (conceded === 0 && pm.min >= 60 && (pm.pos === 'GK' || pm.pos === 'CB' || pm.pos === 'FB')) st.cleanSheets++;
      p.form.push(pm.rating); if (p.form.length > 5) p.form.shift();
    }
    p.condition = clamp(p.condition - (pm.min / 90) * (26 - 0.9 * p.attrs.stamina - 0.25 * p.hidden.naturalFitness), 20, 100);
    applyMatchExperience(p, pm.min, ws.coach.get(p.clubId ?? '') ?? 1);
    let ip = 0.012 * Math.exp(0.1 * (p.hidden.injuryProneness - 10)) * (1 + Math.max(0, 70 - p.condition) / 60) * (pm.min / 90) * (p.human ? 1 + 0.15 * ws.hard : 1);
    if (p.human && g.risk) ip += 0.12;
    if (p.human && (g.flags['s:reinjury'] ?? 0) > 0) ip *= 1.8;
    // Bans: a red card, or every fifth league yellow of the season.
    if (pm.red) { p.suspended = Math.max(p.suspended, pm.yellow >= 2 ? 1 : 2 + (ws.rng.chance(0.25) ? 1 : 0)); ws.justSuspended.add(p.id); if (p.human) g.flags['s:banAt'] = g.week; }
    else if (league && pm.yellow > 0 && st.yellow > 0 && st.yellow % 5 === 0) { p.suspended = Math.max(p.suspended, 1); ws.justSuspended.add(p.id); if (p.human) g.flags['s:banAt'] = g.week; }
    if (ws.rng.chance(ip)) { p.injuredWeeks = ws.rng.pick(INJURY_WEEKS); ws.justInjured.add(p.id); }
    if (!motm || pm.rating > motm.rating) motm = { id: pm.id, rating: pm.rating };
  }
  if (motm && league) P(motm.id).stats.motm++;
  return motm;
}

export interface HumanMatchMeta {
  /** What the report is filed under. League reports use the matchday; cup reports use 100 plus the round. */
  key: number;
  comp: 'league' | 'cup';
  pens?: [number, number];
}

/** Files the human's match: the report, selection trust, confidence, the moments used and the inbox message. */
export function recordHumanMatch(g: Game, ws: WeekState, r: MatchResult, motm: { id: string; rating: number } | null, meta: HumanMatchMeta): MatchReport {
  const P = byIdOf(g);
  const { me, fx, H, A, mySide } = ws;
  const L = mySide === 'h' ? H : A;
  const club = clubOf(g, me.clubId)!;
  const myG = mySide === 'h' ? r.hg : r.ag, opG = mySide === 'h' ? r.ag : r.hg;
  const clubName = (side: 'h' | 'a') => clubOf(g, side === 'h' ? fx.h : fx.a)!.name;
  const teamOf = (id: string, formation: Lineup['formation']): ReplayTeam => { const c = clubOf(g, id)!; return { clubId: id, name: c.name, short: c.short, c1: c.c1, c2: c.c2, formation }; };
  const result = myG > opG ? 'w' : myG < opG ? 'l' : 'd';
  const report: MatchReport = {
    season: g.season, week: meta.key, division: ws.division, h: fx.h, a: fx.a, hg: r.hg, ag: r.ag, mySide,
    result,
    comp: meta.comp,
    pens: meta.pens,
    lines: buildLines(r, mySide, me.id, id => P(id).name, clubName, a => ws.rng.pick(a)),
    team: r.team, formation: { h: H.formation, a: A.formation }, mentality: r.mentality,
    ratings: { h: rowsFor(r, 'h', P), a: rowsFor(r, 'a', P) },
    status: ws.status, note: explainSelection(L, me, g.players, club.mgr.name.split(' ').slice(-1)[0], { week: g.week, trust: g.trust, sitOut: g.sitOut }),
    me: r.players[me.id] ?? null,
    replay: buildReplay(r, teamOf(fx.h, H.formation), teamOf(fx.a, A.formation), P),
    moments: r.moments?.logs ?? [],
    motm: motm ? { name: P(motm.id).name, club: clubOf(g, P(motm.id).clubId)!.name, rating: motm.rating } : null,
  };
  g.reports.unshift(report);
  if (g.reports.length > 8) g.reports.pop();
  const mr = report.me;
  if (mr && mr.min >= 20) g.trust = clamp(g.trust + (mr.rating >= 7.5 ? 0.35 : mr.rating >= 7 ? 0.15 : mr.rating < 5.8 ? -0.3 : 0), -5, 5);
  const conf = (r.moments?.confidence ?? g.confidence) + (result === 'w' ? 2 : result === 'l' ? -2 : 0);
  g.confidence = clamp(conf + (50 - conf) * 0.15, 5, 95);
  if (r.moments) g.recentMoments = [...r.moments.used, ...g.recentMoments].slice(0, 12);
  const opp = clubOf(g, fx.h === me.clubId ? fx.a : fx.h)!;
  const pensText = meta.pens ? ` (${meta.pens[mySide === 'h' ? 0 : 1]}-${meta.pens[mySide === 'h' ? 1 : 0]} on penalties)` : '';
  const won = result === 'w' || (meta.pens ? meta.pens[mySide === 'h' ? 0 : 1] > meta.pens[mySide === 'h' ? 1 : 0] : false);
  pushMessage(g, {
    week: g.week, from: meta.comp === 'cup' ? 'Cup report' : 'Match report',
    subject: `${club.short} ${myG}-${opG} ${opp.short}${pensText}${mr ? `, you rated ${mr.rating.toFixed(1)}` : ''}`,
    body: meta.comp === 'cup'
      ? `${won ? 'Through' : 'Out'} in the ${ws.division}. ${report.note}`
      : `${result === 'w' ? 'Win' : result === 'l' ? 'Defeat' : 'Draw'} on matchday ${g.week}. ${report.note}`,
  });
  return report;
}
