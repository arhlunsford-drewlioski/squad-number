import { ATTR_IDS } from '../attributes';
import { generatePlayer, type Player } from '../player';
import type { Position } from '../positions';
import { makeRng, type Rng } from '../rng';
import { hasTrait, TRAIT_BY_ID, type TraitId } from '../traits';
import { fill } from './engine';
import { check, expectedValue, rollTier, tierProbs } from './resolver';
import { TEMPLATES } from './templates';
import { TIERS, type MomentCtx, type OptionDef, type ResultKind, type TemplateDef, type Tier } from './types';

/** The situation a moment is previewed in. */
export interface LabSetup {
  /** Use these attributes for you instead of a flat level. */
  me?: Player;
  myLevel: number;
  oppLevel: number;
  conf: number;
  /** Freshness, 0.8 to 1. */
  fat: number;
  minute: number;
  lead: number;
  slot: Position;
  traits: TraitId[];
}

export const DEFAULT_SETUP: LabSetup = { myLevel: 10, oppLevel: 10, conf: 50, fat: 1, minute: 50, lead: 0, slot: 'ST', traits: [] };

const rng0 = makeRng(4242);
/** A player whose every attribute is the same level. */
export function flatPlayer(level: number, pos: Position, traits: TraitId[] = []): Player {
  const p = generatePlayer(rng0, { id: `lab-${pos}-${level}`, position: pos, age: 24, targetOvr: 50, clubId: 'lab' });
  for (const k of ATTR_IDS) p.attrs[k] = level;
  p.traits = traits;
  p.hidden = { professionalism: 10, determination: 10, naturalFitness: 10, injuryProneness: 10, consistency: 10, bigMatches: 10 };
  return p;
}

export function labCtx(s: LabSetup): MomentCtx {
  const me = s.me ?? flatPlayer(s.myLevel, s.slot, s.traits);
  const opp = flatPlayer(s.oppLevel, 'CB');
  const gk = flatPlayer(s.oppLevel, 'GK');
  const mate = flatPlayer(s.oppLevel, 'ST');
  const oppAvg: MomentCtx['oppAvg'] = {};
  for (const k of ATTR_IDS) oppAvg[k] = s.oppLevel;
  return { minute: s.minute, lead: s.lead, slot: s.slot, me, fat: s.fat, conf: s.conf, opp, oppFat: 1, mate, gk, teamShield: s.oppLevel, oppAvg };
}

export interface OptionReport {
  id: string;
  label: string;
  risk: OptionDef['risk'];
  locked: boolean;
  lockText?: string;
  mine: number;
  theirs: number;
  edge: number;
  s: number;
  tiers: [number, number, number, number];
  ev: number;
  /** Chance of each kind of result, from the tier odds. */
  results: Partial<Record<ResultKind, number>>;
}

export function reportFor(t: TemplateDef, s: LabSetup): OptionReport[] {
  const c = labCtx(s);
  return t.options.map(o => {
    const r = check(c, t, o);
    const tiers = tierProbs(r.s, o.risk);
    const results: Partial<Record<ResultKind, number>> = {};
    o.out.forEach((out, i) => { results[out.r] = (results[out.r] ?? 0) + tiers[i]; });
    const needsAttr = !!o.needs && c.me.attrs[o.needs.attr] < o.needs.min;
    const needsTrait = !!o.trait && !hasTrait(c.me, o.trait);
    return {
      id: o.id, label: fill(o.label, { minute: s.minute }), risk: o.risk, locked: needsAttr || needsTrait,
      lockText: needsTrait ? `Needs the ${TRAIT_BY_ID[o.trait!].label} trait` : needsAttr ? `Needs ${o.needs!.attr} ${o.needs!.min}` : undefined,
      mine: r.mine, theirs: r.theirs, edge: r.edge, s: r.s, tiers, ev: expectedValue(o, r.s), results,
    };
  });
}

export function sampleOutcome(t: TemplateDef, optionId: string, s: LabSetup, rng: Rng): { tier: Tier; result: ResultKind; text: string } {
  const o = t.options.find(x => x.id === optionId)!;
  const c = labCtx(s);
  const { s: p } = check(c, t, o);
  const tier = rollTier(p, o.risk, rng);
  const out = o.out[TIERS.indexOf(tier)];
  return { tier, result: out.r, text: fill(out.text, { opp: c.opp, mate: c.mate, gk: c.gk, minute: s.minute }) };
}

export interface HealthIssue { template: string; message: string }

/** Checks that the library behaves: better players do better, nothing is a free win, every position has choice. */
export function libraryHealth(): { issues: HealthIssue[]; byKind: Record<string, number>; traitOptions: number; options: number; selectable: number } {
  const issues: HealthIssue[] = [];
  const byKind: Record<string, number> = {};
  let options = 0, traitOptions = 0;
  for (const t of TEMPLATES) {
    if (!t.followOnly) byKind[t.kind] = (byKind[t.kind] ?? 0) + 1;
    options += t.options.length;
    traitOptions += t.options.filter(o => o.trait).length;
    const pos = (t.for[0] ?? 'ST') as Position;
    const at = (lvl: number, traits: TraitId[]) => reportFor(t, { ...DEFAULT_SETUP, myLevel: lvl, slot: pos, traits });
    const all = Object.keys(TRAIT_BY_ID) as TraitId[];
    const low = at(6, all), mid = at(10, all), high = at(14, all);
    for (let i = 0; i < t.options.length; i++) {
      if (!(high[i].ev >= low[i].ev - 0.02)) issues.push({ template: t.id, message: `${t.options[i].id}: a better player does worse (${low[i].ev.toFixed(2)} to ${high[i].ev.toFixed(2)})` });
    }
    const open = mid.filter(r => !r.locked).map(r => r.ev).sort((a, b) => b - a);
    if (open.length >= 2 && open[0] - open[1] > 0.35) issues.push({ template: t.id, message: `one option dominates at equal level (${open[0].toFixed(2)} against ${open[1].toFixed(2)})` });
    if (t.options.filter(o => !o.trait && !o.needs).length < 2) issues.push({ template: t.id, message: 'fewer than two options are open to everyone' });
  }
  return { issues, byKind, traitOptions, options, selectable: TEMPLATES.filter(t => !t.followOnly).length };
}

