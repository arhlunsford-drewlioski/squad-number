import { useEffect } from 'react';
import { describeEvent } from '../../engine/events/events';
import { useStore } from '../../state/store';
import { Panel } from '../components';

/** An event that needs an answer, and what came of it afterwards. */
export function EventScreen() {
  const game = useStore(s => s.game)!;
  const result = useStore(s => s.eventResult);
  const answer = useStore(s => s.answerEvent);
  const done = useStore(s => s.dismissEvent);
  const ev = describeEvent(game);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (result) { if (e.key === 'Enter' || e.key === ' ') done(); return; }
      const n = Number(e.key);
      if (ev && n >= 1 && n <= ev.options.length) answer(ev.options[n - 1].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ev, result, answer, done]);

  if (result) {
    return (
      <div style={{ maxWidth: 720 }}>
        <Panel title={result.title} right="Done">
          <p className="t2" style={{ marginBottom: 8 }}>You chose: <b style={{ color: 'var(--text)' }}>{result.choice}</b></p>
          <p style={{ fontSize: '1.05rem', lineHeight: 1.5 }}>{result.result}</p>
          <button className="btn primary" style={{ marginTop: 16 }} onClick={done}>Back to the game</button>
        </Panel>
      </div>
    );
  }
  if (!ev) {
    return <div style={{ maxWidth: 720 }}><Panel title="Nothing to decide"><p className="muted">There is nothing waiting for you.</p></Panel></div>;
  }
  return (
    <div style={{ maxWidth: 820 }}>
      <Panel title={ev.title} right={`From ${ev.from}`}>
        <p style={{ fontSize: '1.05rem', lineHeight: 1.5 }}>{ev.body}</p>
        <div className="stack" style={{ marginTop: 14 }}>
          {ev.options.map((o, i) => (
            <button key={o.id} onClick={() => answer(o.id)}
              style={{ textAlign: 'left', background: 'var(--panel-head)', border: '1px solid var(--line-strong)', borderRadius: 3, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <b>{i + 1}. {o.label}</b>
              <span className="t2" style={{ fontSize: '0.92rem' }}>{o.desc}</span>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
