# Squad Number: roadmap to a true Be a Pro sim

Where we are: weekly loop, point buy, 32 attributes, match engine v2, training and progression for 1,900 players, season roll-over, promotion and relegation. What is missing is the part where you are *in* the match, plus the career around it.

## 1. What is left, by area

| Area | What it needs | Size |
|---|---|---|
| Match experience | 2D pitch view, resumable match session, 4-5 interactive moments per match, match modes (full, highlights, instant) | Large |
| Moments library | 15 archetypes, 60+ templates, matchup reads, outcome chains, traits that unlock options | Large |
| Career events | Manager meetings, agent and contract talks, loans, transfer approaches, injuries and rehab, suspensions, rivals, media | Medium |
| Player state | Confidence, morale, reputation, sharpness, playing identity (team player or selfish), traits learned in training | Medium |
| World | AI transfers, loans, free agents and windows, club finances and facilities, manager changes and styles, a domestic cup | Large |
| Career arc | National team, awards, achievements and goals from the agent, retirement and legacy screen | Medium |
| Information | Scouting uncertainty on potential, coach reports, news feed | Small |
| Quality | Multiple saves, settings, onboarding, balance harness coverage, performance | Ongoing |

## 2. The match view

### What it looks like
A top-down 2D pitch in the style of Football Manager's match view. Twenty-two dots, a ball, name labels on hover, your player ringed. Scoreboard and clock on top, commentary ticker beside the pitch, speed controls (pause, x1, x4, skip to next moment).

### Is it easy to solve? Yes, if we do it as scenes and not a full simulation.
- **Recommended (tier A, scene based).** Players sit on formation anchors that shift with where the ball is, so the shape looks alive. The 4-5 moments (and every goal) are *choreographed scenes*: a short list of keyframes for the few players and the ball that matter, with easing. Rendering is one canvas or SVG component and a tiny scene player. Pitch coordinates are normalised, so scenes are data.
- **Not recommended (tier B, continuous agents).** Simulating all 22 players with ball physics every frame. It is a different game, it is expensive to tune, and it makes results harder to reason about. Our existing sequence engine would be replaced.
- The match engine stays the source of truth. Scenes *illustrate* what the engine decided (or what you decided), they never decide anything.

### How a match plays
1. **Pre-match**: lineups, formation, the manager's note on your role (you have this today).
2. **First half** runs on the clock. The engine is refactored into a resumable *match session* (a generator): it advances to the next moment, pauses, asks you, then continues with your choice baked in.
3. **Moments** pause the clock, play the setup scene, show the decision card. After you choose, the outcome scene plays and the commentary updates.
4. **Half-time**: stats, a short team talk, change your instructions.
5. **Full-time**: the report you already have, now including your decisions and what they led to.

### Modes (important for a long career)
| Mode | What happens | Time per match |
|---|---|---|
| Full | All moments, scenes at normal speed | 3-4 minutes |
| Highlights | Moments only, skips between them | 1-2 minutes |
| Instant | Engine plays every moment for you using your tendencies | Seconds |

Mixing is allowed: for example Full for cup finals and derbies, Highlights for the rest.

## 3. Moments: decisions that play out from your skills and the opponent

### The idea
A moment is a short football situation where *you* have the ball or the decision. You choose one of 3-4 options. What happens depends on your attributes against the specific opponents on the pitch, how tired you are, your confidence, the score, and a little luck. Options can chain (a dribble that works leads to a second decision: shoot or square it).

### How a moment is built
```
Moment template
  applies to        positions, game state (score, minute), role (starter or sub)
  scene             where everyone stands, the choreography for each outcome
  matchup           which opposing player or keeper you face (live from the lineup)
  options (3-4)
    label and hint
    drivers         your attributes that matter, their attributes that matter
    risk profile    safe, balanced, gamble (shifts the odds and the payoff)
    outcome tiers   great, good, poor, disaster, each with a result and a follow-up
    unlock          optional: a trait or minimum attribute to see this option
```

### How an option resolves (one formula, many moments)
1. `mine` = weighted sum of your attributes for that option, scaled by fatigue, confidence and your instructions.
2. `theirs` = weighted sum of the *actual* opponent's attributes (live fatigue included), plus keeper quality where it applies.
3. `edge = mine - theirs + situation + option risk`. Situation covers score pressure, crowd, derby, minute.
4. Roll against a logistic of the edge to pick an outcome tier. Hidden attributes bend it: Composure and Big Matches in pressure moments, Consistency narrows the roll.
5. The tier produces the result: goal, shot saved, key pass, turnover, foul, card, injury, or a follow-up moment.

