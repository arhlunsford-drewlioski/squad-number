import { ATTR_BY_ID, type AttrId } from '../attributes';
import { clubOf, humanOf, makeOffers, pushMessage, roleAt, wageFor, type Game } from '../game';
import { generatePlayer, ovrOf, type Player } from '../player';
import { ovrAt } from '../rating';
import { keyAttrs, type Position } from '../positions';
import { clamp, makeRng, type Rng } from '../rng';
import { defaultPlan } from '../training';
import { marketValue } from '../economy';
import { styleWord } from '../market/managers';
import { windowOf } from '../market/transfers';
import { missingPrereq, TRAITS, TRAIT_BY_ID } from '../traits';
import type { EventCtx, EventDef, EventLogEntry, EventOption, PendingEvent } from './types';

// ---------------------------------------------------------------- helpers
const trust = (g: Game, d: number) => { g.trust = clamp(g.trust + d, -5, 5); };
const conf = (g: Game, d: number) => { g.confidence = clamp(g.confidence + d, 5, 95); };
const money = (v: number) => '£' + Math.round(v).toLocaleString('en-GB');
const weeksText = (w: number) => `${w} week${w === 1 ? '' : 's'}`;

const ADJ: Partial<Record<Position, Position[]>> = {
  ST: ['AM', 'W'], W: ['AM', 'ST', 'FB'], AM: ['CM', 'W', 'ST'], CM: ['DM', 'AM'], DM: ['CM', 'CB'], FB: ['W', 'CB', 'DM'], CB: ['DM', 'FB'],
};
const POSN: Record<Position, string> = { GK: 'goalkeeper', CB: 'centre back', FB: 'full back', DM: 'defensive midfielder', CM: 'central midfielder', AM: 'attacking midfielder', W: 'winger', ST: 'striker' };

export const ctxFor = (g: Game, rng: Rng): EventCtx => {
  const me = humanOf(g);
  const club = clubOf(g, me.clubId)!;
  const recent = g.reports.slice(0, 6);
  const played = recent.filter(r => r.me && r.me.min > 0);
  const ratings = me.form;
  const mine = ovrOf(me);
  const rank = g.players.filter(p => p.clubId === me.clubId && p.position === me.position && ovrAt(p.attrs, p.position) > ovrAt(me.attrs, me.position)).length;
  return {
    g, me, club, rng, ovr: mine, starts6: played.filter(r => r.me!.start).length, played6: played.length,
    form: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0, rank, abs: g.season * 40 + g.week,
  };
};

/** Physical decline after a serious injury. */
function setback(me: Player, amount: number) {
  for (const k of ['pace', 'acceleration', 'stamina'] as AttrId[]) me.attrs[k] = Math.max(1, me.attrs[k] - amount);
}

const lowestKey = (me: Player): AttrId => keyAttrs(me.position, 8).filter(k => me.attrs[k] < me.ceil[k]).sort((a, b) => me.attrs[a] - me.attrs[b])[0] ?? keyAttrs(me.position, 1)[0];

const opt = (id: string, label: string, desc: string, apply: EventOption['apply']): EventOption => ({ id, label, desc, apply });

