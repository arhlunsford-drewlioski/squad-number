import { Panel } from '../components';

const Q: { q: string; a: string }[] = [
  { q: 'What is a matchday?', a: 'One round of league matches. You train, then play your match, then the rest of the world plays. A season is 38 matchdays, with cup rounds and international breaks in between.' },
  { q: 'How do I get picked?', a: 'The manager chooses on form, fitness, level for the role, and trust. Play well and your trust rises. The Overview and Instructions screens say where you stand. Resting through a knock keeps you fresh but costs a match.' },
  { q: 'What happens in a match?', a: 'You get a few moments each match where the ball comes to you. Pick an option; how it goes depends on your attributes against the opponent. Reads show how well you can see the situation. Skip lets the engine decide.' },
  { q: 'How do I improve?', a: 'Training (two sessions and a focus each week), match experience, and learned traits. Young players grow faster. Your potential is hidden, shown only as a range. Condition drops with hard training and matches.' },
  { q: 'What do the overall ratings mean?', a: 'Overall runs from the 40s to the 90s. 80 and above is Premier level: the best of the top division. The point-buy at the start decides where you begin and how far you can go.' },
  { q: 'Contracts, offers and the market', a: 'Clubs buy, sell and loan players in two windows. Your agent and the club bring offers and renewals as events. A contract that runs out lets you choose a new club. Wages follow your level and standing.' },
  { q: 'Cups, call-ups and awards', a: 'Every club enters the Crown Cup. Your tie is played before the next league match. A strong player is called up for the national team, with a tournament every fourth season. Your agent sets three targets a season; meeting them raises your standing.' },
  { q: 'How does a career end?', a: 'From 33 you can retire at the end of any season, and at 37 the career ends. The legacy screen scores peak level, honours, international career, goals and appearances, longevity, standing and achievements.' },
];

const KEYS: [string, string][] = [
  ['Ctrl or Cmd + Enter', 'Continue to the next matchday, or play your tie'],
  ['1 to 5', 'Choose an option on a decision card'],
  ['Alt + Left, Alt + Right', 'Go back and forward through the screens you have visited'],
  ['?', 'Open this help'],
  ['Tab and Shift + Tab', 'Move through buttons and tables'],
];

export function Help() {
  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(18rem, 1fr)', maxWidth: '80rem' }}>
      <Panel title="How the game works">
        <div className="stack">
          {Q.map(x => (
            <div key={x.q}>
              <h3 style={{ fontSize: '1rem', marginBottom: 4 }}>{x.q}</h3>
              <p className="t2" style={{ maxWidth: '70ch', lineHeight: 1.5 }}>{x.a}</p>
            </div>
          ))}
        </div>
      </Panel>
      <div className="stack">
        <Panel title="Keyboard" flush>
          <table><tbody>{KEYS.map(([k, d]) => <tr key={k}><td className="l"><b>{k}</b></td><td className="l" style={{ whiteSpace: 'normal' }}>{d}</td></tr>)}</tbody></table>
        </Panel>
        <Panel title="Colour bands">
          <p className="note">Ratings and attributes are coloured by band, and always shown as a number too: red is weak, through yellow and green, to blue for elite.</p>
        </Panel>
      </div>
    </div>
  );
}
