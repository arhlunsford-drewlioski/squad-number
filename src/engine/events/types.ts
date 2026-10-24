import type { Game } from '../game';
import type { Club } from '../world';
import type { Player } from '../player';
import type { Rng } from '../rng';

/** The event waiting for the player's answer. Serialisable: the definition is looked up by id. */
export interface PendingEvent {
  id: string;
  week: number;
  data: Record<string, number | string>;
}

export interface EventLogEntry { season: number; week: number; id: string; title: string; choice: string }

export interface EventCtx {
  g: Game;
  me: Player;
  club: Club;
  rng: Rng;
  ovr: number;
  /** Matches started in the last six played. */
  starts6: number;
  /** Matches played in the last six, from the stored reports. */
  played6: number;
  /** Average rating over the last five matches. 0 when none. */
  form: number;
  /** Place among players in the same position at the club, 0 being the best. */
  rank: number;
  /** Absolute week, so cooldowns work across seasons. */
  abs: number;
}

export interface EventOption {
  id: string;
  label: string;
  desc: string;
  /** Carries out the choice and returns what happened, in a sentence or two. */
  apply: (c: EventCtx, data: PendingEvent['data']) => string;
}

export interface EventDef {
  id: string;
  from: string;
  title: string;
  /** Zero means not eligible. Urgent events fire as soon as they are eligible. */
  weight: (c: EventCtx) => number;
  urgent?: boolean;
  /** Weeks before the same event can come up again. */
  cooldown: number;
  /** Values the event fixes when it fires, such as an offer or a rival club. */
  data?: (c: EventCtx) => PendingEvent['data'];
  body: (c: EventCtx, data: PendingEvent['data']) => string;
  options: (c: EventCtx, data: PendingEvent['data']) => EventOption[];
}
