# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

mintara is a web tool for validating API response parity during migrations (primary use case: PHP 5 → PHP 8). It fires the same request at 2+ target APIs in parallel, deep-diffs the JSON responses, and lets the user export/report the results. See README.md for the full feature list and API contract.

## Commands

```bash
npm install          # install all workspaces (root, shared, server, client)
npm start             # run server (tsx watch, :3001) + client (vite, :5174) concurrently
npm test              # run tests in every workspace that has them (shared, server, client all use vitest)

npm run dev --workspace=server     # server only
npm run dev --workspace=client     # client only
npm run test --workspace=shared    # test a single workspace
npm run build --workspace=client   # tsc + vite build for production
NODE_ENV=production npm start --workspace=server
```

Run a single test file with vitest directly, e.g. `npx vitest run shared/src/__tests__/compare.test.ts` or `cd client && npx vitest run src/lib/curl.test.ts`.

There is no lint script configured; TypeScript's `strict` mode (via `tsconfig.base.json`) is the main static check — `tsc` runs as part of `client`'s `build` script.

## Architecture

npm workspaces monorepo: `shared` → `server` and `client` both depend on it via `@mintara/shared` (aliased to source, not built output — see `client/vite.config.ts` resolve alias and server's direct TS import).

- **`shared/src/`** — pure TypeScript, no runtime deps. `types.ts` defines the wire contracts (`CompareRequest`, `CompareResult`, `BulkRequestItem`, `FileFindRequest`, etc.) shared verbatim between client and server. `normalize.ts` strips ignored fields and optionally sorts arrays before diffing. `compare.ts` is an iterative (non-recursive, stack-based) structural diff producing a flat `DiffNode[]`. Normalize before comparing — `compare()` does not normalize itself.

- **`server/src/`** — Express proxy, three route modules mounted under `/api`:
  - `routes/compare.ts` — `POST /api/compare`. Fires requests to each target **sequentially** (not parallel — a 300ms delay is inserted between targets, deliberately, to avoid overwhelming shared backend DB connection pools during migration testing), then normalizes + diffs the first two targets' bodies for `hasChanges`. `GET /api/health` also lives here.
  - `routes/files.ts` — `POST /api/files/find`. Given `originalRoot`/`modifiedRoot` directory paths and a list of filenames, walks both trees (skipping `.git`, `node_modules`, `vendor`, `graphify-out`) and returns matching file contents, used by the Diff Checker page to locate files by name across two codebases. Has hard caps: 5MB/file, 50k files/root walk, 20 matches/filename/root.
  - `routes/summarize.ts` — `POST /api/summarize`. Optional AI summary of a comparison result via Ollama's cloud API (`OLLAMA_API_KEY` required; 503s cleanly if unset). Three modes: `single`, `bulk-item`, `bulk-aggregate`, each building a different prompt. Response is hard-capped to 2 sentences / 250 chars server-side regardless of what the model returns.

- **`client/src/`** — Vite + React 18 + Zustand SPA.
  - `store.ts` is the single source of truth (one large Zustand store, not split into slices). Only `savedCases` and `activeCaseName` are persisted to localStorage (`partialize`); the current request/result/bulk state is session-only and resets on reload.
  - Two top-level modes live in the same store: **single** (one request, one `CompareResult`) and **bulk** (`BulkRequestItem[]` run sequentially through the same `/api/compare` endpoint, accumulating `BulkItemResult[]`). Bulk runs can be stopped mid-flight via a module-level `stopFlag` closure captured by `runBulk`/`stopBulk`.
  - Test-case save/load/switch logic is intentionally non-trivial: `switchCase`/`newCase` auto-save the currently active case before loading another, and `saveCurrentCase` avoids clobbering an existing saved case's data when the user types a name that already exists but isn't the active case (see the comment in that function) — read it before changing test-case persistence behavior.
  - `App.tsx` toggles between two pages (`testcases`, `diffchecker`) via `Sidebar`, independent of the single/bulk mode toggle. The Diff Checker page is a separate feature (raw text/file diffing via `DiffChecker.tsx` + `FileFinder.tsx`, which calls `/api/files/find` to pull files from two local directory trees) — don't conflate it with the API comparison flow.
  - Path aliases (`client/vite.config.ts`): `@` → `client/src`, `@ui` → `client/src/components_ui/ui` (shadcn/ui components), `@mintara/shared` → shared source directly (no build step needed when iterating).
  - Dev server runs on port **5174** (not 5173 — README is out of date on this) and proxies `/api` to the server port.

## Conventions worth knowing before editing

- `NormalizationOptions` currently only has `ignoreFields` and `sortArrays` — the README's `floatTolerance` example is aspirational/not implemented; don't assume it exists in `shared/src/types.ts`.
- `CompareRequest` targets carry `baseUrl` + `headers`, with `method`/`path`/`body` at the top level (shared across all targets) — this differs from the flat `targets[].url` shape shown in the README's API example, which describes an earlier contract. Trust the code (`shared/src/types.ts`) over the README for the current wire format.
- `.claude/`, `docs/`, and `.worktrees/` are gitignored — treat anything under them as local/uncommitted context, not part of the shipped codebase.