// ---------------------------------------------------------------- the deck
export const EVENTS: EventDef[] = [
  // ---- club
  {
    id: 'newManager', from: 'Club', title: 'A new manager', urgent: true, cooldown: 0,
    weight: c => (c.g.flags.newMgr && c.g.flags.newMgr !== c.g.flags.newMgrHandled ? 100 : 0),
    body: c => {
      const m = c.club.mgr;
      return `${c.club.name} have a new manager: ${m.name}. He likes ${styleWord(m.style)} football in a ${m.formation}, and ${m.youth > 0.6 ? 'is happy to give young players a chance' : m.youth < 0.35 ? 'prefers experience' : 'picks on merit'}. Everyone starts again with him.`;
    },
    options: () => [
      opt('introduce', 'Introduce yourself', 'Make a good first impression.', c => { c.g.flags.newMgrHandled = c.g.flags.newMgr; trust(c.g, 0.3); return 'You have a short chat. He seems to like your attitude.'; }),
      opt('role', 'Ask where you stand', 'Find out what he thinks of you.', c => {
        c.g.flags.newMgrHandled = c.g.flags.newMgr;
        if (c.rank === 0) { trust(c.g, 0.6); return 'He tells you that you are one of his key players.'; }
        if (c.rank === 1) { trust(c.g, 0.2); return 'He says you are in the mix. It is up to you.'; }
        return 'He says you will have to earn your place like everyone else.';
      }),
      opt('quiet', 'Keep your head down', 'Let your football do the talking.', c => { c.g.flags.newMgrHandled = c.g.flags.newMgr; return 'You say nothing and get on with it.'; }),
    ],
  },
  // ---- body
  {
    id: 'injuryDiagnosis', from: 'Physio', title: 'Your injury', urgent: true, cooldown: 0,
    weight: c => (c.me.injuredWeeks > 0 && !c.g.injuryHandled ? 100 : 0),
    body: c => {
      const w = c.me.injuredWeeks;
      return `The scan is back. It is a ${w <= 2 ? 'minor' : w <= 5 ? 'moderate' : 'serious'} injury and you should be out for about ${weeksText(w)}. How do you want to handle the rehab?`;
    },
    options: () => [
      opt('standard', 'Follow the club programme', 'Steady and safe.', c => {
        c.g.injuryHandled = true;
        const w = c.me.injuredWeeks;
        if (w >= 8) { setback(c.me, 0.6); return 'You follow the programme. The long layoff takes a little pace and stamina from you.'; }
        return `You follow the club programme and expect to be back in ${weeksText(w)}.`;
      }),
      opt('intense', 'Intensive rehab', 'Back about a third sooner, but a relapse is more likely.', c => {
        c.g.injuryHandled = true;
        const w = c.me.injuredWeeks;
        c.me.injuredWeeks = Math.max(1, Math.round(w * 0.7));
        c.g.flags['s:reinjury'] = c.me.injuredWeeks + 4;
        if (w >= 8) setback(c.me, 0.8);
        return `You push hard. You should be back in ${weeksText(c.me.injuredWeeks)}, but the risk of a relapse stays high for a month after.`;
      }),
      opt('specialist', 'See a specialist', 'Quicker, and the risk of a relapse is low. The manager dislikes you going outside the club.', c => {
        c.g.injuryHandled = true;
        const w = c.me.injuredWeeks;
        c.me.injuredWeeks = Math.max(1, Math.ceil(w * 0.8));
        trust(c.g, -0.3);
        if (w >= 8) setback(c.me, 0.3);
        return `The specialist gets you moving sooner: ${weeksText(c.me.injuredWeeks)}. The manager is not happy that you went elsewhere.`;
      }),
    ],
  },
  {
    id: 'rehabProgress', from: 'Physio', title: 'Rehab check', cooldown: 3,
    weight: c => (c.me.injuredWeeks >= 3 && c.g.injuryHandled && c.g.week - (c.g.flags['s:injuredAt'] ?? c.g.week) >= 2 ? 0.7 : 0),
    body: c => `You are ${weeksText(c.me.injuredWeeks)} from a return. The physio says you are ahead of schedule and asks how hard to push.`,
    options: () => [
      opt('push', 'Push it', 'Try to shave a week off. There is a risk of a setback.', c => {
        if (c.rng.chance(0.3)) { c.me.injuredWeeks += 2; conf(c.g, -3); return 'You push too hard and feel it go again. Two weeks added.'; }
        c.me.injuredWeeks = Math.max(1, c.me.injuredWeeks - 1);
        conf(c.g, 2);
        return `It goes well. You are now ${weeksText(c.me.injuredWeeks)} from a return.`;
      }),
      opt('steady', 'Keep it steady', 'No change to the plan.', c => { conf(c.g, 1); return 'You stick to the plan.'; }),
      opt('rest', 'Take an extra rest', 'Look after yourself.', c => { trust(c.g, 0.1); return 'The physio is pleased with your patience.'; }),
    ],
  },
  {
    id: 'physioWarning', from: 'Physio', title: 'Tight hamstring', cooldown: 4,
    weight: c => (c.me.condition < 62 && c.me.injuredWeeks === 0 && c.me.suspended === 0 && !c.g.sitOut ? 0.7 : 0),
    body: c => `Your hamstrings are tight and your condition is down to ${Math.round(c.me.condition)}%. Resting this week would clear it up. Playing through it is a gamble.`,
    options: () => [
      opt('rest', 'Sit this week out', 'Miss the match and recover.', c => { c.g.sitOut = true; return 'You will sit the next match out and get a good rest.'; }),
      opt('play', 'Play through it', 'Much higher injury risk this week.', c => { c.g.risk = true; return 'You will play through it. Keep your fingers crossed.'; }),
    ],
  },
  // ---- discipline
  {
    id: 'hearing', from: 'Club', title: 'Disciplinary', urgent: true, cooldown: 0,
    weight: c => (c.me.suspended > 0 && (c.g.flags['s:banAt'] ?? 0) > 0 && c.g.flags['s:hearingFor'] !== c.g.flags['s:banAt'] ? 100 : 0),
    body: c => `You have been banned for ${c.me.suspended} match${c.me.suspended === 1 ? '' : 'es'}. The club asks how you want to respond.`,
    options: () => [
      opt('accept', 'Accept it', 'Take it on the chin.', c => { c.g.flags['s:hearingFor'] = c.g.flags['s:banAt']; trust(c.g, 0.2); return 'You accept the ban. The manager appreciates it.'; }),
      opt('appeal', 'Appeal', 'A chance to cut the ban. If it fails, the manager will not be pleased.', c => {
        c.g.flags['s:hearingFor'] = c.g.flags['s:banAt'];
        if (c.me.suspended >= 2 && c.rng.chance(clamp(0.3 + c.g.trust * 0.04, 0.1, 0.55))) { c.me.suspended -= 1; return 'Your appeal succeeds and the ban is cut by a match.'; }
        trust(c.g, -0.3);
        return 'Your appeal is rejected. The manager is annoyed you wasted the club\'s time.';
      }),
      opt('apologise', 'Apologise publicly', 'Does not change the ban, but it helps with the manager and supporters.', c => { c.g.flags['s:hearingFor'] = c.g.flags['s:banAt']; trust(c.g, 0.4); conf(c.g, -1); return 'You apologise to the fans. It does not change the ban, but it goes down well.'; }),
    ],
  },
  // ---- contract and agent
  {
    id: 'contractOffer', from: 'Agent', title: 'A new contract', cooldown: 30,
    weight: c => (c.g.contract && c.g.contract.years === 1 && c.g.week >= 12 && c.g.week <= 34 && !c.g.flags['s:contract'] && !c.g.loan ? 0.6 : 0),
    data: c => ({ base: Math.round(Math.max(c.g.contract!.wage, wageFor(c.ovr)) / 50) * 50 }),
    body: (c, d) => `Your deal ends this summer and ${c.club.name} want to keep you. Your agent says they can improve your wage. Turning it down means you become a free agent at the end of the season. The standing offer is around ${money(+d.base * 1.25)} a week for three more years.`,
    options: (_c, d) => {
      const base = +d.base;
      const set = (c2: EventCtx, wage: number, years: number) => { c2.g.contract = { years, wage }; c2.g.flags['s:contract'] = 1; };
      return [
        opt('sign3', `Sign for three more years at ${money(base * 1.25)} a week`, 'Security, and a bigger wage.', c2 => { set(c2, base * 1.25, 4); trust(c2.g, 0.5); conf(c2.g, 2); return 'You sign. The club is delighted.'; }),
        opt('sign1', `Sign for one more year at ${money(base * 1.1)} a week`, 'Keeps your options open next summer.', c2 => { set(c2, base * 1.1, 2); return 'You sign a short extension.'; }),
        opt('counter', `Ask for more: ${money(base * 1.5)} a week`, 'A bolder ask. The club may meet you, split the difference, or walk away.', c2 => {
          const p = clamp(0.3 + 0.05 * c2.g.trust + (c2.rank === 0 ? 0.15 : 0) + (c2.ovr >= c2.club.rating ? 0.1 : 0), 0.1, 0.8);
          const r = c2.rng.next();
          if (r < p * 0.5) { set(c2, base * 1.5, 4); trust(c2.g, 0.3); return `The club give in. You sign for ${money(base * 1.5)} a week.`; }
          if (r < p) { set(c2, base * 1.35, 4); return `You meet in the middle at ${money(base * 1.35)} a week.`; }
          c2.g.flags['s:contract'] = 1; trust(c2.g, -0.8);
          return 'The club withdraw their offer. You will have to see what the summer brings.';
        }),
        opt('refuse', 'Turn it down', 'You will be a free agent in the summer and can pick from whoever wants you.', c2 => { c2.g.flags['s:contract'] = 1; trust(c2.g, -0.8); return 'You turn it down. The manager will not forget it.'; }),
      ];
    },
  },
  {
    id: 'raiseRequest', from: 'Agent', title: 'A raise', cooldown: 20,
    weight: c => (c.g.contract && c.g.contract.wage < wageFor(c.ovr) * 0.85 && c.g.week >= 8 && !c.g.flags['s:raise'] ? 0.5 : 0),
    data: c => ({ fair: Math.round(wageFor(c.ovr) / 50) * 50 }),
    body: (c, d) => `Your agent thinks you are underpaid. A player of your level earns about ${money(+d.fair)} a week and you are on ${money(c.g.contract!.wage)}.`,
    options: (_c, d) => [
      opt('ask', 'Ask the club for a raise', 'It might work. It might annoy them.', c2 => {
        c2.g.flags['s:raise'] = 1;
        if (c2.rng.chance(clamp(0.35 + 0.06 * c2.g.trust, 0.1, 0.8))) { c2.g.contract!.wage = +d.fair; return `The club agree. You now earn ${money(+d.fair)} a week.`; }
        trust(c2.g, -0.3);
        return 'The club say no and are not impressed you asked.';
      }),
      opt('wait', 'Stay quiet', 'Keep your head down and let your football do the talking.', c2 => { c2.g.flags['s:raise'] = 1; conf(c2.g, 1); return 'You decide to wait. Your form will make the case for you.'; }),
    ],
  },
  {
    id: 'transferOffer', from: 'Agent', title: 'A transfer offer', cooldown: 30,
    weight: c => (windowOf(c.g.week) === 'winter' && !c.g.flags['s:transfer'] && !c.g.loan ? 0.9 * (c.g.flags['s:agent'] ? 3 : 1) : 0),
    data: c => {
      const offers = makeOffers(c.g, c.rng).filter(o => o.clubId !== c.me.clubId && !o.stay);
      const o = offers.find(x => x.role !== 'Squad player') ?? offers[0];
      const club = o ? o.clubId : c.g.clubs.find(x => x.id !== c.me.clubId && x.division === c.club.division)!.id;
      return { clubId: club, wage: o?.wage ?? wageFor(c.ovr), years: o?.years ?? 3, role: o?.role ?? roleAt(c.g.players, club, c.me) };
    },
    body: (c, d) => {
      const nc = c.g.clubs.find(x => x.id === d.clubId)!;
      return `The January window is open and ${nc.name} have made an offer for you. They see you as a ${String(d.role).toLowerCase()}. ${money(+d.wage)} a week for ${d.years} years.`;
    },
    options: (c, d) => {
      const nc = c.g.clubs.find(x => x.id === d.clubId)!;
      return [
        opt('join', `Join ${nc.name}`, `${d.role} at ${nc.division < c.club.division ? 'a bigger' : nc.division > c.club.division ? 'a smaller' : 'a similar'} club.`, c2 => {
          c2.g.flags['s:transfer'] = 1;
          const fee = marketValue(c2.me);
          nc.funds -= fee; c2.club.funds += fee;
          c2.me.clubId = nc.id;
          c2.g.contract = { years: +d.years, wage: +d.wage };
          c2.g.trust = 0.5; c2.g.promise = null;
          c2.me.form = [];
          return `Welcome to ${nc.name}. Your new manager is looking forward to working with you.`;
        }),
        opt('stay', `Stay at ${c.club.name}`, 'Keep fighting for your place.', c2 => { c2.g.flags['s:transfer'] = 1; trust(c2.g, 0.2); return 'You stay put. The manager is glad.'; }),
      ];
    },
  },
  {
    id: 'loanOffer', from: 'Club', title: 'A loan offer', cooldown: 30,
    weight: c => {
      if (c.me.age > 21 || c.g.loan || c.played6 < 4 || c.starts6 > 1 || c.g.week < 8 || c.g.week > 28 || c.g.flags['s:loan']) return 0;
      return c.g.clubs.some(x => x.division > c.club.division && roleAt(c.g.players, x.id, c.me) === 'Starter') ? 0.7 : 0;
    },
    data: c => {
      const pool = c.g.clubs.filter(x => x.division > c.club.division && roleAt(c.g.players, x.id, c.me) === 'Starter');
      return { clubId: c.rng.pick(pool).id };
    },
    body: (c, d) => {
      const nc = c.g.clubs.find(x => x.id === d.clubId)!;
      return `You have started ${c.starts6} of your last ${c.played6}. ${nc.name} would take you on loan until the summer and play you every week. Young players grow with minutes.`;
    },
    options: (c, d) => {
      const nc = c.g.clubs.find(x => x.id === d.clubId)!;
      return [
        opt('go', `Go on loan to ${nc.name}`, 'Regular football at a smaller club. You come back in the summer.', c2 => {
          c2.g.flags['s:loan'] = 1;
          c2.g.loan = { from: c2.me.clubId!, to: nc.id, trust: c2.g.trust };
          c2.me.clubId = nc.id; c2.g.trust = 1; c2.g.promise = null; c2.me.form = [];
          return `You join ${nc.name} on loan until the end of the season.`;
        }),
        opt('stay', 'Stay and fight for a place', 'Training ground and the bench.', c2 => { c2.g.flags['s:loan'] = 1; trust(c2.g, 0.3); return 'You tell the manager you want to fight for your place. He respects it.'; }),
      ];
    },
  },
  {
    id: 'agentInterest', from: 'Agent', title: 'Interest from elsewhere', cooldown: 12,
    weight: c => (!c.g.loan && !c.g.flags['s:agent'] ? 0.25 : 0),
    body: () => `Your agent says other clubs have been asking about you. He wants to know whether to push things along.`,
    options: () => [
      opt('push', 'Ask him to push', 'Offers are more likely to come, and the manager may hear about it.', c => { c.g.flags['s:agent'] = 1; trust(c.g, -0.1); return 'Your agent gets on the phone. Expect offers in the window.'; }),
      opt('focus', 'Stay focused', 'Your football comes first.', c => { conf(c.g, 2); trust(c.g, 0.1); return 'You tell him you are happy here for now.'; }),
    ],
  },
  {
    id: 'agentAdvice', from: 'Agent', title: 'A skill worth learning', cooldown: 12,
    weight: c => {
      if (c.g.training.traitFocus) return 0;
      return TRAITS.some(t => t.suits.includes(c.me.position) && !c.me.traits.includes(t.id) && missingPrereq(c.me, t).length === 0) ? 0.35 : 0;
    },
    data: c => ({ trait: TRAITS.find(t => t.suits.includes(c.me.position) && !c.me.traits.includes(t.id) && missingPrereq(c.me, t).length === 0)!.id }),
    body: (_c, d) => `Your agent thinks adding ${TRAIT_BY_ID[d.trait as keyof typeof TRAIT_BY_ID].label.toLowerCase()} to your game would lift your value. ${TRAIT_BY_ID[d.trait as keyof typeof TRAIT_BY_ID].desc} You already have the attributes for it.`,
    options: (_c, d) => [
      opt('learn', 'Start learning it', 'Sets a Skill work session and aims it at the skill.', c2 => {
        c2.g.training.traitFocus = d.trait as keyof typeof TRAIT_BY_ID;
        if (!c2.g.training.sessions.some(s => s.programme === 'skillWork')) c2.g.training.sessions[2] = { programme: 'skillWork', intensity: 'standard' };
        return 'You add Skill work to your week. It will take a while.';
      }),
      opt('later', 'Not now', 'Keep your plan as it is.', () => 'You keep things as they are.'),
    ],
  },
  // ---- manager
  {
    id: 'promisedMinutes', from: 'Manager', title: 'Minutes', cooldown: 8,
    weight: c => (c.played6 >= 4 && c.starts6 <= 2 && c.rank > 0 && c.g.promise === null ? 0.55 : 0),
    body: c => `You have started ${c.starts6} of your last ${c.played6}. You could go and see the manager about it.`,
    options: () => [
      opt('ask', 'Ask for a start', 'It depends on how much he trusts you and how you have played.', c => {
        if (c.rng.chance(clamp(0.3 + c.g.trust * 0.08 + (c.form >= 6.8 ? 0.2 : 0), 0.1, 0.8))) { c.g.promise = c.g.week; trust(c.g, 0.2); return 'The manager gives you his word: you start this week.'; }
        trust(c.g, -0.4);
        return 'The manager says you are not there yet and does not like being pushed.';
      }),
      opt('wait', 'Wait for your chance', 'Be patient and keep working.', c => { trust(c.g, 0.3); conf(c.g, 1); return 'You tell him you will keep working. He nods.'; }),
      opt('out', 'Say you want to leave', 'Your agent will look at options. The manager will not take it well.', c => { c.g.flags['s:agent'] = 1; trust(c.g, -0.8); return 'The manager is furious. Your agent starts making calls.'; }),
    ],
  },
  {
    id: 'managerPraise', from: 'Manager', title: 'Good form', cooldown: 8,
    weight: c => (c.form >= 7 && c.starts6 >= 4 ? 0.5 : 0),
    body: () => `The manager takes you aside. You have been one of the best players at the club recently and he wants you to know it.`,
    options: () => [
      opt('thank', 'Thank him', 'Stay humble.', c => { trust(c.g, 0.3); conf(c.g, 3); return 'He is pleased with your attitude.'; }),
      opt('more', 'Ask for more responsibility', 'Push for a bigger role.', c => {
        if (c.rng.chance(0.6)) { trust(c.g, 0.5); conf(c.g, 4); return 'He agrees. You will be more involved from now on.'; }
        trust(c.g, -0.1);
        return 'He says to take it one game at a time.';
      }),
    ],
  },
  {
    id: 'droppedBadRun', from: 'Manager', title: 'Poor run', cooldown: 8,
    weight: c => (c.form > 0 && c.form < 5.9 && c.played6 >= 4 ? 0.5 : 0),
    body: () => `Your last few performances have not been good enough and the manager wants to talk. He is thinking of changing things.`,
    options: () => [
      opt('accept', 'Accept it', 'Take responsibility.', c => { trust(c.g, 0.3); conf(c.g, -1); return 'You take it on board. He appreciates the honesty.'; }),
      opt('argue', 'Argue your case', 'You think you deserve a longer run.', c => {
        if (c.rng.chance(clamp(0.2 + c.g.trust * 0.05, 0.05, 0.5))) { c.g.promise = c.g.week; trust(c.g, 0.1); return 'He gives you one more game.'; }
        trust(c.g, -0.6); conf(c.g, 1);
        return 'He is not convinced and does not appreciate the argument.';
      }),
      opt('extra', 'Ask for extra training', 'Work your way out of it.', c => {
        const k = lowestKey(c.me);
        c.me.condition = Math.max(20, c.me.condition - 10);
        c.me.attrs[k] = Math.min(c.me.ceil[k], c.me.attrs[k] + 0.25);
        trust(c.g, 0.2);
        return `You put in extra work on your ${ATTR_BY_ID[k].label.toLowerCase()}. It leaves you tired, but it helps.`;
      }),
    ],
  },
  {
    id: 'positionSwitch', from: 'Manager', title: 'A new position', cooldown: 60,
    weight: c => (c.rank >= 1 && c.played6 >= 3 && !c.g.flags['s:pos'] && c.g.week >= 5 && (ADJ[c.me.position] ?? []).some(p => ovrAt(c.me.attrs, p) >= ovrAt(c.me.attrs, c.me.position) - 3) ? 0.25 : 0),
    data: c => ({ alt: (ADJ[c.me.position] ?? []).filter(p => ovrAt(c.me.attrs, p) >= ovrAt(c.me.attrs, c.me.position) - 3).sort((a, b) => ovrAt(c.me.attrs, b) - ovrAt(c.me.attrs, a))[0] }),
    body: (c, d) => `The manager thinks you could get more games as a ${POSN[d.alt as Position]}. Your rating there would be ${Math.round(ovrAt(c.me.attrs, d.alt as Position))}, against ${Math.round(c.ovr)} where you play now.`,
    options: (c, d) => [
      opt('move', `Move to ${POSN[d.alt as Position]}`, 'New position, new rivals. The manager will appreciate it.', c2 => {
        c2.g.flags['s:pos'] = 1;
        c2.me.position = d.alt as Position;
        c2.g.training = { ...defaultPlan(c2.me.position), traitFocus: null };
        trust(c2.g, 1);
        return `You are now a ${POSN[c2.me.position]}. Your training plan has been reset to suit.`;
      }),
      opt('stay', `Stay a ${POSN[c.me.position]}`, 'The manager will be a little disappointed.', c2 => { c2.g.flags['s:pos'] = 1; trust(c2.g, -0.5); return 'You stay where you are.'; }),
    ],
  },
  {
    id: 'rivalSigned', from: 'Club', title: 'A new arrival', cooldown: 60,
    weight: c => (c.g.week >= 3 && c.g.week <= 20 && !c.g.flags['s:rival'] && c.me.position !== 'GK' ? 0.25 : 0),
    // Creates the new signing, so the event has a real effect on your place in the squad.
    data: c => {
      const rival = generatePlayer(c.rng, { id: 'p' + c.g.nextId++, position: c.me.position, age: c.rng.int(21, 28), targetOvr: c.ovr + 2, clubId: c.me.clubId });
      const out = c.g.players.filter(p => p.clubId === c.me.clubId && p.position === c.me.position && !p.human).sort((a, b) => ovrOf(a) - ovrOf(b))[0];
      if (out) c.g.players = c.g.players.filter(p => p.id !== out.id);
      c.g.players.push(rival);
      c.g.flags['s:rival'] = 1;
      return { name: rival.name, ovr: ovrOf(rival) };
    },
    body: (c, d) => `${c.club.name} have signed a new ${POSN[c.me.position]}: ${d.name}, rated ${d.ovr}. You are not the only one in your position any more.`,
    options: () => [
      opt('ask', 'Ask the manager where you stand', 'Get it out in the open.', c => {
        if (c.rng.chance(clamp(0.5 + c.g.trust * 0.08, 0.2, 0.85))) { trust(c.g, 0.3); return 'He reassures you. You are still in his plans.'; }
        trust(c.g, -0.3);
        return 'He is blunt: the new man is ahead of you for now.';
      }),
      opt('fight', 'Vow to fight for it', 'Use it as motivation.', c => { conf(c.g, 3); trust(c.g, 0.1); return 'You tell yourself you will win your place back. You are motivated.'; }),
      opt('loan', 'Ask your agent about a loan', 'Look for games elsewhere.', c => { c.g.flags['s:agent'] = 1; return 'Your agent says he will see what is out there.'; }),
    ],
  },
  // ---- coaching and teammates
  {
    id: 'coachFeedback', from: 'Coach', title: 'Coach feedback', cooldown: 16,
    weight: () => 0.25,
    data: c => ({ attr: lowestKey(c.me) }),
    body: (c, d) => `The coach says your ${ATTR_BY_ID[d.attr as AttrId].label.toLowerCase()} is the thing holding you back at the moment (${Math.round(c.me.attrs[d.attr as AttrId])}). It matters in your position.`,
    options: (_c, d) => [
      opt('work', `Work on ${ATTR_BY_ID[d.attr as AttrId].label.toLowerCase()}`, 'Sets it as your individual focus.', c2 => { c2.g.training.focus = d.attr as AttrId; return `Your individual focus is now ${ATTR_BY_ID[d.attr as AttrId].label.toLowerCase()}.`; }),
      opt('noted', 'Noted', 'Leave your plan as it is.', () => 'You thank him and leave it there.'),
    ],
  },
  {
    id: 'mentor', from: 'Teammate', title: 'A mentor', cooldown: 999,
    weight: c => (!c.g.flags.mentor && c.g.players.some(p => p.clubId === c.me.clubId && p.position === c.me.position && p.age >= 28 && !p.human) ? 0.2 : 0),
    data: c => ({ name: c.g.players.filter(p => p.clubId === c.me.clubId && p.position === c.me.position && p.age >= 28 && !p.human)[0].name }),
    body: (_c, d) => `${d.name}, who has played your position for years, offers to take you under his wing and pass on what he knows.`,
    options: () => [
      opt('accept', 'Accept', 'A small, lasting boost to how quickly you learn.', c => { c.g.flags.mentor = 1; c.me.devRate = Math.min(1.4, c.me.devRate + 0.05); trust(c.g, 0.2); return 'You start spending time with him. You pick up a lot.'; }),
      opt('decline', 'Politely decline', 'You prefer to work it out for yourself.', c => { c.g.flags.mentor = 1; conf(c.g, 1); return 'You thank him but say you will manage.'; }),
    ],
  },
  {
    id: 'extraSession', from: 'Fitness coach', title: 'Extra session', cooldown: 14,
    weight: c => (c.me.age <= 30 && c.me.injuredWeeks === 0 ? 0.15 : 0),
    body: () => `The fitness coach offers you an extra session on top of the week. It will leave you tired, but it should help your body.`,
    options: () => [
      opt('accept', 'Take it', 'A small gain in a physical attribute, and a tired week.', c => {
        const k = c.rng.pick(['pace', 'acceleration', 'stamina', 'strength', 'agility'] as AttrId[]);
        c.me.condition = Math.max(20, c.me.condition - 12);
        c.me.attrs[k] = Math.min(c.me.ceil[k], c.me.attrs[k] + 0.25);
        return `You put in the work. Your ${ATTR_BY_ID[k].label.toLowerCase()} benefits, and your legs are heavy.`;
      }),
      opt('skip', 'Pass', 'Save your legs.', () => 'You keep your legs fresh for the weekend.'),
    ],
  },
  {
    id: 'captainTalk', from: 'Captain', title: 'A word from the captain', cooldown: 16,
    weight: c => (c.played6 >= 3 ? 0.12 : 0),
    body: () => `The captain pulls you aside after training. He has a few thoughts on how you can fit in better.`,
    options: () => [
      opt('listen', 'Listen carefully', 'Take it on board.', c => { trust(c.g, 0.2); conf(c.g, 1); return 'You listen. It does you good.'; }),
      opt('brush', 'Brush it off', 'You know what you are doing.', c => { conf(c.g, 1); trust(c.g, -0.1); return 'He shrugs. Word gets around.'; }),
    ],
  },
  // ---- outside
  {
    id: 'mediaInterview', from: 'Media', title: 'A request for an interview', cooldown: 6,
    weight: c => {
      const last = c.g.reports[0];
      return last && last.week === c.g.week - 1 && last.result === 'w' && last.me && last.me.min > 0 ? 0.35 : 0;
    },
    body: c => `After the win, the local paper wants a word with you. ${c.club.name} fans are keen to hear from you.`,
    options: () => [
      opt('humble', 'Keep it humble', 'Talk about the team.', c => { trust(c.g, 0.2); conf(c.g, 1); return 'You praise your teammates. The manager reads it and smiles.'; }),
      opt('bold', 'Talk yourself up', 'Back yourself in public.', c => {
        if (c.rng.chance(0.5)) { conf(c.g, 4); return 'It goes down well. You feel ten feet tall.'; }
        conf(c.g, -2); trust(c.g, -0.2);
        return 'It reads badly and the dressing room notices.';
      }),
      opt('none', 'No comment', 'Stay out of it.', () => 'You politely decline.'),
    ],
  },
];

