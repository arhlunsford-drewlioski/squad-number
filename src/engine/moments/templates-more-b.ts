import { AERIAL, CHASE, CLEAR, FOUL, HURT, MARK, NOTHING, opt, RUNNER, SHOOTER, SHOT, WIN } from './kit';
import type { TemplateDef } from './types';

/** Defending, goalkeeping and anywhere moments, part three of the library. */
export const MORE_B: TemplateDef[] = [
  // ------------------------------------------------------------------ defend
  { id: 'oneTwoDefend', title: 'One-two around you', kind: 'defend', script: 'defendRun', for: ['CB', 'FB', 'DM', 'CM'], opp: 'ATT',
    prompt: '{opp} plays a one-two and is running beyond you.',
    options: [
      opt('stay', 'Stay with the run', 'Track {opp} all the way.', 'balanced', { pace: 0.3, anticipation: 0.3, workRate: 0.2, positioning: 0.2 }, CHASE, 0, [CLEAR('You stay with him and the return is cut out.', 0.2), CLEAR('You get a foot in and it goes behind.'), SHOT('He gets on the end of the return and shoots.', 0.3), SHOT('He is clean through.', 0.45)]),
      opt('hold', 'Hold your position', 'Do not be dragged out.', 'safe', { positioning: 0.4, concentration: 0.3, anticipation: 0.3 }, CHASE, 0.3, [CLEAR('You hold your ground and the move dies.'), CLEAR('The return is blocked.'), SHOT('The return finds a gap.', 0.2), SHOT('The return finds him in space.', 0.35)]),
      opt('lunge', 'Lunge at the return', 'Try to win it.', 'gamble', { tackling: 0.35, anticipation: 0.3, aggression: 0.2, pace: 0.15 }, CHASE, -0.2, [WIN('You step in and win it.'), WIN('You nick it away.'), SHOT('You miss it and he is through.', 0.4), FOUL('You catch him. Foul.', 0.4, 0.04, 0.07)]),
    ] },
  { id: 'counterPress', title: 'Lost it high up', kind: 'defend', script: 'defendRun', for: ['CM', 'DM', 'W', 'AM', 'ST', 'FB'], opp: 'ATT',
    prompt: 'Your team has lost the ball and {opp} is about to run at the open space.',
    options: [
      opt('press', 'Counter-press', 'Win it back immediately.', 'gamble', { workRate: 0.3, aggression: 0.25, tackling: 0.25, pace: 0.2 }, { composure: 0.4, firstTouch: 0.3, dribbling: 0.3 }, 0, [WIN('You win it back at once.'), WIN('You close him down and win it.'), SHOT('He plays out of your press and they break.', 0.25), FOUL('You foul him to stop the break.', 0.6, 0.02, 0.05)]),
      opt('drop', 'Drop and block the lane', 'Get back into shape.', 'safe', { positioning: 0.35, workRate: 0.3, anticipation: 0.35 }, { composure: 0.35, passing: 0.35, vision: 0.3 }, 0.4, [CLEAR('You get back into shape and the break stalls.'), CLEAR('You block the lane.'), SHOT('They play through the gap.', 0.18), SHOT('They find the space in behind.', 0.3)]),
      opt('foul', 'Stop it with a foul', 'A tactical foul.', 'gamble', { aggression: 0.35, decisions: 0.35, composure: 0.3 }, 'team', 0, [FOUL('You stop the break. Yellow card.', 0.7, 0.01, 0.03), FOUL('You haul him down and take the booking.', 0.9, 0.02, 0.04), FOUL('You foul him in a dangerous spot.', 0.9, 0.1, 0.1), FOUL('You foul him and are sent off.', 0.5, 0.5, 0.1)]),
    ] },
  { id: 'wideFreeKickDefend', title: 'Free kick swung in', kind: 'defend', script: 'defendCross', for: ['CB', 'FB', 'DM', 'CM'], opp: 'ATT', pressure: true,
    prompt: 'A free kick from wide is swung in and {opp} is attacking it.',
    options: [
      opt('attack', 'Attack the ball', 'Win the header.', 'balanced', AERIAL, { heading: 0.35, jumping: 0.3, strength: 0.2, offTheBall: 0.15 }, 0, [CLEAR('You win the header and clear.', 0.2), CLEAR('You get your head to it.'), SHOT('{opp} gets there first.', 0.28, 'header'), SHOT('You miss it and {opp} has a free header.', 0.45, 'header')]),
      opt('mark', 'Mark {opp} tight', 'Deny him space.', 'safe', MARK, { offTheBall: 0.4, strength: 0.3, heading: 0.3 }, 0.3, [CLEAR('You stay tight and the header is weak.'), CLEAR('You body him and it runs through.'), SHOT('He gets a header away.', 0.16, 'header'), SHOT('He loses you and heads at goal.', 0.32, 'header')]),
      opt('zone', 'Hold your zone', 'Protect the six-yard box.', 'safe', { positioning: 0.4, anticipation: 0.3, concentration: 0.3 }, { offTheBall: 0.4, anticipation: 0.3, composure: 0.3 }, 0.2, [CLEAR('You clear it from your zone.'), CLEAR('The ball runs through your zone.'), SHOT('It drops into a gap.', 0.2), SHOT('It drops to a free man.', 0.35)]),
    ] },
  { id: 'farPostDefend', title: 'Far post danger', kind: 'defend', script: 'defendCross', for: ['CB', 'FB', 'DM'], opp: 'ATT',
    prompt: 'The ball is swung to the far post and you are late getting across to {opp}.',
    options: [
      opt('recover', 'Recover and challenge', 'Sprint across.', 'balanced', { pace: 0.3, anticipation: 0.3, jumping: 0.2, strength: 0.2 }, { heading: 0.3, jumping: 0.3, offTheBall: 0.4 }, -0.1, [CLEAR('You get across and clear.', 0.2), CLEAR('You get a head to it.'), SHOT('You are a step late and he heads at goal.', 0.3, 'header'), SHOT('You never get there and he heads in.', 0.5, 'header')]),
      opt('body', 'Body him off it', 'Make it difficult.', 'balanced', { strength: 0.35, balance: 0.25, anticipation: 0.2, aggression: 0.2 }, { strength: 0.3, balance: 0.3, composure: 0.4 }, 0, [CLEAR('You put him off and it drifts wide.'), CLEAR('You put him off and the keeper claims it.'), SHOT('He rides the challenge and shoots.', 0.25), FOUL('You push him in the back. Penalty.', 0.5, 0.05, 0.76)]),
      opt('drop', 'Cover the goal line', 'Protect the net.', 'safe', { positioning: 0.4, concentration: 0.3, reflexes: 0.3 }, { heading: 0.4, composure: 0.3, offTheBall: 0.3 }, 0.1, [CLEAR('You cover the line and the header is wide.'), CLEAR('You are in the right place.'), SHOT('The header is on target.', 0.25, 'header'), SHOT('The header is too strong.', 0.4, 'header')]),
    ] },
  { id: 'slidingTackle', title: 'Slide or stay up', kind: 'defend', script: 'defendRun', for: ['CB', 'FB', 'DM', 'CM'], opp: 'ATT',
    prompt: '{opp} is about to get away from you. You could slide in.',
    options: [
      opt('slide', 'Slide in', 'Go to ground.', 'gamble', { tackling: 0.4, anticipation: 0.25, balance: 0.15, aggression: 0.2 }, RUNNER, 0, [WIN('You slide in and win it cleanly.'), WIN('You get the ball and the danger goes.'), SHOT('He skips over it and is away.', 0.4), FOUL('You take him down. Foul.', 0.5, 0.06, 0.08)]),
      opt('stay', 'Stay on your feet', 'Do not commit.', 'safe', { positioning: 0.35, anticipation: 0.3, pace: 0.2, agility: 0.15 }, RUNNER, 0.3, [CLEAR('You stay up and he runs out of room.'), CLEAR('You keep your feet and shepherd him wide.'), SHOT('He goes past you.', 0.22), SHOT('He beats you and shoots.', 0.35)]),
    ] },
  { id: 'tacticalFoul', title: 'Break the move up', kind: 'defend', script: 'defendRun', for: ['CM', 'DM', 'AM', 'W'], opp: 'ATT',
    prompt: 'They are countering at speed and {opp} is about to find a pass.',
    options: [
      opt('foul', 'Take the yellow', 'Foul him and break it up.', 'gamble', { aggression: 0.35, decisions: 0.35, composure: 0.3 }, 'team', 0, [FOUL('You stop the move. A booking, but it was worth it.', 0.8, 0.01, 0.02), FOUL('You foul him and take the card.', 0.9, 0.02, 0.03), FOUL('You foul him late. Yellow.', 0.9, 0.08, 0.06), FOUL('You foul him badly and are sent off.', 0.5, 0.5, 0.06)]),
      opt('screen', 'Screen the pass', 'Get in the way.', 'balanced', { positioning: 0.35, anticipation: 0.35, workRate: 0.3 }, { passing: 0.35, vision: 0.35, composure: 0.3 }, 0.1, [CLEAR('You block the pass and the move dies.', 0.2), CLEAR('You screen it and they recycle.'), SHOT('He finds the pass and they have a shot.', 0.2), SHOT('He splits you and a chance follows.', 0.3)]),
    ] },
  { id: 'clearancePressure', title: 'Under pressure at the back', kind: 'defend', script: 'block', for: ['CB', 'FB', 'DM'], opp: 'ATT',
    prompt: 'A cross is knocked down in your box and {opp} is closing in.',
    options: [
      opt('hack', 'Hack it clear', 'Do not worry about style.', 'safe', { composure: 0.3, anticipation: 0.3, pace: 0.2, aggression: 0.2 }, { pace: 0.3, anticipation: 0.3, finishing: 0.4 }, 0.4, [CLEAR('You hack it into the stands.'), CLEAR('You clear it to safety.'), SHOT('Your clearance falls to {opp}.', 0.3), SHOT('You scuff it straight to {opp}.', 0.45)]),
      opt('control', 'Control it', 'Take a touch and play.', 'gamble', { firstTouch: 0.4, composure: 0.4, balance: 0.2 }, { pace: 0.3, anticipation: 0.3, tackling: 0.4 }, -0.3, [CLEAR('You calmly play out of trouble.', 0.25), CLEAR('You control it and clear.'), SHOT('You take too long and {opp} pounces.', 0.45), SHOT('You lose it in your own box.', 0.6)]),
    ] },
  { id: 'twoAttackers', title: 'Two against you', kind: 'defend', script: 'defendRun', for: ['CB', 'FB', 'DM'], opp: 'ATT',
    prompt: 'Two attackers are running at you. {opp} has the ball.',
    options: [
      opt('delay', 'Delay and hold', 'Buy time for the others to get back.', 'safe', { positioning: 0.35, anticipation: 0.3, concentration: 0.35 }, { passing: 0.35, vision: 0.35, composure: 0.3 }, 0.3, [CLEAR('You delay them and help arrives.'), CLEAR('You hold them up and the move slows.'), SHOT('They play through you.', 0.25), SHOT('They split you with a pass.', 0.4)]),
      opt('man', 'Pick the dangerous one', 'Commit to {opp}.', 'gamble', { tackling: 0.3, anticipation: 0.3, aggression: 0.2, pace: 0.2 }, { dribbling: 0.3, passing: 0.3, composure: 0.4 }, -0.1, [WIN('You step in and win it.'), CLEAR('You commit to {opp} and the pass is wasted.'), SHOT('He plays the other man in.', 0.4), FOUL('You catch {opp}. Foul.', 0.4, 0.04, 0.08)]),
    ] },
  { id: 'throwInDanger', title: 'Dangerous throw-in', kind: 'defend', script: 'defendCross', for: ['FB', 'CB', 'DM', 'CM'], opp: 'ATT',
    prompt: 'A long throw is coming into your box. {opp} is waiting for it.',
    options: [
      opt('attack', 'Go and win it', 'Attack the ball.', 'balanced', AERIAL, { heading: 0.3, jumping: 0.3, strength: 0.25, offTheBall: 0.15 }, 0, [CLEAR('You win it and clear.', 0.15), CLEAR('You get a head to it.'), SHOT('It is flicked on and he shoots.', 0.22), SHOT('You miss it and he has a free shot.', 0.4)]),
      opt('mark', 'Pick up {opp}', 'Man to man.', 'safe', MARK, { offTheBall: 0.4, strength: 0.3, heading: 0.3 }, 0.3, [CLEAR('You stay tight and the throw is cleared.'), CLEAR('You body him and it runs through.'), SHOT('He gets a flick away.', 0.16), SHOT('He loses you and gets a shot.', 0.3)]),
    ] },
  { id: 'emptyGoal', title: 'The keeper is out', kind: 'defend', script: 'block', for: ['CB', 'FB', 'DM', 'CM'], opp: 'ATT', pressure: true,
    prompt: 'Your keeper is beaten and the shot is rolling towards an empty net. You are the last player there.',
    options: [
      opt('clear', 'Hook it off the line', 'Get there.', 'balanced', { pace: 0.3, anticipation: 0.3, agility: 0.2, composure: 0.2 }, { finishing: 0.5, composure: 0.5 }, 0, [CLEAR('You get there and hook it clear.', 0.5), CLEAR('You scramble it clear.', 0.3), SHOT('You get a toe to it but it still goes in.', 0.8), SHOT('You are too late.', 0.9)]),
      opt('stand', 'Stand in the way', 'Block it with your body.', 'gamble', { aggression: 0.35, positioning: 0.3, composure: 0.35 }, { finishing: 0.5, composure: 0.5 }, -0.2, [CLEAR('You throw your body in the way and block it.', 0.55), CLEAR('You block it and the danger goes.', 0.3), SHOT('It squirms past you.', 0.8), SHOT('It goes in off you.', 0.9)]),
    ] },
  { id: 'shortCornerDefend', title: 'Short corner', kind: 'defend', script: 'corner', for: ['CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST'], opp: 'ATT',
    prompt: 'They take the corner short and {opp} has space to cross.',
    options: [
      opt('step', 'Step out', 'Close {opp} down.', 'balanced', { pace: 0.3, workRate: 0.3, anticipation: 0.4 }, { crossing: 0.4, technique: 0.3, composure: 0.3 }, 0.1, [CLEAR('You close him down and the cross is blocked.', 0.2), CLEAR('You step out and he must go back.'), SHOT('He crosses over you and it is attacked.', 0.22, 'header'), SHOT('He gets the cross in and a free header follows.', 0.35, 'header')]),
      opt('hold', 'Stay in your zone', 'Trust the shape.', 'safe', { positioning: 0.4, concentration: 0.3, anticipation: 0.3 }, { crossing: 0.4, technique: 0.3, composure: 0.3 }, 0.3, [CLEAR('You hold your zone and clear the cross.'), CLEAR('The cross runs through.'), SHOT('The cross is met with a header.', 0.2, 'header'), SHOT('The cross finds a free man.', 0.32, 'header')]),
    ] },
  { id: 'headerOnEdge', title: 'High ball on the edge', kind: 'defend', script: 'defendCross', for: ['CB', 'DM'], opp: 'ATT',
    prompt: 'A high ball drops on the edge of your box and {opp} is rising with you.',
    options: [
      opt('header', 'Win the header', 'Get your head to it.', 'balanced', AERIAL, { heading: 0.35, jumping: 0.3, strength: 0.2, offTheBall: 0.15 }, 0, [CLEAR('You win it and head it clear.', 0.2), CLEAR('You head it back to your keeper.'), SHOT('He wins it and lays it off for a shot.', 0.25), SHOT('He wins it and runs through.', 0.4)]),
      opt('drop', 'Let it bounce', 'Control it after the bounce.', 'safe', { firstTouch: 0.3, anticipation: 0.3, composure: 0.4 }, { strength: 0.35, pace: 0.3, anticipation: 0.35 }, 0.2, [CLEAR('You let it bounce and clear.'), CLEAR('You deal with it calmly.'), SHOT('He gets in ahead of you.', 0.25), SHOT('He steals it and shoots.', 0.35)]),
    ] },
  { id: 'lastMinuteDefend', title: 'Holding on', kind: 'defend', script: 'defendCross', for: ['CB', 'FB', 'DM', 'CM'], opp: 'ATT', pressure: true,
    when: c => c.lead > 0 && c.minute >= 85,
    prompt: 'It is the {minute}th minute and you are ahead. {opp} is bringing it forward for one last attack.',
    options: [
      opt('clear', 'Clear it any way you can', 'Do not take any risks.', 'safe', { composure: 0.3, anticipation: 0.3, heading: 0.2, aggression: 0.2 }, { composure: 0.4, technique: 0.3, finishing: 0.3 }, 0.5, [CLEAR('You clear it and the danger passes.', 0.2), CLEAR('You hack it into touch.'), SHOT('Your clearance falls to {opp}.', 0.25), SHOT('Your clearance is poor and {opp} shoots.', 0.4)]),
      opt('hold', 'Hold your shape', 'Trust the line.', 'safe', { positioning: 0.35, concentration: 0.35, decisions: 0.3 }, { composure: 0.4, technique: 0.3, finishing: 0.3 }, 0.2, [CLEAR('You hold your shape and they cannot break you down.'), CLEAR('The attack fizzles out.'), SHOT('They find a gap and shoot.', 0.2), SHOT('They find a gap and a chance falls to {opp}.', 0.35)]),
      opt('foul', 'Take a foul', 'Break up the play.', 'gamble', { aggression: 0.35, decisions: 0.35, composure: 0.3 }, 'team', 0, [FOUL('You take a foul and the clock keeps ticking.', 0.7, 0.01, 0.04), FOUL('You foul him and take a booking.', 0.9, 0.02, 0.06), FOUL('You foul him in a dangerous spot.', 0.9, 0.1, 0.12), FOUL('You foul him and are sent off.', 0.4, 0.55, 0.12)]),
    ] },
  // ------------------------------------------------------------------ goalkeeper
  { id: 'gkLongShot', title: 'Shot from distance', kind: 'defend', script: 'block', for: ['GK'], opp: 'ATT',
    prompt: '{opp} lets fly from 25 yards.',
    options: [
      opt('hold', 'Get behind it', 'Make a clean save.', 'balanced', { handling: 0.35, reflexes: 0.3, positioning: 0.2, concentration: 0.15 }, { longShots: 0.4, technique: 0.35, composure: 0.25 }, 0.2, [CLEAR('You get behind it and hold it.', 0.3), CLEAR('You hold it at the second attempt.'), SHOT('You spill it and he follows up.', 0.3), SHOT('It beats your hand.', 0.5, 'long')]),
      opt('parry', 'Push it round the post', 'Play safe.', 'safe', { reflexes: 0.4, agility: 0.3, positioning: 0.3 }, { longShots: 0.4, technique: 0.35, composure: 0.25 }, 0.3, [CLEAR('You push it round the post.'), CLEAR('You tip it over the bar.'), SHOT('You parry it into danger.', 0.22), SHOT('It gets past you.', 0.45, 'long')]),
      opt('dive', 'Dive full stretch', 'Go for the corner.', 'gamble', { reflexes: 0.4, agility: 0.35, anticipation: 0.25 }, { longShots: 0.4, technique: 0.35, composure: 0.25 }, -0.1, [CLEAR('You fling yourself across and tip it away.', 0.45), CLEAR('You get a hand to it.', 0.25), SHOT('It is out of your reach.', 0.55, 'long'), SHOT('You are caught the wrong way.', 0.6, 'long')]),
    ] },
  { id: 'gkNearPost', title: 'Shot at the near post', kind: 'defend', script: 'gk1v1', for: ['GK'], opp: 'ATT',
    prompt: '{opp} is racing down the wing and looks to shoot at the near post.',
    options: [
      opt('post', 'Cover the near post', 'Take away the angle.', 'safe', { positioning: 0.4, reflexes: 0.3, concentration: 0.3 }, SHOOTER, 0.3, [CLEAR('You cover the near post and make the save.', 0.2), CLEAR('You save at the near post.'), SHOT('He gets it past you at the near post.', 0.4), SHOT('He beats you at the near post.', 0.55)]),
      opt('come', 'Come off your line', 'Narrow the angle.', 'balanced', { oneOnOnes: 0.35, commandOfArea: 0.3, positioning: 0.2, agility: 0.15 }, SHOOTER, 0, [CLEAR('You come out and block it.', 0.25), CLEAR('You narrow the angle and he hits you.'), SHOT('He finds the far post.', 0.35), SHOT('He slots it past you.', 0.5)]),
    ] },
  { id: 'gkChip', title: 'He might chip you', kind: 'defend', script: 'gk1v1', for: ['GK'], opp: 'ATT',
    prompt: '{opp} is through and you are some way off your line. A chip is a possibility.',
    options: [
      opt('back', 'Backpedal', 'Get back and cover the chip.', 'balanced', { agility: 0.35, reflexes: 0.3, anticipation: 0.35 }, { technique: 0.4, composure: 0.35, finishing: 0.25 }, 0, [CLEAR('You backpedal and tip it over.', 0.35), CLEAR('You get back and catch it.'), SHOT('He chips you.', 0.55), SHOT('He chips you easily.', 0.7)]),
      opt('close', 'Close him down', 'Get big and force him to shoot.', 'gamble', { oneOnOnes: 0.4, aggression: 0.2, handling: 0.2, agility: 0.2 }, { composure: 0.4, finishing: 0.3, technique: 0.3 }, -0.1, [CLEAR('You close him down and save at his feet.', 0.4), CLEAR('You block it.'), SHOT('He goes round you.', 0.6), FOUL('You bring him down. Penalty.', 0.5, 0.45, 0.76)]),
    ] },
  { id: 'gkHighLine', title: 'Your line is high', kind: 'defend', script: 'gkThrough', for: ['GK'], opp: 'ATT',
    prompt: 'The defence is high and a ball is played over the top. {opp} is running onto it.',
    options: [
      opt('sweep', 'Sweep it up', 'Come out to the edge and clear.', 'balanced', { commandOfArea: 0.35, anticipation: 0.3, kicking: 0.2, agility: 0.15 }, { pace: 0.35, acceleration: 0.25, composure: 0.4 }, 0.1, [CLEAR('You sweep up and clear it.', 0.3), CLEAR('You win the race and clear.'), SHOT('You are beaten to it.', 0.35), SHOT('You are beaten to it and the net is open.', 0.55)]),
      opt('back', 'Get back to your line', 'Do not gamble.', 'safe', { positioning: 0.4, reflexes: 0.3, concentration: 0.3 }, { pace: 0.3, composure: 0.4, finishing: 0.3 }, 0.1, [CLEAR('You get back and save.', 0.2), CLEAR('You stay on your line and he shoots at you.'), SHOT('He lobs it over you.', 0.5), SHOT('He finds a gap.', 0.4)]),
    ] },
  // ------------------------------------------------------------------ anywhere
  { id: 'injuryKnock', title: 'A knock', kind: 'any', script: 'any', for: ['ST', 'AM', 'W', 'CM', 'DM', 'FB', 'CB', 'GK'], opp: 'none',
    prompt: 'You pick up a knock. It is sore, but you could carry on.',
    options: [
      opt('on', 'Play on', 'Run it off.', 'gamble', { concentration: 0.35, composure: 0.35, decisions: 0.3 }, 'team', 4, [NOTHING('You run it off and carry on.', 2, 0.05), NOTHING('You play through it.'), HURT('You play on, but it gets worse.', 1), HURT('You play on and it is worse than you thought.', 3)]),
      opt('easy', 'Ease off', 'Protect yourself.', 'safe', { decisions: 0.4, concentration: 0.3, composure: 0.3 }, 'team', 8, [NOTHING('You ease off and it settles.'), NOTHING('You take it easy for a few minutes.'), NOTHING('You are a little less effective for a while.', -1, -0.1), NOTHING('You carry the knock and it limits you.', -2, -0.15)]),
    ] },
  { id: 'managerSignal', title: 'The manager', kind: 'any', script: 'any', for: ['ST', 'AM', 'W', 'CM', 'DM', 'FB', 'CB'], opp: 'none',
    prompt: 'The manager is waving at you from the touchline, telling you to push higher.',
    options: [
      opt('obey', 'Do as he says', 'Follow the instruction.', 'safe', { decisions: 0.4, workRate: 0.3, concentration: 0.3 }, 'team', 8, [NOTHING('You push up and the manager is pleased.', 2, 0.1), NOTHING('You follow the instruction.', 1, 0.05), NOTHING('You push up, but it leaves you exposed.', 0, -0.05), NOTHING('You push up and leave a gap.', -1, -0.1)]),
      opt('own', 'Trust your own read', 'Stay where you think you are needed.', 'gamble', { decisions: 0.4, anticipation: 0.3, positioning: 0.3 }, 'team', 4, [NOTHING('Your read is right and the manager notices.', 3, 0.12), NOTHING('You stay where you are.'), NOTHING('The manager shakes his head.', -2, -0.05), NOTHING('The manager is furious.', -3, -0.1)]),
    ] },
  { id: 'teammateRow', title: 'Who takes it?', kind: 'any', script: 'any', for: ['ST', 'AM', 'W', 'CM', 'DM', 'FB'], opp: 'none', pressure: true,
    prompt: 'A teammate wants the next set piece, but you fancy it.',
    options: [
      opt('assert', 'Take it yourself', 'Back yourself.', 'gamble', { composure: 0.4, decisions: 0.3, technique: 0.3 }, 'team', 4, [NOTHING('You take charge and the team backs you.', 3, 0.1), NOTHING('You win the argument.', 1), NOTHING('Your teammate is not happy.', -2, -0.05), NOTHING('You upset a teammate and lose focus.', -3, -0.1)]),
      opt('defer', 'Let him have it', 'Keep the peace.', 'safe', { composure: 0.4, decisions: 0.3, concentration: 0.3 }, 'team', 8, [NOTHING('You let him have it and the mood lifts.', 2, 0.05), NOTHING('You keep the peace.', 1), NOTHING('You let it go but it nags at you.', -1), NOTHING('You let it go and feel overlooked.', -2)]),
    ] },
];

