import { GAME_VERSION, type Game } from './game';
import { ensureMarket } from './economy';
import { ensureCareer } from './career';

/** Oldest save version that can still be brought up to date. */
const OLDEST = 3;

/**
 * Brings a saved game up to the current shape. Everything added since version 3 is filled in with defaults,
 * so older saves keep working. Returns null for a save too old, or too new, to read.
 */
export function migrate(g: Game): Game | null {
  if (!g || typeof g !== 'object' || !Array.isArray(g.players) || !Array.isArray(g.clubs)) return null;
  if (g.version < OLDEST || g.version > GAME_VERSION) return null;
  ensureMarket(g);
  g.event ??= null; g.eventLog ??= []; g.flags ??= {}; g.promise ??= null; g.sitOut ??= false; g.risk ??= false; g.loan ??= null;
  g.injuryHandled ??= true; g.confidence ??= 50; g.recentMoments ??= []; g.traitProgress ??= {}; g.training.traitFocus ??= null;
  for (const p of g.players) { p.suspended ??= 0; p.traits ??= []; }
  if (g.phase !== 'offers') ensureCareer(g);
  return g;
}
