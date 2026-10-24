import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';

const STEPS: { title: string; body: string }[] = [
  { title: 'You are one player', body: 'You are a 17-year-old starting in the lower leagues. Everything is about your career: where you play, how you grow and what you win. The rest of the world plays on without you.' },
  { title: 'Continue plays the week', body: 'Press Continue (top right, or Ctrl or Cmd + Enter) to play the next matchday. Training happens first, then your match. Events that need an answer stop you until you reply.' },
  { title: 'Matches are decisions', body: 'In a match you get a few moments to choose what to do with the ball. Your attributes decide how well each choice works. You can skip them or play in Highlights or Instant mode, from the match view or Settings.' },
  { title: 'Train to grow', body: 'Training sets what you work on each week. Hard weeks tire you; rest and good selection keep you fit. Learn traits to unlock new options in matches.' },
  { title: 'Build a career', body: 'Your agent sets targets each season. Win the cup, earn a national call-up, collect awards and achievements, and when the time comes, retire to see your legacy. Help is always in the Tools menu.' },
];

/** A short first-run introduction. Shown once, then available again from Settings. */
export function Tour() {
  const seen = useStore(s => s.prefs.tourSeen);
  const setPrefs = useStore(s => s.setPrefs);
  const [i, setI] = useState(0);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!seen) ref.current?.focus(); }, [seen, i]);
  if (seen) return null;
  const step = STEPS[i];
  const done = () => setPrefs({ tourSeen: true });
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="tour-title" className="tour-back" onKeyDown={e => { if (e.key === 'Escape') done(); }}>
      <div className="panel tour">
        <div className="ph"><span id="tour-title">{step.title}</span><span className="muted" style={{ fontWeight: 400 }}>{i + 1} of {STEPS.length}</span></div>
        <div className="pb">
          <p style={{ lineHeight: 1.55, marginBottom: 16 }}>{step.body}</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn" onClick={done}>Skip</button>
            <span style={{ flex: 1 }} />
            {i > 0 && <button className="btn" onClick={() => setI(i - 1)}>Back</button>}
            {i < STEPS.length - 1
              ? <button ref={ref} className="btn primary" onClick={() => setI(i + 1)}>Next</button>
              : <button ref={ref} className="btn primary" onClick={done}>Start playing</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
