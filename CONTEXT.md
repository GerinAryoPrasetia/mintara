# mintara domain glossary

mintara has two independent product domains, each with its own folder under `client/src/domains/` and `server/src/domains/`, its own Zustand store on the client, and zero shared state between them.

## API Diff Checker (`domains/api-diff/`)

Sends the same request to 2+ API targets and diffs the JSON responses. Covers both **Single** mode (one request, one comparison) and **Bulk** mode (a list of requests run sequentially, results accumulated).

- **Target** — one API endpoint under comparison: a name, base URL, and its own headers. A request is always sent to 2+ targets.
- **Normalization** — the rules applied to a response body before diffing: `ignoreFields` (dot-notation paths to strip) and `sortArrays` (compare arrays regardless of element order). Lives in `shared/src/types.ts` as `NormalizationOptions`.
- **Diff Node** — one structural difference between two normalized bodies (`added` / `removed` / `changed`), produced by `shared/src/compare.ts`. `domains/api-diff/diff.ts`'s `diffTargets()` is the single seam that pairs normalization with diffing — every comparison in this domain goes through it rather than calling `normalize`/`compare` directly.
- **Test Case** — a named, persisted configuration (single or bulk) a user can save, load, switch between, duplicate, or export/import. Represented as `SavedCase` (`domains/api-diff/testCases.ts`).
- **Working Case** — whatever's currently on screen, saved or not: the mode, request, and bulk-specific fields. Only `savedCases` and `activeCaseName` survive a reload, so the store's `rehydrateActiveCase()` (wired to persist's `onRehydrateStorage`) reloads the active case onto the working state on startup. Without it the sidebar would mark a case active while the working state sat empty, and the next auto-save would overwrite that case with the empty state. The counterpart to `SavedCase` — `toSavedCase`/`fromSavedCase` convert between the two. Test-case actions (save, load, switch, duplicate, new, save-current) are pure functions over `SavedCase[]` + `WorkingCase` in `testCases.ts`, independent of the Zustand store or React.
- **Case Results** — everything one run produced for a Test Case: the single `CompareResult`, the bulk `BulkItemResult[]`, and any AI summaries (`domains/api-diff/caseResults.ts`). Held per case name in the store's `caseResults` cache so switching cases shows that case's own run rather than the last one executed. Session-only: deliberately excluded from the store's `partialize`, because persisting response bodies would exhaust the localStorage quota and take the saved Test Cases down with it. They do travel in test-case exports — `SavedCasesExport` is version 2, whose `ExportedCase` entries may carry a `results` field; version 1 files (config only) still import, and `splitImported()` peels `results` back off so it never reaches persisted storage.
- **Bulk Request Item** — one request in a bulk run (method, path, body, optional per-item headers/normalization). `bulkRequest.ts`'s `buildBulkCompareRequest()` is the single seam that resolves an item's effective headers (shared vs. per-item) and normalization (per-item override vs. global) into the request actually sent.

## File Diff Checker (`domains/file-diff/`)

Pastes or pulls two blobs of text (often full file contents) and renders a line-level diff — unrelated to the API comparison flow; it has its own text-diff algorithm (`lineDiff.ts`), not the structural JSON diff used by API Diff Checker.

- **File Finder** — given two root directory paths (original/modified) and a list of filenames, scans both trees and returns matching file contents, so a pair of files can be loaded into the diff view without leaving the browser. Server-side scanning logic lives in `scanFiles.ts`; `matching.ts` pairs up original/modified matches that share a relative path.
- **Diff Line** — one line in the rendered text diff (`unchanged` / `added` / `removed`), produced by `lineDiff.ts`'s LCS-based algorithm, either as split left/right columns or a single unified column.
