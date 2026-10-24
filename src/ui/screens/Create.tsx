import { useMemo, useState } from 'react';
import { ATTR_DEFS, GROUPS, attrsIn, type AttrId, type Attrs } from '../../engine/attributes';
import { BUILDS, buyCapFor, ceilingMods, HEIGHT_AVG, HEIGHT_MAX, HEIGHT_MIN, heightFeetInches, heightNote, type Build, type Foot } from '../../engine/body';
import { AGE_START, autoBuild, isLocked, NOW_LATER_MAX, pointsSpent, poolFor, potentialCenter, startAttrs, stepCost, weakFootCost } from '../../engine/pointbuy';
import { keyAttrs, POSITIONS, POS_BY_ID, type Position } from '../../engine/positions';
import { allPositionOvr, ovrAt, ovrTier } from '../../engine/rating';
import { randomName } from '../../engine/names';
import { makeRng } from '../../engine/rng';
import { useStore } from '../../state/store';
import { AttrNum, Ovr, Panel } from '../components';
import { TextSizeControl } from '../TextSize';

const clampAttrs = (a: Attrs, h: number, b: Build): Attrs => {
  const out = { ...a };
  for (const d of ATTR_DEFS) out[d.id] = Math.min(out[d.id], buyCapFor(d.id, h, b));
  return out;
};

