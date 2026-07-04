# GitHub Analytics System Documentation

This document describes the design, implementation, and maintenance of the local, self-hosted GitHub Profile Analytics generator.

---

## Architecture

The system is decoupled into two primary components to ensure high performance, easy offline testing, and low rate-limit consumption:

```
[GitHub API] 
     │ (Octokit GraphQL & REST)
     ▼
┌───────────┐
│  fetch.ts │  ◄── [Runs daily or weekly rebuild]
└─────┬─────┘
      │
      ▼
┌──────────────────────┐
│ cache/analytics.json │  ◄── [Flat-file JSON database]
└─────┬────────────────┘
      │
      ▼
┌──────────────┐
│ generate.ts  │  ◄── [Runs coordinate validation & hashing check]
└─────┬────────┘
      ├───────────────────────┬──────────────────────────┐
      ▼                       ▼                          ▼
┌──────────────┐      ┌──────────────┐           ┌──────────────┐
│generateStats │      │generateStreak│           │generateLangs │ ...
└──────────────┘      └──────────────┘           └──────────────┘
```

1. **The Harvester (`fetch.ts`)**: Fetches raw data from the GitHub API using Octokit and stores a structured daily snapshot inside `cache/analytics.json`.
2. **The Generator (`generate.ts` and card scripts)**: Reads data from the local JSON database, generates SVG vectors using a shared `SVGRenderer` layout and widget engine, validates syntax/dimensions, and commits files if their hashes differ.

---

## Folder Structure

```
├── .github/
│   └── workflows/
│       └── update-profile.yml      # GitHub Actions automation script
├── assets/                         # Output destination for generated SVGs
│   ├── custom-stats.svg
│   ├── custom-streak.svg
│   ├── custom-languages.svg
│   ├── custom-contributions.svg
│   └── custom-activity.svg
├── cache/
│   └── analytics.json              # Local intermediate database (cached metrics)
├── docs/
│   └── github-analytics.md         # System operations manual (this file)
├── scripts/
│   ├── fetch.ts                    # HARVESTER: Fetches data via API
│   ├── generate.ts                 # ORCHESTRATOR: Coordinates rendering
│   ├── generateStats.ts            # Stats card generator
│   ├── generateStreak.ts           # Streak card generator
│   ├── generateLanguages.ts        # Top languages card generator
│   ├── generateContributions.ts    # 53-week contribution grid card generator
│   ├── generateActivity.ts         # Productive hour distribution card generator
│   ├── theme.ts                    # Design configuration & color palette
│   ├── renderer.ts                 # Component-driven SVG layout & drawing engine
│   └── utils.ts                    # Helper string, date, and hashing utilities
├── package.json                    # Node dependencies and scripts
└── tsconfig.json                   # TypeScript compiler configuration
```

---

## Workflow Lifecycle

1. **Trigger**:
   - Every day at 00:00 UTC (cron scheduled update)
   - Every Sunday at 01:00 UTC (cron scheduled full clean rebuild)
   - Manually via `workflow_dispatch` in Actions tab (with optional "rebuild" checkbox)
2. **Setup**: The environment checkouts main, setups Node, installs dependencies via `npm ci`.
3. **Data Harvest**: Runs `npm run fetch`. Pulls profile stats, repositories, languages, 365-day contribution calendar, and public push events. Saves merged state into `cache/analytics.json`.
4. **SVG Compilation**: Runs `npm run generate`. Compiles in-memory SVGs, validates tags balance (XML) and target canvas dimensions.
5. **Deduplication**: Computes SHA-256 hashes of new SVGs and compares them to existing ones. Overwrites only changed files.
6. **Commit**: Commits and pushes modifications to `assets/` and `cache/analytics.json` back to main. Commits are skipped if no changes exist.

---

## GitHub API Endpoints & Rate Limits

* **GraphQL Endpoint**: `https://api.github.com/graphql`
  - Used to query detailed profile data, languages, repo counts, and contributions.
  - Cost is calculated in query complexity points. A single query uses about 1-2 points.
  - GraphQL rate limits: 5,000 points per hour for authenticated requests.
* **REST Search API**: `https://api.github.com/search/commits?q=author:{user}`
  - Used to find all-time commit counts.
  - REST Search rate limits: 30 requests per minute. Since we only call it once per run, we are well below limits.
* **REST Event API**: `https://api.github.com/users/{user}/events/public`
  - Used to fetch recent user activity history to approximate hour-of-day distribution.
  - Standard REST rate limits: 5,000 requests per hour.

---

## Caching Strategy

The file `cache/analytics.json` acts as our persistent state between workflow runs.
- **Contributions caching**: The GraphQL calendar only returns the past 1 year of data. To keep track of streaks spanning multiple years or calculate historic longest streaks, `fetch.ts` loads the existing cache database, harvests the current year, and merges it. This acts as a rolling ledger, compiling an all-time calendar over multiple years.
- **Weekly full rebuild**: Passing the `--rebuild` flag ignores the local cache database and rebuilds calendar structures freshly from the active GitHub calendar records (e.g. to reconcile force-pushes or deleted repositories).

---

## Theme Customization

Themes are controlled in `scripts/theme.ts`. To customize the appearance, edit the values in the `theme` object:

```typescript
export const theme: Theme = {
  bg: "#0d1117",      // Card background color
  border: "#30363d",  // Card border color
  accent: "#58a6ff",  // Main titles, bold text, highlighted stats (User's accent)
  text: "#c9d1d9",    // Regular description text
  textMuted: "#8b949e",
  ...
}
```

Typography uses clean, system-level font-stacks in `scripts/renderer.ts` to ensure compatibility under GitHub's Camo caching mechanism:
- **Sans-serif (Regular Text)**: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`
- **Monospace (Numerical Values / Calendars)**: `"JetBrains Mono", SFMono-Regular, Consolas, monospace`

---

## Streak Algorithm

1. **Daily Normalization**: Converts contribution calendar dates into a local timezone index `YYYY-MM-DD` using `TIMEZONE_OFFSET`.
2. **Consecutive Evaluation**:
   - Dates are sorted. We parse consecutive days by converting them to UTC midnights and checking if `(date2.time - date1.time) / 86400000 === 1`. This naturally handles leap years and hour anomalies.
3. **Current Streak**:
   - If user has contributions today or yesterday (local timezone), we count backward day-by-day.
   - If neither today nor yesterday is active, current streak is `0`.
4. **Longest Streak**:
   - Tracks the maximum consecutive active window achieved across all historical data found in the `contributions` cache record.

---

## Contribution Calculations

* **Language percentages**:
  $$\text{Percentage} = \frac{\text{Sum of language bytes across all owned repositories}}{\text{Total language bytes across all owned repositories}} \times 100$$
  *Forks and archived repositories are ignored.*
* **Productive hour**:
  - Push events are scanned. We parse the `created_at` timestamp, convert to user timezone offset, extract the hour integer (0-23), and count the commits.
  - Represents a weighted distribution of local active hours.

---

## Maintenance Guide

### How to test layout changes locally
1. Edit code inside `scripts/renderer.ts` or individual generators.
2. Run `npm run generate`.
3. Open the output files in `assets/` in a web browser to verify rendering and sizing.
4. Run `npm run generate -- --dry-run` to test validation rules without overwriting production assets.

### Rebuilding cache database
If you need to force-rebuild statistics from scratch:
```bash
npm run fetch -- --rebuild
npm run generate
```
This drops the cached daily contributions list and pulls fresh calendar snapshots.
