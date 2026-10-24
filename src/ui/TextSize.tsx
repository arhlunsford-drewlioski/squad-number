import { useStore, type TextSize } from '../state/store';

const SIZES: { id: TextSize; label: string }[] = [{ id: 's', label: 'A' }, { id: 'm', label: 'A' }, { id: 'l', label: 'A' }];

/** Three-step text size control. Every size in the UI is in rem, so this scales the whole interface. */
export function TextSizeControl() {
  const size = useStore(s => s.size);
  const setSize = useStore(s => s.setSize);
  return (
    <div className="seg" role="group" aria-label="Text size">
      {SIZES.map((s, i) => (
        <button key={s.id} aria-pressed={size === s.id} onClick={() => setSize(s.id)} title={['Smaller text', 'Normal text', 'Larger text'][i]}
          style={{ fontSize: `${[0.8, 1, 1.25][i]}rem`, padding: '0.1rem 0.6rem' }}>{s.label}</button>
      ))}
    </div>
  );
}
