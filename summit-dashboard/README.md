# Snowflake Summit 2026 Agenda Dashboard

A personalized agenda builder for Snowflake Summit 2026 (June 1-4, Moscone Center, San Francisco). Browse 378 sessions across all 4 days, filter by track/format/day, get AI-powered recommendations based on your persona, and export your agenda as CSV, Markdown, or PDF.

Session data is scraped from the live [RainFocus session catalog](https://reg.snowflake.com/flow/snowflake/summit26/sessions/page/catalog) and enriched with speaker details from the [speakers catalog](https://reg.snowflake.com/flow/snowflake/summit26/speakers/page/catalog).

## Features

- **Persona-based recommendations** — Select your role (Data Engineer, Architect, Developer, etc.) and get sessions ranked by relevance
- **Interest tags** — Boost sessions matching topics you care about (AI, Cortex, Iceberg, dbt, etc.)
- **Filters** — Narrow by track, format (Breakout, Theater, Hands-on Lab, Keynote, Training, Executive Content, Dev Day Luminary Talk), day, and level
- **Full-text search** — Search across titles, speakers, descriptions, companies, and tags
- **Agenda builder** — Add sessions to your personal agenda with time-conflict detection
- **Catalog links** — Every session links directly to the live RainFocus session page
- **Export** — Download your agenda as CSV, Markdown, or PDF
- **Tim Spann featured** — Tim Spann's sessions are auto-added and pinned to the top

## Tech Stack

- **React 19** + **Vite 8** — Frontend framework and build tool
- **Tailwind CSS 4** — Utility-first styling
- **PapaParse** — CSV parsing
- **Lucide React** — Icons
- **Playwright** — Browser automation for scraping the RainFocus SPA
- **Vitest** — Test runner

## Project Structure

```
agenda/
├── manage.sh                  # Management script (start/stop/build/test/scrape/backup)
├── summit_sessions.csv        # Generated session data (378 sessions, 16 columns)
├── build_csv_v3.mjs           # CSV builder: merges DOM + API + type data
├── scrape_alldays_showmore.mjs # Scrapes all sessions across all 4 day tabs
├── scrape_speakers3.mjs       # Scrapes speaker names, titles, companies
├── scrape_types_all.mjs       # Scrapes session types via catalog filters
├── scrape_api_full.mjs        # Captures API responses for room/time enrichment
├── .gitignore
├── summit-dashboard/
│   ├── src/
│   │   ├── App.jsx                        # Main app: data loading, filtering, routing
│   │   ├── components/
│   │   │   ├── AgendaBuilder.jsx          # Sidebar: agenda list, conflict detection, export menu
│   │   │   ├── ExportAgenda.jsx           # Markdown and PDF export functions
│   │   │   ├── PersonaSelector.jsx        # Persona picker + interest tag toggles
│   │   │   ├── RecommendationEngine.js    # Scoring: persona affinity, tags, Tim Spann boost
│   │   │   ├── SessionCard.jsx            # Session display card with metadata and catalog link
│   │   │   └── TrackFilter.jsx            # Dropdown filters for track/format/day/level
│   │   ├── index.css
│   │   └── main.jsx
│   ├── public/
│   │   ├── summit_sessions.csv            # Copy of CSV served by Vite
│   │   ├── favicon.svg
│   │   └── icons.svg
│   ├── tests/
│   │   ├── RecommendationEngine.test.js
│   │   ├── ExportAgenda.test.js
│   │   └── SessionCard.test.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
```

## Quick Start

```bash
# Install dependencies
./manage.sh install

# Start development server
./manage.sh dev

# Run tests
./manage.sh test

# Production build
./manage.sh build
```

## Management Script

All operations are handled through `manage.sh`:

| Command | Description |
|---------|-------------|
| `./manage.sh install` | Install npm dependencies and Playwright browser |
| `./manage.sh dev` | Start Vite dev server with hot reload |
| `./manage.sh stop` | Stop the running dev server |
| `./manage.sh build` | Create production build in `summit-dashboard/dist/` |
| `./manage.sh test` | Run the Vitest test suite |
| `./manage.sh scrape` | Re-scrape sessions, speakers, and types from live catalog |
| `./manage.sh refresh` | Scrape + rebuild (full data refresh) |
| `./manage.sh backup` | Create timestamped `.tar.gz` archive |
| `./manage.sh list` | Show session stats (counts by format, day, track) |

## Data Pipeline

The scraping pipeline extracts real session data from the RainFocus SPA:

1. **`scrape_alldays_showmore.mjs`** — Opens the session catalog in headless Chromium, clicks each day tab (Mon/Tue/Wed/Thu), clicks "Show more" to load all sessions per day, and extracts codes, titles, descriptions, speakers, days, and times for all 378 sessions
2. **`scrape_speakers3.mjs`** — Scrapes the speakers catalog for 510+ speaker names with titles and companies
3. **`scrape_types_all.mjs`** — Clicks each Session Type filter checkbox (Breakout, Theater, Hands-on Lab, Keynote, Executive Content, Dev Day Luminary Talk, Training) to categorize all sessions by type and duration
4. **`scrape_api_full.mjs`** — Intercepts RainFocus API responses to capture room assignments and properly formatted times for sessions with API coverage
5. **`build_csv_v3.mjs`** — Merges DOM-scraped data, API data, and type filter data into `summit_sessions.csv` with 16 columns: session_id, title, description, speakers, speaker_company, speaker_title, track, format, day, time, duration_min, room, level, tags, persona_fit, catalog_url

## Recommendation Engine

Sessions are scored and ranked based on:

| Factor | Points | Description |
|--------|--------|-------------|
| Tim Spann boost | +100 | His sessions are always pinned first |
| Persona-track affinity | 0-30 | How relevant the track is to your role |
| Persona fit match | +20 | Whether the session targets your persona |
| Interest-tag overlap | +10 each | Matches between your interests and session tags |
| Format bonus | +3/+5 | Small bonus for Hands-on Labs and Keynotes |

## Testing

```bash
./manage.sh test
```

Tests cover:
- Recommendation engine scoring and ranking
- Tim Spann priority guarantee
- Persona-track affinity calculations
- Interest-tag matching
- Export function output (Markdown structure, HTML escaping)
- Format color mapping regression

## License

This project is for personal/educational use for Snowflake Summit 2026 attendees.
