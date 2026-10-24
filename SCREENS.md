# Screens and flow

What each screen is for, what it shows, and where it leads. This is the spec the Godot UI is built from. The web prototype follows it today.

## Rules that apply everywhere

- **Built for a 13 inch laptop.** The target is about 1280 by 700 pixels of page at the normal text size. Every screen fits that width with no sideways scrolling. The Overview and the live match fit the height too, with the controls and decision always visible. Bigger screens get more room and a third column, not a different layout.
- **Names are links.** A player's name opens their profile. A club's name opens its club page. This holds in every list, report and message.
- **History.** Back and forward move through the places you have visited (Alt + Left, Alt + Right, and the arrows in the top bar). Going somewhere new drops the forward history. Opening the same place twice adds nothing.
- **One primary action.** The top bar's Continue button always does the next thing: play the matchday, play a waiting cup tie, or open a decision that needs an answer. Its label says which.
- **Tables.** Click a header to sort, click again to reverse. Text columns start ascending, numbers descending. A table that can be long has a filter above it. The row that is yours is highlighted.
- **Numbers always shown.** Colour is never the only carrier of meaning; ratings and attributes are always numbers too.
- **Nothing is lost on the way out.** The game saves after every matchday and every choice, to the current slot.

## Flow

```
Menu ── New career ──> Create (point buy) ──> Offers ──> Overview
  │                                                        │
  └── Continue / View legacy ─────────────────────────────>│
                                                           ▼
          ┌───────────── Continue (top bar) ───────────────┤
          ▼                                                ▼
   Event (decision) ──> Overview           Match view (live) ──> Report ──> Overview
                                                           │
                                       end of matchday 38  ▼
                                    Season end ──> next season, or Retire ──> Legacy ──> Menu
```

## Screens

| Screen | Purpose | Shows | Leads to |
|---|---|---|---|
| Menu | Pick a save slot | Three slots with name, club, season, overall; new, continue, export, import, delete | Create, Overview, Legacy |
| Create | Build the player | Name, position, height, build, foot, weak foot, point buy over 32 attributes, now-or-later slider, live overall and potential range | Offers |
| Offers | Choose the first club | Three offers with role, wage, contract | Overview |
| Overview | Today at a glance | Today (what needs attention, latest news), next match, your role, your player, training this week, nearby table | Anything below |
| News | Everything that happened | One feed of matches, transfers, career and club news, filterable; messages expand in place | Player, Club |
| Inbox | Messages from people | Messages by sender, read state | Event |
| Profile | The player | Attributes by group with changes since the season began, hidden traits described, traits, positions, contract, value | Club |
| Training | Plan the week | Three sessions with programme and intensity, focus attribute, trait work, projected gains, condition cost | - |
| Instructions | Your match instructions | Shooting, movement, defending; selection outlook; probable eleven and bench | - |
| Career | The long view | Targets, honours, achievements, international record, season-by-season record, standing | Player, Club |
| Squad | Your team | Sortable table with position filter and views (overview, stats, attribute groups) | Player |
| Club | Any club | Finances, manager, wages and contracts (sortable) | Player |
| Schedule | Fixtures and reports | Fixtures with results, the selected match report (events, ratings, your decisions) | Club, Match view (replay) |
| Leagues | The pyramid | Sortable table for each division with squad levels | Club |
| Cup | The knockout | Rounds, ties, your path, penalties | Club, Match view |
| Transfers | The market | Window state and money, latest deals (filter and sort), free agents (sort) | Player, Club |
| Match view | Play or watch | 2D pitch, commentary, line-ups, speed, decision cards with options and reads, mode switch | Report |
| Event | A decision | Title, text, options with consequences | Overview |
| Season end | Close the year | Your season, development, league and cup, awards, targets, tournament, contract or offers, retire | Next season, Legacy |
| Legacy | The career, judged | Title and score with the parts, numbers, honours, clubs, season by season | Menu |
| Moment lab | Check the moments | Library health, odds for any option against any player | - |
| Settings | Preferences | Text size, skin, density, contrast, motion, match mode and speed, saves | Menu |
| Help | How it works | Questions and answers, keyboard | - |

## Tables

| Table | Default order | Sortable columns | Filter |
|---|---|---|---|
| Squad | Position | Position, name, age, height, overall, condition, stats, every attribute in the group views | Position |
| Leagues | Points | Club, played, won, drawn, lost, goals for and against, goal difference, points, squad level | Division tabs |
| Club wages | Wage | Position, name, age, overall, wage, contract years, value | - |
| Latest deals | Newest | Date, player, overall, type, fee | All, your club, big names |
| Free agents | Overall | Position, name, age, overall, wage, value | - |
| News | Newest | - | Kind |

## Not in the prototype, for the port

- Visual theming, club identity, motion and transitions, audio, controller support.
- The 2D match presentation: camera, player animation, ball and crowd.
- Column choice per table, saved filters, and a search box over every player in the world.