### How skill shows up, so it feels earned
- **Reads.** What you see on the card depends on your Vision, Decisions and Anticipation. Low: vague words ("he looks quick"). High: clear bands (likely, even, risky) and one precise hint about the defender. Better players *see* the right option.
- **Options unlock.** Traits learned in training (finesse shot, trickster, press resistant, long throw, aerial threat) add options that only some players have.
- **Opponents are real.** A winger facing a 9-pace full back gets a different card than against a 16-pace one. The same moment reads differently every week.

### How decisions feed the career
- **Rating**: results and decisions both move your match rating, so a smart safe pass is not punished the same as a blazed shot.
- **Confidence** (new, 0-100): rises with success, falls with errors, shifts the next checks.
- **Identity**: over time you become known as a team player or a selfish one. That changes how the manager talks to you and how often teammates look for you.
- **Replaces your auto stats.** In moments mode the engine stops handing you automatic shots and key passes, and the moments supply them, so goal rates stay balanced.

### How many moments, and which
A *moment director* picks 4-5 per starter (2-3 as a substitute) at kickoff, weighted by:
- your position and instructions (a striker who runs in behind gets more chances),
- the live game state (chasing a goal, protecting a lead),
- variety (no repeat archetype in one match, and not the same one as last week),
- a mix of attacking, defensive and quiet moments so it is not always a shot.

### Content: a ton, without writing a ton by hand
Fifteen archetypes, each with variants by zone, opponent profile and game state, gives hundreds of distinct situations. Starting archetypes:

| Position | Moments |
|---|---|
| Striker | Through ball one on one, header from a cross, loose ball in the box, holding up with back to goal, penalty |
| Winger | Beat the full back, cut inside or cross, overlap with a teammate, counter on the break |
| Midfield | Progressive pass or play safe, switch of play, win the second ball, long shot or keep it, press trigger |
| Defender | Striker running at you, last-man foul decision, step in or hold, play out or clear, set-piece marking |
| Keeper | Rush out or stay, sweep behind the line, distribution under pressure, penalty guess |
| Any | Free kick, corner delivery, argue with the referee, dispute over who takes the penalty, first touch after coming on, protect the lead late |

### Making it balanced
- A **moment lab** dev screen: pick a template, sliders for your attributes and the opponent's, see the outcome distribution per option.
- A **headless harness**: simulate thousands of moments for typical players and check that no option dominates, that good players beat bad ones, and that goals per match stay in range.

## 4. The career around the match

### Events deck
Weighted events with conditions, cooldowns and chains, each with choices that move trust, morale, reputation or contract terms:
- manager: "see me", promised minutes, dropped after a bad run, asked to switch position
- agent: new contract, a better offer elsewhere, a loan, a move in the window
- body: injury, rehab choices, playing through a knock, long-term setbacks
- squad: a rival in your position, a captain's advice, a dressing-room row
- outside: media, an international call-up, awards

### Player state
Confidence, morale, reputation, sharpness, form (already there), suspension from cards (the engine already records them), and traits learned through training.

### World
AI transfers and loans in two windows, free agents, club budgets and facilities (which already feed coaching quality), managers who change and bring a style, a domestic cup, then national team call-ups and awards.

### Arc and goals
Career goals set by the agent, achievements, retirement at the end, and a legacy screen that summarises the career.

## 5. Build order

Each milestone ends with something you can play.

| # | Milestone | You get | Done when |
|---|---|---|---|
| 5 | Match session and 2D view | A resumable match session. The pitch view with shape, ball and scenes for goals, commentary and speed controls. Highlights are auto-played (no decisions yet) | You can watch a match in 2D and the result matches the engine |
| 6 | Moments v1 | Decision card, resolver, matchup reads, moment director, three modes, ratings and confidence wired in. 15-20 templates across all positions | You make 4-5 choices per match and the outcomes follow your attributes |
| 7 | Moments content and traits | 60+ templates, traits that unlock options, the moment lab, the harness | The harness passes and no option dominates |
| 8 | Career events | Events deck, manager and agent talks, contract negotiation, injuries and rehab, suspensions | A season has real off-pitch decisions |
| 9 | The market | AI transfers, loans, free agents, windows, club finances, manager changes | The world reshuffles year to year |
| 10 | Arc and legacy | Cups, national team, awards, goals, retirement and legacy | A career has an ending worth sharing |
| 11 | Polish | Save slots, settings, tutorial, accessibility, compact mode, performance, publish | Someone new can start and finish a career |

## 6. Risks and how we handle them
- **Repetition.** 170+ decisions a season gets old. Answer: modes, variety rules, and a library big enough that weeks differ.
- **Content volume.** The moments library is the biggest cost. Answer: archetypes with variants, one resolver, and the lab to check them quickly.
- **Balance.** Decisions must matter without making results random. Answer: caps on how much a moment can swing a match, plus the harness.
- **Scope.** The 2D view tempts toward full simulation. Answer: scenes only, and the engine stays in charge.

