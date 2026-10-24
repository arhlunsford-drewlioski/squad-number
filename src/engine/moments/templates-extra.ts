import type { OptionDef, Outcome, ResultKind, Risk, TemplateDef, Weights } from './types';

const O = (r: ResultKind, text: string, extra: Partial<Outcome> = {}): Outcome => ({ r, text, ...extra });
const GOAL = (text: string, how?: Outcome['how']) => O('goal', text, how ? { how } : {});
const SAVE = (text: string) => O('saved', text);
const WIDE = (text: string) => O('wide', text);
const BLOCK = (text: string) => O('blocked', text);
const ASSIST = (text: string) => O('assist', text);
const KEY = (text: string) => O('keyPass', text);
const KEEP = (text: string, rate?: number) => O('retain', text, rate ? { rate } : {});
const LOSE = (text: string, rate?: number) => O('turnover', text, rate ? { rate } : {});
const BREAK = (text: string, q = 0.2) => O('counter', text, { q });
const WIN = (text: string) => O('tackleWon', text);
const CLEAR = (text: string, rate?: number) => O('cleared', text, rate ? { rate } : {});
const SHOT = (text: string, q: number, how?: Outcome['how']) => O('oppShot', text, how ? { q, how } : { q });
const FOUL = (text: string, y: number, r: number, q: number) => O('foulConceded', text, { card: { y, r }, q });
const WON = (text: string) => O('foulWon', text);
const FOLLOW = (text: string) => O('follow', text, { follow: 'inTheBox' });

const opt = (id: string, label: string, desc: string, risk: Risk, mine: Weights, theirs: Weights | 'gk' | 'team', bias: number, out: [Outcome, Outcome, Outcome, Outcome], needs?: OptionDef['needs']): OptionDef =>
  ({ id, label, desc, risk, mine, theirs, bias, out, needs });

const PASSER = { passing: 0.4, vision: 0.3, composure: 0.2, decisions: 0.1 };
const RUNNER = { pace: 0.35, acceleration: 0.25, dribbling: 0.2, composure: 0.2 };
const AERIAL: Weights = { heading: 0.35, jumping: 0.3, strength: 0.2, anticipation: 0.15 };
const CHASE = { pace: 0.4, acceleration: 0.2, anticipation: 0.2, positioning: 0.2 };

