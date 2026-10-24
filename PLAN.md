# Squad Number: v2 build plan

Status: proposal, nothing built yet. Written against the published v1 (single HTML file, 2,616 lines).

## 0. What v1 is today

- You are one 17-year-old player. The game is a weekly loop: pick a training focus and intensity, the manager picks the XI, the match is simulated, events fire (contract, loan, transfer).
- 6 attributes on a 1-20 scale (pace, finishing, passing, tackling, stamina, composure) plus keeping for GKs. Overall is a position-weighted sum shown as "10.3".
- Match engine: Poisson chance counts from a midfield-strength logistic, then shooter and creator are picked by weight. Players only feed it through finishing, passing, tackling and composure.
- Other players barely progress. Each AI player gets `age rate * 0.3` on a few attributes, retires at 33-36, and is replaced by a regen at the club's fixed tier level. No AI transfers, no promotion or relegation, one league, club strength is a constant (`tier`).
- One 170 KB file, saved to localStorage.

This is why the stats feel thin and why NPCs feel static. The fix for both is the same: make the player model rich, and run every player through the same pipeline.

## 1. Stat model (FM-style)

Attributes are stored as floats on 1-20. The UI shows the integer and a small marker when a player is close to ticking up.

| Group | Attributes |
|---|---|
| Technical (10) | Finishing, Long Shots, Passing, First Touch, Dribbling, Crossing, Heading, Tackling, Marking, Technique |
| Mental (9) | Composure, Vision, Decisions, Positioning, Off the Ball, Anticipation, Work Rate, Aggression, Concentration |
| Physical (7) | Pace, Acceleration, Stamina, Strength, Agility, Balance, Jumping |
| Goalkeeping (6) | Handling, Reflexes, Aerial Reach, Command of Area, Kicking, One on Ones |
| Hidden (6) | Professionalism, Determination, Natural Fitness, Injury Proneness, Consistency, Big Matches |
| Traits | Height (cm), build, preferred foot, weak foot (1-5) |

Hidden attributes drive how fast you train, how often you get hurt and how much your match form swings. You see them only as scout and coach descriptions ("model professional", "injury prone").

### Overall rating, 40s to 90s

- Each position (GK, CB, FB, DM, CM, AM, W, ST, and later roles) has a weight vector over the attributes. `wavg` is the weighted mean on 1-20.
- `OVR = clamp(round(40 + 4.7 * (wavg - 6)), 20, 99)`, then calibrated against the targets below. The constants are placeholders. The calibration harness (section 6) sets them.
- Tie the bands to a league pyramid so that "80+ is Premier level" is true by construction:

| OVR | Meaning | Typical home |
|---|---|---|
| 40-49 | Academy and non-league | Youth, free agents |
| 50-59 | Division 4 starter | League Two equivalent |
| 60-69 | Division 3 starter | League One |
| 70-79 | Division 2 starter | Championship |
| 80-89 | Top-flight starter, elite at the top | Premier |
| 90+ | World class, a handful per world | Top 3 clubs |

Targets for the harness: top-flight starters median about 77, top three clubs about 83, fewer than 15 players at 85+ across the whole world, 17-year-old academy median about 47.

## 2. Point buy at game start

New player flow, one screen at full-screen width: left column is the build, right column is the live profile card and OVR preview.

**Free choices, no points, with trade-offs**
- Position (and a second position at low familiarity).
- Height, 165 to 203 cm, and build (lean, athletic, solid). Height is a real modifier, not flavour:
  - Taller raises the Heading, Jumping, Strength and GK Aerial ceilings, and lowers the Acceleration, Agility and Balance ceilings.
  - Shorter does the reverse.
  - Build shifts Pace vs Strength vs Stamina ceilings the same way.
  - Every position has a "natural" height band. Outside it you are a specimen (a 160 cm centre back is playable and hard). The UI says so plainly.
- Preferred foot and weak foot (1-5). A weak foot of 5 costs points.

**Bought with points** (suggested pool: 120 points)
- All 32 attributes start at about 5 (physical about 6). Raising one level costs 1 point up to 10, 2 points from 11 to 13, 3 points from 14 to 16. Start cap is 16.
- Physical traits are bought the same way, but their caps come from height and build. You cannot buy a 190 cm player with elite Agility.
- A pool of 120 gives a roughly 45-50 OVR player in your position with one clear strength.

**One optional trade-off slider, "Now vs Later"**
- Moves up to 15 points between your starting attributes and your hidden potential. More now means a lower ceiling, more later means a thinner start.
- Potential is otherwise rolled for you (from a distribution) and only revealed through fuzzy scout language and a star range that tightens as scouts see you.

Open question for you: do you want potential to be partly buyable (the slider) or fully random and hidden? The slider is the only part of the point buy I am unsure about.

## 3. Training

### Structure
- Three training slots per week (before the match). Each slot takes one **programme** and one **intensity** (Light, Standard, Hard). A fourth choice is **rest**.
- One **individual focus**: any single attribute you pick. It gets a bonus whenever a programme trains it, and it is the only way to train one attribute alone.
- Weekly load is the sum of intensity across slots. It feeds condition, match sharpness and injury risk (reuses the v1 fitness model).
- **Specialist bonus**: the same programme in all three slots gets about +15% because the coach can build on the work. Broad weeks spread thinner but touch more attributes.

