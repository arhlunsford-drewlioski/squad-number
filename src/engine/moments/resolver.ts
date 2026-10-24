import type { Attrs } from '../attributes';
import { hashUnit, clamp, type Rng } from '../rng';
import { sigmoid } from '../util';
import { hasTrait } from '../traits';
import type { Band, MomentCtx, OptionDef, Outcome, ResultKind, Risk, TemplateDef, Tier, Weights } from './types';

/** Slope of the success curve against the edge. Calibrated with scripts/moment-lab.ts. */
const K = 0.42;

/** Weighted mean of attributes on the 1-20 scale. */
export function composite(a: Attrs, w: Weights): number {
  let s = 0, t = 0;
  for (const k in w) { const wk = w[k as keyof Weights] ?? 0; s += (a[k as keyof Attrs] ?? 0) * wk; t += wk; }
  return t ? s / t : 0;
}

export const gkComposite = (a: Attrs) =>
  a.handling * 0.28 + a.reflexes * 0.3 + a.oneOnOnes * 0.12 + a.aerialReach * 0.1 + a.commandOfArea * 0.1 + a.positioning * 0.05 + a.concentration * 0.05;

/** How well the player reads a situation: 0 for a newcomer, close to 1 for a sharp player. */
export function readQuality(me: { attrs: Attrs; traits?: import('../traits').TraitId[] }): number {
  const a = me.attrs;
  return clamp(((a.vision + a.decisions + a.anticipation) / 3 - 3) / 15 + (hasTrait(me, 'reader') ? 0.15 : 0), 0, 1);
}

/** Your side of the check, the opponent's side, and the edge between them. Also returns the chance of a good execution. */
export function check(c: MomentCtx, t: TemplateDef, o: OptionDef): { mine: number; theirs: number; edge: number; s: number } {
  const instrBoost = c.instr && (o.id === 'shoot' || o.id === 'placeIt') ? (c.instr.shooting === 'more' ? 0.2 : c.instr.shooting === 'less' ? -0.2 : 0) : 0;
  const mine = composite(c.me.attrs, o.mine) * c.fat;
  let theirs: number;
  if (o.theirs === 'gk') theirs = c.gk ? gkComposite(c.gk.attrs) : 8;
  else if (o.theirs === 'team' || !c.opp) theirs = c.teamShield;
  else theirs = composite(c.opp.attrs, o.theirs) * c.oppFat;
  const pressure = t.pressure ? ((c.me.attrs.composure + c.me.hidden.bigMatches) / 2 - 10) * 0.1 : 0;
  const traitBoost = o.traitBonus && hasTrait(c.me, o.traitBonus.trait) ? o.traitBonus.bias : 0;
  const edge = mine - theirs + 0.03 * (c.conf - 50) + (o.bias ?? 0) + pressure + instrBoost + traitBoost;
  return { mine, theirs, edge, s: sigmoid(K * edge) };
}

const RISK: Record<Risk, { rg: number; rd: number; rp: number }> = {
  safe: { rg: 0.35, rd: 0.04, rp: 0.85 },
  balanced: { rg: 0.6, rd: 0.12, rp: 1.0 },
  gamble: { rg: 1.2, rd: 0.24, rp: 1.05 },
};

/** Probabilities of a great, good, poor and disastrous execution. */
export function tierProbs(s: number, risk: Risk): [number, number, number, number] {
  const r = RISK[risk];
  const great = clamp(r.rg * s * s, 0, 0.95);
  const dis = clamp(r.rd * (1 - s) * (1 - s), 0, 0.6);
  const poor = clamp(r.rp * (1 - s) - dis, 0, 0.95);
  const good = Math.max(0, 1 - great - dis - poor);
  const sum = great + good + poor + dis;
  return [great / sum, good / sum, poor / sum, dis / sum];
}

