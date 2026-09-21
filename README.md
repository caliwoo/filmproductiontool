# Reelboard

A film/video production management tool inspired by StudioBinder — script breakdown, shot lists, shooting schedule, and call sheets, all tied to a project.

## Features

- **Projects** — create and switch between multiple productions. A new project can also be created directly from a screenplay PDF via "Import from Script" on the projects page: upload it and, in the same dialog used for reviewing detected scenes, the project's name and description are prefilled from the script's own title page (its title, and a "Written by ..." byline when present) — or, if it has none, from the uploaded file's name — before you confirm and the project and its scenes are created together.
- **Script Breakdown** — add scenes (INT/EXT, day/night, location, synopsis) and tag breakdown elements per scene (cast, stunts, extras, props, wardrobe, vehicles, SFX, sound, makeup, animals, notes). Every scene has an editable **script length** in eighths of a page (e.g. "2 3/8 pgs"), the standard AD stripboard unit — it drives the page totals on this page, the PDF breakdown sheet, and the page-per-day cap in Build Shooting Schedule. A scene's location can be created on the spot with the "+" next to its location dropdown, with no need to visit the Locations page first. Each scene's collapsed row shows a **Location** and a **Breakdown** indicator, turning green once a location is picked and once at least one breakdown element is tagged, so you can see readiness across the whole list without opening every scene. Scenes can also be bulk-created by **uploading a screenplay PDF**: the app scans it for scene headings (e.g. `INT. HOUSE - DAY`), splits it into scenes, keeps any scene numbers already in the script, auto-numbers the rest, and estimates each scene's page length from where it actually falls in the PDF (rather than defaulting every scene to 1 page) — you review and edit everything, including the estimated length, before importing. Each scene's captured text is read from the PDF's own glyph positions and classified line-by-line into action, character cue, parenthetical, dialogue, or transition, then rendered read-only in standard screenplay format (the same margins, capitalization, and centering an industry-formatted script uses) instead of a flattened paragraph. An "Edit text" button switches that scene to a plain, freely-editable text field when you need to hand-edit it — doing so drops the per-line formatting for that scene (a re-import restores it).
- **AI Select** — inside a scene, click "AI Select" to have Claude read that scene's heading and text and suggest breakdown elements (cast, props, wardrobe, etc.) it finds. Only tags someone as cast if they're actually physically present and performing in the scene — a character merely referenced indirectly (in a photo, a text message thread, a phone call) is left untagged as cast, with the physical object carrying the reference (the photo, the phone) suggested as a prop instead. Suggestions are shown in a checklist for you to review, edit, and select before anything is added — nothing is tagged automatically. Once tagged, an element is highlighted right in the scene's formatted screenplay text, in that element's tag color, so you can see where it actually appears without cross-referencing the tag list: AI Select elements highlight at the exact excerpt Claude found them at (so a paraphrased breakdown-sheet label like "Colorful Butterfly" still highlights correctly, even though that exact phrase is never literally in the text), and manually-tagged elements highlight wherever their own value appears verbatim. Requires an `ANTHROPIC_API_KEY` (see below); without one, the button shows a clear "not configured" message instead of failing silently.
- **PDF Breakdown Sheet** — every scene has a "PDF Breakdown" button that downloads a printable, industry-style breakdown sheet (breakdown/scene number, INT/EXT, set, day/night, page count, description, location, and a box per element category) generated on the fly from that scene's data.
- **Shot List** — a dedicated "Shot List" page, separate from Script Breakdown, with two tabs. **By Scene** lists every scene in the same order as the breakdown, each row showing a **Shot List** indicator that turns green once the scene has at least one shot; selecting one shows a read-only preview of its screenplay text (formatted, or plain if it wasn't imported from a PDF) alongside that scene's shots — size (including Insert), angle, movement, subject, lens, spatial composition (foreground/midground/background notes), equipment, setup notes (gear/lighting/blocking), and shot/not-shot status. Click "Create Shot List (AI)" to have Claude draft a shot list from the scene's text, following a DP/1st-AD coverage checklist (master shot first, matched coverage for speaking characters, dedicated reaction shots for non-speaking characters, inserts/cutaways for key props or actions, complex camera moves only after that baseline is covered); suggestions appear in an editable checklist and nothing is added until you commit. For a scene with formatted screenplay text, each AI-suggested shot also gets a cut-mark: a small numbered, colored circle inserted exactly where that shot's coverage begins in the preview above — mid-sentence if that's where the shot picks up, the way an AD circles a word by hand on a printed script to mark a new setup — with a legend below the text mapping each circle back to its shot number and description. Every cut-mark, legend entry, and its shot's row in the table are clickable and cross-reference each other — click a circle in the text (or its legend entry) to jump to and briefly highlight that shot's row below, or click the small colored circle next to a shot's number in the table to jump back to its mark in the text. Manually-added shots aren't mapped this way and simply show no mark or table indicator. **Report** compiles every shot across every scene (with its scene number, location, subject, lens, cast, and props) into one plain black-and-white table, viewable in the app and downloadable as a landscape PDF. Toggle "Batch by setup" to reorder it by location, angle, and lens instead of script order, so the 1st AD can call same-setup shots back to back and avoid unnecessary re-lighting or camera moves.
- **Schedule** — organize scenes into shoot days (stripboard-lite), with date, general call time, location, and weather. Each assigned scene shows as a stripboard row — heading + synopsis, **Cast ID#** (a compact number per cast member, assigned in the order they were introduced, instead of full names), editable **Pages** and **Estimation (hours)**, and location. Drag a day up or down by its ⠿ handle to reorder it — day numbers renumber automatically to match the new position. Drag a scene by its own ⠿ handle to reorder it within a day, or drop it on another day to move it there; a translucent label follows the cursor while dragging. These drags happen entirely in the browser; a "Commit Changes" bar appears until you save them (or discard them back to the last-loaded order). Click "Build Shooting Schedule" to auto-generate the whole schedule from your breakdown: groups scenes by location (exteriors first, for a weather buffer), then — among locations tied on that — clusters ones sharing **lead cast** (flagged in Cast & Crew) together so a lead actor's days fall close together instead of spread across the schedule with gaps, orders by complexity (stunts/SFX/vehicles/extras), never mixes DAY and NIGHT scenes in the same day, caps each day at a target page count — charging a half-page "company move" penalty against that cap each time the location changes mid-day, so a second (or third) location can share a day once there's still room under the cap, rather than always forcing a new day at every location change — and puts animal-tagged scenes first within a day. Only scenes that already have at least one tagged breakdown element *and* at least one shot are eligible — a scene that's still just a heading is left out, and the preview lists each skipped scene with the reason (missing breakdown elements, a shot list, or both) so nothing gets scheduled off an unfinished breakdown. Before generating, choose a **workweek length** (5-day, Mon–Fri, or 6-day, Mon–Sat) and, optionally, a **rest-period rule set** (SAG-AFTRA, IATSE Local 80, IATSE Low Budget, IATSE Area Standards, DGA, or CA/NY minor work rules) and a **start date**: with a start date set, each proposed day gets an actual calendar date, automatically skipping weekends (or just Sunday, for a 6-day week); the selected rule's daily and weekly rest-hour requirements are shown as a reminder alongside the preview, since the app doesn't track call/wrap times precisely enough to enforce them itself. Shows a full preview, including which lead cast are on each proposed day, and warns if it will replace an existing schedule — before you apply it.
- **Call Sheets** — auto-generated, printable call sheet per shoot day: scene lineup, cast needed, and individual crew/cast call times. Includes a print/PDF button.
- **Cast & Crew** — editable contact directory (name, role, department, phone, email) shared across the project; edit any field inline, no separate save step. Every cast row shows its **Cast ID** — the same compact number shown on Schedule stripboard rows and call sheets, assigned in the order that character was first introduced. Tagging someone as a `cast` element on a scene (manually or via AI Select) automatically adds them here — the character/role name goes in Role, with Name left blank for the actor's real name once the part is cast. A cast contact can be flagged **Lead**, which Build Shooting Schedule uses to cluster their scenes onto fewer, closer-together shoot days.
- **Locations** — location directory (name, address, notes) used by scenes and shoot days; edit any field inline, no separate save step. A **Scenes** column lists which scene numbers use each location, in script order, so you can see everywhere a location is needed at a glance.

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