### Programmes (each trains 2-3 attributes; primary 1.0, secondary 0.6, tertiary 0.4)

| Programme | Trains |
|---|---|
| Finishing | Finishing, Composure, Off the Ball |
| Long Range | Long Shots, Technique, Strength |
| Ball Mastery | First Touch, Dribbling, Technique |
| Passing Patterns | Passing, Vision, Decisions |
| Delivery | Crossing, Technique, Passing |
| Defensive Shape | Positioning, Marking, Concentration |
| Tackling and Duels | Tackling, Aggression, Strength |
| Aerial | Heading, Jumping, Strength |
| Movement | Off the Ball, Anticipation, Acceleration |
| Speed and Agility | Pace, Acceleration, Agility |
| Strength and Balance | Strength, Balance, Jumping |
| Endurance | Stamina, Work Rate (+ Natural Fitness protection) |
| Video Analysis | Decisions, Anticipation, Vision |
| Mindset | Composure, Concentration (+ Determination protection) |
| GK Handling | Handling, Command of Area, One on Ones |
| GK Reflexes | Reflexes, Aerial Reach, Kicking |
| Small-Sided Games (broad) | Passing, First Touch, Decisions, Stamina, Work Rate |

### Gain per attribute per session
`gain = base * programmeWeight * ageCurve(group, age) * headroom * coach * personality * load * diminishing`

- `headroom = (ceiling - value) / range`, where each player has a per-attribute ceiling derived from potential, position archetype, height and build. Players top out naturally.
- `ageCurve` is per group: physical peaks about 22-27 and falls from about 29, technical plateaus, mental keeps rising slowly to about 32.
- `coach` comes from the club's facilities and coaching staff, so a bigger club trains you faster. This is one more reason clubs differ.
- `personality` uses Professionalism and Determination.
- `diminishing` makes every level above 14 harder.
- **Match experience** adds a second source: minutes in competitive matches give small gains to the attributes your position uses, scaled for age. Playing time matters, which keeps the loan decision meaningful.
- Target pace for a high-potential 17-year-old at standard load: about 2-3 points per key attribute per season, so about 48 to 75 OVR over six or seven seasons. Calibrated in the harness.

## 4. Do other players progress?

Today barely. For a world that feels alive they must, and cheaply, because every player in the world runs through the **same progression functions** as you:

- AI players get an auto-assigned training plan from their position's key attributes (the coach picks), then use the same gain formula. About 2,300 players times 32 attributes per week is trivial to run.
- Each player has hidden potential and per-attribute ceilings. Some are wonderkids, most are not, and development has variance (spurts, stalls, injury setbacks).
- **Youth intake** each summer: every club produces 3-5 regens, with potential drawn from a distribution scaled by its academy rating. They are released, loaned or promoted.
- **Retirement and decline** by age and attribute group.
- **AI transfers and loans** in two windows. Each club computes positional need and surplus, a value is derived from OVR, age, potential and contract, and a single matching pass makes moves. Budgets limit it.
- **Pyramid**: 4 divisions of 20 clubs (80 clubs), promotion and relegation. Club strength is **emergent** from its squad, not a fixed `tier`. Squads and budgets shift, so clubs rise and fall over a long career.

This is also what makes the OVR bands meaningful: a player at 80+ will be found at the top clubs because that is where the transfer logic sends them.

## 5. Match engine v2

Goal: every attribute has a visible job, and the same engine produces match ratings, stat lines and commentary.

- Each match is about 100-120 possession sequences per team, each moving through phases: build-up, progression, chance creation, shot. A phase is resolved by attribute duels between the players involved, for example Passing and Vision against Positioning and Anticipation, or Dribbling and Acceleration against Tackling and Pace.
- Shots use Finishing, Long Shots, Composure and Heading against blockers and GK Handling, Reflexes and One on Ones, giving xG per shot.
- Also: fouls and cards (Aggression, Tackling), set pieces (Technique, Heading, Marking), fatigue by minute (Stamina, Natural Fitness), and injuries (Injury Proneness).
- Teams have formation, mentality and roles. The AI manager sets these. You set **player instructions** for yourself (shoot more, run in behind, hold position, close down), like FM's player instructions.
- Position familiarity affects every duel you take part in out of position.
- The seeded RNG stays deterministic. Engine output includes a per-player stat line (passes, key passes, tackles, interceptions, dribbles, shots, xG, saves) from which the 1-10 rating is computed, not hand-tuned.
- Simulation of other divisions uses the same engine with commentary off.

## 6. Architecture: split the single file

**Recommendation: yes, split it now.** A world sim this size, a calibration harness and a dense FM-style UI will not survive one HTML file.

