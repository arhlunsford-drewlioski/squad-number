import { useStore, type MatchMode, type Speed } from '../../state/store';
import { Panel } from '../components';
import { TextSizeControl } from '../TextSize';
import { useInstall } from '../../state/install';
import { buildLabel } from '../../state/update';

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <span className="lbl">{label}</span>
      {children}
      {hint && <span className="note">{hint}</span>}
    </div>
  );
}

export function Settings() {
  const { theme, toggleTheme, prefs, setPrefs, matchMode, setMatchMode, slot, exportSlot, openMenu, go } = useStore();
  const app = useInstall();
  const seg = <T extends string | number>(value: T, options: [T, string][], on: (v: T) => void, label: string) => (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, text]) => <button key={String(v)} aria-pressed={value === v} onClick={() => on(v)}>{text}</button>)}
    </div>
  );
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(22rem, 1fr))', maxWidth: '72rem' }}>
      <Panel title="Display">
        <Row label="Text size" hint="Everything in the game scales with this."><TextSizeControl /></Row>
        <Row label="Skin">{seg(theme, [['dark', 'Dark'], ['light', 'Light']], t => { if (t !== theme) toggleTheme(); }, 'Skin')}</Row>
        <Row label="Table density" hint="Compact fits more rows on screen, for squad and market lists.">{seg(prefs.density, [['normal', 'Normal'], ['compact', 'Compact']], v => setPrefs({ density: v }), 'Table density')}</Row>
        <Row label="Contrast" hint="Stronger text and borders.">{seg(prefs.contrast, [['normal', 'Normal'], ['high', 'High']], v => setPrefs({ contrast: v }), 'Contrast')}</Row>
      </Panel>
      <Panel title="Matches">
        <Row label="How matches are played" hint="Full shows every scene and moment. Highlights is faster. Instant skips the match view and lets the engine decide for you.">
          {seg<MatchMode>(matchMode, [['full', 'Full'], ['highlights', 'Highlights'], ['instant', 'Instant']], setMatchMode, 'Match mode')}
        </Row>
        <Row label="Match speed" hint="The speed a match starts at. You can change it during the match.">
          {seg<Speed>(prefs.speed, [[1, '1x'], [2, '2x'], [4, '4x'], [8, '8x']], v => setPrefs({ speed: v }), 'Match speed')}
        </Row>
        <Row label="Motion" hint="Reduced motion removes interface animation. It follows your system setting until you change it.">
          {seg(prefs.motion, [['normal', 'Normal'], ['reduced', 'Reduced']], v => setPrefs({ motion: v }), 'Motion')}
        </Row>
      </Panel>
      <Panel title="Install on your phone">
        <p className="t2" style={{ marginBottom: 10 }}>
          {app.installed ? 'You are playing the installed app.' : 'Put Squad Number on your home screen to play it full screen, like any other game.'}
        </p>
        {!app.installed && app.canPrompt && <button className="btn primary" onClick={() => void app.install()}>Install the app</button>}
        {!app.installed && !app.canPrompt && app.ios && <p className="note">On iPhone: tap the Share button in Safari, then Add to Home Screen.</p>}
        {!app.installed && !app.canPrompt && !app.ios && <p className="note">Use your browser's menu and choose Install app, or Add to Home screen.</p>}
        <p className="note" style={{ marginTop: 8 }}>Version: built {buildLabel()}</p>
        <p className="note" style={{ marginTop: 8 }}>{app.offline ? 'Saved for offline play: the game opens and plays with no connection.' : 'Offline play switches on after the first visit to the built app.'}</p>
      </Panel>
      <Panel title="Career and saves">
        <p className="t2" style={{ marginBottom: 10 }}>This career is in save slot {slot}. It is saved after every matchday.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => void exportSlot(slot)}>Export this career</button>
          <button className="btn" onClick={openMenu}>Main menu</button>
          <button className="btn" onClick={() => { setPrefs({ tourSeen: false }); go('overview'); }}>Show the welcome tour again</button>
        </div>
      </Panel>
    </div>
  );
}