## 7. Decisions I will make unless you object
- 2D view as scenes (tier A), not a continuous simulation.
- 4-5 moments per start, 2-3 as a substitute, with the three play modes.
- Moments replace your automatic shots and key passes, so goal rates hold.
- Reads depend on Vision, Decisions and Anticipation.
- Match experience comes before the market and events, because it is the core fantasy.

## Status

- Milestones 1 to 4 done (see PLAN.md).
- Milestone 5 done: the match engine is a resumable session (`matchSession`), every match records a replay trace, and Continue opens a 2D pitch view with auto-played highlights, speed controls and a replay from any stored report. Moments (decisions) come next, in milestone 6.
- Milestone 6 done: decision moments. 52 templates (51 selectable plus one follow-up) across all positions, a resolver that uses your attributes against the live opponent, reads that depend on Vision, Decisions and Anticipation, a moment director (4-5 per start, 2-3 as a substitute), the decision card (number keys), match modes (Full, Highlights, Instant), confidence, and your decisions on the match report. Next: grow the library toward 100 and add traits (milestone 7).
- Milestone 7 done: the moment library is 97 moments (292 options) with 12 trait options. Twelve traits (finesse shot, chip, trickster, press resistant, aerial threat, set-piece specialist, sweeper keeper, reads the game, hard tackler, poacher, playmaker, shot stopper) are learned with Skill work sessions once the attributes are there, and unlock or boost options in moments. The Moment lab screen previews any moment against any player, shows the odds of each option, and runs a library health check and a match check.
- Milestone 8 done: an events deck (19 events from the physio, agent, manager, coach, captain, club and media), contract talks with a counter-offer, mid-season transfer and loan offers (you return from a loan in the summer), injury diagnosis and rehab choices with a relapse risk, and suspensions (red cards, and every fifth yellow). An event stops Continue until you answer. About 8 to 15 events a season.
- Milestone 9 done: every player has a wage, a contract and a market value; every club has income, wage bill, transfer funds and a manager. Two transfer windows (matchdays 1 to 3 and 19 to 23, plus a long summer round) where AI clubs buy, sell, sign free agents and loan out reserves within their budgets. Contracts run down and clubs renew or release. Managers have styles, a favoured shape and an attitude to youth, and are sacked for poor results. New Transfers and Club screens. Check the world with `npx tsx scripts/market-sim.ts 10`.
- Milestone 10 done: the Crown Cup (all 80 clubs, a preliminary round for the weakest 32, seven rounds, penalties, neutral semi-finals and final; your tie is played live before the next league match and does not touch league stats). National team: Under-21 and senior call-ups from standing and overall, three international breaks a season, and a Continental Championship every fourth season. Awards (top scorer, player of the season, young player, club awards), three targets a season from your agent, 25 achievements, a standing score, retirement from 33 (forced at 37) and a legacy screen with a score and title. New Cup and Career screens. Old saves are caught up on load. Check whole careers with `npx tsx scripts/career-sim.ts 2 31 25`.

- Milestone 11 done: three save slots with a menu, export and import as a file, and a version check with migrations (`src/engine/migrate.ts`); a Settings screen (text size, skin, table density, contrast, reduced motion, match mode and speed); a first-run tour and a Help screen; Ctrl or Cmd + Enter to continue, ? for help, a skip link, visible focus; a stacked layout on narrow screens. A matchday takes about 130 ms and a save is about 5 MB. The single-file build is `SINGLE=1 npx vite build` (537 kB).

### Port notes (for the Godot move)
The engine is pure and seeded, so it can be ported and checked against the TypeScript version with the same seeds. Before porting: move static content (attributes, positions, traits, formations, moment templates, events, achievements) into JSON, record golden fixtures (seeded matches, seasons, a market run, a full career), and add an explicit save-format version with migrations. Prefer C# for the engine: GDScript will be many times slower for the world sim.

- Milestone 12 done: golden fixtures (`scripts/golden.ts`, `tests/golden.test.ts`, `fixtures/golden.json`), exported tables (`scripts/export-data.ts`, `data/*.json`, checked by `tests/data.test.ts`), `PORTING.md`, and growth calibration. A player who trains with purpose now gets within about 3 points of potential by 26: potential 84 reaches 81, potential 77 reaches 76 (`npx tsx scripts/growth-sim.ts -8 9 4`; the bot in `scripts/bot.ts` rotates programmes to close the biggest useful gap). Your own sessions keep paying off closer to the ceiling than club coaching does (`TUNING` in `src/engine/training.ts`). The world is unchanged: after 12 seasons the divisions sit at 78, 72, 65, 57. A bug where a club could end the summer a player short was fixed earlier.
- Milestone 13 done: names of players and clubs are links; Back and Forward (top bar, Alt + arrows) walk through where you have been; sortable tables on leagues, club wages, deals and free agents, and a position filter on the squad; a Today panel on the Overview; a News screen that merges messages, results and transfers; `SCREENS.md` as the screen-flow spec for the port. Visual theming, motion, audio and the match presentation are left for Godot.

