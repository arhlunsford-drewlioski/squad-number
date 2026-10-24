import { ASSIST, BREAK, CLEAR, FOLLOW, FOUL, GOAL, KEEP, KEY, LOSE, SAVE, SHOT, WIDE, WIN, opt } from './kit';
import type { OptionDef, TemplateDef } from './types';

/** Options that only players with the right trait see. They are slotted into existing templates. */
const TRAIT_OPTIONS: Record<string, OptionDef[]> = {
  oneOnOne: [
    opt('finesse', 'Curl it round the keeper', 'Bend it into the far corner.', 'balanced', { technique: 0.4, finishing: 0.3, composure: 0.2, longShots: 0.1 }, 'gk', 0.1,
      [GOAL('You curl it round {gk} and into the far corner.'), GOAL('Your curler beats {gk} and nestles in.'), SAVE('{gk} stretches and tips it away.'), WIDE('You bend it just wide.')], { trait: 'finesseShot' }),
  ],
  wingerOneOnOne: [
    opt('trick', 'Skill move', 'A flick and a step-over to leave {opp} behind.', 'balanced', { dribbling: 0.35, agility: 0.3, balance: 0.15, technique: 0.2 }, { tackling: 0.3, pace: 0.25, anticipation: 0.2, balance: 0.1, agility: 0.15 }, 0.0,
      [FOLLOW('Your skill leaves {opp} on the floor and you are into the box.'), KEY('Your skill beats {opp} and your cross brings a shot.'), LOSE('{opp} does not fall for it.'), BREAK('{opp} wins it and they break.')], { trait: 'trickster' }),
  ],
  crossIncoming: [
    opt('backPostRun', 'Attack the back post', 'Use your height and timing.', 'balanced', { heading: 0.4, jumping: 0.3, offTheBall: 0.15, strength: 0.15 }, { heading: 0.3, jumping: 0.25, marking: 0.25, strength: 0.2 }, 0.1,
      [GOAL('You peel away and power a header in at the back post.', 'header'), GOAL('You rise above everyone at the back post.', 'header'), SAVE('Your header is saved.'), WIDE('Your header is over.')], { trait: 'aerialThreat' }),
  ],
  progressive: [
    opt('inchPerfect', 'Thread the needle', 'The pass nobody else sees.', 'gamble', { passing: 0.4, vision: 0.4, technique: 0.2 }, 'team', 0.1,
      [ASSIST('Your pass is inch-perfect and {mate} scores.'), KEY('Your pass splits them and {mate} shoots.'), LOSE('The pass is a fraction too heavy.'), BREAK('The pass is cut out and they break.')], { trait: 'playmaker' }),
  ],
  strikerRuns: [
    opt('slide', 'Slide in', 'A crunching challenge.', 'gamble', { tackling: 0.4, aggression: 0.2, anticipation: 0.2, balance: 0.2 }, { dribbling: 0.3, acceleration: 0.25, technique: 0.15, balance: 0.15, composure: 0.15 }, 0.1,
      [WIN('You slide in and take the ball cleanly.'), WIN('Your slide wins it and he goes flying.'), SHOT('You miss him and he is clear.', 0.4), FOUL('You take him down.', 0.5, 0.05, 0.08)], { trait: 'hardTackler' }),
  ],
  freeKick: [
    opt('curl', 'Curl it in', 'Bend it into the corner.', 'gamble', { technique: 0.45, longShots: 0.3, composure: 0.25 }, 'gk', -0.1,
      [GOAL('You bend it round the wall and into the corner.', 'long'), SAVE('{gk} just gets across to save.'), WIDE('Your curler is just wide.'), WIDE('Your curler clips the wall.')], { trait: 'setPiece' }),
  ],
  gkThrough: [
    opt('sweepHigh', 'Sweep high', 'Come well out and clear with your feet.', 'balanced', { commandOfArea: 0.35, anticipation: 0.3, kicking: 0.2, agility: 0.15 }, { pace: 0.35, acceleration: 0.25, composure: 0.4 }, 0.1,
      [CLEAR('You sweep up well outside the box.', 0.35), CLEAR('You win the race and clear.'), SHOT('You are beaten to it.', 0.35), SHOT('You are beaten and the net is open.', 0.5)], { trait: 'sweeperKeeper' }),
  ],
  pressResist: [
    opt('turnAway', 'Turn away calmly', 'Glide out of the pressure.', 'balanced', { composure: 0.35, firstTouch: 0.3, balance: 0.2, agility: 0.15 }, { aggression: 0.3, pace: 0.3, tackling: 0.4 }, 0.2,
      [KEY('You glide out of the press and your pass opens the pitch.'), KEEP('You turn out of trouble with ease.', 0.2), LOSE('You are dispossessed.'), BREAK('You lose it in a dangerous area.', 0.25)], { trait: 'pressResistant' }),
  ],
  secondBall: [
    opt('intercept', 'Step in and intercept', 'You saw it coming.', 'balanced', { anticipation: 0.45, positioning: 0.25, pace: 0.15, decisions: 0.15 }, { anticipation: 0.3, pace: 0.3, strength: 0.2, balance: 0.2 }, 0.1,
      [WIN('You read it and step in to win it.'), KEEP('You step in and win it.', 0.15), LOSE('{opp} gets there first.'), BREAK('{opp} wins it and they break.')], { trait: 'reader' }),
  ],
  gk1v1: [
    opt('react', 'React to the shot', 'Trust your reflexes.', 'balanced', { reflexes: 0.5, agility: 0.25, oneOnOnes: 0.25 }, { finishing: 0.4, composure: 0.35, technique: 0.25 }, 0.1,
      [CLEAR('You react and save brilliantly.', 0.4), CLEAR('Your reflexes keep it out.', 0.3), SHOT('He beats you anyway.', 0.5), SHOT('He finds the corner.', 0.65)], { trait: 'shotStopper' }),
  ],
  looseBall: [
    opt('poach', 'Poach it', 'You are always in the right place.', 'balanced', { finishing: 0.35, offTheBall: 0.3, anticipation: 0.2, composure: 0.15 }, { tackling: 0.3, positioning: 0.3, anticipation: 0.2, pace: 0.2 }, 0.0,
      [GOAL('You are first to the loose ball and score.'), GOAL('You poach a goal from close range.'), SAVE('You are in the right place but it is saved.'), WIDE('You get there and miss.')], { trait: 'poacher' }),
  ],
};

