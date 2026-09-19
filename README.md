# Reelboard

A film/video production management tool inspired by StudioBinder — script breakdown, shot lists, shooting schedule, and call sheets, all tied to a project.

## Features

- **Projects** — create and switch between multiple productions.
- **Script Breakdown** — add scenes (INT/EXT, day/night, location, synopsis) and tag breakdown elements per scene (cast, stunts, extras, props, wardrobe, vehicles, SFX, sound, makeup, animals, notes). Every scene has an editable **script length** in eighths of a page (e.g. "2 3/8 pgs"), the standard AD stripboard unit — it drives the page totals on this page, the PDF breakdown sheet, and the page-per-day cap in Build Shooting Schedule. A scene's location can be created on the spot with the "+" next to its location dropdown, with no need to visit the Locations page first. Scenes can also be bulk-created by **uploading a screenplay PDF**: the app scans it for scene headings (e.g. `INT. HOUSE - DAY`), splits it into scenes, keeps any scene numbers already in the script, auto-numbers the rest, and estimates each scene's page length from where it actually falls in the PDF (rather than defaulting every scene to 1 page) — you review and edit everything, including the estimated length, before importing.
- **AI Select** — inside a scene, click "AI Select" to have Claude read that scene's heading and text and suggest breakdown elements (cast, props, wardrobe, etc.) it finds. Suggestions are shown in a checklist for you to review, edit, and select before anything is added — nothing is tagged automatically. Requires an `ANTHROPIC_API_KEY` (see below); without one, the button shows a clear "not configured" message instead of failing silently.
- **PDF Breakdown Sheet** — every scene has a "PDF Breakdown" button that downloads a printable, industry-style breakdown sheet (breakdown/scene number, INT/EXT, set, day/night, page count, description, location, and a box per element category) generated on the fly from that scene's data.
- **Shot List** — per-scene shots with size (including Insert), angle, movement, subject, lens, spatial composition (foreground/midground/background notes), equipment, setup notes (gear/lighting/blocking), and shot/not-shot status. Click "AI Suggest Shots" to have Claude draft a shot list from the scene's text, following a DP/1st-AD coverage checklist (master shot first, matched coverage for speaking characters, dedicated reaction shots for non-speaking characters, inserts/cutaways for key props or actions, complex camera moves only after that baseline is covered); suggestions appear in an editable checklist and nothing is added until you commit.
- **Shot List Report** — a project-wide "Shot List" page compiles every shot across every scene (with its scene number, location, subject, lens, cast, and props) into one plain black-and-white table, viewable in the app and downloadable as a landscape PDF. Toggle "Batch by setup" to reorder it by location, angle, and lens instead of script order, so the 1st AD can call same-setup shots back to back and avoid unnecessary re-lighting or camera moves.
- **Schedule** — organize scenes into shoot days (stripboard-lite), with date, general call time, location, and weather. Click "Build Shooting Schedule" to auto-generate the whole schedule from your breakdown: groups scenes by location (exteriors first, for a weather buffer), then — among locations tied on that — clusters ones sharing **lead cast** (flagged in Cast & Crew) together so a lead actor's days fall close together instead of spread across the schedule with gaps, orders by complexity (stunts/SFX/vehicles/extras), never mixes two locations or DAY and NIGHT scenes in the same day, caps each day at a target page count, and puts animal-tagged scenes first within a day. Only scenes that already have at least one tagged breakdown element *and* at least one shot are eligible — a scene that's still just a heading is left out, and the preview lists each skipped scene with the reason (missing breakdown elements, a shot list, or both) so nothing gets scheduled off an unfinished breakdown. Shows a full preview, including which lead cast are on each proposed day, and warns if it will replace an existing schedule — before you apply it.
- **Call Sheets** — auto-generated, printable call sheet per shoot day: scene lineup, cast needed, and individual crew/cast call times. Includes a print/PDF button.
- **Cast & Crew** — editable contact directory (name, role, department, phone, email) shared across the project; edit any field inline, no separate save step. Tagging someone as a `cast` element on a scene (manually or via AI Select) automatically adds them here — the character/role name goes in Role, with Name left blank for the actor's real name once the part is cast. A cast contact can be flagged **Lead**, which Build Shooting Schedule uses to cluster their scenes onto fewer, closer-together shoot days.
- **Locations** — location directory (name, address, notes) used by scenes and shoot days.

