import type { Game } from '../game';
import { humanOf } from '../game';
import { totals } from './achievements';
import type { HonourKind } from './types';

const TITLES: { min: number; title: string; blurb: string }[] = [
  { min: 0, title: 'A short career', blurb: 'The game gave you little time, and you made the most of what you had.' },
  { min: 15, title: 'Journeyman', blurb: 'A professional for years, known in a few dressing rooms and forgotten in most stands.' },
  { min: 30, title: 'Solid professional', blurb: 'You earned a decent living and the respect of the teams you played for.' },
  { min: 45, title: 'Top-flight regular', blurb: 'Years at a high level, with moments supporters still talk about.' },
  { min: 64, title: 'Club legend', blurb: 'There are people who will say they saw you play for the rest of their lives.' },
  { min: 88, title: 'National icon', blurb: 'A career that mattered well beyond one club. Your name sits on a list of the best the country produced.' },
  { min: 118, title: 'All-time great', blurb: 'The sort of career that other careers are measured against.' },
];

/** Base worth of each honour. Trophies and awards in the higher divisions are worth more. */
const POINTS: Partial<Record<HonourKind, number>> = { league: 4, cup: 3, promotion: 0.3, boot: 2, poty: 3, young: 1, clubPoty: 0.6, clubBoot: 0.15, tournament: 10, tournamentFinal: 3 };
const DIV_WEIGHT = [0, 1.6, 0.8, 0.4, 0.25];
const NATIONAL: HonourKind[] = ['tournament', 'tournamentFinal'];

export interface Legacy {
  score: number;
  title: string;
  blurb: string;
  seasons: number;
  apps: number;
  goals: number;
  assists: number;
  peak: { ovr: number; season: number; age: number };
  caps: number;
  intlGoals: number;
  trophies: { kind: HonourKind; label: string; count: number }[];
  clubs: { name: string; seasons: number; apps: number; goals: number }[];
  achievements: number;
  parts: { label: string; points: number }[];
}

const KIND_LABEL: Record<HonourKind, string> = {
  league: 'League titles', cup: 'Cup wins', promotion: 'Promotions', cupFinal: 'Cup finals lost', boot: 'Golden Boots', poty: 'Player of the Year', young: 'Young Player of the Year',
  clubPoty: 'Club Player of the Year', clubBoot: 'Club top scorer', tournament: 'Continental titles', tournamentFinal: 'Continental finals lost',
};

/** What the career amounted to, from everything on record. */
export function legacyOf(g: Game): Legacy {
  const t = totals(g);
  const c = g.career;
  const counts = new Map<HonourKind, number>();
  for (const h of c.honours) counts.set(h.kind, (counts.get(h.kind) ?? 0) + 1);
  const honourPts = c.honours.reduce((s, h) => s + (POINTS[h.kind] ?? 0) * (NATIONAL.includes(h.kind) ? 1 : DIV_WEIGHT[h.div ?? 3]), 0);
  const topFlight = g.history.filter(h => h.division === 'Crown League').length + (g.clubs.find(x => x.id === humanOf(g).clubId)?.division === 1 && g.phase === 'play' ? 1 : 0);
  const parts = [
    { label: 'Peak level', points: Math.max(0, c.peak.ovr - 60) * 1.1 },
    { label: 'Honours', points: honourPts },
    { label: 'International career', points: Math.min(12, c.intl.caps * 0.2 + c.intl.goals * 0.3) },
    { label: 'Top-flight career', points: Math.min(12, topFlight * 0.8) },
    { label: 'Goals and appearances', points: Math.min(6, t.goals * 0.025 + t.apps * 0.01) },
    { label: 'Longevity', points: Math.min(4, t.seasons * 0.25) },
    { label: 'Reputation', points: c.rep * 0.08 },
    { label: 'Achievements', points: Math.min(8, c.achievements.length * 0.3) },
  ].map(p => ({ ...p, points: Math.round(p.points * 10) / 10 }));
  const score = Math.round(parts.reduce((s, p) => s + p.points, 0));
  const tier = [...TITLES].reverse().find(x => score >= x.min)!;
  const byClub = new Map<string, { name: string; seasons: number; apps: number; goals: number }>();
  for (const h of g.history) {
    const e = byClub.get(h.clubName) ?? { name: h.clubName, seasons: 0, apps: 0, goals: 0 };
    e.seasons++; e.apps += h.apps; e.goals += h.goals;
    byClub.set(h.clubName, e);
  }
  return {
    score, title: tier.title, blurb: tier.blurb, seasons: t.seasons, apps: t.apps, goals: t.goals, assists: t.assists, peak: c.peak, caps: c.intl.caps, intlGoals: c.intl.goals,
    trophies: [...counts].map(([kind, count]) => ({ kind, label: KIND_LABEL[kind], count })).sort((a, b) => b.count - a.count),
    clubs: [...byClub.values()], achievements: c.achievements.length, parts,
  };
}

export const canRetire = (g: Game) => humanOf(g).age >= 33;
export const mustRetire = (g: Game, ovrEnd: number) => { const age = humanOf(g).age; return age >= 37 || (age >= 34 && ovrEnd < 40); };