- Screen size and growth pass: every screen now fits a 1280 by 700 page (checked by measuring overflow on every screen). The point buy, the match report with its ratings tables, the Overview and the live match were reworked for it, and the decision card moved beside the pitch. Your player's development now follows a smooth bell by age (physical peaks earliest, mental latest) instead of steps: a diligent player gains about 6 to 7 overall a year at 18 to 20, then tails off, and potential is centred on 79 so 80 and above is reachable (smart play at average potential reaches 80 by 24; choosing "later" reaches the mid 80s).

- Ratings pass: a good decision is now worth more (and a well-executed one a little extra), the rating starts at 6.1 for a quiet tidy match, luck on the day is smaller, and short appearances swing less. Your match report shows where the rating came from. Check with `npx tsx scripts/rating-check.ts 1 5`.

- Match day mode and risk pass: a live match is now its own full-screen mode that covers the sidebar and top bar, opens on a Kick off card that says what your role is, and ends on a Full time card. A substitute's match plays through quickly to their entrance and announces it. Gamble options were a trap (worth about double a safe option's loss when you were the underdog); a gamble now pays about the same as a balanced option on average with much bigger swings, and is the best bet when you are clearly the better player (`npx tsx scripts/risk-check.ts`). To do: a small bonus to gambles when your side is behind late.

- Match day, bigger: a full-screen team sheet before kick-off (both elevens with overalls, managers, league positions, form, your instructions and your role) and a full-screen summary at full time (score, goals, your rating and where it came from, your decisions with a tick or cross, team stats, and buttons for the full report, watching again, or continuing). Short appearances now scale every rating part together, so a cameo's breakdown adds up.

- Mobile first (started): the game is a phone game now, with the desktop layout kept as a bigger version of it. Phones get a slim top bar, a bottom tab bar with a raised Play button (Home, Squad, Play, Train, More), a More sheet for the rest, a Home screen that leads with the next match and a big Play button, a Squad list of cards instead of a table, the profile with attributes first, secondary table columns dropped, and the match decision as a sheet from the bottom. Type is now Barlow Condensed for titles, scores and buttons and Barlow for reading, bundled with the app so it works offline. A web app manifest and icon are in place. Installable app: done. PNG icons (`scripts/make-icons.py`), a manifest, a service worker (`public/sw.js`) that makes the built app play fully offline (tested by stopping the server and reloading), an install button in Settings with iPhone steps, and a request to keep saves from being cleared. `MOBILE.md` has the store-wrapper plan (Capacitor). The game is published on GitHub Pages (https://arhlunsford-drewlioski.github.io/squad-number/), and a `git push` redeploys it. Iteration is through the web app: `npm run dev:phone` for instant refresh on a phone, and a one-command deploy to a static host for the installed app, with an in-app "new version ready" banner (see `MOBILE.md`). The iPhone project is set up in `ios/` (Capacitor 8) and runs as a native app in the iPhone 17 Pro simulator (`npm run ios` opens it in Xcode); safe areas are handled. Not done yet: Android, haptics, testing on a real device, and the remaining screens' phone polish (Training detail, Career, Club, Schedule, Cup).

## Next

- **Milestone 14: personality and reputation (the interaction layer).** A personality for your player, chosen at the start and shaped by what you do, that decides which things you can say and how people take them. Reputation with separate audiences (manager, dressing room, fans, press, the industry and your agent) rather than one number. A People screen with the manager, captain, agent, a rival and a mentor as named people with a relationship each, and conversations you can start as well as ones that find you. Mostly design and content, so it belongs in the browser phase before the port. Borrowed from Campus Dynasty (a mobile basketball coaching sim): reputation as the spine of the climb, so it opens bigger clubs and better offers; an interest gauge on every club that wants you, with offers that can arrive in any window and not only at season end; a fast "sim to next event" for quiet weeks; and long-career robustness (its reviewers' main complaint).

- Playtest with a real person: three seasons, then note where it felt slow, confusing or repetitive.
- Decide the platform question (Godot with C# against a desktop wrapper for the web build), then start the port from `PORTING.md`.
- Republish the artifact when you want the latest build online. The Export button needs the `downloads` capability to work there.

## Ideas to keep

- **Option previews.** Hovering a decision option plays a short loop of that action on the pitch (the shot, the touch and shoot, the pass), and stops when you move away. Keep the decision card docked beside the pitch, not over it, so the situation stays visible. Needs a clip per option across the moment library, so it is animation and content work: do it in Godot.
- **Decision card as a focused panel.** A strong frame and a dimmed surround so the choice is unmistakable without covering the pitch.