## Tech Stack

- **Backend**: Node.js / Express, SQLite (via `better-sqlite3`)
- **Frontend**: React + React Router, built with Vite
- **Deploy**: single Node process serves the built frontend and the API (Railway-ready)

## Local Setup

```bash
# Install dependencies (root + workspaces)
npm install

# Run backend (port 4000) and frontend dev server (port 5173) together
npm run dev
```

Visit `http://localhost:5173` (the Vite dev server proxies `/api` to the backend on port 4000).

### Production build

```bash
npm run build   # builds the React client into client/dist
npm start       # runs the Express server, which serves client/dist and the API on one port
```

Visit `http://localhost:4000`.

## Data storage

Data is stored in a local SQLite file at `server/data/filmprod.sqlite`. Set the `DATABASE_PATH` environment variable to change its location — on Railway, point it at a mounted [volume](https://docs.railway.app/reference/volumes) so data survives redeploys, e.g. `DATABASE_PATH=/data/filmprod.sqlite`.

## Environment Variables

- `PORT` — server port (default: `4000`)
- `DATABASE_PATH` — path to the SQLite database file (default: `server/data/filmprod.sqlite`)
- `ANTHROPIC_API_KEY` — enables the "AI Select" breakdown-element suggestions and "AI Suggest Shots" shot list suggestions. Get a key at [console.anthropic.com](https://console.anthropic.com). Without it, both features show a "not configured" message instead of erroring.
- `ANTHROPIC_MODEL` — Claude model used for AI Select and AI Suggest Shots (default: `claude-opus-5`)

## Project Structure

```
server/       Express API + SQLite schema (server/src)
client/       React app (client/src), built with Vite
railway.json  Railway build/deploy config
```

## API Overview

All endpoints are under `/api`:

- `projects` — CRUD; `projects/:id/shot-list` returns the project's shots joined with scene/location/cast/props data; `projects/:id/shot-list-pdf` downloads it as a landscape PDF
- `locations`, `contacts` — CRUD, filterable by `?projectId=`
- `scenes` — CRUD, filterable by `?projectId=`; nested `scenes/:id/elements` for breakdown tags (`scenes/:id/elements/bulk` for a batch add); `scenes/:id/ai-tag` proposes breakdown elements via Claude (does not save them); `scenes/:id/breakdown-pdf` downloads a printable breakdown sheet; `scenes/reorder`
- `scripts/parse` — upload a PDF (`multipart/form-data`, field `script`) and get back detected scenes for review; `scripts/import` — commit a reviewed scene list to a project
- `shots` — CRUD, filterable by `?sceneId=`; `shots/bulk` for a batch add; `shots/reorder`
- `scenes/:id/ai-shots` proposes a shot list for the scene via Claude (does not save them)
- `shoot-days` — CRUD, filterable by `?projectId=`
  - `shoot-days/:id/scenes` — assign/unassign/reorder scenes for a shoot day
  - `shoot-days/:id/calls` — set per-contact call times for a shoot day
  - `shoot-days/:id/call-sheet` — aggregated, ready-to-render call sheet data
- `projects/:id/build-schedule/preview` — proposes a full shooting schedule from the project's scenes (does not save); `projects/:id/build-schedule/commit` — replaces the project's schedule with a reviewed proposal

## Deploying to Railway

Connect this repo to a Railway service. `railway.json` runs `npm install && npm run build` on build and `npm start` on deploy. Add a volume and set `DATABASE_PATH` to a path inside it so production data persists across deploys.
