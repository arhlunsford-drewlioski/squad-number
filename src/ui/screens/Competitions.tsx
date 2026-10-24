import { useState } from 'react';
import { clubOf, humanOf } from '../../engine/game';
import { squadLevel, tableFor } from '../../engine/table';
import { DIVISIONS } from '../../engine/world';
import { useStore } from '../../state/store';
import { ClubLink, Kit, Ovr, Panel } from '../components';
import { useSort } from '../useSort';
import { useMobile } from '../useMobile';

export function Competitions() {
  const game = useStore(s => s.game)!;
  const mine = clubOf(game, humanOf(game).clubId)!;
  const [div, setDiv] = useState(mine.division);
  const mobile = useMobile();
  const rows = tableFor(game, div);
  const rank = new Map(rows.map((r, i) => [r.id, i + 1]));
  const nameOf = (id: string) => game.clubs.find(c => c.id === id)!.name;
  const sort = useSort(rows, { club: r => nameOf(r.id), p: r => r.p, w: r => r.w, d: r => r.d, l: r => r.l, gf: r => r.gf, ga: r => r.ga, gd: r => r.gf - r.ga, pts: r => rank.size - (rank.get(r.id) ?? 0), squad: r => squadLevel(game, r.id) }, 'pts');

  return (
    <Panel title={DIVISIONS[div - 1].name} right={`Season ${game.season}`} flush>
      <div className="tabs">
        {DIVISIONS.map(d => <button key={d.id} aria-pressed={div === d.id} onClick={() => setDiv(d.id)}>{mobile ? (d.id === 1 ? 'League' : `Div ${d.id - 1}`) : d.name}</button>)}
      </div>
      <table>
        <thead>
          <tr><th>#</th>{sort.th('club', 'Club', true)}{sort.th('p', 'P')}{sort.th('w', 'W', false, undefined, true)}{sort.th('d', 'D', false, undefined, true)}{sort.th('l', 'L', false, undefined, true)}{sort.th('gf', 'GF', false, undefined, true)}{sort.th('ga', 'GA', false, undefined, true)}{sort.th('gd', 'GD')}{sort.th('pts', 'Pts')}{sort.th('squad', 'Squad', false, 'Average rating of the best eleven players')}</tr>
        </thead>
        <tbody>
          {sort.rows.map(r => {
            const c = game.clubs.find(x => x.id === r.id)!;
            return (
              <tr key={r.id} className={r.id === mine.id ? 'me' : ''}>
                <td>{rank.get(r.id)}</td>
                <td className="l"><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Kit club={c} /><ClubLink id={c.id}>{c.name}</ClubLink></span></td>
                <td>{r.p}</td><td className="hide-m">{r.w}</td><td className="hide-m">{r.d}</td><td className="hide-m">{r.l}</td><td className="hide-m">{r.gf}</td><td className="hide-m">{r.ga}</td><td>{r.gf - r.ga}</td><td><b>{r.pts}</b></td>
                <td><Ovr v={squadLevel(game, c.id)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}
