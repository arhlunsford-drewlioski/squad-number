import { useState } from 'react';
import { useStore } from '../../state/store';
import { Panel } from '../components';

export function Inbox() {
  const game = useStore(s => s.game)!;
  const read = useStore(s => s.readMessage);
  const [sel, setSel] = useState<number | null>(game.inbox[0]?.id ?? null);
  const msg = game.inbox.find(m => m.id === sel) ?? game.inbox[0];

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(300px, 460px) 1fr' }}>
      <Panel title="Inbox" right={`${game.inbox.filter(m => !m.read).length} unread`} flush>
        <table>
          <tbody>
            {game.inbox.map(m => (
              <tr key={m.id} className={'click' + (msg && msg.id === m.id ? ' me' : '')} onClick={() => { setSel(m.id); read(m.id); }}>
                <td className="l" style={{ fontWeight: m.read ? 400 : 700 }}>{m.subject}<div className="muted" style={{ fontWeight: 400, fontSize: 12 }}>{m.from}</div></td>
                <td className="muted">Week {m.week}</td>
              </tr>
            ))}
            {game.inbox.length === 0 && <tr><td className="l muted">No messages.</td></tr>}
          </tbody>
        </table>
      </Panel>
      <Panel title={msg ? msg.subject : 'Message'} right={msg ? `From ${msg.from}` : undefined}>
        {msg ? <p style={{ maxWidth: '70ch', lineHeight: 1.55, whiteSpace: 'pre-line' }}>{msg.body}</p> : <p className="muted">Select a message.</p>}
      </Panel>
    </div>
  );
}