export const EXTRA: TemplateDef[] = [
  // ------------------------------------------------------------------ attack
  { id: 'rebound', title: 'Rebound', kind: 'attack', script: 'loose', for: ['ST', 'AM', 'W', 'CM'], opp: 'gk', mate: 'ATT',
    prompt: '{gk} parries the shot and the ball rolls out to you.',
    options: [
      opt('tapIn', 'Tap it in', 'Be first to the rebound.', 'balanced', { finishing: 0.4, composure: 0.3, anticipation: 0.15, firstTouch: 0.15 }, 'gk', 0.5, [GOAL('You are first to the rebound and tap it in.'), GOAL('You poke it past {gk}.'), SAVE('{gk} recovers and saves again.'), WIDE('You scuff it wide.')]),
      opt('blast', 'Hit it first time', 'Give {gk} no time.', 'gamble', { finishing: 0.35, technique: 0.2, composure: 0.2, longShots: 0.25 }, 'gk', 0, [GOAL('You hit it first time and it is in.'), SAVE('{gk} gets a hand to it.'), WIDE('You blaze it over.'), BLOCK('A defender throws himself in the way.')]),
      opt('layOff', 'Pull it back to {mate}', 'A better angle for a teammate.', 'safe', PASSER, 'team', 0.3, [ASSIST('{mate} steps in and scores.'), KEY('{mate} shoots and it is saved.'), LOSE('The pull-back is cut out.'), LOSE('A defender gets across and clears.')]),
    ] },
  { id: 'longBallChase', title: 'Race to the ball', kind: 'attack', script: 'oneOnOne', for: ['ST', 'W', 'AM'], opp: 'CB',
    prompt: 'A long ball goes over the top and you are racing {opp} to it.',
    options: [
      opt('pace', 'Outrun him', 'Get there first and run at goal.', 'balanced', { pace: 0.4, acceleration: 0.3, balance: 0.1, offTheBall: 0.2 }, CHASE, 0, [FOLLOW('You get there first and are clear.'), KEY('You get there first but the angle is tight, and your pass is saved.'), LOSE('{opp} gets there first and clears.'), BREAK('{opp} wins it and they break.')]),
      opt('strength', 'Hold him off', 'Use your body to protect the ball.', 'balanced', { strength: 0.35, balance: 0.25, firstTouch: 0.2, composure: 0.2 }, { strength: 0.4, aggression: 0.2, tackling: 0.2, balance: 0.2 }, 0, [FOLLOW('You hold off {opp} and turn towards goal.'), WON('You hold him off and win a free kick.'), LOSE('{opp} muscles you off it.'), WON('{opp} fouls you. Free kick.')]),
      opt('check', 'Check your run', 'Let it bounce and take it down.', 'safe', { firstTouch: 0.4, anticipation: 0.3, composure: 0.3 }, { anticipation: 0.4, positioning: 0.3, pace: 0.3 }, 0.3, [KEEP('You take it down and the move goes on.', 0.1), KEEP('You bring it under control.'), LOSE('You mistime it and {opp} gets it.'), LOSE('It bounces over you.')]),
    ] },
  { id: 'overheadKick', title: 'A chance for something special', kind: 'attack', script: 'loose', for: ['ST', 'AM', 'W'], opp: 'gk',
    prompt: 'The ball drops awkwardly in the box, just above head height, with your back to goal.',
    options: [
      opt('overhead', 'Try an overhead kick', 'High risk. It only works for the technical.', 'gamble', { technique: 0.35, agility: 0.25, balance: 0.2, composure: 0.1, finishing: 0.1 }, 'gk', -0.7, [GOAL('You throw yourself backwards and it flies into the net.'), SAVE('Your overhead kick is well saved.'), WIDE('You connect, but it goes over the bar.'), WIDE('You miss it completely and land in a heap.')], { attr: 'technique', min: 10 }),
      opt('bring', 'Bring it down', 'Control it and turn.', 'balanced', { firstTouch: 0.4, balance: 0.2, composure: 0.2, strength: 0.2 }, { tackling: 0.4, strength: 0.3, anticipation: 0.3 }, 0, [FOLLOW('You take it down and swivel on goal.'), KEY('You take it down and lay it off for a shot.'), LOSE('The touch is heavy and it is cleared.'), LOSE('You take it down but are robbed.')]),
      opt('head', 'Head it across goal', 'Keep it in the danger zone.', 'safe', { heading: 0.4, jumping: 0.2, vision: 0.2, composure: 0.2 }, 'team', 0.3, [KEY('You head it across goal and someone shoots.'), KEEP('You keep it alive in the box.'), LOSE('Your header goes out of play.'), LOSE('You head it straight to a defender.')]),
    ] },
  { id: 'cutbackArrives', title: 'Cutback', kind: 'attack', script: 'inBox', for: ['ST', 'AM', 'W', 'CM'], opp: 'gk', mate: 'W', pressure: true,
    prompt: '{mate} cuts the ball back from the byline and you are arriving at the edge of the area.',
    options: [
      opt('first', 'Hit it first time', 'Meet it on the run.', 'gamble', { finishing: 0.3, technique: 0.25, composure: 0.2, offTheBall: 0.15, firstTouch: 0.1 }, 'gk', -0.1, [GOAL('You meet it first time and it flies in.'), SAVE('You hit it well but {gk} saves.'), WIDE('You get over it and it goes high.'), BLOCK('A defender slides in and blocks it.')]),
      opt('control', 'Take a touch', 'Steady yourself before shooting.', 'balanced', { firstTouch: 0.3, composure: 0.3, finishing: 0.25, balance: 0.15 }, { tackling: 0.4, anticipation: 0.3, pace: 0.3 }, 0, [GOAL('You take a touch and finish calmly.'), SAVE('You shoot after a touch and it is saved.'), BLOCK('The touch lets a defender block it.'), LOSE('The touch is too heavy.')]),
      opt('dummy', 'Let it run', 'A dummy to leave it for a teammate.', 'safe', { vision: 0.4, decisions: 0.3, composure: 0.3 }, 'team', 0.3, [ASSIST('You let it run and your teammate scores.'), KEY('You let it run and a teammate shoots.'), KEEP('The dummy does not work, but the move goes on.'), LOSE('Your dummy fools nobody and the ball is cleared.')], { attr: 'vision', min: 7 }),
    ] },
  { id: 'takeCorner', title: 'Corner kick', kind: 'attack', script: 'corner', for: ['W', 'AM', 'CM', 'FB', 'DM'], opp: 'none', mate: 'ST',
    prompt: 'You have the corner. {mate} is making a run into the box.',
    options: [
      opt('near', 'Whip it to the near post', 'Fast and flat.', 'balanced', { crossing: 0.5, technique: 0.3, vision: 0.2 }, 'team', 0, [ASSIST('{mate} flicks your corner in at the near post.'), KEY('{mate} gets a touch and it is saved.'), LOSE('The first man clears.'), LOSE('You hit the first defender.')]),
      opt('far', 'Float it to the far post', 'Hang it up for the big men.', 'balanced', { crossing: 0.45, technique: 0.25, vision: 0.3 }, 'team', -0.1, [ASSIST('{mate} rises at the far post and heads in.'), KEY('{mate} heads it back across and there is a shot.'), LOSE('The keeper claims it.'), LOSE('You overhit it out of play.')]),
      opt('short', 'Play it short', 'Change the angle.', 'safe', PASSER, 'team', 0.5, [KEY('The short corner works and a shot follows.'), KEEP('You play it short and keep possession.'), LOSE('The short corner is closed down.'), LOSE('The pass is intercepted.')]),
    ] },
  { id: 'cornerAttack', title: 'Attacking a corner', kind: 'attack', script: 'corner', for: ['ST', 'CB', 'AM', 'CM', 'W', 'FB', 'DM'], opp: 'CB', pressure: true,
    prompt: 'A corner is coming in. {opp} is marking you. Where do you attack?',
    options: [
      opt('near', 'Attack the near post', 'Get across {opp} and flick it on.', 'gamble', { offTheBall: 0.3, anticipation: 0.25, heading: 0.25, acceleration: 0.2 }, { marking: 0.35, positioning: 0.3, anticipation: 0.35 }, -0.1, [GOAL('You get across {opp} and flick it in.', 'header'), SAVE('You get a touch but it is saved.'), WIDE('You get a touch but it goes wide.'), BLOCK('{opp} gets there first.')]),
      opt('far', 'Drift to the far post', 'Lose your man in the crowd.', 'balanced', { offTheBall: 0.35, heading: 0.3, jumping: 0.2, anticipation: 0.15 }, { marking: 0.4, heading: 0.3, strength: 0.3 }, 0, [GOAL('You lose {opp} and head in at the far post.', 'header'), SAVE('You win the header but it is saved.'), WIDE('You get your head to it but it goes over.'), BLOCK('{opp} stays tight and clears.')]),
      opt('edge', 'Wait at the edge of the box', 'Be ready for the second ball.', 'safe', { longShots: 0.4, composure: 0.3, technique: 0.3 }, 'gk', -0.3, [GOAL('The ball falls to you at the edge and you hit it in.', 'long'), SAVE('Your shot from the edge is saved.'), WIDE('Your shot flies over.'), BLOCK('Your shot is blocked.')]),
    ] },
  { id: 'pressSteal', title: 'Press', kind: 'attack', script: 'buildUp', for: ['ST', 'AM', 'W'], opp: 'CB',
    prompt: 'Their keeper plays it short to {opp}. You can press.',
    options: [
      opt('sprint', 'Sprint and press', 'Close him down before he settles.', 'gamble', { workRate: 0.3, pace: 0.25, anticipation: 0.25, aggression: 0.2 }, { composure: 0.4, firstTouch: 0.3, passing: 0.3 }, 0, [FOLLOW('You win it high up the pitch and are in on goal.'), KEY('You win it and slip in a teammate for a shot.'), KEEP('He gets it away, but you forced him to hurry.'), BREAK('He plays through your press and they break.')]),
      opt('lane', 'Cut the passing lane', 'Force him into a mistake.', 'balanced', { anticipation: 0.4, positioning: 0.3, workRate: 0.3 }, { composure: 0.4, passing: 0.3, decisions: 0.3 }, 0.1, [KEY('You cut the lane and he gives it away. A shot follows.'), KEEP('You force a long ball.', 0.1), LOSE('He finds the pass anyway.'), LOSE('You are taken out of the game by a pass.')]),
      opt('hold', 'Hold your position', 'Do not chase.', 'safe', { positioning: 0.5, concentration: 0.3, decisions: 0.2 }, 'team', 0.5, [KEEP('You stay in shape and the team keeps its structure.'), KEEP('You hold your position.'), LOSE('He plays through the gap you left.'), LOSE('The space behind you is used.')]),
    ] },
  { id: 'giveAndGo', title: 'One-two', kind: 'attack', script: 'buildUp', for: ['AM', 'CM', 'W', 'ST', 'FB'], opp: 'CB', mate: 'ATT',
    prompt: 'You can play a one-two with {mate} around {opp}.',
    options: [
      opt('oneTwo', 'Play the one-two', 'Give and go.', 'balanced', { passing: 0.3, firstTouch: 0.25, offTheBall: 0.25, vision: 0.2 }, { marking: 0.35, anticipation: 0.35, positioning: 0.3 }, 0, [FOLLOW('The one-two works and you are in the box.'), KEY('The one-two works and you slip it to {mate}, who shoots.'), LOSE('{opp} reads it and cuts out the return.'), LOSE('The return pass is behind you.')]),
      opt('dribble', 'Dribble past him', 'Trust yourself.', 'gamble', { dribbling: 0.35, agility: 0.2, acceleration: 0.2, balance: 0.15, composure: 0.1 }, { tackling: 0.3, pace: 0.25, anticipation: 0.25, balance: 0.2 }, -0.1, [FOLLOW('You go past {opp} and into the box.'), KEY('You beat {opp} and find {mate}.'), LOSE('{opp} wins it.'), BREAK('{opp} wins it and they break.')]),
      opt('shoot', 'Shoot from here', 'Hit it before he closes.', 'gamble', { longShots: 0.4, technique: 0.3, composure: 0.3 }, 'gk', -0.5, [GOAL('You hit it from distance and it is in.', 'long'), SAVE('Your shot is saved.'), WIDE('Your shot is wide.'), BLOCK('{opp} blocks it.')]),
    ] },
  { id: 'overlapRun', title: 'Overlap', kind: 'build', script: 'wide', for: ['FB', 'CM'], opp: 'FB', mate: 'W',
    prompt: '{mate} takes his man inside. You can overlap down the outside.',
    options: [
      opt('overlap', 'Overlap', 'Run past on the outside.', 'balanced', { workRate: 0.25, pace: 0.25, stamina: 0.2, offTheBall: 0.2, acceleration: 0.1 }, { workRate: 0.3, pace: 0.3, positioning: 0.2, anticipation: 0.2 }, 0, [KEY('{mate} slides you in and your cross brings a shot.'), KEEP('You overlap and win a corner.', 0.1), LOSE('You are not found and the move dies.'), BREAK('You are caught upfield when they win it.', 0.25)]),
      opt('stay', 'Stay in position', 'Keep your shape.', 'safe', { positioning: 0.4, concentration: 0.3, decisions: 0.3 }, 'team', 0.5, [KEEP('You hold your position and the move goes on.'), KEEP('You keep your shape.'), LOSE('The move breaks down.'), LOSE('The move breaks down.')]),
      opt('under', 'Underlap', 'Run inside {mate}.', 'gamble', { offTheBall: 0.3, anticipation: 0.25, pace: 0.25, composure: 0.2 }, { positioning: 0.4, marking: 0.3, anticipation: 0.3 }, -0.1, [KEY('You underlap and are played in for a shot.'), KEEP('You underlap and keep the move moving.'), LOSE('Your run is missed.'), BREAK('You are caught out of position.', 0.22)]),
    ] },
  { id: 'dropBall', title: 'Clearance drops to you', kind: 'attack', script: 'longRange', for: ['CM', 'DM', 'FB', 'AM'], opp: 'DM', mate: 'ATT',
    prompt: 'A clearance drops to you 20 yards out and {opp} is coming to close you down.',
    options: [
      opt('volley', 'Volley it', 'First time, on the full.', 'gamble', { technique: 0.35, longShots: 0.3, composure: 0.2, firstTouch: 0.15 }, 'gk', -0.7, [GOAL('You volley it and it flies in.', 'long'), SAVE('Your volley is well saved.'), WIDE('Your volley goes over.'), WIDE('You scuff it wide.')]),
      opt('control', 'Control it first', 'Take a touch and look up.', 'balanced', { firstTouch: 0.4, composure: 0.3, vision: 0.15, technique: 0.15 }, { tackling: 0.35, aggression: 0.25, pace: 0.2, anticipation: 0.2 }, 0, [KEY('You control it and play {mate} in for a shot.'), KEEP('You control it and the move goes on.', 0.1), LOSE('{opp} wins it as you take a touch.'), BREAK('{opp} wins it and they break.')]),
      opt('simple', 'Play it simple', 'Find a teammate.', 'safe', PASSER, 'team', 0.5, [KEEP('You play it simply and keep possession.', 0.1), KEEP('You find a teammate.'), LOSE('Your pass is cut out.'), LOSE('You miscontrol it.')]),
    ] },
  // ------------------------------------------------------------------ build
  { id: 'pressResist', title: 'Closed down', kind: 'build', script: 'buildUp', for: ['CM', 'DM', 'AM', 'CB', 'FB', 'W'], opp: 'MID',
    prompt: 'Two players close you down at once and {opp} arrives first.',
    options: [
      opt('spin', 'Spin out of it', 'Turn away from the pressure.', 'gamble', { agility: 0.25, balance: 0.25, firstTouch: 0.25, composure: 0.25 }, { aggression: 0.3, pace: 0.3, tackling: 0.4 }, -0.1, [KEY('You spin away and your pass opens the pitch.'), KEEP('You spin out of trouble.', 0.2), LOSE('You are dispossessed.'), BREAK('You lose it in a dangerous area.', 0.25)]),
      opt('quick', 'Play it first time', 'One touch to a teammate.', 'safe', { passing: 0.35, firstTouch: 0.3, vision: 0.2, composure: 0.15 }, 'team', 0.5, [KEEP('A first-time pass takes the pressure off.', 0.15), KEEP('You find a teammate.'), LOSE('Your pass is intercepted.'), LOSE('You rush it and give it away.')]),
      opt('shield', 'Shield and wait', 'Use your body.', 'balanced', { strength: 0.35, balance: 0.3, composure: 0.2, firstTouch: 0.15 }, { strength: 0.3, aggression: 0.3, tackling: 0.4 }, 0.2, [KEEP('You shield it until help arrives.', 0.15), WON('You shield it and win a foul.'), LOSE('You are barged off it.'), LOSE('You are robbed.')]),
    ] },
  { id: 'playOutBack', title: 'Pressed in your own half', kind: 'build', script: 'buildUp', for: ['CB', 'FB', 'DM'], opp: 'ATT',
    prompt: '{opp} is pressing you high up the pitch and you have the ball in your own half.',
    options: [
      opt('short', 'Play out short', 'Trust the build-up.', 'balanced', { passing: 0.35, composure: 0.3, firstTouch: 0.2, decisions: 0.15 }, { aggression: 0.3, workRate: 0.3, anticipation: 0.4 }, 0.1, [KEY('You play through the press and a chance follows.'), KEEP('You play out cleanly.', 0.15), LOSE('Your pass is intercepted.'), BREAK('The pass is intercepted in your half.', 0.4)]),
      opt('long', 'Go long', 'Clear your lines.', 'safe', { passing: 0.3, technique: 0.25, strength: 0.15, composure: 0.3 }, 'team', 0.4, [KEEP('You clear your lines and win a throw.'), KEEP('A long ball relieves the pressure.'), LOSE('The long ball goes straight out.'), LOSE('A long ball is easily won.')]),
      opt('keeper', 'Pass back to the keeper', 'Let him deal with it.', 'safe', { passing: 0.4, composure: 0.4, decisions: 0.2 }, { aggression: 0.4, pace: 0.3, workRate: 0.3 }, 0.6, [KEEP('You pass back and the keeper clears.'), KEEP('You pass back calmly.'), LOSE('The back pass is short and the keeper hacks it away.'), BREAK('The back pass is short and {opp} pounces.', 0.45)]),
    ] },
  { id: 'longDiagonal', title: 'The diagonal', kind: 'build', script: 'buildUp', for: ['CM', 'DM', 'CB', 'FB', 'AM'], opp: 'MID', mate: 'W',
    prompt: '{mate} is free on the far side. Do you hit the diagonal?',
    options: [
      opt('hit', 'Hit the diagonal', 'Pick him out across the pitch.', 'gamble', { passing: 0.4, technique: 0.3, vision: 0.3 }, 'team', -0.1, [KEY('The diagonal finds {mate} and a chance follows.'), KEEP('The diagonal finds {mate} and the team moves up.', 0.15), LOSE('The pass is too long.'), LOSE('The pass is cut out.')]),
      opt('simple', 'Play it simple', 'Keep it moving.', 'safe', PASSER, 'team', 0.6, [KEEP('You keep it moving.', 0.1), KEEP('You find a teammate.'), LOSE('The pass is intercepted.'), LOSE('You misplace a simple pass.')]),
      opt('drive', 'Drive forward', 'Take it on yourself.', 'balanced', { dribbling: 0.3, strength: 0.15, pace: 0.2, balance: 0.15, composure: 0.2 }, { tackling: 0.35, aggression: 0.2, workRate: 0.2, anticipation: 0.25 }, 0, [KEY('You drive forward and play in {mate}.'), KEEP('You carry it up the pitch.', 0.12), LOSE('{opp} wins it.'), BREAK('{opp} wins it and they break.')]),
    ] },
  { id: 'fiftyFifty', title: 'Fifty-fifty', kind: 'build', script: 'secondBall', for: ['CM', 'DM', 'CB', 'FB', 'AM', 'W', 'ST'], opp: 'MID',
    prompt: 'A fifty-fifty ball with {opp}, and neither of you is backing off.',
    options: [
      opt('strong', 'Go in strong', 'Win it or nobody does.', 'gamble', { aggression: 0.3, tackling: 0.25, strength: 0.25, anticipation: 0.2 }, { aggression: 0.3, strength: 0.3, tackling: 0.2, balance: 0.2 }, 0, [WIN('You win it and start the break.'), WIN('You get there first.'), FOUL('You go in late and give away a foul.', 0.25, 0, 0.04), FOUL('You go in too hard.', 0.7, 0.06, 0.07)]),
      opt('care', 'Go in with care', 'Get a foot in without risking a foul.', 'balanced', { tackling: 0.35, anticipation: 0.3, balance: 0.2, positioning: 0.15 }, { aggression: 0.3, strength: 0.3, tackling: 0.2, balance: 0.2 }, 0.1, [WIN('You win it cleanly.'), KEEP('You get a touch and it breaks to your team.'), LOSE('{opp} wins it.'), LOSE('{opp} wins it and goes past you.')]),
      opt('leave', 'Leave it', 'Let him have it and hold your shape.', 'safe', { positioning: 0.4, concentration: 0.3, decisions: 0.3 }, 'team', 0.4, [KEEP('You stay in shape and win it back soon after.'), KEEP('You hold your position.'), LOSE('He wins it and moves forward.'), BREAK('He wins it and breaks into space.', 0.18)]),
    ] },
  { id: 'trackBack', title: 'Track back', kind: 'defend', script: 'defendRun', for: ['W', 'ST', 'AM', 'CM'], opp: 'ATT',
    prompt: 'They are breaking and you are the nearest player back. {opp} has the ball.',
    options: [
      opt('sprint', 'Sprint back and challenge', 'Put in the effort.', 'balanced', { workRate: 0.3, pace: 0.25, tackling: 0.25, stamina: 0.2 }, RUNNER, 0, [WIN('You track back and win the ball.'), CLEAR('You get back and slow the break.'), SHOT('You are too late and he has a shot.', 0.25), SHOT('You are well beaten and he is clear.', 0.4)]),
      opt('screen', 'Drop in front of him', 'Stay between him and goal.', 'safe', { positioning: 0.35, anticipation: 0.3, workRate: 0.2, concentration: 0.15 }, { composure: 0.4, technique: 0.3, longShots: 0.3 }, 0.3, [CLEAR('You screen the ball and the break fizzles out.'), CLEAR('You get in the way and he slows.'), SHOT('He shoots from distance.', 0.1, 'long'), SHOT('He finds a way round you.', 0.25)]),
      opt('foul', 'Pull him back', 'Take the card and stop it.', 'gamble', { aggression: 0.4, workRate: 0.2, composure: 0.2, decisions: 0.2 }, 'team', 0, [FOUL('You pull him back and take the yellow.', 0.85, 0.02, 0.04), FOUL('You stop the break and take a booking.', 0.9, 0.05, 0.05), FOUL('You pull him back and are booked.', 0.9, 0.2, 0.1), FOUL('You haul him down and are sent off.', 0.5, 0.7, 0.1)]),
    ] },
  // ------------------------------------------------------------------ defend
  { id: 'throughBallDefend', title: 'Ball over the top', kind: 'defend', script: 'defendRun', for: ['CB', 'FB', 'DM'], opp: 'ATT',
    prompt: 'A ball is played over the top and you are racing {opp} to it.',
    options: [
      opt('race', 'Win the race', 'Outpace him.', 'balanced', { pace: 0.4, acceleration: 0.3, anticipation: 0.3 }, RUNNER, 0, [CLEAR('You win the race and clear.', 0.2), CLEAR('You get there first and clear.'), SHOT('He gets there first and shoots.', 0.3), SHOT('You are beaten and he is clean through.', 0.5)]),
      opt('shoulder', 'Use your body', 'Shoulder to shoulder.', 'balanced', { strength: 0.35, balance: 0.25, aggression: 0.2, anticipation: 0.2 }, { strength: 0.3, balance: 0.3, pace: 0.2, composure: 0.2 }, 0, [CLEAR('You shoulder him off the ball.'), WIN('You win the ball cleanly.'), FOUL('You push him and it is a free kick.', 0.1, 0, 0.04), SHOT('He rides the challenge and shoots.', 0.3)]),
      opt('foul', 'Take him down', 'A professional foul.', 'gamble', { aggression: 0.4, composure: 0.2, decisions: 0.4 }, 'team', 0, [FOUL('You bring him down. Yellow card but the danger is over.', 0.85, 0.02, 0.05), FOUL('You haul him back and are booked.', 0.9, 0.05, 0.06), FOUL('You bring him down on the edge of the box.', 0.9, 0.3, 0.12), FOUL('You take him out as the last man.', 0.4, 0.8, 0.12)]),
    ] },
  { id: 'cutbackDefend', title: 'Cutback across the box', kind: 'defend', script: 'defendCross', for: ['CB', 'DM', 'CM', 'FB'], opp: 'ATT',
    prompt: 'A cutback is coming across the box. {opp} is making the run.',
    options: [
      opt('runner', 'Pick up the runner', 'Stay with {opp}.', 'balanced', { marking: 0.35, pace: 0.2, anticipation: 0.25, workRate: 0.2 }, { offTheBall: 0.4, pace: 0.3, acceleration: 0.3 }, 0, [CLEAR('You stay with {opp} and cut it out.', 0.2), CLEAR('You get a foot in and it runs away.'), SHOT('{opp} gets free and shoots.', 0.3), SHOT('{opp} loses you and has a clear sight of goal.', 0.45)]),
      opt('zone', 'Hold your zone', 'Protect the penalty spot.', 'safe', { positioning: 0.4, anticipation: 0.3, concentration: 0.3 }, { offTheBall: 0.4, anticipation: 0.3, composure: 0.3 }, 0.3, [CLEAR('You hold your zone and the cutback runs through.'), CLEAR('You are in the right place and clear it.'), SHOT('The ball finds a gap and he shoots.', 0.2), SHOT('The ball falls to a free man.', 0.35)]),
      opt('lane', 'Block the lane', 'Step across and cut it out.', 'gamble', { anticipation: 0.35, positioning: 0.25, aggression: 0.15, pace: 0.25 }, { passing: 0.3, vision: 0.4, technique: 0.3 }, -0.1, [CLEAR('You step across and intercept it.', 0.25), CLEAR('You get a toe to it.'), SHOT('You step the wrong way and he has a free shot.', 0.35), SHOT('You are caught out and he scores from close range.', 0.5)]),
    ] },
  { id: 'byline1v1', title: 'Defending wide', kind: 'defend', script: 'defendRun', for: ['FB', 'CB', 'DM'], opp: 'ATT',
    prompt: '{opp} has you one on one near the byline.',
    options: [
      opt('inside', 'Show him inside', 'Steer him towards your defenders.', 'balanced', { positioning: 0.35, anticipation: 0.25, pace: 0.2, agility: 0.2 }, RUNNER, 0.1, [CLEAR('You show him inside and the cross is blocked.'), CLEAR('You steer him wide and he runs out of space.'), SHOT('He gets past you and cuts it back for a shot.', 0.25), SHOT('He beats you and gets a shot away.', 0.35)]),
      opt('outside', 'Show him outside', 'Force him down the line.', 'safe', { positioning: 0.35, pace: 0.25, concentration: 0.2, anticipation: 0.2 }, { crossing: 0.4, dribbling: 0.3, technique: 0.3 }, 0.2, [CLEAR('You force him down the line and he has no angle.'), CLEAR('He runs out of space.'), SHOT('He crosses and it is attacked.', 0.18, 'header'), SHOT('His cross finds a free man.', 0.3, 'header')]),
      opt('tackle', 'Go to ground', 'Slide in and win it.', 'gamble', { tackling: 0.4, anticipation: 0.25, pace: 0.15, aggression: 0.2 }, { dribbling: 0.3, balance: 0.3, acceleration: 0.4 }, 0, [WIN('You slide in and win it cleanly.'), WIN('You get the ball and the danger is over.'), SHOT('He skips over your tackle and is in the box.', 0.35), FOUL('You take him down in the box. Penalty.', 0.5, 0.05, 0.76)]),
    ] },
  { id: 'longBallHeader', title: 'Long ball forward', kind: 'defend', script: 'defendCross', for: ['CB', 'FB', 'DM'], opp: 'ATT',
    prompt: 'A long ball comes forward and you challenge {opp} for the header.',
    options: [
      opt('win', 'Win the header', 'Go up and head it clear.', 'balanced', AERIAL, { heading: 0.3, jumping: 0.25, strength: 0.25, aggression: 0.2 }, 0, [CLEAR('You win the header and the danger is gone.', 0.2), CLEAR('You head it clear.'), SHOT('{opp} wins the header and goes through.', 0.28), SHOT('You miss it and he is clear.', 0.45)]),
      opt('drop', 'Drop and clean up', 'Let him win it, then deal with the second ball.', 'safe', { positioning: 0.35, anticipation: 0.3, concentration: 0.2, pace: 0.15 }, { technique: 0.4, composure: 0.3, firstTouch: 0.3 }, 0.3, [CLEAR('You pick up the second ball and clear.'), CLEAR('You clean up behind the header.'), SHOT('He wins it and lays it off for a shot.', 0.2), SHOT('He flicks it on and a runner is clear.', 0.35)]),
      opt('check', 'Body check him', 'Make sure he does not get a clean contact.', 'gamble', { strength: 0.3, aggression: 0.3, balance: 0.2, decisions: 0.2 }, { strength: 0.3, balance: 0.3, composure: 0.4 }, -0.1, [CLEAR('You get a body on him and the ball runs out.'), WIN('You win the ball cleanly.'), FOUL('You are penalised for a foul.', 0.15, 0, 0.05), FOUL('You are booked for a clumsy challenge.', 0.7, 0.05, 0.07)]),
    ] },
  { id: 'looseInBox', title: 'Loose ball in your box', kind: 'defend', script: 'loose', for: ['CB', 'FB', 'DM', 'CM'], opp: 'ATT',
    prompt: 'Your keeper saves, and the ball sits loose in your box with {opp} closing in.',
    options: [
      opt('clear', 'Clear it first time', 'Get it away.', 'balanced', { composure: 0.3, anticipation: 0.3, pace: 0.2, aggression: 0.2 }, { pace: 0.3, anticipation: 0.3, finishing: 0.4 }, 0.2, [CLEAR('You hack it clear.', 0.2), CLEAR('You clear it away from danger.'), SHOT('You are too late and {opp} gets a shot away.', 0.3), SHOT('Your clearance hits {opp} and falls kindly for him.', 0.45)]),
      opt('control', 'Take a touch', 'Control it and play out.', 'gamble', { firstTouch: 0.4, composure: 0.4, balance: 0.2 }, { pace: 0.3, anticipation: 0.3, tackling: 0.4 }, -0.2, [CLEAR('You take a touch and calmly play it out.', 0.25), CLEAR('You control it and clear.'), SHOT('The touch is heavy and {opp} pounces.', 0.45), SHOT('{opp} robs you in your own box.', 0.6)]),
      opt('smother', 'Throw yourself at it', 'Win it with your body.', 'balanced', { aggression: 0.35, anticipation: 0.3, strength: 0.15, pace: 0.2 }, { pace: 0.3, anticipation: 0.3, balance: 0.4 }, 0, [CLEAR('You get your body on it and it runs clear.', 0.2), CLEAR('You throw yourself at it and block the shot.'), SHOT('You are beaten to it.', 0.35), FOUL('You take him out. Penalty.', 0.5, 0.05, 0.76)]),
    ] },
  { id: 'goalLineClear', title: 'On the line', kind: 'defend', script: 'block', for: ['CB', 'FB', 'DM', 'CM'], opp: 'ATT', pressure: true,
    prompt: 'The ball loops towards the empty net and you are the only one near it.',
    options: [
      opt('head', 'Head it clear', 'Get under it.', 'balanced', { heading: 0.35, jumping: 0.3, positioning: 0.2, composure: 0.15 }, { finishing: 0.3, offTheBall: 0.3, anticipation: 0.4 }, 0, [CLEAR('You head it off the line.', 0.4), CLEAR('You nod it clear.', 0.2), SHOT('You get a touch but it still creeps in.', 0.7), SHOT('You misjudge it and it drops in.', 0.9)]),
      opt('kick', 'Hook it clear', 'Get a boot to it.', 'gamble', { balance: 0.3, technique: 0.25, anticipation: 0.25, agility: 0.2 }, { finishing: 0.3, offTheBall: 0.3, anticipation: 0.4 }, -0.2, [CLEAR('You hook it off the line.', 0.45), CLEAR('You scramble it clear.', 0.2), SHOT('You get a toe to it but it dribbles over.', 0.75), SHOT('You slice it into your own goal.', 0.95)]),
      opt('stay', 'Stand and hope', 'Do not risk putting it in your own net.', 'safe', { positioning: 0.5, concentration: 0.3, decisions: 0.2 }, { finishing: 0.3, offTheBall: 0.3, anticipation: 0.4 }, -0.5, [CLEAR('It drifts wide.'), CLEAR('The keeper gets back and claims it.'), SHOT('It drops in.', 0.8), SHOT('It drops in.', 0.9)]),
    ] },
  { id: 'offsideTrap', title: 'The offside trap', kind: 'defend', script: 'defendRun', for: ['CB', 'FB'], opp: 'ATT',
    prompt: 'Your line is about to step up to catch {opp} offside. You are the one who sets it.',
    options: [
      opt('step', 'Step up', 'Catch him offside.', 'gamble', { concentration: 0.35, anticipation: 0.3, decisions: 0.35 }, { offTheBall: 0.4, pace: 0.3, anticipation: 0.3 }, -0.1, [CLEAR('You step up together and {opp} is flagged offside.', 0.25), CLEAR('You catch him offside.'), SHOT('Your line is broken and {opp} is through.', 0.4), SHOT('You step up out of sync and he is clean through.', 0.55)]),
      opt('hold', 'Hold your line', 'Stay deep and compact.', 'safe', { positioning: 0.4, concentration: 0.3, anticipation: 0.3 }, { offTheBall: 0.4, pace: 0.3, anticipation: 0.3 }, 0.3, [CLEAR('You hold your line and he has no space.'), CLEAR('You stay compact and the move dies.'), SHOT('He finds space and shoots.', 0.2), SHOT('He gets in behind and shoots.', 0.35)]),
      opt('drop', 'Drop off', 'Give yourself time.', 'safe', { positioning: 0.4, pace: 0.3, concentration: 0.3 }, { composure: 0.4, longShots: 0.3, technique: 0.3 }, 0.4, [CLEAR('You drop off and he shoots from distance.', 0.1), CLEAR('You drop and cover the space.'), SHOT('He shoots from the edge of the box.', 0.1, 'long'), SHOT('You drop too deep and he has time.', 0.2)]),
    ] },
  { id: 'lateRunner', title: 'Late runner', kind: 'defend', script: 'defendCross', for: ['CM', 'DM', 'AM', 'W'], opp: 'ATT',
    prompt: '{opp} is making a late run into the box and nobody is picking him up.',
    options: [
      opt('track', 'Track him', 'Run with {opp}.', 'balanced', { workRate: 0.3, stamina: 0.2, anticipation: 0.25, pace: 0.25 }, { offTheBall: 0.4, pace: 0.3, acceleration: 0.3 }, 0, [CLEAR('You track him all the way and get a block in.', 0.2), CLEAR('You stay with {opp} and he cannot get a clean shot.'), SHOT('You arrive late and he gets a shot off.', 0.25), SHOT('He loses you and finishes from close range.', 0.45)]),
      opt('space', 'Cover the space', 'Protect the penalty spot.', 'safe', { positioning: 0.4, anticipation: 0.3, concentration: 0.3 }, { offTheBall: 0.4, anticipation: 0.3, composure: 0.3 }, 0.2, [CLEAR('You cover the space and the cross is wasted.'), CLEAR('You hold the zone and the ball runs through.'), SHOT('He finds the space and shoots.', 0.2), SHOT('He finds a gap and shoots from close range.', 0.35)]),
      opt('shout', 'Shout and drop', 'Organise the defence.', 'safe', { decisions: 0.4, concentration: 0.3, positioning: 0.3 }, { offTheBall: 0.5, anticipation: 0.5 }, 0.3, [CLEAR('Your shout gets a defender onto him.'), CLEAR('The defence reacts and covers.'), SHOT('Nobody picks him up and he shoots.', 0.3), SHOT('The communication breaks down and he is free.', 0.4)]),
    ] },
  { id: 'wallDuty', title: 'In the wall', kind: 'defend', script: 'freeKick', for: ['CM', 'DM', 'AM', 'W', 'ST', 'FB', 'CB'], opp: 'ATT', pressure: true,
    prompt: 'You are in the wall. {opp} stands over a free kick, 22 yards out.',
    options: [
      opt('jump', 'Jump', 'Go up as he strikes it.', 'balanced', { jumping: 0.4, anticipation: 0.3, balance: 0.15, concentration: 0.15 }, { technique: 0.4, longShots: 0.4, composure: 0.2 }, 0, [CLEAR('You jump and block it.', 0.2), CLEAR('The ball hits your head and goes wide.'), SHOT('He goes under the wall and the keeper has to save.', 0.15, 'long'), SHOT('He bends it over the wall.', 0.3, 'long')]),
      opt('stand', 'Stand firm', 'Hold your ground.', 'safe', { concentration: 0.4, positioning: 0.3, composure: 0.3 }, { technique: 0.4, longShots: 0.4, composure: 0.2 }, 0.2, [CLEAR('You stand firm and it hits the wall.'), CLEAR('The wall holds.'), SHOT('He curls it round the wall.', 0.18, 'long'), SHOT('He finds the top corner.', 0.3, 'long')]),
      opt('peel', 'Peel off and mark', 'Be ready for the second ball.', 'gamble', { anticipation: 0.4, marking: 0.3, pace: 0.15, decisions: 0.15 }, { technique: 0.4, composure: 0.3, longShots: 0.3 }, -0.1, [CLEAR('You peel off and clear the rebound.', 0.2), CLEAR('You peel off and pick up the second ball.'), SHOT('The wall opens a gap and he shoots through it.', 0.3, 'long'), SHOT('The gap in the wall is punished.', 0.45, 'long')]),
    ] },
  // ------------------------------------------------------------------ goalkeeper
  { id: 'keeperPenalty', title: 'Penalty', kind: 'defend', script: 'gk1v1', for: ['GK'], opp: 'ATT', pressure: true,
    prompt: 'A penalty to {opp}. It is you against him.',
    options: [
      opt('left', 'Dive to your left', 'Commit early.', 'gamble', { reflexes: 0.3, anticipation: 0.25, agility: 0.25, composure: 0.2 }, { composure: 0.4, finishing: 0.3, technique: 0.3 }, 0, [CLEAR('You guess right and save it.', 0.4), CLEAR('You dive the right way and keep it out.', 0.3), SHOT('You guess right but it is out of reach.', 0.76), SHOT('You dive the wrong way.', 0.76)]),
      opt('right', 'Dive to your right', 'Commit early.', 'gamble', { reflexes: 0.3, anticipation: 0.25, agility: 0.25, composure: 0.2 }, { composure: 0.4, finishing: 0.3, technique: 0.3 }, 0, [CLEAR('You guess right and save it.', 0.4), CLEAR('You dive the right way and keep it out.', 0.3), SHOT('You guess right but it is out of reach.', 0.76), SHOT('You dive the wrong way.', 0.76)]),
      opt('wait', 'Wait for him to commit', 'Stay up and read his run-up.', 'balanced', { anticipation: 0.4, reflexes: 0.3, composure: 0.3 }, { composure: 0.4, finishing: 0.3, technique: 0.3 }, 0.2, [CLEAR('You read it and save.', 0.4), CLEAR('You stay up and get a hand to it.', 0.3), SHOT('He places it beyond you.', 0.76), SHOT('He sends you the wrong way.', 0.76)]),
    ] },
  { id: 'gkCorner', title: 'Corner to your area', kind: 'defend', script: 'corner', for: ['GK'], opp: 'ATT',
    prompt: 'A corner is swung in and {opp} is waiting at the near post.',
    options: [
      opt('claim', 'Come for it', 'Claim it at the highest point.', 'gamble', { aerialReach: 0.3, commandOfArea: 0.3, handling: 0.25, jumping: 0.15 }, { heading: 0.4, jumping: 0.3, strength: 0.3 }, 0, [CLEAR('You come and claim the corner.', 0.25), CLEAR('You punch it clear under pressure.'), SHOT('You miss it and {opp} gets his head to it.', 0.4, 'header'), SHOT('You come and miss it completely.', 0.6, 'header')]),
      opt('punch', 'Punch it clear', 'Get a fist to it.', 'safe', { aerialReach: 0.35, strength: 0.3, commandOfArea: 0.2, jumping: 0.15 }, { heading: 0.4, jumping: 0.3, strength: 0.3 }, 0.2, [CLEAR('You punch it away.'), CLEAR('You punch it clear.'), SHOT('Your punch drops to an attacker.', 0.22), SHOT('You only get a glancing touch.', 0.35)]),
      opt('line', 'Stay on your line', 'Trust the defence.', 'safe', { positioning: 0.4, reflexes: 0.3, concentration: 0.3 }, { heading: 0.4, offTheBall: 0.3, jumping: 0.3 }, 0, [CLEAR('The defence clears it.'), CLEAR('The header is straight at you.'), SHOT('The header is on target.', 0.22, 'header'), SHOT('The header is well placed.', 0.4, 'header')]),
    ] },
  { id: 'gkFreeKick', title: 'Free kick to beat', kind: 'defend', script: 'freeKick', for: ['GK'], opp: 'ATT', pressure: true,
    prompt: 'A free kick, 25 yards out and central. {opp} is over the ball.',
    options: [
      opt('wall', 'Set the wall and stay central', 'Cover the middle and trust the wall.', 'balanced', { positioning: 0.4, reflexes: 0.3, concentration: 0.3 }, { technique: 0.4, longShots: 0.4, composure: 0.2 }, 0.1, [CLEAR('You set the wall perfectly and it hits it.', 0.25), CLEAR('You hold your ground and save.'), SHOT('He bends it round the wall.', 0.2, 'long'), SHOT('He finds the corner.', 0.35, 'long')]),
      opt('near', 'Cover the near post', 'Narrow the angle on the near side.', 'safe', { positioning: 0.35, reflexes: 0.35, anticipation: 0.3 }, { technique: 0.4, longShots: 0.4, composure: 0.2 }, 0, [CLEAR('You are in the right place and save.'), CLEAR('You push it away from the near post.'), SHOT('He goes to the far post.', 0.22, 'long'), SHOT('He leaves you stranded.', 0.38, 'long')]),
      opt('read', 'Read it late', 'Stay alert and react.', 'gamble', { reflexes: 0.4, anticipation: 0.3, agility: 0.3 }, { technique: 0.4, longShots: 0.4, composure: 0.2 }, -0.1, [CLEAR('You react quickly and tip it round the post.', 0.4), CLEAR('You get across and save.', 0.2), SHOT('You are caught moving the wrong way.', 0.4, 'long'), SHOT('You wrong-foot yourself.', 0.5, 'long')]),
    ] },
  { id: 'gkRebound', title: 'Loose ball', kind: 'defend', script: 'loose', for: ['GK'], opp: 'ATT',
    prompt: 'You parry the shot and the ball is loose in the six-yard box. {opp} is first to react.',
    options: [
      opt('smother', 'Smother it', 'Dive on it.', 'balanced', { handling: 0.35, oneOnOnes: 0.25, aggression: 0.2, agility: 0.2 }, { pace: 0.3, anticipation: 0.3, finishing: 0.4 }, 0.1, [CLEAR('You dive on it and smother it.', 0.25), CLEAR('You gather it at the second attempt.'), SHOT('{opp} gets there first and shoots.', 0.5), FOUL('You bring him down. Penalty.', 0.5, 0.05, 0.76)]),
      opt('push', 'Push it wide', 'Get it away from danger.', 'safe', { reflexes: 0.35, agility: 0.3, commandOfArea: 0.2, handling: 0.15 }, { pace: 0.3, anticipation: 0.3, finishing: 0.4 }, 0.2, [CLEAR('You push it out of danger.'), CLEAR('You push it round the post.'), SHOT('Your push falls to an attacker.', 0.35), SHOT('You only get a hand to it and he follows up.', 0.5)]),
      opt('scramble', 'Scramble back', 'Get back up and recover.', 'gamble', { agility: 0.4, reflexes: 0.3, anticipation: 0.3 }, { pace: 0.3, anticipation: 0.3, finishing: 0.4 }, -0.2, [CLEAR('You scramble up and save a second time.', 0.4), CLEAR('You get across and block it.', 0.2), SHOT('You are still on the floor and he finishes.', 0.6), SHOT('You are stranded and he has an open goal.', 0.8)]),
    ] },
  // ------------------------------------------------------------------ anywhere
  { id: 'captainRequest', title: 'The captain', kind: 'any', script: 'any', for: ['ST', 'AM', 'W', 'CM', 'DM', 'FB', 'CB'], opp: 'none',
    prompt: 'Your captain shouts at you to drop deeper and help out.',
    options: [
      opt('help', 'Do as he asks', 'Put the team first.', 'safe', { workRate: 0.4, decisions: 0.3, concentration: 0.3 }, 'team', 8, [O('nothing', 'You drop in and the captain nods.', { rate: 0.12, conf: 2 }), O('nothing', 'You drop deeper and help the team.', { rate: 0.06, conf: 1 }), O('nothing', 'You drop in, but it costs you your energy.', { rate: 0, conf: 0 }), O('nothing', 'You drop in and the team loses its shape.', { rate: -0.1, conf: -1 })]),
      opt('stay', 'Stay where you are', 'Trust your own instincts.', 'gamble', { decisions: 0.4, composure: 0.3, concentration: 0.3 }, 'team', 4, [O('nothing', 'You stay high and the manager approves.', { rate: 0.1, conf: 2 }), O('nothing', 'You stay where you are and nothing comes of it.'), O('nothing', 'The captain glares at you.', { rate: -0.05, conf: -2 }), O('nothing', 'The captain shouts again and you lose focus.', { rate: -0.1, conf: -3 })]),
    ] },
  { id: 'crowdOnYourBack', title: 'The crowd', kind: 'any', script: 'any', for: ['ST', 'AM', 'W', 'CM', 'DM', 'FB', 'CB', 'GK'], opp: 'none', pressure: true,
    prompt: 'You misplace a pass and the home crowd groans.',
    options: [
      opt('ignore', 'Ignore it', 'Shake it off.', 'safe', { composure: 0.5, concentration: 0.3, decisions: 0.2 }, 'team', 8, [O('nothing', 'You shake it off and carry on.', { conf: 2 }), O('nothing', 'You let it go.'), O('nothing', 'It plays on your mind.', { conf: -2 }), O('nothing', 'You cannot stop thinking about it.', { conf: -4, rate: -0.05 })]),
      opt('demand', 'Demand the ball', 'Show them what you can do.', 'gamble', { composure: 0.4, decisions: 0.3, dribbling: 0.15, passing: 0.15 }, 'team', 4, [O('nothing', 'You ask for the ball and make something happen.', { conf: 4, rate: 0.1 }), O('nothing', 'You demand it and play well.', { conf: 2 }), O('nothing', 'You try too hard.', { conf: -2, rate: -0.05 }), O('nothing', 'You force it and give it away.', { conf: -4, rate: -0.1 })]),
    ] },
];

