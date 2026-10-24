import { clubOf, humanOf, lineupCtx } from '../../engine/game';
import { bestLineup, explainSelection, statusIn } from '../../engine/match/lineup';
import { DEFAULT_INSTRUCTIONS, type Instructions as Ins } from '../../engine/match/types';
import { ovrOf } from '../../engine/player';
import { POS_BY_ID } from '../../engine/positions';
import { useStore } from '../../state/store';
import { Ovr, Panel } from '../components';

const OPTIONS: { key: keyof Ins; label: string; hint: string; choices: { id: string; label: string; effect: string }[] }[] = [
  {
    key: 'shooting', label: 'Shooting', hint: 'How much you look for goal when the ball reaches you.',
    choices: [
      { id: 'less', label: 'Pass first', effect: 'Fewer shots for you, more of the ball goes to others.' },
      { id: 'normal', label: 'Normal', effect: 'Take shots when the chance is there.' },
      { id: 'more', label: 'Shoot on sight', effect: 'More shots for you. Not all of them are good ones.' },
    ],
  },
  {
    key: 'movement', label: 'Movement', hint: 'Where you position yourself off the ball.',
    choices: [
      { id: 'hold', label: 'Hold position', effect: 'Tighter and safer. Less threat going forward.' },
      { id: 'normal', label: 'Normal', effect: 'Stay in your usual zone.' },
      { id: 'roam', label: 'Run in behind', effect: 'More threat going forward and more shots, but you leave gaps.' },
    ],
  },
  {
    key: 'defending', label: 'Defending', hint: 'How you work without the ball.',
    choices: [
      { id: 'drop', label: 'Drop off', effect: 'Save energy and stay compact. Win the ball less often.' },
      { id: 'normal', label: 'Normal', effect: 'Close down when the situation asks for it.' },
      { id: 'press', label: 'Close down', effect: 'Press hard. You tire faster and give away more fouls.' },
    ],
  },
];

export function Instructions() {
  const game = useStore(s => s.game)!;
  const set = useStore(s => s.setInstructions);
  const me = humanOf(game);
  const club = clubOf(game, me.clubId)!;
  const lctx = lineupCtx(game);
  const L = bestLineup(game.players, club.id, lctx);
  const status = statusIn(L, me, lctx);
  const note = explainSelection(L, me, game.players, 'The manager', lctx);
  const ins = game.instructions;
  const statusText = { start: 'Expected to start', bench: 'Expected on the bench', out: 'Expected to be left out', injured: 'Injured', suspended: 'Suspended', rested: 'Resting' }[status];

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(360px, 1fr) minmax(360px, 1fr)' }}>
      <div className="stack">
        <Panel title="Player instructions" right={<button className="btn sm" onClick={() => set(DEFAULT_INSTRUCTIONS)}>Reset</button>}>
          {OPTIONS.map(o => (
            <div className="field" key={o.key}>
              <span className="lbl">{o.label}</span>
              <div className="seg">
                {o.choices.map(c => <button key={c.id} aria-pressed={ins[o.key] === c.id} onClick={() => set({ [o.key]: c.id } as Partial<Ins>)}>{c.label}</button>)}
              </div>
              <span className="note">{o.choices.find(c => c.id === ins[o.key])!.effect}</span>
            </div>
          ))}
          <p className="note">Instructions only apply to you. The manager sets the team's shape and approach.</p>
        </Panel>
      </div>

      <div className="stack">
        <Panel title="Selection outlook" right={`${club.name}, ${L.formation}`}>
          <p style={{ fontWeight: 600, marginBottom: 6 }}>{statusText} on matchday {game.week}</p>
          <p className="t2">{note}</p>
          <p className="note" style={{ marginTop: 8 }}>This is the manager's pick if the match were played now. Condition and form change it week to week.</p>
        </Panel>
        <Panel title="Probable starting eleven" flush>
          <table>
            <thead><tr><th className="l">Pos</th><th className="l">Player</th><th>Cond</th><th>OVR</th></tr></thead>
            <tbody>
              {L.xi.map(s => (
                <tr key={s.player.id} className={s.player.human ? 'me' : ''}>
                  <td className="l">{POS_BY_ID[s.slot].label}</td><td className="l">{s.player.name}</td><td>{Math.round(s.player.condition)}%</td><td><Ovr v={ovrOf(s.player)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Bench" flush>
          <table>
            <tbody>
              {L.bench.map(p => (
                <tr key={p.id} className={p.human ? 'me' : ''}>
                  <td className="l">{POS_BY_ID[p.position].label}</td><td className="l">{p.name}</td><td>{Math.round(p.condition)}%</td><td><Ovr v={ovrOf(p)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}
