# Changelog

## 1.0.0 - 2026-06-02

### Added

- Full Agile workspace across epics, stories, tasks, sprint workflow board, and backlog prioritization.
- AI endpoints and UI actions for story drafts, acceptance criteria, sprint summaries, retrospective notes, meeting action items, and standup summaries.
- Meeting notes upload flow that converts notes to requirements, tasks, risks, and dependencies.
- Role-aware workflow support for PM, BA, Scrum Master, and Developer.
- Collaboration comments with role attribution and status tracking.
- PostgreSQL schema and initialization with in-memory fallback mode for zero-config local runs.
- Docker Compose setup for local PostgreSQL.
- Windows-safe client reliability scripts for resilient Vite and native dependency handling.
- Smoke test automation for API and client paths.
- GitHub Actions smoke workflow on push and pull request.

### Changed

- React client now uses active Tailwind utility classes in key layout surfaces while preserving existing visual styling.
- Client build and smoke flow now route through a reliability-first toolchain bootstrap process.

### Validation

- Client reliable build passes: npm run build:reliable --prefix client.
- Client smoke passes end-to-end: npm run smoke:client.
- API smoke passes cascade and status checks: npm run smoke:api.
