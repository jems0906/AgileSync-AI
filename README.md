# AgileSync AI

AgileSync AI is a full-stack web app for Agile teams to manage sprint planning, backlog refinement, meeting notes, and action items with AI support.

## Status

[![Smoke CI](https://github.com/jems0906/AgileSync-AI/actions/workflows/smoke-ci.yml/badge.svg?branch=main)](https://github.com/jems0906/AgileSync-AI/actions/workflows/smoke-ci.yml)
[![Pages Health Check](https://github.com/jems0906/AgileSync-AI/actions/workflows/pages-health-check.yml/badge.svg?branch=main)](https://github.com/jems0906/AgileSync-AI/actions/workflows/pages-health-check.yml)

## Features

- Agile artifacts: epics, user stories, tasks, sprint board
- AI assist: story drafts, acceptance criteria, sprint summaries, retrospective notes, standup summaries
- Backlog prioritization recommendations
- Sprint progress dashboard
- Role-based views (PM, BA, Scrum Master, Developer)
- Team comments and status tracking
- Meeting notes upload and AI extraction for requirements, risks, dependencies
- Jira-like workflow states (`backlog`, `selected`, `in-progress`, `review`, `done`)

## Tech Stack

- Frontend: React + Vite client (`client/`), with production assets served by Express from `client/dist`
- Backend: Node.js + Express
- Data: PostgreSQL-ready schema with in-memory fallback
- AI: OpenAI API
- Optional: Docker Compose for Postgres

## Quick Start

1. Install dependencies:

```bash
npm install
npm install --prefix server
npm install --prefix client
```

2. Copy env template:

```bash
copy .env.example .env
copy .env.example server/.env
copy .env.example client/.env
```

3. (Optional) Start Postgres:

```bash
docker compose up -d postgres
```

4. Run app:

```bash
npm run dev
```

- App: http://localhost:5173
- API: http://localhost:4000/api

5. Create a production build when you want Express to serve the client:

```bash
npm run build
npm start
```

- Production app: http://localhost:4000

## Smoke Test

Run the API smoke test (creates, updates, and deletes temporary artifacts, then verifies cascade cleanup):

```bash
npm run smoke:api
```

Optional server-level invocation with custom API base:

```bash
npm run smoke:api --prefix server -- -ApiBase http://localhost:4001/api
```

Run the client smoke test (repairs missing Vite toolchain if needed, builds the React app, serves it on `127.0.0.1:5173`, and validates page/API availability):

```bash
npm run smoke:client
```

If you only need a resilient client build:

```bash
npm run build:reliable --prefix client
```

## Client Reliability Notes (Windows)

- `build:reliable` stages native Rollup and esbuild binaries under `%LOCALAPPDATA%` and then runs Vite through Node. This avoids common `EPERM`/`Access is denied` failures when native binaries are blocked inside workspace paths.
- `smoke:client` runs toolchain repair first, then build + dev-server checks.
- If native dependency files become inconsistent after interrupted installs, rerun:

```bash
npm run smoke:client
```

This command is the canonical recovery path for the client toolchain in this project.

## Continuous Integration

GitHub Actions now runs smoke validation on every push and pull request using [smoke-ci.yml](.github/workflows/smoke-ci.yml):

- Starts the API server on a Windows runner.
- Waits for `/api/health` readiness.
- Runs API smoke (`npm run smoke:api`).
- Runs client smoke (`npm run smoke:client`).

Additional production monitoring runs via [pages-health-check.yml](.github/workflows/pages-health-check.yml):

- Calls `https://agilesync-ai.pages.dev/api/health`
- Fails if `ok` is not `true`
- Fails if `persistence` is not `d1`

## Deploy To Render

This repo includes a Render Blueprint file at [render.yaml](render.yaml).

1. Push this repository to GitHub.
2. In Render, choose **New +** -> **Blueprint**.
3. Select this GitHub repository and apply the Blueprint.
4. In Render service settings, set these env vars:
	- `CORS_ORIGIN`: your Render app URL (for example `https://agilesync-ai.onrender.com`)
	- `OPENAI_API_KEY`: optional, enables real AI output
	- `DATABASE_URL`: optional, app runs with in-memory fallback if omitted
5. Deploy and verify health:
	- `GET /api/health`

Build/start commands used by Render:

- Build: `npm install --prefix server && npm install --prefix client && npm run build --prefix client`
- Start: `npm run start --prefix server`

## Deploy To Cloudflare

Cloudflare deployment is configured in `client/` using Pages + Functions:

- Static app: React build output (`client/dist`)
- API routes: `client/functions/api/[[path]].js` (same `/api/*` contract used by the UI)

Steps:

1. In Cloudflare Dashboard, go to **Workers & Pages** -> **Create** -> **Pages**.
2. Connect this GitHub repository.
3. Use these build settings:
	- Root directory: `client`
	- Build command: `npm install && npm run build`
	- Build output directory: `dist`
4. Add environment variables for Pages Functions:
	- `OPENAI_API_KEY` (optional)
	- `OPENAI_MODEL` (optional, default `gpt-4.1-mini`)
	- `CORS_ORIGIN` (optional, defaults to `*`)
	- Set values separately for `Production` and `Preview` as needed
5. Create and bind a D1 database so artifact data persists across restarts:
	- Create DB: `npx wrangler d1 create agilesync-ai-db`
	- In Cloudflare Pages project settings, add D1 binding:
	  - Variable name: `DB`
	  - D1 database: `agilesync-ai-db`
	- Run migration once from your machine (inside `client/`): `npx wrangler d1 migrations apply agilesync-ai-db --cwd client`
6. Deploy and verify:
	- `GET /api/health`

Recommended production values:

- `CORS_ORIGIN`: `https://agilesync-ai.pages.dev` (or your custom domain)
- `OPENAI_MODEL`: `gpt-4.1-mini` (or your preferred model)
- `OPENAI_API_KEY`: set in `Production` only unless preview AI output is required

Notes for Cloudflare runtime:

- Pages Functions run on the Workers runtime.
- With `DB` binding configured, API state persists in D1.
- Without `DB`, the app automatically falls back to in-memory state.

## Release Notes

- Current release: [CHANGELOG.md](CHANGELOG.md)
- Latest version entry: `1.0.0 - 2026-06-02`

## API Overview

- `GET /api/artifacts` - fetch epics, stories, tasks, sprints
- `POST /api/epics`, `POST /api/stories`, `POST /api/tasks`, `POST /api/comments`
- `PATCH /api/tasks/:id/status` - workflow transition
- `GET /api/dashboard` - sprint and backlog metrics
- `GET /api/backlog/prioritized` - AI-like prioritization score ordering
- `POST /api/ai/story-draft`
- `POST /api/ai/acceptance-criteria`
- `POST /api/ai/sprint-summary`
- `POST /api/ai/retro-notes`
- `POST /api/ai/meeting-action-items`
- `POST /api/ai/standup-summary`
- `POST /api/ai/meeting-notes-to-work`

## Roles

Send role via request header `x-role` with one of:

- `PM`
- `BA`
- `SCRUM_MASTER`
- `DEVELOPER`

## Notes

- Without `DATABASE_URL`, server runs in-memory mode so you can demo instantly.
- Add `OPENAI_API_KEY` to enable real model outputs; otherwise deterministic fallback responses are returned.
- During development, Vite serves the React app on `5173` and proxies `/api` to Express on `4000`.
- For production-style local runs, build the client first so Express can serve `client/dist`.
