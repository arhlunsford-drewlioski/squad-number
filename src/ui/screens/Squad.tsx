import { useMemo, useState } from 'react';
import { attrsIn, type AttrGroup } from '../../engine/attributes';
import { BUILDS, heightFeetInches } from '../../engine/body';
import { clubOf, humanOf, roleAt } from '../../engine/game';
import { avgRating, ovrOf, type Player } from '../../engine/player';
import { POS_BY_ID, POSITIONS, type Position } from '../../engine/positions';
import { useStore } from '../../state/store';
import { AttrNum, Ovr, Panel } from '../components';
import { useMobile } from '../useMobile';

type View = 'overview' | 'stats' | AttrGroup;
const VIEWS: { id: View; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'stats', label: 'Season stats' },
  { id: 'technical', label: 'Technical' },
  { id: 'mental', label: 'Mental' },
  { id: 'physical', label: 'Physical' },
  { id: 'goalkeeping', label: 'Goalkeeping' },
];

const posOrder = Object.fromEntries(POSITIONS.map((p, i) => [p.id, i])) as Record<string, number>;

export function Squad() {
  const game = useStore(s => s.game)!;
  const select = useStore(s => s.selectPlayer);
  const me = humanOf(game);
  const club = clubOf(game, me.clubId)!;
  const [view, setView] = useState<View>('overview');
  const [sortKey, setSortKey] = useState<string>('pos');
  const [asc, setAsc] = useState(true);
  const [only, setOnly] = useState<Position | 'all'>('all');
  const mobile = useMobile();

  const squad = useMemo(() => game.players.filter(p => p.clubId === club.id), [game.players, club.id]);
  const cols = view === 'overview' || view === 'stats' ? [] : attrsIn(view);

  const value = (p: Player, key: string): number | string => {
    if (key === 'pos') return posOrder[p.position];
    if (key === 'name') return p.name;
    if (key === 'age') return p.age;
    if (key === 'height') return p.heightCm;
    if (key === 'ovr') return ovrOf(p);
    if (key === 'cond') return p.injuredWeeks > 0 ? -p.injuredWeeks : p.condition;
    if (key === 'apps') return p.stats.apps;
    if (key === 'mins') return p.stats.mins;
    if (key === 'goals') return p.stats.goals;
    if (key === 'ast') return p.stats.assists;
    if (key === 'avg') return avgRating(p.stats);
    return p.attrs[key as keyof Player['attrs']];
  };
  const rows = squad.filter(p => only === 'all' || p.position === only).sort((a, b) => {
    const x = value(a, sortKey), y = value(b, sortKey);
    const c = typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number);
    return (asc ? c : -c) || ovrOf(b) - ovrOf(a);
  });
  const sortBy = (k: string) => { if (k === sortKey) setAsc(!asc); else { setSortKey(k); setAsc(k === 'pos' || k === 'name'); } };
  const th = (k: string, label: string, left?: boolean) => (
    <th className={'sort' + (left ? ' l' : '')} onClick={() => sortBy(k)} aria-sort={sortKey === k ? (asc ? 'ascending' : 'descending') : 'none'}>
      {label}{sortKey === k ? (asc ? ' ▴' : ' ▾') : ''}
    </th>
  );

  if (mobile) {
    return (
      <Panel title={`${club.name} squad`} right={`${squad.length} players`} flush>
        <div className="chips-row" role="group" aria-label="Position filter">
          {(['all', ...POSITIONS.map(p => p.id)] as const).map(p => <button key={p} aria-pressed={only === p} onClick={() => setOnly(p)}>{p === 'all' ? 'All' : p}</button>)}
        </div>
        <div className="cards">
          {[...rows].sort((a, b) => (only === 'all' ? posOrder[a.position] - posOrder[b.position] : 0) || ovrOf(b) - ovrOf(a)).map(p => {
            const out = p.suspended > 0 ? `Banned ${p.suspended}` : p.injuredWeeks > 0 ? `Injured ${p.injuredWeeks}w` : null;
            return (
              <button key={p.id} className={'card-row' + (p.human ? ' me' : '')} onClick={() => select(p.id)}>
                <span className="pos-chip">{POS_BY_ID[p.position].label}</span>
                <span className="card-main">
                  <b>{p.name}</b>
                  <span className="muted">{p.age} · {roleAt(game.players, club.id, p)} · {p.stats.apps} apps, {p.stats.goals} goals{p.stats.ratingN ? `, ${avgRating(p.stats).toFixed(1)}` : ''}</span>
                </span>
                <span className="card-end">
                  <Ovr v={ovrOf(p)} />
                  <span className={out ? 'bad-t' : 'muted'}>{out ?? Math.round(p.condition) + '%'}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Panel>
    );
  }

  return (
    <Panel title={`${club.name} squad`} right={`${squad.length} players`} flush>
      <div className="tabs">
        {VIEWS.map(v => <button key={v.id} aria-pressed={view === v.id} onClick={() => setView(v.id)}>{v.label}</button>)}
      </div>
      <div style={{ padding: '8px 12px' }} className="seg" role="group" aria-label="Position filter">
        {(['all', ...POSITIONS.map(p => p.id)] as const).map(p => <button key={p} aria-pressed={only === p} onClick={() => setOnly(p)}>{p === 'all' ? 'All' : p}</button>)}
      </div>
      <table>
        <thead>
          <tr>
            {th('pos', 'Pos', true)}{th('name', 'Name', true)}{th('age', 'Age')}{th('height', 'Height')}
            {view === 'overview' && <><th>Build</th><th>Foot</th><th>Role</th></>}
            {view === 'stats' && <>{th('apps', 'Apps')}{th('mins', 'Mins')}{th('goals', 'Goals')}{th('ast', 'Assists')}{th('avg', 'Avg rating')}{th('cond', 'Condition')}</>}
            {cols.map(c => th(c.id, c.label))}
            {th('ovr', 'OVR')}
          </tr>
        </thead>
        <tbody>
          {rows.map(p => (
            <tr key={p.id} className={'click' + (p.human ? ' me' : '')} onClick={() => select(p.id)}>
              <td className="l">{POS_BY_ID[p.position].label}</td>
              <td className="l">{p.name}</td>
              <td>{p.age}</td>
              <td>{p.heightCm} <span className="muted">({heightFeetInches(p.heightCm)})</span></td>
              {view === 'overview' && <>
                <td>{BUILDS.find(b => b.id === p.build)!.label}</td>
                <td>{p.foot === 'left' ? 'Left' : 'Right'}</td>
                <td>{roleAt(game.players, club.id, p)}</td>
              </>}
              {view === 'stats' && <>
                <td>{p.stats.apps}</td><td>{p.stats.mins}</td><td>{p.stats.goals}</td><td>{p.stats.assists}</td>
                <td>{p.stats.ratingN ? avgRating(p.stats).toFixed(2) : '-'}</td>
                <td>{p.suspended > 0 ? <span style={{ color: 'var(--bad)' }}>Suspended, {p.suspended}</span> : p.injuredWeeks > 0 ? <span style={{ color: 'var(--bad)' }}>Injured, {p.injuredWeeks}w</span> : Math.round(p.condition) + '%'}</td>
              </>}
              {cols.map(c => <td key={c.id}><AttrNum v={p.attrs[c.id]} /></td>)}
              <td><Ovr v={ovrOf(p)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