// ---------------------------------------------------------------- engine
const byId = Object.fromEntries(EVENTS.map(e => [e.id, e])) as Record<string, EventDef>;

const eligible = (def: EventDef, c: EventCtx): number => {
  const last = c.g.flags['e:' + def.id];
  if (last !== undefined && c.abs - last < def.cooldown) return 0;
  return def.weight(c);
};

/** Maybe raises an event for the human: urgent ones at once, otherwise a weighted draw about four weeks in ten. */
export function drawEvent(g: Game, rng: Rng): void {
  if (g.event || g.phase !== 'play') return;
  const c = ctxFor(g, rng);
  const live = EVENTS.map(d => ({ d, w: eligible(d, c) })).filter(x => x.w > 0);
  const urgent = live.find(x => x.d.urgent);
  let pick = urgent?.d;
  if (!pick && live.length && rng.chance(0.33)) {
    let r = rng.next() * live.reduce((a, x) => a + x.w, 0);
    for (const x of live) { r -= x.w; if (r <= 0) { pick = x.d; break; } }
    pick ??= live[live.length - 1].d;
  }
  if (!pick) return;
  g.flags['e:' + pick.id] = c.abs;
  g.event = { id: pick.id, week: g.week, data: pick.data ? pick.data(c) : {} };
}

