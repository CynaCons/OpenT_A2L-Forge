# Copilot Instructions — OpenT_A2L-Forge

## Big picture
- Desktop app: React + TypeScript frontend (Vite) and Rust backend via Tauri.
- Frontend → backend communication uses Tauri commands invoked from `@tauri-apps/api/core` (see [src/App.tsx](../src/App.tsx) and [src-tauri/src/lib.rs](../src-tauri/src/lib.rs)).
- Tauri config + window metadata live in [src-tauri/tauri.conf.json](../src-tauri/tauri.conf.json).

## Collaboration expectations
- The user is the Product Owner and provides product direction, feedback, and priorities.
- The AI agent must interpret requirements, ask clarifying questions only when necessary, and deliver a professional, production-grade implementation.
- Prefer industry-standard behavior and UX patterns without requiring the Product Owner to specify every minor detail.
- Avoid overly minimal solutions; aim for complete, mature functionality aligned with the Product Owner's intent.
- Proactively identify gaps, edge cases, and usability concerns, and address them or call them out with focused questions.

## Key workflows
- Frontend dev server (fixed port 1420): `npm run dev` (see [vite.config.ts](../vite.config.ts)).
- Tauri desktop dev: `npm run tauri dev` (uses `npm run dev` as `beforeDevCommand`).
- E2E tests: `npm run e2e` (Playwright runs against `http://127.0.0.1:1420`) — see [playwright.config.ts](../playwright.config.ts).

## Project-specific conventions
- Port 1420 is fixed for the dev server; do not change without updating Tauri + Playwright configs.
- Keep Vite `strictPort: true` to align with Tauri expectations.
- Tauri commands are registered in [src-tauri/src/lib.rs](../src-tauri/src/lib.rs) and invoked from the UI.

## External dependencies / submodules
- `external/a2lfile`, `external/a2ltool`, `external/PowerSpawn` are git submodules.
- Treat submodules as read-only unless explicitly asked to modify or update them.
- Test fixtures for A2L/ELF exist in `external/a2ltool/fixtures`.

## Examples of current patterns
- Example Tauri command: `greet` in [src-tauri/src/lib.rs](../src-tauri/src/lib.rs).
- Example UI invoke: `invoke("greet", { name })` in [src/App.tsx](../src/App.tsx).
- Example E2E test: [tests/e2e/smoke.spec.ts](../tests/e2e/smoke.spec.ts).
