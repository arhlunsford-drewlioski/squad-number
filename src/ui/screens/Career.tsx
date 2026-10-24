import { useState } from 'react';
import { clubOf, humanOf } from '../../engine/game';
import { ACHIEVEMENTS, HOME_NATION, INTL_WEEKS, standing, TOURNAMENT_EVERY, TOURNAMENT_NAME, totals } from '../../engine/career';
import { avgRating, ovrOf } from '../../engine/player';
import { useStore } from '../../state/store';
import { Ovr, Panel } from '../components';

const KIND_ORDER = ['league', 'cup', 'tournament', 'promotion', 'boot', 'poty', 'young', 'clubPoty', 'clubBoot', 'cupFinal', 'tournamentFinal'];

/** How far each target has got, for the table. */
function progress(game: ReturnType<typeof useStore.getState>['game'] & object, kind: string): number {
  const st = humanOf(game).stats;
  switch (kind) {
    case 'apps': return st.apps;
    case 'goals': return st.goals;
    case 'assists': return st.assists;
    case 'cleanSheets': return st.cleanSheets;
    case 'rating': return st.apps >= 10 ? avgRating(st) : 0;
    case 'ovr': return ovrOf(humanOf(game));
    default: return 0;
  }
}

export function Career() {
  const game = useStore(s => s.game)!;
  const [tab, setTab] = useState<'honours' | 'goals' | 'achievements' | 'international' | 'record'>('goals');
  const c = game.career;
  const me = humanOf(game);
  const club = clubOf(game, me.clubId)!;
  const t = totals(game);
  const st = standing(game);
  const honours = [...c.honours].sort((a, b) => b.season - a.season || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  const next = INTL_WEEKS.find(w => w >= game.week - 1);
  const nextTournament = Math.ceil(game.season / TOURNAMENT_EVERY) * TOURNAMENT_EVERY;

  return (
    <div className="grid career-grid" style={{ gridTemplateColumns: 'minmax(260px, 320px) 1fr' }}>
      <div className="stack">
        <Panel title={me.name} right={`Age ${me.age}`}>
          <dl className="kv">
            <dt>Standing</dt><dd className="num">{Math.round(c.rep)} of 100</dd>
            <dt>Seasons</dt><dd className="num">{t.seasons}{game.phase === 'play' ? ' (+ this one)' : ''}</dd>
            <dt>League apps / goals</dt><dd className="num">{t.apps} / {t.goals}</dd>
            <dt>Assists</dt><dd className="num">{t.assists}</dd>
            <dt>Cup apps / goals</dt><dd className="num">{c.cup.apps} / {c.cup.goals}</dd>
            <dt>Caps / goals</dt><dd className="num">{c.intl.caps} / {c.intl.goals}</dd>
            <dt>Peak overall</dt><dd><Ovr v={c.peak.ovr} /> <span className="muted">age {c.peak.age}</span></dd>
            <dt>Honours</dt><dd className="num">{c.honours.filter(h => h.kind === 'league' || h.kind === 'cup' || h.kind === 'tournament').length} trophies</dd>
            <dt>Achievements</dt><dd className="num">{c.achievements.length} of {ACHIEVEMENTS.length}</dd>
          </dl>
        </Panel>
        <Panel title="Where you stand">
          <p className="t2" style={{ marginBottom: 6 }}>{club.name}</p>
          <p className="note">{st.level === 'senior' ? `In the ${HOME_NATION} squad. ${st.starts ? 'In line to start.' : 'On the fringe of the eleven.'}` : st.level === 'u21' ? `In the ${HOME_NATION} Under-21 squad.` : `Not in a national squad. Standing and overall decide who is called.`}</p>
          {next !== undefined && game.phase === 'play' && <p className="note" style={{ marginTop: 6 }}>Next international break: after matchday {next}.</p>}
          <p className="note" style={{ marginTop: 6 }}>{TOURNAMENT_NAME}: end of season {nextTournament}.</p>
        </Panel>
      </div>

      <Panel title="Career" flush>
        <div className="tabs">
          {([['goals', 'Targets'], ['honours', 'Honours'], ['achievements', 'Achievements'], ['international', 'International'], ['record', 'Record']] as const).map(([id, label]) => (
            <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {tab === 'goals' && (
          <div className="pb">
            <p className="t2" style={{ marginBottom: 8 }}>Season {game.season} targets from your agent.</p>
            <table>
              <thead><tr><th className="l">Target</th><th>So far</th><th>Needed</th></tr></thead>
              <tbody>
                {c.goals.map(x => {
                  const v = progress(game, x.kind);
                  const shown = x.kind === 'finish' || x.kind === 'cup' ? 'at season end' : x.kind === 'rating' ? (v ? v.toFixed(2) : '-') : v;
                  return <tr key={x.id}><td className="l">{x.text}</td><td className="num">{shown}</td><td className="num">{x.kind === 'finish' ? `top ${x.target}` : x.kind === 'cup' ? '' : x.target}</td></tr>;
                })}
                {c.goals.length === 0 && <tr><td className="l muted" colSpan={3}>No targets set yet.</td></tr>}
              </tbody>
            </table>
            {c.goalLog.length > 0 && (
              <>
                <h4 style={{ margin: '14px 0 6px' }}>Past seasons</h4>
                <table>
                  <thead><tr><th>Season</th><th>Targets met</th></tr></thead>
                  <tbody>{[...c.goalLog].reverse().map(l => <tr key={l.season}><td>{l.season}</td><td className="num">{l.met} of {l.total}</td></tr>)}</tbody>
                </table>
              </>
            )}
          </div>
        )}

        {tab === 'honours' && (
          <table>
            <thead><tr><th>Season</th><th className="l">Honour</th><th className="l">Club</th></tr></thead>
            <tbody>
              {honours.map((h, i) => <tr key={i}><td>{h.season}</td><td className="l">{h.label}</td><td className="l">{h.club}</td></tr>)}
              {honours.length === 0 && <tr><td className="l muted" colSpan={3}>Nothing yet.</td></tr>}
            </tbody>
          </table>
        )}

        {tab === 'achievements' && (
          <div className="pb" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(15rem, 1fr))', gap: 8 }}>
            {ACHIEVEMENTS.map(a => {
              const got = c.achievements.find(x => x.id === a.id);
              return (
                <div key={a.id} className="panel" style={{ opacity: got ? 1 : 0.55 }}>
                  <div className="pb">
                    <b>{a.label}</b>{got ? <span className="muted"> season {got.season}</span> : null}
                    <div className="note">{a.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'international' && (
          <div className="pb">
            <dl className="kv" style={{ maxWidth: 360 }}>
              <dt>Senior caps / goals</dt><dd className="num">{c.intl.caps} / {c.intl.goals}</dd>
              <dt>Under-21 caps / goals</dt><dd className="num">{c.intl.u21Caps} / {c.intl.u21Goals}</dd>
              <dt>Assists</dt><dd className="num">{c.intl.assists}</dd>
            </dl>
            <h4 style={{ margin: '14px 0 6px' }}>{TOURNAMENT_NAME}</h4>
            <table>
              <thead><tr><th>Season</th><th className="l">Result for {HOME_NATION}</th><th>Goals</th><th>In the squad</th></tr></thead>
              <tbody>
                {c.intl.tournaments.map(x => <tr key={x.season}><td>{x.season}</td><td className="l">{x.result}</td><td className="num">{x.goals}</td><td>{x.played ? 'Yes' : 'No'}</td></tr>)}
                {c.intl.tournaments.length === 0 && <tr><td className="l muted" colSpan={4}>None played yet. One every {TOURNAMENT_EVERY} seasons.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'record' && (
          <table>
            <thead><tr><th>Season</th><th className="l">Club</th><th className="l">Division</th><th>Pos</th><th>Apps</th><th>G</th><th>A</th><th>Avg</th><th>OVR</th></tr></thead>
            <tbody>
              {game.history.map(h => <tr key={h.season}><td>{h.season}</td><td className="l">{h.clubName}</td><td className="l">{h.division}</td><td>{h.pos}</td><td>{h.apps}</td><td>{h.goals}</td><td>{h.assists}</td><td className="num">{h.avg ? h.avg.toFixed(2) : '-'}</td><td><Ovr v={h.ovr} /></td></tr>)}
              {game.history.length === 0 && <tr><td className="l muted" colSpan={9}>No seasons completed yet.</td></tr>}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