export function Create() {
  const newCareer = useStore(s => s.newCareer);
  const openMenu = useStore(s => s.openMenu);
  const hasSaves = useStore(s => s.slots.some(Boolean));
  const [name, setName] = useState('');
  const [position, setPosition] = useState<Position>('ST');
  const [height, setHeight] = useState(HEIGHT_AVG);
  const [build, setBuild] = useState<Build>('athletic');
  const [foot, setFoot] = useState<Foot>('right');
  const [weakFoot, setWeakFoot] = useState(2);
  const [nowLater, setNowLater] = useState(0);
  const [attrs, setAttrs] = useState<Attrs>(() => startAttrs('ST'));

  const pool = poolFor(nowLater);
  const spent = pointsSpent(attrs, position, weakFoot);
  const left = pool - spent;
  const key = useMemo(() => new Set(keyAttrs(position, 8)), [position]);
  const cur = ovrAt(attrs, position);
  const mods = ceilingMods(height, build);
  const note = heightNote(position, height);
  const potLo = Math.round(potentialCenter(nowLater) - 7);
  const potHi = Math.round(potentialCenter(nowLater) + 7);

  const changePosition = (p: Position) => { setPosition(p); setAttrs(startAttrs(p)); };
  const changeHeight = (h: number) => { setHeight(h); setAttrs(a => clampAttrs(a, h, build)); };
  const changeBuild = (b: Build) => { setBuild(b); setAttrs(a => clampAttrs(a, height, b)); };
  const bump = (id: AttrId, d: 1 | -1) => setAttrs(a => ({ ...a, [id]: a[id] + d }));
  const canUp = (id: AttrId) => !isLocked(id, position) && attrs[id] < buyCapFor(id, height, build) && stepCost(attrs[id]) <= left;
  const canDown = (id: AttrId) => !isLocked(id, position) && attrs[id] > 1;
  const auto = () => setAttrs(autoBuild(position, height, build, pool - weakFootCost(weakFoot)));
  const reset = () => setAttrs(startAttrs(position));

  const modList = Object.entries(mods).filter(([, v]) => v).map(([id, v]) => ({ id: id as AttrId, v: v as number }));
  const [busy, setBusy] = useState(false);
  const canStart = left >= 0 && name.trim().length > 0 && !busy;
  const start = () => { setBusy(true); setTimeout(() => newCareer({ name: name.trim().slice(0, 28), position, heightCm: height, build, foot, weakFoot, attrs, nowLater }), 40); };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '2px 2px 12px' }}>
        <h1 style={{ fontSize: 18 }}>Squad Number</h1>
        <span className="muted hide-m">New career. You are {AGE_START} and joining the lower leagues. Build your player.</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, alignItems: 'center' }}>{hasSaves && <button className="btn sm" onClick={openMenu}>Back to menu</button>}<TextSizeControl /></span>
      </div>

      <div className="grid g-pb">
        {/* Identity and body */}
        <div className="pb-player"><Panel title="Player">
          <div className="field">
            <label htmlFor="pname">Name</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input id="pname" type="text" value={name} placeholder="Player name" maxLength={28} onChange={e => setName(e.target.value)} />
              <button className="btn" onClick={() => setName(randomName(makeRng((Math.random() * 1e9) | 0)))}>Random</button>
            </div>
          </div>

          <div className="field">
            <span className="lbl">Position</span>
            <div className="seg pos-seg">
              {POSITIONS.map(p => <button key={p.id} aria-pressed={position === p.id} onClick={() => changePosition(p.id)} title={p.long}>{p.label}</button>)}
            </div>
            <span className="note">{POS_BY_ID[position].long}. Changing position resets the attributes.</span>
          </div>

          <div className="field">
            <label htmlFor="height" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Height</span><span className="num">{height} cm ({heightFeetInches(height)})</span>
            </label>
            <input id="height" type="range" min={HEIGHT_MIN} max={HEIGHT_MAX} value={height} onChange={e => changeHeight(+e.target.value)} />
            <span className={'note' + (note.tone === 'warn' ? ' warn' : '')}>{note.text}</span>
          </div>

          <div className="field">
            <span className="lbl">Build</span>
            <div className="seg">
              {BUILDS.map(b => <button key={b.id} aria-pressed={build === b.id} onClick={() => changeBuild(b.id)}>{b.label}</button>)}
            </div>
            <span className="note">{BUILDS.find(b => b.id === build)!.effect}</span>
          </div>

          <div className="field">
            <span className="lbl">Preferred foot</span>
            <div className="seg">
              {(['left', 'right'] as Foot[]).map(f => <button key={f} aria-pressed={foot === f} onClick={() => setFoot(f)}>{f === 'left' ? 'Left' : 'Right'}</button>)}
            </div>
          </div>

          <div className="field">
            <span className="lbl" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Weaker foot</span><span className="muted">{weakFootCost(weakFoot) === 0 ? 'Free' : `${weakFootCost(weakFoot) > 0 ? '+' : ''}${weakFootCost(weakFoot)} points`}</span>
            </span>
            <div className="seg">
              {[1, 2, 3, 4, 5].map(n => <button key={n} aria-pressed={weakFoot === n} onClick={() => setWeakFoot(n)}>{n}</button>)}
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="nl" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Now or later</span><span className="num">{nowLater === 0 ? 'Even' : nowLater > 0 ? `${nowLater} towards now` : `${-nowLater} towards later`}</span>
            </label>
            <input id="nl" type="range" min={-NOW_LATER_MAX} max={NOW_LATER_MAX} value={nowLater} onChange={e => setNowLater(+e.target.value)} />
            <span className="note">More now gives more starting points and lowers your ceiling. More later gives fewer points and a higher ceiling. Your real potential is rolled when the career starts and stays hidden.</span>
          </div>
        </Panel></div>

        {/* Attributes */}
        <div className="stack pb-attrs">
          <div className="pb-tools">
            <button className="btn" onClick={auto}>Auto-fill for {POS_BY_ID[position].label}</button>
            <button className="btn" onClick={reset}>Reset attributes</button>
            <span className="muted">Shaded rows matter most for a {POS_BY_ID[position].long.toLowerCase()}. Cost rises above 10 and above 13.</span>
          </div>
          <div className="g-pb-attrs">
            {[['technical', 'mental', 'physical', 'goalkeeping']].map((col, i) => (
              <div className="pb-cols" key={i}>
                {col.map(gid => {
                  const g = GROUPS.find(x => x.id === gid)!;
                  const dim = gid === 'goalkeeping' && position !== 'GK';
                  return (
                    <Panel key={gid} title={g.label} right={dim ? 'Goalkeepers only' : undefined} flush>
                      <div className="pbrow head"><span>Attribute</span><span /><span style={{ textAlign: 'center' }}>Value</span><span /><span style={{ textAlign: 'right' }}>Max</span><span style={{ textAlign: 'right' }}>Cost</span></div>
                      {attrsIn(g.id).map(d => {
                        const locked = isLocked(d.id, position);
                        const cap = buyCapFor(d.id, height, build);
                        const delta = mods[d.id] ?? 0;
                        return (
                          <div key={d.id} className={'pbrow' + (key.has(d.id) && !locked ? ' key' : '') + (locked ? ' locked' : '')}>
                            <span title={delta ? `Height and build move this ceiling by ${delta > 0 ? '+' : ''}${delta}` : undefined}>
                              {d.label}{delta ? <span className={delta > 0 ? 'b-good' : 'b-low'} style={{ marginLeft: 6, fontSize: 11 }}>{delta > 0 ? '+' : ''}{delta}</span> : null}
                            </span>
                            <button className="step" disabled={!canDown(d.id)} onClick={() => bump(d.id, -1)} aria-label={`Lower ${d.label}`}>-</button>
                            <span className="v"><AttrNum v={attrs[d.id]} /></span>
                            <button className="step" disabled={!canUp(d.id)} onClick={() => bump(d.id, 1)} aria-label={`Raise ${d.label}`}>+</button>
                            <span className="cap">{locked ? '' : cap}</span>
                            <span className="cost">{locked ? '' : attrs[d.id] >= cap ? 'max' : stepCost(attrs[d.id])}</span>
                          </div>
                        );
                      })}
                    </Panel>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="stack pb-preview">
          <Panel title="Profile preview">
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12 }}>
              <Ovr v={cur} lg />
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{name.trim() || 'Unnamed player'}</div>
                <div className="t2">{AGE_START} · {POS_BY_ID[position].long} · {height} cm · {BUILDS.find(b => b.id === build)!.label} · {foot === 'left' ? 'Left' : 'Right'} foot</div>
                <div className="muted">Level today: {ovrTier(cur)}</div>
              </div>
            </div>
            <dl className="kv">
              <dt>Expected ceiling</dt><dd>{ovrTier(potLo)} to {ovrTier(potHi)}</dd>
              <dt>Points</dt><dd className="num">{spent} of {pool} spent</dd>
            </dl>
            <div className={'pool' + (left < 0 ? ' over' : '')} style={{ margin: '8px 0 4px' }}><i style={{ width: `${Math.min(100, (spent / pool) * 100)}%` }} /></div>
            <div className={left < 0 ? 'err' : 'muted'}>{left < 0 ? `${-left} points over. Remove some attributes or move the slider towards now.` : `${left} points left`}</div>
          </Panel>

          <Panel title="Rating by position" flush>
            <table>
              <thead><tr><th className="l">Position</th><th>OVR</th></tr></thead>
              <tbody>
                {allPositionOvr(attrs).sort((a, b) => b.ovr - a.ovr).map(r => (
                  <tr key={r.pos} className={r.pos === position ? 'me' : ''}>
                    <td className="l">{POS_BY_ID[r.pos].long}</td>
                    <td><Ovr v={r.ovr} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Key attributes">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 18px' }}>
              {keyAttrs(position, 8).map(id => (
                <div key={id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="t2">{ATTR_DEFS.find(d => d.id === id)!.label}</span><AttrNum v={attrs[id]} />
                </div>
              ))}
            </div>
          </Panel>

          {modList.length > 0 && (
            <Panel title="Ceilings from height and build">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {modList.map(m => <span key={m.id} className="pill"><span className={m.v > 0 ? 'b-good' : 'b-low'}>{m.v > 0 ? '+' : ''}{m.v}</span> {ATTR_DEFS.find(d => d.id === m.id)!.label}</span>)}
              </div>
              <p className="note" style={{ marginTop: 8 }}>These move how high each attribute can eventually grow. At the start you can buy up to 16.</p>
            </Panel>
          )}

        </div>
      </div>

      <div className="pb-bar">
        <div className="pb-bar-info">
          <div className={'pool' + (left < 0 ? ' over' : '')}><i style={{ width: `${Math.min(100, (spent / pool) * 100)}%` }} /></div>
          <span className={left < 0 ? 'err' : 'muted'}>{!name.trim() ? 'Enter a name to start.' : left < 0 ? `${-left} points over. Remove some attributes or move the slider towards now.` : `${left} of ${pool} points left`}</span>
        </div>
        <button className="btn primary" disabled={!canStart} onClick={start}>{busy ? 'Building the world...' : 'Start career'}</button>
      </div>
    </div>
  );
}
