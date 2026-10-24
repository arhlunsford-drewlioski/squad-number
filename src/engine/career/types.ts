export type HonourKind = 'league' | 'promotion' | 'cup' | 'cupFinal' | 'boot' | 'poty' | 'young' | 'clubPoty' | 'clubBoot' | 'tournament' | 'tournamentFinal';

export interface Honour {
  season: number;
  kind: HonourKind;
  label: string;
  club: string;
  /** The division the club was in that season. Trophies in higher divisions count for more. */
  div: number;
}

export interface CupTie {
  h: string;
  a: string;
  hg: number | null;
  ag: number | null;
  /** Shoot-out score, home first, when the tie was level after 90 minutes. */
  pens?: [number, number];
  winner: string | null;
  neutral?: boolean;
}

export interface CupRound {
  name: string;
  /** Played after this league matchday. */
  after: number;
  ties: CupTie[];
  /** Clubs that skip the round (preliminary round only). */
  byes: string[];
}

export interface CupState {
  season: number;
  rounds: CupRound[];
  /** Clubs still in the competition and not yet drawn into a finished round. */
  alive: string[];
  winner: string | null;
  /** The round whose tie involving your club is waiting to be played. */
  pending: { round: number; tie: number } | null;
  /** The round you went out in, or null while you are still in. */
  outAt: number | null;
}

export type GoalKind = 'apps' | 'goals' | 'assists' | 'cleanSheets' | 'rating' | 'ovr' | 'finish' | 'cup';

export interface SeasonGoal {
  id: string;
  kind: GoalKind;
  text: string;
  target: number;
}

export interface GoalResult extends SeasonGoal {
  actual: number;
  met: boolean;
}

export type IntlLevel = 'none' | 'u21' | 'senior';

export interface Career {
  /** 0 to 100. How well known you are. Feeds call-ups and offers. */
  rep: number;
  honours: Honour[];
  cup: { apps: number; goals: number; assists: number };
  intl: { level: IntlLevel; caps: number; goals: number; assists: number; u21Caps: number; u21Goals: number; tournaments: { season: number; result: string; goals: number; played: boolean }[] };
  goals: SeasonGoal[];
  goalLog: { season: number; met: number; total: number }[];
  achievements: { id: string; season: number }[];
  peak: { ovr: number; season: number; age: number };
  retired: boolean;
}

export const newCareer = (ovr: number, age: number): Career => ({
  rep: 8, honours: [], cup: { apps: 0, goals: 0, assists: 0 },
  intl: { level: 'none', caps: 0, goals: 0, assists: 0, u21Caps: 0, u21Goals: 0, tournaments: [] },
  goals: [], goalLog: [], achievements: [], peak: { ovr, season: 1, age }, retired: false,
});