export function rollTier(s: number, risk: Risk, rng: Rng): Tier {
  const p = tierProbs(s, risk);
  const x = rng.next();
  return x < p[0] ? 'great' : x < p[0] + p[1] ? 'good' : x < p[0] + p[1] + p[2] ? 'poor' : 'disaster';
}

/** Rough worth of each result, for choosing automatically. */
export const VALUE: Record<ResultKind, number> = {
  goal: 1, assist: 0.75, keyPass: 0.3, saved: 0.12, wide: 0.02, blocked: 0.02, retain: 0.05, turnover: -0.12, counter: -0.3,
  tackleWon: 0.35, cleared: 0.2, oppShot: -0.3, foulConceded: -0.18, foulWon: 0.08, injury: -0.5, nothing: 0, follow: 0.45,
};
const outValue = (o: Outcome) => (o.r === 'oppShot' || o.r === 'counter' ? VALUE[o.r] - (o.q ?? 0.2) : VALUE[o.r]);

/** Expected worth of an option given the chance of a good execution. */
export function expectedValue(o: OptionDef, s: number): number {
  const p = tierProbs(s, o.risk);
  return o.out.reduce((a, out, i) => a + p[i] * outValue(out), 0);
}

const NOISE = 0.34;
/** What the card shows for an option: the true chance, blurred by how well the player reads the game. */
export function bandOf(s: number, read: number, seed: string): Band {
  if (read < 0.2) return 'unclear';
  const sigma = NOISE * (1 - read);
  const seen = clamp(s + (hashUnit(seed) - 0.5) * 2 * sigma, 0, 1);
  return seen >= 0.62 ? 'likely' : seen >= 0.4 ? 'even' : 'risky';
}

interface Tip { text: string; score: number }

/** Things a sharp player notices about the opponent. Truthful, so reading them well pays. */
export function opponentTips(c: MomentCtx, read: number): string[] {
  if (read < 0.35) return [];
  const n = read < 0.7 ? 1 : 2;
  const tips: Tip[] = [];
  const add = (text: string, score: number) => { if (score > 0) tips.push({ text, score }); };
  const avg = c.oppAvg;
  if (c.opp) {
    const a = c.opp.attrs, nm = c.opp.name.split(' ').slice(-1)[0];
    const d = (k: keyof Attrs) => a[k] - (avg[k] ?? a[k]);
    add(`${nm} is slow to turn.`, -(d('acceleration') + d('agility')) / 2 - 2);
    add(`${nm} has no pace.`, -d('pace') - 2.5);
    add(`${nm} is quick.`, d('pace') - 2.5);
    add(`${nm} is strong in the air.`, (d('heading') + d('jumping')) / 2 - 2);
    add(`${nm} is weak in the air.`, -(d('heading') + d('jumping')) / 2 - 2);
    add(`${nm} reads the game well.`, d('anticipation') - 2);
    add(`${nm} can be caught out by a quick movement.`, -d('anticipation') - 2);
    add(`${nm} likes to dive in.`, d('aggression') - d('composure') - 2.5);
    add(`${nm} is hard to get past in a duel.`, (d('tackling') + d('strength')) / 2 - 2);
    add(`${nm} is tiring.`, c.minute > 55 ? -d('stamina') - 2 : 0);
  }
  if (c.gk) {
    const a = c.gk.attrs, nm = c.gk.name.split(' ').slice(-1)[0];
    add(`${nm} is weak in one on ones.`, 9 - a.oneOnOnes);
    add(`${nm} is slow to react to shots.`, 9 - a.reflexes);
    add(`${nm} comes off his line.`, a.commandOfArea - 11);
    add(`${nm} is uncertain with crosses.`, 8 - a.aerialReach);
    add(`${nm} can spill shots.`, 8 - a.handling);
  }
  return tips.sort((x, y) => y.score - x.score).slice(0, n).map(t => t.text);
}

export function resolveTierOutcome(o: OptionDef, tier: Tier): Outcome {
  return o.out[['great', 'good', 'poor', 'disaster'].indexOf(tier)];
}