```
squad-number/
  src/engine/       pure TypeScript, no DOM: model, generation, training, progression,
                    match, world (transfers, youth, pyramid), ai, rng, save schema
  src/ui/           React screens and components (design system lives here)
  src/state/        store, save and load (IndexedDB), worker bridge
  scripts/          headless calibration and balance reports (`npm run sim`)
  tests/            engine unit tests (Vitest)
```

- **Vite + TypeScript + React**, plain CSS with design tokens, a small custom table component (sort, sticky header, column picker, virtualised for league-wide lists).
- **Engine in a Web Worker** so a season of world sim never freezes the UI.
- **Saves in IndexedDB** (slots), not localStorage. A world of 2,000+ players with history will not fit the 5 MB limit.
- **Versioned save schema and engine version** so old saves migrate or are flagged.
- **Single-file build** (vite-plugin-singlefile) so the game can still be published to the existing Squad Number artifact link. Both options stay open: local dev for iteration, artifact for sharing.
- **Calibration harness**: run N worlds for M seasons headless and print OVR by division and age, goals per match, home advantage, upset rates, league tables spread, age-curve peaks, and promotion churn. The OVR bands in section 1 become assertions.

## 7. UI: remove the AI tells, make it FM-like

What the current UI does that reads as generated, and what replaces it:

| Now | Replace with |
|---|---|
| Dark navy and amber, "broadcast graphics" theme | Neutral charcoal and slate, one muted accent, plus a light skin. Colour only carries data meaning (attribute bands, form, status) |
| Mobile-first single column capped at 1100 px | Full-screen first: persistent left sidebar nav, top context bar, multi-panel pages that use 1920 x 1080 |
| Rounded 10 px cards with shadows, left accent stripes | Flat panels, 1 px borders, 2-4 px radius, no shadows, no gradients |
| Rows of KPI tiles and pills everywhere | Dense tables and labelled key-value lists. Pills only for real status |
| All-caps condensed headlines (NOT IN THE SQUAD), giant ghost numerals, outlined text | Plain sentence-case headings at 13-16 px. Status as a readable line of text |
| Uppercase letter-spaced "eyebrow" labels on every block | Normal-case section headers |
| Hero with tagline ("One player. Twenty clubs.") and chirpy microcopy | Dry, informational copy. An inbox of plain messages |
| One giant rating square and big numerals | Small coloured numbers in tables, FM-style attribute colouring by band |
| Bottom sticky "PLAY MATCHDAY" bar | A **Continue** button top right, and Space/Enter as shortcut |
| Mixed hover and focus styles, per-screen layout | One grid system, shared table, shared panel, keyboard navigation between sections |

FM-style screen list: Inbox, Overview, Schedule, Squad (sortable table with attribute columns), Player (attributes grid by group, position map, stats, history, contract, scout report), Training (weekly grid and programme picker, load and condition), Instructions and role, Club, Competitions (table, results, stats leaders, other divisions), Transfers and Scouting, Career. Base font 13-14 px, row height 24-28 px, tabular numbers, sticky headers.

## 8. Build order

Each milestone ends with something you can open and play, and the harness numbers for it.

1. **Foundation.** Scaffold, design tokens, FM app shell (sidebar, top bar, Continue), IndexedDB saves, single-file build that publishes to the artifact. Port the existing flow into the new shell using the old engine so nothing is lost.
2. **Stat model and point buy.** Attribute suite, position weights, OVR 40-99 scale, player generator by division, create-a-player flow with height, build and point buy, Player screen with full attribute grid. Calibration harness version 1 (OVR distribution by division and age).
3. **Match engine v2.** Phase-based engine, tactics, player instructions, per-player stat lines, derived ratings, match screen and report. Harness checks goals per match, home advantage and strength-to-results.
4. **Training and progression.** Programmes, weekly grid, load and fitness, match-experience gains, scout report, progress markers. NPC progression through the same functions. Harness checks the growth curve (48 to about 75 over six or seven seasons for high potential) and age peaks.
5. **World.** Pyramid with promotion and relegation, youth intake, retirements, AI transfers and loans, emergent club strength. Long-run harness: 30 seasons with no collapse of the OVR bands.
6. **Career depth and polish.** Events rework (agent, contract negotiation, injuries), scouting uncertainty, light and dark skins, keyboard shortcuts, compact mode for small screens.

## 9. Decisions I will make unless you object

- Keep the one-player career (not a manager game), now with the pyramid.
- Stack: Vite, TypeScript, React. Saves in IndexedDB.
- Keep publishing to the existing Squad Number artifact link.
- Point-buy pool of 120 with height and build as free choices that modify attribute ceilings.
- Start with milestone 1 and 2 together so you can see the new look and the new stat model early.

## Status

- Milestone 1 and 2 done: shell, point buy, stat model, 80-club pyramid, saves.
- Milestone 3 done: match engine v2, selection, match reports, instructions.
- Milestone 4 done: training programmes and weekly plan, progression for every player, ageing, retirements, youth intake, season roll-over, promotion and relegation (3 up, 3 down). Check it with `npx tsx scripts/world-sim.ts 16 ST`.
- Next: milestone 5 (AI transfers and loans, contracts and the market, club finances and facilities) and milestone 6 (events, scouting uncertainty, polish).
