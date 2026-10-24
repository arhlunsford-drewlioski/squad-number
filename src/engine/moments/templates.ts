import { EXTRA } from './templates-extra';
import { MORE_A } from './templates-more-a';
import { MORE_B } from './templates-more-b';
import { withTraits } from './templates-traits';
import type { Outcome, ResultKind, TemplateDef } from './types';

const O = (r: ResultKind, text: string, extra: Partial<Outcome> = {}): Outcome => ({ r, text, ...extra });

// Shared check weights.
const FIN = { finishing: 0.4, composure: 0.35, technique: 0.15, firstTouch: 0.1 };
const DUEL_DEF = { tackling: 0.3, pace: 0.25, anticipation: 0.2, balance: 0.1, agility: 0.15 };
const DUEL_ATT = { dribbling: 0.3, acceleration: 0.25, technique: 0.15, balance: 0.15, composure: 0.15 };
const PASSER = { passing: 0.4, vision: 0.3, composure: 0.2, decisions: 0.1 };

const CORE: TemplateDef[] = [
  // ------------------------------------------------------------------ attack
  {
    id: 'oneOnOne', title: 'One on one', kind: 'attack', script: 'oneOnOne', for: ['ST', 'AM', 'W', 'CM'], opp: 'gk', mate: 'ATT', pressure: true,
    prompt: 'A through ball has put you clear of the defence. It is you against {gk}.',
    options: [
      { id: 'place', label: 'Place it low', desc: 'Pick your corner and side-foot it.', risk: 'balanced', mine: FIN, theirs: 'gk', bias: 0.4,
        out: [O('goal', 'You slot it past {gk} into the corner.'), O('goal', 'You roll it in off the post.'), O('saved', '{gk} gets down to save.'), O('wide', 'You pull it wide of the post.')] },
      { id: 'round', label: 'Take it round the keeper', desc: 'Dribble past {gk} and score into an open net.', risk: 'gamble', mine: { dribbling: 0.3, balance: 0.2, composure: 0.25, finishing: 0.15, agility: 0.1 }, theirs: 'gk', bias: 0,
        out: [O('goal', 'You go round {gk} and tap it into the empty net.'), O('goal', '{gk} is beaten and you finish.'), O('turnover', '{gk} gets a hand to it and smothers the ball.'), O('turnover', 'You take it too wide and the angle is gone.', { rate: -0.15 })] },
      { id: 'square', label: 'Square it to {mate}', desc: 'Safer. Needs a clean pass and {mate} to finish.', risk: 'safe', mine: PASSER, theirs: 'team', bias: 0.3,
        out: [O('assist', '{mate} has an open goal and scores.'), O('keyPass', '{mate} shoots and it is saved.'), O('turnover', 'A defender gets back and cuts it out.'), O('counter', 'The pass is intercepted and they break.', { q: 0.2 })] },
      { id: 'chip', label: 'Chip the keeper', desc: 'Only for players with the touch.', risk: 'gamble', mine: { technique: 0.45, finishing: 0.25, composure: 0.2, firstTouch: 0.1 }, theirs: 'gk', bias: -0.2, needs: { attr: 'technique', min: 9 },
        out: [O('goal', 'You chip it over {gk} and it drops in.'), O('goal', 'The chip loops over {gk} and under the bar.'), O('saved', '{gk} backpedals and tips it over.'), O('wide', 'You scoop it over the bar.')] },
    ],
  },
  {
    id: 'wingerOneOnOne', title: 'Beat your man', kind: 'attack', script: 'wide', for: ['W', 'AM', 'FB', 'CM'], opp: 'FB', mate: 'ST',
    prompt: 'You have the ball wide and {opp} is in front of you.',
    options: [
      { id: 'takeOn', label: 'Take him on', desc: 'Beat {opp} for pace or skill and get into the box.', risk: 'balanced', mine: { dribbling: 0.3, acceleration: 0.25, agility: 0.2, balance: 0.15, pace: 0.1 }, theirs: DUEL_DEF, bias: 0,
        out: [O('follow', 'You beat {opp} for pace and cut inside.', { follow: 'inTheBox' }), O('keyPass', 'You get past {opp} and find {mate}, whose shot is saved.'), O('turnover', '{opp} reads it and wins the ball.'), O('counter', '{opp} takes it off you and they break.', { q: 0.2 })] },
      { id: 'cutInside', label: 'Cut inside and shoot', desc: 'Come inside onto your stronger side and hit it.', risk: 'gamble', mine: { dribbling: 0.2, longShots: 0.25, technique: 0.2, composure: 0.15, firstTouch: 0.1, acceleration: 0.1 }, theirs: { tackling: 0.35, positioning: 0.25, anticipation: 0.2, pace: 0.2 }, bias: -0.2,
        out: [O('goal', 'You cut inside and bend it into the far corner.'), O('saved', 'You cut in and force a save.'), O('wide', 'Your shot from the edge goes wide.'), O('blocked', '{opp} gets across and blocks it.')] },
      { id: 'cross', label: 'Early cross', desc: 'Whip it in before the defence is set.', risk: 'safe', mine: { crossing: 0.6, technique: 0.2, vision: 0.2 }, theirs: 'team', bias: 0.3,
        out: [O('assist', '{mate} meets your cross and scores.'), O('keyPass', 'Your cross finds {mate}, whose header is saved.'), O('turnover', 'The cross is cleared.'), O('turnover', 'You put it straight out of play.')] },
      { id: 'recycle', label: 'Hold it and recycle', desc: 'Keep possession and wait for a better chance.', risk: 'safe', mine: { firstTouch: 0.3, passing: 0.3, composure: 0.2, decisions: 0.2 }, theirs: { aggression: 0.3, tackling: 0.3, workRate: 0.4 }, bias: 0.6,
        out: [O('retain', 'You keep it and the move goes on.', { rate: 0.12 }), O('retain', 'You work it back inside.'), O('turnover', 'You are closed down and lose it.'), O('turnover', 'You are dispossessed.')] },
    ],
  },
  {
    id: 'crossIncoming', title: 'Cross coming in', kind: 'attack', script: 'crossIn', for: ['ST', 'AM', 'W'], opp: 'CB', mate: 'W', pressure: true,
    prompt: 'A cross is coming in from {mate}. {opp} is marking you.',
    options: [
      { id: 'header', label: 'Attack it with your head', desc: 'Win the header and direct it at goal.', risk: 'balanced', mine: { heading: 0.4, jumping: 0.25, strength: 0.15, composure: 0.1, offTheBall: 0.1 }, theirs: { heading: 0.3, jumping: 0.25, strength: 0.2, marking: 0.25 }, bias: 0,
        out: [O('goal', 'You rise above {opp} and head it in.', { how: 'header' }), O('goal', 'Your header beats the keeper.', { how: 'header' }), O('saved', 'Your header is saved.'), O('wide', 'You head it over the bar.')] },
      { id: 'nearPost', label: 'Dart to the near post', desc: 'Lose {opp} with a movement and flick it on.', risk: 'gamble', mine: { offTheBall: 0.35, anticipation: 0.3, acceleration: 0.15, finishing: 0.2 }, theirs: { marking: 0.3, positioning: 0.35, anticipation: 0.2, pace: 0.15 }, bias: -0.2,
        out: [O('goal', 'You steal in front of {opp} and flick it in.'), O('goal', 'You get across {opp} and turn it in.'), O('saved', 'You get there first but it is saved.'), O('blocked', '{opp} gets there first and clears.')] },
      { id: 'volley', label: 'Take it first time', desc: 'Meet it on the volley.', risk: 'gamble', mine: { technique: 0.35, firstTouch: 0.25, finishing: 0.25, composure: 0.15 }, theirs: 'gk', bias: -0.3, needs: { attr: 'technique', min: 8 },
        out: [O('goal', 'You hit it first time and it flies in.'), O('goal', 'Your volley takes a deflection and goes in.'), O('saved', 'Your volley is straight at the keeper.'), O('wide', 'You get under it and it sails over.')] },
      { id: 'knockDown', label: 'Knock it down', desc: 'Nod it into the path of a teammate.', risk: 'safe', mine: { heading: 0.3, firstTouch: 0.2, strength: 0.2, vision: 0.15, passing: 0.15 }, theirs: { heading: 0.3, strength: 0.3, marking: 0.4 }, bias: 0.4,
        out: [O('keyPass', 'You knock it down and a teammate shoots.'), O('keyPass', 'Your flick falls kindly and there is a shot.'), O('retain', 'You win it but it runs away from your team.'), O('turnover', '{opp} gets there first.')] },
    ],
  },
  {
    id: 'looseBall', title: 'Loose ball in the box', kind: 'attack', script: 'loose', for: ['ST', 'AM', 'W', 'CM', 'FB'], opp: 'CB', mate: 'ATT',
    prompt: 'The ball drops loose in the box and {opp} is closing in.',
    options: [
      { id: 'shoot', label: 'Shoot first time', desc: 'Hit it before anyone gets there.', risk: 'gamble', mine: { finishing: 0.35, composure: 0.2, technique: 0.2, firstTouch: 0.15, anticipation: 0.1 }, theirs: { tackling: 0.3, positioning: 0.3, anticipation: 0.2, pace: 0.2 }, bias: -0.1,
        out: [O('goal', 'You hit it first time and it flies in.'), O('saved', 'You hit it well and it is saved.'), O('wide', 'You snatch at it and drag it wide.'), O('blocked', '{opp} throws himself in the way and blocks it.')] },
      { id: 'control', label: 'Control it, then shoot', desc: 'Take a touch to make space.', risk: 'balanced', mine: { firstTouch: 0.3, composure: 0.25, finishing: 0.25, agility: 0.1, balance: 0.1 }, theirs: { tackling: 0.35, pace: 0.2, anticipation: 0.25, strength: 0.2 }, bias: 0,
        out: [O('goal', 'You steady yourself and finish calmly.'), O('saved', 'You take a touch and shoot, but it is saved.'), O('blocked', 'The touch gives {opp} time and he blocks it.'), O('turnover', '{opp} wins it off your toe.')] },
      { id: 'square', label: 'Square it to {mate}', desc: 'Find a teammate in a better position.', risk: 'safe', mine: PASSER, theirs: 'team', bias: 0.3,
        out: [O('assist', '{mate} finishes from your pass.'), O('keyPass', '{mate} shoots from your pass and it is saved.'), O('turnover', 'The pass is blocked.'), O('turnover', 'The pass is cut out and cleared.')] },
    ],
  },
  {
    id: 'longRange', title: 'Space on the edge', kind: 'attack', script: 'longRange', for: ['CM', 'AM', 'DM', 'W', 'FB'], opp: 'DM', mate: 'ATT',
    prompt: 'Space opens up about 25 yards out. {opp} is stepping towards you.',
    options: [
      { id: 'shoot', label: 'Hit it from distance', desc: 'Let fly before {opp} closes you down.', risk: 'gamble', mine: { longShots: 0.5, technique: 0.25, composure: 0.15, firstTouch: 0.1 }, theirs: 'gk', bias: -0.5,
        out: [O('goal', 'You hit it sweetly and it flies into the top corner.', { how: 'long' }), O('saved', 'Your shot is well saved.'), O('wide', 'Your effort sails over the bar.'), O('wide', 'You mishit it and it goes miles wide.')] },
      { id: 'carry', label: 'Carry it forward', desc: 'Take it past {opp} towards the box.', risk: 'balanced', mine: { dribbling: 0.3, strength: 0.15, pace: 0.2, balance: 0.15, composure: 0.2 }, theirs: { tackling: 0.35, aggression: 0.2, workRate: 0.2, anticipation: 0.25 }, bias: 0,
        out: [O('follow', 'You go past {opp} and into the box.', { follow: 'inTheBox' }), O('keyPass', 'You drive on and slide in {mate} for a shot.'), O('turnover', '{opp} stands you up and wins it.'), O('counter', '{opp} steals it and they break.', { q: 0.2 })] },
      { id: 'pass', label: 'Play it to {mate}', desc: 'Keep the move alive.', risk: 'safe', mine: PASSER, theirs: 'team', bias: 0.4,
        out: [O('keyPass', 'Your pass opens the defence and {mate} shoots.'), O('retain', 'You play it simply and keep possession.', { rate: 0.1 }), O('turnover', 'The pass is cut out.'), O('turnover', 'You overhit it out of play.')] },
    ],
  },
  {
    id: 'freeKick', title: 'Free kick', kind: 'attack', script: 'freeKick', for: ['AM', 'CM', 'W', 'ST', 'DM', 'FB'], opp: 'gk', mate: 'ATT', pressure: true,
    prompt: 'A free kick, 22 yards out and central. The ball is there if you want it.',
    options: [
      { id: 'shoot', label: 'Shoot', desc: 'Go for goal over the wall.', risk: 'gamble', mine: { technique: 0.4, longShots: 0.3, composure: 0.2, finishing: 0.1 }, theirs: 'gk', bias: -0.5,
        out: [O('goal', 'Your free kick curls over the wall and in.', { how: 'long' }), O('saved', '{gk} tips your free kick round the post.'), O('wide', 'Your free kick clips the wall and goes wide.'), O('blocked', 'Your free kick hits the wall.')] },
      { id: 'cross', label: 'Float it into the box', desc: 'Aim for a teammate attacking the ball.', risk: 'balanced', mine: { crossing: 0.45, technique: 0.35, vision: 0.2 }, theirs: 'team', bias: -0.1,
        out: [O('assist', 'Your delivery is met by {mate} and it goes in.'), O('keyPass', 'Your delivery finds {mate} but the header is saved.'), O('turnover', 'The defence clears your delivery.'), O('turnover', 'You hit the first man.')] },
      { id: 'short', label: 'Play it short to {mate}', desc: 'Change the angle and keep the ball.', risk: 'safe', mine: PASSER, theirs: 'team', bias: 0.5,
        out: [O('keyPass', 'The short free kick works and {mate} gets a shot away.'), O('retain', 'You play it short and keep possession.'), O('turnover', 'The short pass is blocked.'), O('turnover', 'The pass is intercepted.')] },
    ],
  },
  {
    id: 'counter', title: 'Break', kind: 'attack', script: 'counter', for: ['CM', 'AM', 'W', 'ST', 'FB', 'DM'], opp: 'CB', mate: 'ATT',
    prompt: 'You are breaking three against two. {opp} is the covering defender.',
    options: [
      { id: 'drive', label: 'Drive at {opp}', desc: 'Carry it forward and commit him.', risk: 'balanced', mine: { dribbling: 0.3, pace: 0.25, acceleration: 0.2, composure: 0.15, balance: 0.1 }, theirs: { tackling: 0.3, pace: 0.2, positioning: 0.3, anticipation: 0.2 }, bias: 0.2,
        out: [O('follow', 'You commit {opp} and the box opens up.', { follow: 'inTheBox' }), O('keyPass', 'You draw {opp} and slide it to {mate}, who shoots.'), O('turnover', '{opp} gets a foot in and the break is over.'), O('counter', '{opp} wins it and they spring a break of their own.', { q: 0.22 })] },
      { id: 'through', label: 'Through ball to {mate}', desc: 'Split the defence early.', risk: 'gamble', mine: { passing: 0.35, vision: 0.35, technique: 0.15, decisions: 0.15 }, theirs: 'team', bias: -0.1,
        out: [O('assist', 'Your through ball sends {mate} clear and he scores.'), O('keyPass', 'Your pass finds {mate} and he shoots.'), O('turnover', 'The through ball is a touch too long.'), O('counter', 'The pass is cut out and they break.', { q: 0.2 })] },
      { id: 'wide', label: 'Play it wide', desc: 'Safe and effective if the pass is right.', risk: 'safe', mine: PASSER, theirs: 'team', bias: 0.4,
        out: [O('keyPass', 'You play it wide and the cross brings a shot.'), O('retain', 'You keep the move going.'), O('turnover', 'The wide pass is intercepted.'), O('turnover', 'You overhit it out of play.')] },
      { id: 'shoot', label: 'Shoot early', desc: 'Hit it before they get back.', risk: 'gamble', mine: { longShots: 0.35, finishing: 0.3, composure: 0.2, technique: 0.15 }, theirs: 'gk', bias: -0.4,
        out: [O('goal', 'You hit it early and it beats the keeper.'), O('saved', 'Your shot is saved.'), O('wide', 'Your shot is wide.'), O('blocked', '{opp} gets across to block.')] },
    ],
  },
  {
    id: 'inTheBox', title: 'In the box', kind: 'attack', script: 'inBox', for: ['ST', 'AM', 'W', 'CM', 'FB', 'DM'], opp: 'gk', mate: 'ATT', followOnly: true, pressure: true,
    prompt: 'You are in the box and only {gk} stands in your way.',
    options: [
      { id: 'place', label: 'Place it', desc: 'Pick your spot and finish.', risk: 'balanced', mine: FIN, theirs: 'gk', bias: 0.6,
        out: [O('goal', 'You pick your spot and finish.'), O('goal', 'You drive it into the corner.'), O('saved', '{gk} saves well.'), O('wide', 'You miss the target.')] },
      { id: 'power', label: 'Hit it hard', desc: 'Beat the keeper with power.', risk: 'gamble', mine: { finishing: 0.35, longShots: 0.2, technique: 0.2, composure: 0.25 }, theirs: 'gk', bias: 0.2,
        out: [O('goal', 'You hit it hard and it flies in.'), O('goal', 'Your shot is too hot for {gk}.'), O('saved', '{gk} somehow keeps it out.'), O('wide', 'You blast it over the bar.')] },
      { id: 'square', label: 'Square it to {mate}', desc: 'Find a better placed teammate.', risk: 'safe', mine: PASSER, theirs: 'team', bias: 0.5,
        out: [O('assist', '{mate} slots it into the empty net.'), O('keyPass', '{mate} shoots and it is saved.'), O('turnover', 'The pass is cut out.'), O('turnover', 'The pass is too slow.')] },
    ],
  },
  {
    id: 'holdUp', title: 'Hold-up play', kind: 'build', script: 'holdUp', for: ['ST', 'AM'], opp: 'CB', mate: 'ATT',
    prompt: 'The ball is played up to you with {opp} on your back.',
    options: [
      { id: 'hold', label: 'Hold it up', desc: 'Shield the ball and bring your teammates into play.', risk: 'safe', mine: { strength: 0.3, firstTouch: 0.25, balance: 0.2, composure: 0.15, passing: 0.1 }, theirs: { strength: 0.35, tackling: 0.25, aggression: 0.2, balance: 0.2 }, bias: 0.2,
        out: [O('keyPass', 'You hold it up and lay it off, and {mate} has a shot.'), O('retain', 'You hold it up and the team gets forward.', { rate: 0.12 }), O('turnover', '{opp} gets round you and wins it.'), O('foulWon', 'You win a foul as {opp} comes through the back.')] },
      { id: 'turn', label: 'Turn him', desc: 'Spin away from {opp} and run at goal.', risk: 'gamble', mine: { dribbling: 0.25, agility: 0.25, acceleration: 0.2, balance: 0.15, firstTouch: 0.15 }, theirs: { strength: 0.25, anticipation: 0.3, tackling: 0.25, pace: 0.2 }, bias: -0.2,
        out: [O('follow', 'You spin away from {opp} and you are in on goal.', { follow: 'inTheBox' }), O('keyPass', 'You turn {opp} and slip in {mate}.'), O('turnover', '{opp} stays with you and wins it.'), O('counter', 'You lose it and they break.', { q: 0.2 })] },
      { id: 'flick', label: 'Flick it to {mate}', desc: 'One touch, no fuss.', risk: 'safe', mine: { passing: 0.3, firstTouch: 0.3, vision: 0.2, technique: 0.2 }, theirs: 'team', bias: 0.3,
        out: [O('keyPass', 'Your flick releases {mate} and he shoots.'), O('retain', 'You flick it on and keep the move alive.'), O('turnover', 'The flick goes astray.'), O('turnover', 'The flick is intercepted.')] },
    ],
  },
  {
    id: 'progressive', title: 'The killer pass', kind: 'build', script: 'buildUp', for: ['CM', 'DM', 'AM', 'CB', 'FB', 'W'], opp: 'MID', mate: 'ATT',
    prompt: 'The defence is stretched. You can play the killer pass or keep the ball.',
    options: [
      { id: 'killer', label: 'Play the killer ball', desc: 'Split the lines for {mate}.', risk: 'gamble', mine: { passing: 0.35, vision: 0.35, technique: 0.15, decisions: 0.15 }, theirs: 'team', bias: -0.2,
        out: [O('assist', 'Your pass splits the defence and {mate} scores.'), O('keyPass', 'Your pass finds {mate} and he gets a shot away.'), O('turnover', 'The pass is cut out.'), O('counter', 'The pass is intercepted and they break.', { q: 0.2 })] },
      { id: 'switch', label: 'Switch the play', desc: 'Move it to the far side.', risk: 'balanced', mine: { passing: 0.5, vision: 0.3, technique: 0.2 }, theirs: 'team', bias: 0.1,
        out: [O('keyPass', 'Your switch opens the pitch and a chance follows.'), O('retain', 'You switch play and the team moves up.', { rate: 0.1 }), O('turnover', 'The switch is too short.'), O('turnover', 'The switch goes out of play.')] },
      { id: 'keep', label: 'Keep it', desc: 'Retain possession and wait.', risk: 'safe', mine: { firstTouch: 0.35, composure: 0.25, passing: 0.25, decisions: 0.15 }, theirs: { aggression: 0.3, workRate: 0.3, tackling: 0.4 }, bias: 0.7,
        out: [O('retain', 'You keep it neatly.', { rate: 0.1 }), O('retain', 'You pass it safely.'), O('turnover', 'You are closed down and lose it.'), O('turnover', 'You misplace a simple pass.')] },
      { id: 'carry', label: 'Carry it forward', desc: 'Drive through the gap yourself.', risk: 'balanced', mine: { dribbling: 0.3, strength: 0.15, pace: 0.2, balance: 0.15, composure: 0.2 }, theirs: { tackling: 0.35, aggression: 0.2, workRate: 0.2, anticipation: 0.25 }, bias: 0,
        out: [O('keyPass', 'You carry it forward and slide in {mate}.'), O('retain', 'You carry it up the pitch.', { rate: 0.12 }), O('turnover', '{opp} wins it.'), O('counter', '{opp} wins it and they break.', { q: 0.2 })] },
    ],
  },
  {
    id: 'secondBall', title: 'Loose ball', kind: 'build', script: 'secondBall', for: ['DM', 'CM', 'FB', 'CB', 'AM'], opp: 'MID',
    prompt: 'A loose ball in midfield and {opp} is going for it too.',
    options: [
      { id: 'dive', label: 'Dive in', desc: 'Win it with a hard challenge.', risk: 'gamble', mine: { tackling: 0.3, aggression: 0.25, anticipation: 0.2, strength: 0.15, pace: 0.1 }, theirs: { anticipation: 0.3, strength: 0.3, balance: 0.2, pace: 0.2 }, bias: 0,
        out: [O('tackleWon', 'You win it cleanly and start a break.'), O('tackleWon', 'You get there first.'), O('foulConceded', 'You are late and give away a foul.', { card: { y: 0.15, r: 0 }, q: 0.04 }), O('foulConceded', 'You go in recklessly.', { card: { y: 0.6, r: 0.05 }, q: 0.07 })] },
      { id: 'read', label: 'Read it and step in', desc: 'Anticipate where it will drop.', risk: 'balanced', mine: { anticipation: 0.4, pace: 0.15, positioning: 0.2, decisions: 0.25 }, theirs: { anticipation: 0.3, pace: 0.3, strength: 0.2, balance: 0.2 }, bias: 0,
        out: [O('tackleWon', 'You read it perfectly and nick it away.'), O('retain', 'You step in and win it.', { rate: 0.12 }), O('turnover', '{opp} gets there first.'), O('counter', '{opp} wins it and they break.', { q: 0.2 })] },
      { id: 'shape', label: 'Hold your shape', desc: 'Do not commit and let it come to you.', risk: 'safe', mine: { positioning: 0.4, concentration: 0.3, decisions: 0.3 }, theirs: { composure: 0.5, passing: 0.5 }, bias: 0.4,
        out: [O('retain', 'You hold your shape and the ball runs to your team.'), O('retain', 'You stay put and it comes your way.'), O('turnover', 'They win it and move on.'), O('counter', 'They win it and break past you.', { q: 0.18 })] },
    ],
  },
  {
    id: 'protectLead', title: 'See it out', kind: 'build', script: 'protect', for: ['ST', 'AM', 'W', 'CM', 'DM', 'FB'], opp: 'MID',
    prompt: 'It is the {minute}th minute and you are ahead. The ball is yours near the corner flag.',
    when: c => c.lead > 0 && c.minute >= 65,
    options: [
      { id: 'shield', label: 'Shield it', desc: 'Protect the ball and run down the clock.', risk: 'safe', mine: { strength: 0.35, balance: 0.25, composure: 0.2, firstTouch: 0.2 }, theirs: { aggression: 0.3, tackling: 0.3, strength: 0.4 }, bias: 0.5,
        out: [O('foulWon', 'You shield it and win a foul. The clock keeps moving.'), O('retain', 'You hold it in the corner and the seconds tick by.', { rate: 0.12 }), O('turnover', '{opp} gets round you and wins it.'), O('counter', 'You lose it and they break.', { q: 0.2 })] },
      { id: 'push', label: 'Push for a second', desc: 'Go for the goal that ends it.', risk: 'gamble', mine: { dribbling: 0.3, pace: 0.2, passing: 0.2, vision: 0.15, composure: 0.15 }, theirs: { tackling: 0.35, anticipation: 0.3, pace: 0.35 }, bias: -0.2,
        out: [O('keyPass', 'You push forward and a chance falls to {mate}.'), O('retain', 'You push on and win a throw.'), O('turnover', 'You lose it and the pressure is back on.'), O('counter', 'You lose it and they break.', { q: 0.25 })] },
      { id: 'back', label: 'Play it back', desc: 'Calm things down.', risk: 'safe', mine: { passing: 0.4, composure: 0.3, decisions: 0.3 }, theirs: { workRate: 0.5, aggression: 0.5 }, bias: 0.8,
        out: [O('retain', 'You play it back and the team settles.'), O('retain', 'You pass it back safely.'), O('turnover', 'The pass back is short.'), O('turnover', 'You give it away cheaply.')] },
    ],
  },
  {
    id: 'chaseGame', title: 'Chasing the game', kind: 'build', script: 'buildUp', for: ['ST', 'AM', 'W', 'CM', 'DM', 'FB'], opp: 'MID', mate: 'ATT',
    prompt: 'It is the {minute}th minute and your team needs a goal. The ball is at your feet.',
    when: c => c.lead < 0 && c.minute >= 60,
    options: [
      { id: 'force', label: 'Force something', desc: 'Try the ambitious ball or shot.', risk: 'gamble', mine: { vision: 0.3, passing: 0.3, technique: 0.2, composure: 0.2 }, theirs: 'team', bias: -0.1,
        out: [O('assist', 'Your ball sets up {mate} and he scores.'), O('keyPass', 'Your ball brings a shot from {mate}.'), O('turnover', 'You try too much and lose it.'), O('counter', 'You lose it and they break.', { q: 0.22 })] },
      { id: 'drive', label: 'Drive forward', desc: 'Run at the defence.', risk: 'balanced', mine: { dribbling: 0.3, pace: 0.2, acceleration: 0.2, strength: 0.15, composure: 0.15 }, theirs: { tackling: 0.35, pace: 0.25, anticipation: 0.4 }, bias: 0,
        out: [O('follow', 'You drive into the box.', { follow: 'inTheBox' }), O('retain', 'You win a corner.', { rate: 0.1 }), O('turnover', 'You are tackled.'), O('turnover', 'You run out of space and give it away.')] },
      { id: 'patient', label: 'Be patient', desc: 'Keep the ball and look for an opening.', risk: 'safe', mine: { passing: 0.35, firstTouch: 0.3, composure: 0.2, decisions: 0.15 }, theirs: { aggression: 0.3, workRate: 0.3, tackling: 0.4 }, bias: 0.6,
        out: [O('retain', 'You keep the ball and probe.', { rate: 0.1 }), O('retain', 'You work it round the box.'), O('turnover', 'You are closed down and lose it.'), O('turnover', 'You misplace a pass.')] },
    ],
  },
  // ------------------------------------------------------------------ defend
  {
    id: 'strikerRuns', title: 'He runs at you', kind: 'defend', script: 'defendRun', for: ['CB', 'FB', 'DM', 'CM'], opp: 'ATT',
    prompt: '{opp} turns and runs at you with the goal behind you.',
    options: [
      { id: 'stepIn', label: 'Step in and tackle', desc: 'Win the ball before he gets going.', risk: 'gamble', mine: { tackling: 0.35, anticipation: 0.25, aggression: 0.15, pace: 0.1, strength: 0.15 }, theirs: DUEL_ATT, bias: 0,
        out: [O('tackleWon', 'You step in and win the ball cleanly.'), O('tackleWon', 'You get a foot in and the danger is gone.'), O('oppShot', '{opp} skips past you and has a clear sight of goal.', { q: 0.3 }), O('foulConceded', 'You catch him late. It is a foul.', { card: { y: 0.5, r: 0.04 }, q: 0.07 })] },
      { id: 'jockey', label: 'Jockey him', desc: 'Stay on your feet and show him wide.', risk: 'safe', mine: { positioning: 0.3, anticipation: 0.25, pace: 0.2, agility: 0.15, concentration: 0.1 }, theirs: DUEL_ATT, bias: 0.3,
        out: [O('tackleWon', 'You stay on your feet and he runs out of room.', { rate: 0.2 }), O('cleared', 'You show him wide and he gives it away.'), O('oppShot', 'He gets past you and shoots.', { q: 0.2 }), O('oppShot', 'He beats you and is clean through.', { q: 0.38 })] },
      { id: 'drop', label: 'Drop off and cover', desc: 'Give ground and protect the box.', risk: 'safe', mine: { positioning: 0.35, concentration: 0.25, anticipation: 0.2, workRate: 0.2 }, theirs: { composure: 0.4, longShots: 0.3, technique: 0.3 }, bias: 0.5,
        out: [O('cleared', 'You hold your line and he runs out of ideas.'), O('cleared', 'You drop off and he shoots harmlessly.'), O('oppShot', 'He shoots from the edge of the box.', { q: 0.1, how: 'long' }), O('oppShot', 'He has time and shoots.', { q: 0.22, how: 'long' })] },
      { id: 'foul', label: 'Take him down', desc: 'A professional foul. A card is likely.', risk: 'gamble', mine: { aggression: 0.4, tackling: 0.2, composure: 0.2, decisions: 0.2 }, theirs: 'team', bias: 0,
        out: [O('foulConceded', 'You take him down. A yellow card, but the danger is over.', { card: { y: 0.85, r: 0.02 }, q: 0.05, rate: -0.05 }), O('foulConceded', 'You haul him back and take the booking.', { card: { y: 0.9, r: 0.05 }, q: 0.06 }), O('foulConceded', 'You bring him down on the edge of the box.', { card: { y: 0.9, r: 0.25 }, q: 0.12 }), O('foulConceded', 'You take him down as the last man.', { card: { y: 0.5, r: 0.75 }, q: 0.12 })] },
    ],
  },
  {
    id: 'crossDefend', title: 'Cross into the box', kind: 'defend', script: 'defendCross', for: ['CB', 'FB', 'DM', 'CM'], opp: 'ATT', pressure: true,
    prompt: 'A cross comes in and {opp} is attacking it.',
    options: [
      { id: 'attack', label: 'Attack the ball', desc: 'Go and win the header.', risk: 'balanced', mine: { heading: 0.35, jumping: 0.25, strength: 0.15, anticipation: 0.15, aggression: 0.1 }, theirs: { heading: 0.35, jumping: 0.25, strength: 0.2, offTheBall: 0.2 }, bias: 0,
        out: [O('cleared', 'You rise highest and head it clear.', { rate: 0.2 }), O('cleared', 'You win the header and clear.'), O('oppShot', '{opp} gets in front of you and heads it on target.', { q: 0.28, how: 'header' }), O('oppShot', 'You miss it completely and {opp} has a free header.', { q: 0.45, how: 'header' })] },
      { id: 'tight', label: 'Stay tight to him', desc: 'Stick close and put him off.', risk: 'safe', mine: { marking: 0.35, positioning: 0.25, strength: 0.2, concentration: 0.2 }, theirs: { offTheBall: 0.4, heading: 0.3, strength: 0.3 }, bias: 0.3,
        out: [O('cleared', 'You stay tight and the header is weak.'), O('cleared', 'You get a body on him and the cross runs through.'), O('oppShot', '{opp} gets a header away.', { q: 0.16, how: 'header' }), O('oppShot', '{opp} loses you and heads at goal.', { q: 0.32, how: 'header' })] },
      { id: 'step', label: 'Step up and drop the line', desc: 'Try to catch him offside.', risk: 'gamble', mine: { positioning: 0.3, anticipation: 0.3, concentration: 0.2, decisions: 0.2 }, theirs: { offTheBall: 0.5, pace: 0.2, anticipation: 0.3 }, bias: -0.2,
        out: [O('cleared', 'You step up and he is caught offside.', { rate: 0.2 }), O('cleared', 'You step up and the cross is wasted.'), O('oppShot', 'Your line is broken and he is on goal.', { q: 0.35 }), O('oppShot', 'You step the wrong way and he is clean through.', { q: 0.5 })] },
    ],
  },
  {
    id: 'lastBlock', title: 'He is about to shoot', kind: 'defend', script: 'block', for: ['CB', 'FB', 'DM', 'CM'], opp: 'ATT',
    prompt: '{opp} is about to shoot from inside the box.',
    options: [
      { id: 'block', label: 'Throw yourself in', desc: 'Block it with your body.', risk: 'gamble', mine: { anticipation: 0.3, positioning: 0.2, pace: 0.15, aggression: 0.15, composure: 0.2 }, theirs: { finishing: 0.4, composure: 0.3, technique: 0.3 }, bias: 0,
        out: [O('cleared', 'You block it with your body.', { rate: 0.25 }), O('cleared', 'You get a foot in and it deflects wide.'), O('oppShot', 'You are a split second late and he shoots.', { q: 0.35 }), O('oppShot', 'Your block takes a deflection and it loops towards goal.', { q: 0.5 })] },
      { id: 'angle', label: 'Close the angle', desc: 'Get tight and force him wide.', risk: 'balanced', mine: { positioning: 0.35, anticipation: 0.25, pace: 0.2, concentration: 0.2 }, theirs: { finishing: 0.35, composure: 0.35, technique: 0.3 }, bias: 0.2,
        out: [O('cleared', 'You close him down and he shoots wide.'), O('cleared', 'You close the angle and the shot is blocked.'), O('oppShot', 'He shoots from a tight angle.', { q: 0.14 }), O('oppShot', 'He finds a gap and shoots.', { q: 0.3 })] },
      { id: 'trust', label: 'Trust your keeper', desc: 'Hold your position and let him shoot.', risk: 'safe', mine: { positioning: 0.5, concentration: 0.3, decisions: 0.2 }, theirs: { finishing: 0.4, composure: 0.3, technique: 0.3 }, bias: 0.4,
        out: [O('cleared', 'You hold your position and the keeper saves.'), O('cleared', 'You stay put and he shoots into the side netting.'), O('oppShot', 'He shoots and your keeper has work to do.', { q: 0.2 }), O('oppShot', 'He has a clear shot.', { q: 0.3 })] },
    ],
  },
  {
    id: 'cornerDefend', title: 'Defending a corner', kind: 'defend', script: 'corner', for: ['CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST'], opp: 'ATT', pressure: true,
    prompt: 'A corner is coming in and {opp} is dangerous in the air. How do you defend it?',
    options: [
      { id: 'man', label: 'Pick up {opp}', desc: 'Man to man.', risk: 'balanced', mine: { marking: 0.35, strength: 0.25, jumping: 0.2, concentration: 0.2 }, theirs: { heading: 0.35, jumping: 0.25, strength: 0.2, offTheBall: 0.2 }, bias: 0,
        out: [O('cleared', 'You stay with {opp} and head it clear.', { rate: 0.2 }), O('cleared', 'You get tight and the delivery is cleared.'), O('oppShot', '{opp} gets away from you and heads at goal.', { q: 0.28, how: 'header' }), O('oppShot', '{opp} loses you and is free at the back post.', { q: 0.42, how: 'header' })] },
      { id: 'zone', label: 'Hold your zone', desc: 'Guard an area of the box.', risk: 'safe', mine: { positioning: 0.35, anticipation: 0.25, heading: 0.2, concentration: 0.2 }, theirs: { offTheBall: 0.4, anticipation: 0.3, heading: 0.3 }, bias: 0.3,
        out: [O('cleared', 'You attack the ball in your zone and clear.'), O('cleared', 'You hold your zone and the corner is cleared.'), O('oppShot', 'A header falls in your zone and is hit at goal.', { q: 0.18, how: 'header' }), O('oppShot', 'The ball drops between defenders and is poked at goal.', { q: 0.3 })] },
      { id: 'near', label: 'Attack the near post', desc: 'Get on the first contact.', risk: 'gamble', mine: { heading: 0.3, jumping: 0.25, anticipation: 0.25, aggression: 0.2 }, theirs: { heading: 0.3, anticipation: 0.3, offTheBall: 0.4 }, bias: -0.1,
        out: [O('cleared', 'You get to the near post first and clear.', { rate: 0.25 }), O('cleared', 'You flick it away at the near post.'), O('oppShot', 'You miss it and the second ball is hit at goal.', { q: 0.3 }), O('oppShot', 'You leave the back post open.', { q: 0.45, how: 'header' })] },
    ],
  },
  // ------------------------------------------------------------------ goalkeeper
  {
    id: 'gkThrough', title: 'Through ball', kind: 'defend', script: 'gkThrough', for: ['GK'], opp: 'ATT',
    prompt: 'A through ball splits the defence and {opp} is chasing it.',
    options: [
      { id: 'rush', label: 'Rush out', desc: 'Get there first.', risk: 'gamble', mine: { oneOnOnes: 0.3, commandOfArea: 0.3, agility: 0.2, anticipation: 0.2 }, theirs: { pace: 0.35, acceleration: 0.25, composure: 0.2, finishing: 0.2 }, bias: 0,
        out: [O('cleared', 'You come out and sweep it away.', { rate: 0.3 }), O('cleared', 'You get there first and clear.'), O('oppShot', 'You come out but he gets there first and shoots.', { q: 0.35 }), O('foulConceded', 'You take him out. The referee shows a card.', { card: { y: 0.3, r: 0.65 }, q: 0.1 })] },
      { id: 'stay', label: 'Stay on your line', desc: 'Wait and make yourself big.', risk: 'safe', mine: { positioning: 0.35, reflexes: 0.3, concentration: 0.2, handling: 0.15 }, theirs: { finishing: 0.4, composure: 0.3, technique: 0.3 }, bias: 0.2,
        out: [O('cleared', 'You stay big and save his shot.', { rate: 0.2 }), O('cleared', 'He shoots straight at you.'), O('oppShot', 'He shoots and you have to save it.', { q: 0.25 }), O('oppShot', 'He has all the time he needs.', { q: 0.4 })] },
      { id: 'sweep', label: 'Sweep to the edge', desc: 'Come out to the edge of the box.', risk: 'balanced', mine: { commandOfArea: 0.3, anticipation: 0.3, positioning: 0.2, kicking: 0.2 }, theirs: { pace: 0.3, composure: 0.3, technique: 0.4 }, bias: 0.1,
        out: [O('cleared', 'You sweep up at the edge of the box.', { rate: 0.25 }), O('cleared', 'You come out and clear with your feet.'), O('oppShot', 'He gets there and lobs the ball towards goal.', { q: 0.3 }), O('oppShot', 'You are caught in no man\'s land.', { q: 0.45 })] },
    ],
  },
  {
    id: 'gk1v1', title: 'One on one', kind: 'defend', script: 'gk1v1', for: ['GK'], opp: 'ATT', pressure: true,
    prompt: '{opp} is through and it is one on one.',
    options: [
      { id: 'narrow', label: 'Narrow the angle', desc: 'Come out and take the goal away.', risk: 'balanced', mine: { oneOnOnes: 0.4, positioning: 0.25, reflexes: 0.2, agility: 0.15 }, theirs: { finishing: 0.4, composure: 0.35, technique: 0.25 }, bias: 0.1,
        out: [O('cleared', 'You narrow the angle and he hits you.', { rate: 0.3 }), O('cleared', 'You make yourself big and save.'), O('oppShot', 'He finds a way past you.', { q: 0.5 }), O('oppShot', 'He rounds you and has an open goal.', { q: 0.7 })] },
      { id: 'spread', label: 'Stand tall and spread', desc: 'Stay up and react.', risk: 'safe', mine: { reflexes: 0.4, agility: 0.2, positioning: 0.2, concentration: 0.2 }, theirs: { finishing: 0.4, composure: 0.35, technique: 0.25 }, bias: 0,
        out: [O('cleared', 'You stay up and make the save.', { rate: 0.3 }), O('cleared', 'You get a hand to it.'), O('oppShot', 'He picks his spot.', { q: 0.45 }), O('oppShot', 'He chips you.', { q: 0.65 })] },
      { id: 'dive', label: 'Dive at his feet', desc: 'Smother it.', risk: 'gamble', mine: { oneOnOnes: 0.35, handling: 0.25, aggression: 0.2, agility: 0.2 }, theirs: { dribbling: 0.3, composure: 0.4, acceleration: 0.3 }, bias: -0.1,
        out: [O('cleared', 'You dive at his feet and smother it.', { rate: 0.35 }), O('cleared', 'You get down and win the ball.'), O('oppShot', 'He knocks it past you.', { q: 0.55 }), O('foulConceded', 'You bring him down. It is a penalty and a card.', { card: { y: 0.5, r: 0.5 }, q: 0.76 })] },
    ],
  },
  {
    id: 'gkCross', title: 'Cross into your area', kind: 'defend', script: 'defendCross', for: ['GK'], opp: 'ATT',
    prompt: 'A cross is whipped in and {opp} is rising with you under the ball.',
    options: [
      { id: 'claim', label: 'Come and claim it', desc: 'Catch it at the highest point.', risk: 'gamble', mine: { aerialReach: 0.3, commandOfArea: 0.25, handling: 0.25, jumping: 0.2 }, theirs: { heading: 0.4, jumping: 0.3, strength: 0.3 }, bias: 0,
        out: [O('cleared', 'You come and catch it cleanly.', { rate: 0.25 }), O('cleared', 'You claim it under pressure.'), O('oppShot', 'You miss it and {opp} gets a header away.', { q: 0.4, how: 'header' }), O('oppShot', 'You are beaten to it and the goal is open.', { q: 0.6, how: 'header' })] },
      { id: 'punch', label: 'Punch it clear', desc: 'Safe if you get a fist to it.', risk: 'safe', mine: { aerialReach: 0.35, strength: 0.25, commandOfArea: 0.2, jumping: 0.2 }, theirs: { heading: 0.4, jumping: 0.3, strength: 0.3 }, bias: 0.2,
        out: [O('cleared', 'You punch it a long way clear.'), O('cleared', 'You punch it away.'), O('oppShot', 'Your punch drops to an attacker.', { q: 0.2 }), O('oppShot', 'You only get a glancing touch and it falls kindly.', { q: 0.35 })] },
      { id: 'line', label: 'Stay on your line', desc: 'Let your defenders deal with it.', risk: 'safe', mine: { positioning: 0.4, reflexes: 0.3, concentration: 0.3 }, theirs: { heading: 0.4, offTheBall: 0.3, jumping: 0.3 }, bias: 0,
        out: [O('cleared', 'You stay on your line and the header is straight at you.'), O('cleared', 'The header goes wide.'), O('oppShot', 'The header is on target and you have to save it.', { q: 0.22, how: 'header' }), O('oppShot', 'The header is placed and you cannot reach it.', { q: 0.4, how: 'header' })] },
    ],
  },
  {
    id: 'gkBall', title: 'Ball at your feet', kind: 'build', script: 'gkBall', for: ['GK'], opp: 'ATT',
    prompt: 'A pass back comes to you and {opp} is closing you down.',
    options: [
      { id: 'long', label: 'Kick it long', desc: 'Clear your lines and look for a target.', risk: 'balanced', mine: { kicking: 0.55, composure: 0.2, technique: 0.25 }, theirs: 'team', bias: 0.2,
        out: [O('keyPass', 'Your long kick finds a runner and a chance comes.'), O('retain', 'You find a teammate with a long kick.'), O('turnover', 'Your kick goes straight out of play.'), O('turnover', 'You slice it out for a throw-in.')] },
      { id: 'short', label: 'Play it short', desc: 'Find the nearest defender.', risk: 'safe', mine: { kicking: 0.3, composure: 0.3, firstTouch: 0.2, decisions: 0.2 }, theirs: { aggression: 0.3, pace: 0.3, workRate: 0.4 }, bias: 0.2,
        out: [O('retain', 'You play it short and the team builds.', { rate: 0.1 }), O('retain', 'You pass it out and relieve the pressure.'), O('turnover', 'Your pass is a little short.'), O('counter', 'The pass is intercepted and they have a chance.', { q: 0.4 })] },
      { id: 'dribble', label: 'Beat the press', desc: 'Take a touch round the striker.', risk: 'gamble', mine: { firstTouch: 0.3, agility: 0.3, composure: 0.4 }, theirs: { aggression: 0.3, pace: 0.3, workRate: 0.4 }, bias: -0.4,
        out: [O('retain', 'You take a touch past him and pass out calmly.', { rate: 0.2 }), O('retain', 'You turn away from him and find a pass.'), O('turnover', 'You are closed down and clear it away.'), O('counter', 'He wins it and the goal is open.', { q: 0.55 })] },
    ],
  },
  // ------------------------------------------------------------------ anywhere
  {
    id: 'refDispute', title: 'Referee decision', kind: 'any', script: 'any', for: ['ST', 'AM', 'W', 'CM', 'DM', 'FB', 'CB', 'GK'], opp: 'none', pressure: true,
    prompt: 'The referee waves away your appeal. The crowd is on your back.',
    options: [
      { id: 'accept', label: 'Accept it', desc: 'Get on with the game.', risk: 'safe', mine: { composure: 0.5, decisions: 0.3, concentration: 0.2 }, theirs: 'team', bias: 8,
        out: [O('nothing', 'You shake your head and get on with it.', { conf: 1 }), O('nothing', 'You let it go.'), O('nothing', 'You let it go, but it still bothers you.', { conf: -1 }), O('nothing', 'You stew on it.', { conf: -2 })] },
      { id: 'protest', label: 'Protest', desc: 'Make your point to the referee.', risk: 'gamble', mine: { composure: 0.4, decisions: 0.3, aggression: 0.3 }, theirs: 'team', bias: 2,
        out: [O('foulWon', 'The referee listens and awards a free kick.', { conf: 3 }), O('nothing', 'The referee hears you out and play goes on.'), O('foulConceded', 'The referee does not like your tone. Yellow card.', { card: { y: 1, r: 0 }, q: 0, conf: -3 }), O('foulConceded', 'You go too far and are sent off.', { card: { y: 0, r: 1 }, q: 0, conf: -6 })] },
    ],
  },
];

export const TEMPLATES: TemplateDef[] = [...CORE, ...EXTRA, ...MORE_A, ...MORE_B].map(withTraits);

export const TEMPLATE_BY_ID: Record<string, TemplateDef> = Object.fromEntries(TEMPLATES.map(t => [t.id, t]));

/** Templates a player in this position can be given by the director. */
export const selectable = (slot: TemplateDef['for'][number]) => TEMPLATES.filter(t => !t.followOnly && t.for.includes(slot));

