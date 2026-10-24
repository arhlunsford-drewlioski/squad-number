import { clubOf, humanOf } from '../../engine/game';
import { ACHIEVEMENTS, legacyOf } from '../../engine/career';
import { POS_BY_ID } from '../../engine/positions';
import { useStore } from '../../state/store';
import { Ovr, Panel } from '../components';

export function Legacy() {
  const game = useStore(s => s.game)!;
  const openMenu = useStore(s => s.openMenu);
  const me = humanOf(game);
  const L = legacyOf(game);
  const last = clubOf(game, me.clubId);
  const best = [...game.history].sort((a, b) => b.ovr - a.ovr || b.goals - a.goals)[0];

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '2px 2px 12px' }}>
        <h1 style={{ fontSize: 18 }}>{me.name}</h1>
        <span className="muted">{POS_BY_ID[me.position].long}, retired at {me.age}{last ? `, last at ${last.name}` : ''}</span>
        <div style={{ flex: 1 }} />
        <button className="btn primary" onClick={openMenu}>Main menu</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="stack">
          <Panel title="Legacy" right={`${L.score} points`}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 6 }}>{L.title}</div>
            <p className="t2" style={{ maxWidth: '44ch' }}>{L.blurb}</p>
          </Panel>
          <Panel title="Where the points came from" flush>
            <table>
              <tbody>{L.parts.map(p => <tr key={p.label}><td className="l">{p.label}</td><td className="num">{p.points}</td></tr>)}</tbody>
            </table>
          </Panel>
          <Panel title="Peak">
            <dl className="kv">
              <dt>Best overall</dt><dd><Ovr v={L.peak.ovr} /> <span className="muted">age {L.peak.age}, season {L.peak.season}</span></dd>
              {best && <><dt>Best season</dt><dd>{best.clubName}, {best.apps} apps, {best.goals} goals</dd></>}
            </dl>
          </Panel>
        </div>

        <div className="stack">
          <Panel title="In numbers">
            <dl className="kv">
              <dt>Seasons</dt><dd className="num">{L.seasons}</dd>
              <dt>League appearances</dt><dd className="num">{L.apps}</dd>
              <dt>League goals</dt><dd className="num">{L.goals}</dd>
              <dt>Assists</dt><dd className="num">{L.assists}</dd>
              <dt>Cup appearances / goals</dt><dd className="num">{game.career.cup.apps} / {game.career.cup.goals}</dd>
              <dt>Caps / goals</dt><dd className="num">{L.caps} / {L.intlGoals}</dd>
              <dt>Achievements</dt><dd className="num">{L.achievements} of {ACHIEVEMENTS.length}</dd>
            </dl>
          </Panel>
          <Panel title="Honours" flush>
            <table>
              <tbody>
                {L.trophies.map(t => <tr key={t.kind}><td className="l">{t.label}</td><td className="num">{t.count}</td></tr>)}
                {L.trophies.length === 0 && <tr><td className="l muted">No honours.</td></tr>}
              </tbody>
            </table>
          </Panel>
        </div>

        <div className="stack">
          <Panel title="Clubs" flush>
            <table>
              <thead><tr><th className="l">Club</th><th>Seasons</th><th>Apps</th><th>Goals</th></tr></thead>
              <tbody>{L.clubs.map(c => <tr key={c.name}><td className="l">{c.name}</td><td>{c.seasons}</td><td>{c.apps}</td><td>{c.goals}</td></tr>)}</tbody>
            </table>
          </Panel>
          <Panel title="Season by season" flush>
            <div style={{ maxHeight: '22rem', overflow: 'auto' }}>
              <table>
                <thead><tr><th>Age</th><th className="l">Club</th><th>Apps</th><th>G</th><th>OVR</th></tr></thead>
                <tbody>{game.history.map(h => <tr key={h.season}><td>{h.age}</td><td className="l">{h.clubName}</td><td>{h.apps}</td><td>{h.goals}</td><td><Ovr v={h.ovr} /></td></tr>)}</tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