/** Trait bonuses on existing options, so the right skill makes a good choice easier. */
const TRAIT_BONUS: Record<string, Record<string, NonNullable<OptionDef['traitBonus']>>> = {
  crossIncoming: { header: { trait: 'aerialThreat', bias: 0.35 } },
  freeKick: { shoot: { trait: 'setPiece', bias: 0.3 }, cross: { trait: 'setPiece', bias: 0.3 } },
  strikerRuns: { stepIn: { trait: 'hardTackler', bias: 0.25 } },
  oneOnOne: { chip: { trait: 'chipShot', bias: 0.3 } },
  cornerAttack: { far: { trait: 'aerialThreat', bias: 0.3 }, near: { trait: 'poacher', bias: 0.25 } },
  takeCorner: { near: { trait: 'setPiece', bias: 0.3 }, far: { trait: 'setPiece', bias: 0.3 } },
  longRange: { shoot: { trait: 'finesseShot', bias: 0.2 } },
  gkCross: { claim: { trait: 'sweeperKeeper', bias: 0.2 } },
  keeperPenalty: { wait: { trait: 'shotStopper', bias: 0.3 } },
};

/** Long shots and volleys are rarely good chances, even for skilled players. These offsets keep them honest. */
const BIAS_ADJUST: Record<string, Record<string, number>> = {
  longRange: { shoot: -1.7 }, dropBall: { volley: -1.5 }, freeKick: { shoot: -1.3, curl: -1.0 }, wonItHigh: { shoot: -1.4 }, counter: { shoot: -1.1 },
  betweenLines: { shoot: -1.4 }, lastGasp: { shoot: -1.5 }, cornerAttack: { edge: -1.2 }, giveAndGo: { shoot: -1.5 }, turnAndShoot: { turn: -1.0 },
  wingerOneOnOne: { cutInside: -0.8 }, looseBall: { shoot: -0.5 }, overheadKick: { overhead: -0.7 }, lateRunBox: { edge: -1.0 }, byline: { tight: -0.6 },
};

export function withTraits(t: TemplateDef): TemplateDef {
  const extra = TRAIT_OPTIONS[t.id];
  const bonus = TRAIT_BONUS[t.id];
  const adj = BIAS_ADJUST[t.id];
  if (!extra && !bonus && !adj) return t;
  const withAdj = (o: OptionDef): OptionDef => (adj?.[o.id] ? { ...o, bias: (o.bias ?? 0) + adj[o.id] } : o);
  const options = t.options.map(o0 => {
    const o = withAdj(o0);
    let next = o;
    // The chip is a trait now, not a bare attribute check.
    if (t.id === 'oneOnOne' && o.id === 'chip') next = { ...o, trait: 'chipShot', needs: undefined };
    if (bonus?.[o.id]) next = { ...next, traitBonus: bonus[o.id] };
    return next;
  });
  return { ...t, options: extra ? [...options, ...extra.map(withAdj)] : options };
}

