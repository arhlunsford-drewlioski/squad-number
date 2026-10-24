import { Panel } from '../components';

export function Placeholder({ title, milestone, text }: { title: string; milestone: string; text: string }) {
  return (
    <div style={{ maxWidth: 640 }}>
      <Panel title={title} right={milestone}>
        <p className="t2" style={{ lineHeight: 1.55 }}>{text}</p>
      </Panel>
    </div>
  );
}
