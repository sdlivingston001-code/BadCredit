# BadCredit — Necromunda Campaign Companion

A static-site tool suite for running a **Necromunda Dominion Campaign** with house rules.  
Built with **Jekyll 4** and vanilla JavaScript; hosted on **GitHub Pages**.

---

## Features

| Tool | Page | Description |
|------|------|-------------|
| **Territory Income** | `tools/territory.html` | Resolve territory boons, income, random recruits, and deck-based income with gang-specific overrides. |
| **Lasting Injuries** | `tools/lastingInjuries.html` | Roll D66 / D6 injuries across 5 modes (house rules, core, ironman, Spyrer glitches) plus rogue-doc treatment and Chaos mutations. |
| **Loot Caskets** | `tools/lootCasket.html` | Smash or bypass loot caskets; handles nested sub-tables and card-suit draws. |
| **XP Advancements** | `tools/xpTables.html` | User-choice promotions and 2D6 random advancement rolls with full skill roller. |
| **Post-Battle Sequence** | `tools/post-battle.html` | Guided workflow: succumb, escape, ransom, critical-injury treatment, and a step checklist. |
| **Meat for the Grinder** | `tools/scenario_MeatForTheGrinder.html` | Scavenged weapon roller, weapon-profile tables, fighter skills, and weapon traits for the scenario. |
| **Campaign Viewer** | `tools/campaignViewer.html` | Live read-only viewer for Munda Manager campaigns (fetched via CORS proxy, cached in localStorage). |
| **Icon Dictionary** | `tools/icons.html` | Developer reference grid of all Phosphor icons used in the app. |

---

## Architecture

### Engine / UI separation

Every tool follows a strict **Engine + UI** pattern:

- **Engine** (`*Engine.js`) — Pure logic: dice rolls, table lookups, data transforms. No DOM access.
- **UI** (`*UI.js`) — DOM rendering, event binding, and orchestration. Calls the engine for results.

Shared modules used across tools:

| Module | Purpose |
|--------|---------|
| `dice.js` | Core dice rolling (`d6`, `2d6`, `d66`, card-draw), shared `isInRange()` utility. |
| `timer.js` | Per-page roll timer with 4-deep history, persisted in `localStorage`. |
| `icons.js` | ~31 inline SVG icons (Phosphor Bold); all use `currentColor` for CSS inheritance. |
| `injuryRenderer.js` | Shared result-box rendering for injury/treatment outcomes. |
| `main.js` | Auto-applies `.btn` class to `<button>` elements and wires up collapsible click-to-close. |

### Data flow

```
_data/*.yml  →  Jekyll build  →  data/*.json  →  fetch() at runtime  →  Engine  →  UI
```

YAML data files in `_data/` are compiled to JSON by Jekyll's `jekyll-json` pipeline and served as static files under `data/`. Each tool's `DOMContentLoaded` handler fetches the relevant JSON file(s) and passes data to its engine.

---

## Development

### Prerequisites

- **Ruby** (with Bundler)
- **Jekyll 4.3+** (`gem install jekyll`)

### Local server

```bash
bundle install
bundle exec jekyll serve --livereload
```

The site will be available at `http://localhost:4000/BadCredit/`.

### Project structure

```
_config.yml              Jekyll configuration (baseurl, collections, plugins)
_layouts/default.html    Master HTML layout (head, body wrapper, bottom-bar)
_includes/bottom-bar.html  Sticky icon navigation bar
_data/                   YAML source data (territories, injuries, loot, etc.)
_pages/                  Markdown content pages (advancements, pre-battle)
assets/
  css/style.css          Master stylesheet (22 numbered sections)
  js/                    All JavaScript modules (engine/UI pairs + shared)
data/                    Build output: compiled JSON from _data/
tools/                   Tool HTML pages (one per feature)
index.md                 Landing page with links to all tools
```

### Cache-busting

All `<script>` and `<link>` tags in the layout append `?v={{ site.time | date: '%s' }}` so browsers always fetch the latest assets after a deploy.

---

## Tech Stack

- **Jekyll 4.3** — Static site generator
- **Vanilla JavaScript (ES6+)** — No frameworks or build tools
- **GitHub Pages** — Hosting and deployment
- **Phosphor Icons** — Inline SVG icon set
- **Munda Manager API** — External campaign data (Campaign Viewer only)
