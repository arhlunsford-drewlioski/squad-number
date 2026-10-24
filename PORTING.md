# Porting Squad Number to Godot

This is the plan for moving the game from the TypeScript prototype to Godot. The prototype stays the reference: the design, the numbers and the tests are settled here first.

## What there is to port

| Part | Lines (TS) | Notes |
|---|---|---|
| `src/engine` | ~1,700 | Players, attributes, training, season rollover, economy. Pure logic. |
| `src/engine/match` | ~900 | The match simulation. `matchSession` is a generator; in a port it becomes a state machine you step. |
| `src/engine/moments` | ~1,500 | Decision moments. The templates are data (`data/moments.json`); four hold functions. |
| `src/engine/events` | ~530 | Career events. Mostly functions (conditions, text), so these are ported by hand. |
| `src/engine/market` | ~290 | Transfers, loans, managers. |
| `src/engine/career` | ~850 | Cup, national team, awards, goals, achievements, legacy. |
| `src/view` | ~800 | The 2D match scenes. Rebuilt natively in Godot. |
| `src/ui`, `src/state` | ~3,200 | Screens. Rebuilt in Godot's UI. Dense tables are the most work. |

## Language

Use C# for the engine. A matchday simulates about 40 matches and the summer rollover touches 2,000 players. C# in Godot runs near the speed of this JavaScript. GDScript would be many times slower and would need a background thread and tuning. Godot needs the .NET build, which limits the web export, so decide on platforms first.

## Data

`data/*.json` holds the static tables, written by `npx tsx scripts/export-data.ts`. `tests/data.test.ts` fails if they drift from the TypeScript source. Functions cannot be exported; they appear as `{ "$fn": true }`.

| File | Contents |
|---|---|
| `attributes.json` | 32 attributes and four groups |
| `positions.json` | 8 positions, height ranges and attribute weights (sum to 1) |
| `formations.json` | 5 formations |
| `traits.json` | 12 traits and their prerequisites |
| `training.json` | 18 programmes, intensities, default programmes by position |
| `world.json` | divisions, cup rounds and weeks, international weeks, nations |
| `achievements.json` | 25 achievements (checks are code) |
| `moments.json` | 97 moment templates and their options |

Events, wage and value formulas, the match engine and the market are code.

## Golden fixtures

`fixtures/golden.json` records seeded outputs: the random number generator, a new world, seeded matches, moment odds, a full season, a summer of market business and a short career. `npx tsx scripts/golden.ts` rewrites it. `tests/golden.test.ts` fails if the TypeScript engine changes by accident.

The port must reproduce every value. The random generator is mulberry32, so port it first and check `rng` against the fixture. After that, port in this order, checking the matching fixture each time: world generation, a match, moment odds, a season, the market, a career. When a number differs, the port is wrong, not the fixture. If an engine change is meant, change the TypeScript first and re-record.

## Order of work

1. Random generator and the data loaders, checked against `rng`.
2. Players, attributes, ratings, point buy, world generation, checked against `world`.
3. The match simulation and lineups, checked against `match`.
4. Moments, checked against `moments`.
5. Season, training, economy, market, cup, career, checked against `season`, `market` and `career`.
6. Saves with a version number and migrations.
7. The match view, then the screens.

## Before starting

- Choose C# or GDScript, and the platforms (desktop only keeps the .NET build simple).
- Decide whether to keep a TypeScript build as the web version.
- Settle design changes first. Each change after the port starts costs twice.
