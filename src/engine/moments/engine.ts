import type { Player } from '../player';
import { hashUnit, type Rng } from '../rng';
import { hasTrait, TRAIT_BY_ID } from '../traits';
import { bandOf, check, expectedValue, opponentTips, readQuality } from './resolver';
import type { MomentCtx, MomentRequest, OptionView, ResultKind, TemplateDef } from './types';

/** Surname for use in text. */
export const surname = (p: { name: string }) => p.name.split(' ').slice(-1)[0];

export interface Tokens { opp?: Player | null; mate?: Player | null; gk?: Player | null; minute: number }

export function fill(text: string, t: Tokens): string {
  return text
    .replace(/\{opp\}/g, t.opp ? surname(t.opp) : 'the defender')
    .replace(/\{mate\}/g, t.mate ? surname(t.mate) : 'a teammate')
    .replace(/\{gk\}/g, t.gk ? surname(t.gk) : 'the keeper')
    .replace(/\{minute\}/g, String(t.minute));
}

/** Match rating and confidence effects when an outcome does not set its own. Stats such as goals are rated elsewhere. */
export const DEFAULT_RATE: Partial<Record<ResultKind, number>> = {
  retain: 0.15, turnover: -0.12, counter: -0.25, tackleWon: 0.3, cleared: 0.22, oppShot: -0.3, foulConceded: -0.15, foulWon: 0.14, saved: 0.1, wide: -0.04, blocked: 0.06, keyPass: 0.12, goal: 0, assist: 0,
};
export const DEFAULT_CONF: Partial<Record<ResultKind, number>> = {
  goal: 6, assist: 5, keyPass: 2, saved: 1, wide: -1, blocked: 0, retain: 1, turnover: -2, counter: -3, tackleWon: 3, cleared: 2, oppShot: -3, foulConceded: -2, foulWon: 1,
};

export interface Built { req: MomentRequest; s: Record<string, number>; tpl: TemplateDef }

/** What the player sees, plus the true chance of success for each option. */
export function buildRequest(tpl: TemplateDef, c: MomentCtx, meta: { side: 'h' | 'a'; humanId: string; scoreOwn: number; scoreOpp: number; stage: 1 | 2; seed: string }): Built {
  const read = readQuality(c.me);
  const tok: Tokens = { opp: c.opp, mate: c.mate, gk: c.gk, minute: c.minute };
  const s: Record<string, number> = {};
  const options: OptionView[] = tpl.options.map(o => {
    s[o.id] = check(c, tpl, o).s;
    const needsAttr = !!o.needs && c.me.attrs[o.needs.attr] < o.needs.min;
    const needsTrait = !!o.trait && !hasTrait(c.me, o.trait);
    const locked = needsAttr || needsTrait;
    return {
      id: o.id, label: fill(o.label, tok), desc: fill(o.desc, tok), risk: o.risk,
      band: bandOf(s[o.id], read, `${meta.seed}:${tpl.id}:${o.id}`), locked,
      lockText: needsTrait ? `Needs the ${TRAIT_BY_ID[o.trait!].label} trait` : needsAttr ? `Needs ${o.needs!.attr.replace(/([A-Z])/g, ' $1').toLowerCase()} ${o.needs!.min}` : undefined,
    };
  });
  const req: MomentRequest = {
    id: tpl.id, title: tpl.title, minute: c.minute, script: tpl.script, scoreOwn: meta.scoreOwn, scoreOpp: meta.scoreOpp,
    prompt: fill(tpl.prompt, tok), defending: tpl.kind === 'defend', side: meta.side, humanId: meta.humanId,
    opp: c.opp ? { id: c.opp.id, name: c.opp.name, pos: c.opp.position } : undefined,
    mate: c.mate ? { id: c.mate.id, name: c.mate.name, pos: c.mate.position } : undefined,
    gk: c.gk ? { id: c.gk.id, name: c.gk.name } : undefined,
    options, tips: opponentTips(c, read), read, stage: meta.stage,
  };
  return { req, s, tpl };
}

/** Instant mode and skipped moments: pick the option with the best expected worth, with a little noise. */
export function autoPick(tpl: TemplateDef, s: Record<string, number>, req: MomentRequest, rng: Rng): string {
  let best = '';
  let bv = -Infinity;
  for (const o of tpl.options) {
    const view = req.options.find(v => v.id === o.id)!;
    if (view.locked) continue;
    const v = expectedValue(o, s[o.id]) + (rng.next() - 0.5) * 0.12;
    if (v > bv) { bv = v; best = o.id; }
  }
  return best;
}

export const noise = (seed: string) => hashUnit(seed);