export interface EventView {
  id: string;
  from: string;
  title: string;
  body: string;
  options: { id: string; label: string; desc: string }[];
}

export function describeEvent(g: Game): EventView | null {
  if (!g.event) return null;
  const def = byId[g.event.id];
  if (!def) return null;
  const c = ctxFor(g, makeRng(g.seed));
  return { id: def.id, from: def.from, title: def.title, body: def.body(c, g.event.data), options: def.options(c, g.event.data).map(o => ({ id: o.id, label: o.label, desc: o.desc })) };
}

/** Applies the player's answer. Returns the title and what happened. */
export function chooseEvent(g: Game, optionId: string): { title: string; choice: string; result: string } | null {
  const ev: PendingEvent | null = g.event;
  if (!ev) return null;
  const def = byId[ev.id];
  const rng = makeRng(g.seed);
  const c = ctxFor(g, rng);
  const o = def.options(c, ev.data).find(x => x.id === optionId);
  if (!o) return null;
  const result = o.apply(c, ev.data);
  g.seed = rng.seed();
  const entry: EventLogEntry = { season: g.season, week: g.week, id: def.id, title: def.title, choice: o.label };
  g.eventLog.unshift(entry);
  if (g.eventLog.length > 40) g.eventLog.length = 40;
  g.event = null;
  pushMessage(g, { week: g.week, from: def.from, subject: def.title, body: `${o.label}. ${result}` });
  return { title: def.title, choice: o.label, result };
}
