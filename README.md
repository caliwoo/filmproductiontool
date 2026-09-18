# Reelboard

A film/video production management tool inspired by StudioBinder — script breakdown, shot lists, shooting schedule, and call sheets, all tied to a project.

## Features

- **Projects** — create and switch between multiple productions.
- **Script Breakdown** — add scenes (INT/EXT, day/night, location, synopsis) and tag breakdown elements per scene (cast, props, wardrobe, vehicles, SFX, sound, makeup, animals, extras, notes).
- **Shot List** — per-scene shots with size, angle, movement, equipment, and shot/not-shot status.
- **Schedule** — organize scenes into shoot days (stripboard-lite), with date, general call time, location, and weather.
- **Call Sheets** — auto-generated, printable call sheet per shoot day: scene lineup, cast needed, and individual crew/cast call times. Includes a print/PDF button.
- **Cast & Crew** — contact directory (name, role, department, phone, email) shared across the project.
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

## Project Structure

```
server/       Express API + SQLite schema (server/src)
client/       React app (client/src), built with Vite
railway.json  Railway build/deploy config
```

## API Overview

All endpoints are under `/api`:

- `projects` — CRUD
- `locations`, `contacts` — CRUD, filterable by `?projectId=`
- `scenes` — CRUD, filterable by `?projectId=`; nested `scenes/:id/elements` for breakdown tags; `scenes/reorder`
- `shots` — CRUD, filterable by `?sceneId=`; `shots/reorder`
- `shoot-days` — CRUD, filterable by `?projectId=`
  - `shoot-days/:id/scenes` — assign/unassign/reorder scenes for a shoot day
  - `shoot-days/:id/calls` — set per-contact call times for a shoot day
  - `shoot-days/:id/call-sheet` — aggregated, ready-to-render call sheet data

## Deploying to Railway

Connect this repo to a Railway service. `railway.json` runs `npm install && npm run build` on build and `npm start` on deploy. Add a volume and set `DATABASE_PATH` to a path inside it so production data persists across deploys.
