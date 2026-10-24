import { CUP_ROUNDS, INTL_WEEKS } from './career';
import { clubOf, humanOf, WEEKS, type Game } from './game';
import { windowOf } from './market/transfers';

export type NewsKind = 'match' | 'transfer' | 'career' | 'club';

export interface NewsItem {
  key: string;
  season: number;
  week: number;
  kind: NewsKind;
  title: string;
  from: string;
  body?: string;
  playerId?: string;
  clubId?: string;
  /** Set for inbox messages, so reading the item can mark the message read. */
  msgId?: number;
  unread?: boolean;
}

const KIND_OF_SENDER: Record<string, NewsKind> = {
  'Match report': 'match', 'Cup report': 'match', 'Crown Cup': 'match',
  Agent: 'career', Achievement: 'career', Federation: 'career', Coach: 'career', Physio: 'career',
};

export const NEWS_KINDS: { id: NewsKind | 'all'; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'match', label: 'Matches' }, { id: 'transfer', label: 'Transfers' }, { id: 'career', label: 'Career' }, { id: 'club', label: 'Club' },
];

/** One feed from your messages and the league's transfer business, newest first. */
export function newsFeed(g: Game): NewsItem[] {
  const me = humanOf(g);
  const mine = me.clubId;
  const items: NewsItem[] = g.inbox.map(m => ({
    key: 'm' + m.id, season: g.season, week: Math.min(m.week, WEEKS), kind: KIND_OF_SENDER[m.from] ?? 'club', title: m.subject, from: m.from, body: m.body, msgId: m.id, unread: !m.read,
  }));
  const label: Record<string, string> = { transfer: 'signs for', loan: 'joins on loan', free: 'signs as a free agent', release: 'is released by', retired: 'retires from' };
  g.deals.forEach((d, i) => {
    if (!(d.ovr >= 65 || d.fee >= 1e6 || d.from === mine || d.to === mine)) return;
    const club = clubOf(g, d.kind === 'release' || d.kind === 'retired' ? d.from : d.to);
    items.push({
      key: `d${i}`, season: d.season, week: d.week, kind: 'transfer', from: d.kind === 'loan' ? 'Loan' : 'Transfer',
      title: `${d.name} ${label[d.kind]} ${club ? club.name : 'football'}`, playerId: d.playerId, clubId: club?.id,
    });
  });
  // Newest first; at the same date, your own messages come before league business.
  return items.map((it, i) => ({ it, i })).sort((a, b) => b.it.season - a.it.season || b.it.week - a.it.week || a.i - b.i).map(x => x.it);
}

/** The things worth knowing before you press Continue. */
export function todayNotes(g: Game): string[] {
  const me = humanOf(g);
  const notes: string[] = [];
  if (g.phase !== 'play') return notes;
  if (me.suspended > 0) notes.push(`Suspended for ${me.suspended} more match${me.suspended === 1 ? '' : 'es'}.`);
  if (me.injuredWeeks > 0) notes.push(`Injured, ${me.injuredWeeks} week${me.injuredWeeks === 1 ? '' : 's'} to go.`);
  else if (me.condition < 70) notes.push(`Condition is ${Math.round(me.condition)}%. Consider an easier training week.`);
  const win = windowOf(g.week);
  if (win) notes.push(`The ${win === 'summer' ? 'summer' : 'January'} transfer window is open.`);
  if (g.contract && g.contract.years <= 1 && g.week >= 20) notes.push('Your contract runs out at the end of the season.');
  const ri = CUP_ROUNDS.findIndex(r => r.after === g.week);
  if (ri >= 0 && g.cup.outAt === null && g.cup.rounds[ri].ties.some(t => t.h === me.clubId || t.a === me.clubId)) notes.push(`Your ${g.cup.rounds[ri].name.toLowerCase()} tie follows this matchday.`);
  if (INTL_WEEKS.includes(g.week) && g.career.intl.level !== 'none') notes.push('An international break follows this matchday.');
  if (g.promise === g.week) notes.push('The manager has promised you a start.');
  return notes;
}
