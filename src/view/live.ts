import type { Lineup, MatchResult } from '../engine/match/types';
import type { LineKind } from '../engine/match/report';
import type { Replay, ReplayTeam } from '../engine/match/replay';
import { matchSession, type SessionYield, type SimCtx } from '../engine/match/sim';
import type { MomentOutcome, MomentRequest } from '../engine/moments/types';
import type { Rng } from '../engine/rng';
import { FULL_OPTS, HIGHLIGHT_OPTS, TimelineBuilder, type Timeline } from './timeline';

export interface LiveLine { min: number; text: string; kind: LineKind }

export interface LiveArgs {
  H: Lineup;
  A: Lineup;
  rng: Rng;
  ctx: SimCtx;
  teams: { h: ReplayTeam; a: ReplayTeam };
  mode: 'full' | 'highlights';
}

/**
 * A match being played with the human in the loop. It runs the engine session until a decision is needed,
 * grows the 2D timeline as it goes, and carries on when a choice comes back.
 */
export class LiveMatch {
  status: 'running' | 'decision' | 'finished' = 'running';
  request: MomentRequest | null = null;
  result: MatchResult | null = null;
  lines: LiveLine[] = [];
  outcomes: MomentOutcome[] = [];
  /** Changes whenever something the UI shows changes. */
  version = 0;
  tl!: Timeline;
  replay!: Replay;
  private session;
  private builder!: TimelineBuilder;
  private stepIdx = 0;
  private evIdx = new Set<unknown>();
  private goals = { h: 0, a: 0 };

  constructor(private args: LiveArgs) {
    this.session = matchSession(args.H, args.A, args.rng, args.ctx);
    this.pump(undefined);
  }

  private nameOf(id: string | undefined) { return this.replay.players.find(p => p.id === id)?.name ?? 'Unknown'; }
  private you(id: string | undefined) { return this.replay.players.find(p => p.id === id)?.human; }

  /** Commentary for what the builder has just laid out, up to a minute. */
  private collect(upTo: number, final: boolean) {
    const steps = this.replay.steps;
    const inRange = (m: number) => (final ? m <= upTo : m < upTo);
    while (this.stepIdx < steps.length && inRange(steps[this.stepIdx].min)) {
      const s = steps[this.stepIdx++];
      if (s.moment) continue;
      if (s.kind === 'goal' || s.kind === 'pen-goal') {
        this.goals[s.att]++;
        const club = (s.att === 'h' ? this.replay.h : this.replay.a).name;
        const who = this.you(s.shooter) ? 'You score' : `${this.nameOf(s.shooter)} scores`;
        const from = s.creator ? `, from ${this.you(s.creator) ? 'your' : this.nameOf(s.creator) + "'s"} pass` : '';
        const mine = this.args.ctx.humanId && this.replay.players.find(p => p.id === this.args.ctx.humanId)?.side === s.att;
        this.lines.push({ min: s.min, text: `GOAL, ${club} (${this.goals.h}-${this.goals.a}). ${who}${s.kind === 'pen-goal' ? ' from the spot' : ''}${from}.`, kind: mine ? 'goal-us' : 'goal-them' });
      }
    }
    for (const e of this.replay.events) {
      if ((e.type === 'yellow' || e.type === 'red') && !this.evIdx.has(e) && inRange(e.min)) {
        this.evIdx.add(e);
        this.lines.push({ min: e.min, text: `${e.type === 'red' ? 'Red card' : 'Yellow card'} for ${this.you(e.p) ? 'You' : this.nameOf(e.p)}.`, kind: this.you(e.p) ? 'you' : 'card' });
      }
    }
  }

  private count(out: MomentOutcome) {
    for (const s of out.steps) if (s.kind === 'goal' || s.kind === 'pen-goal') this.goals[s.att]++;
  }

  private pump(send: string | undefined): void {
    let next = send;
    for (;;) {
      const r = this.session.next(next);
      next = undefined;
      if (r.done) { this.finishWith(r.value); return; }
      const y: SessionYield = r.value;
      if (y.kind === 'init') {
        this.replay = { h: this.args.teams.h, a: this.args.teams.a, players: y.players, steps: y.steps, events: y.events, hg: 0, ag: 0 };
        this.builder = new TimelineBuilder(this.replay, this.args.mode === 'full' ? FULL_OPTS : HIGHLIGHT_OPTS);
        this.builder.skipMoments();
        this.tl = this.builder.tl;
      } else if (y.kind === 'moment') {
        this.builder.addUpTo(y.req.minute);
        this.collect(y.req.minute, false);
        this.builder.addMoment(y.req);
        this.request = y.req;
        this.status = 'decision';
        this.version++;
        return;
      } else if (y.kind === 'outcome') {
        this.builder.addOutcome(this.request!, y.out);
        this.count(y.out);
        this.outcomes.push(y.out);
        const kind: LineKind = y.out.goal === 'own' ? 'goal-us' : y.out.goal === 'opp' ? 'goal-them' : 'you';
        this.lines.push({ min: y.out.minute, text: y.out.goal === 'own' ? `GOAL (${this.goals.h}-${this.goals.a}). ${y.out.text}` : y.out.text, kind });
        this.version++;
      }
    }
  }

  private finishWith(result: MatchResult) {
    this.replay.hg = result.hg;
    this.replay.ag = result.ag;
    this.collect(90, true);
    this.builder.finish();
    this.result = result;
    this.request = null;
    this.status = 'finished';
    this.version++;
  }

  /** Make a choice. Pass undefined to let the engine decide. */
  choose(optionId: string | undefined): void {
    if (this.status !== 'decision') return;
    this.status = 'running';
    this.pump(optionId);
  }

  /** Play out the rest of the match with the engine making any remaining decisions. */
  autoFinish(): void {
    while (this.status !== 'finished') {
      this.status = 'running';
      this.pump(undefined);
    }
    this.tl.pauseT = null;
  }
}
