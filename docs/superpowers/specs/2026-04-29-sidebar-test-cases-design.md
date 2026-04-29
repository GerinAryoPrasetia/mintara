# Sidebar Test Case Manager

**Date:** 2026-04-29  
**Status:** Approved

## Overview

Replace the header dialog-based TestCaseManager with a persistent, collapsible left sidebar. The sidebar lists all saved test cases and allows switching between them (with auto-save), creating new ones, duplicating, and deleting. Import/export moves from the dialog into the sidebar footer.

## Layout

The app changes from a single centered column to a two-panel flex layout:

```
┌──────────────┬────────────────────────────────────────┐
│  Sidebar     │  Main content (existing panels)        │
│  (220px)     │                                        │
│              │  [Mode toggle]                         │
│  Test Cases  │  [RequestBuilder / BulkRequestBuilder] │
│  ──────────  │  [Results / Export]                    │
│  > Case A    │                                        │
│    Case B    │                                        │
│    Case C    │                                        │
│              │                                        │
│  [+ New]     │                                        │
└──────────────┴────────────────────────────────────────┘
```

- The sidebar is **220px** wide when open, collapses to a **32px icon strip** via a chevron toggle button on its right edge.
- The header `TestCaseManager` buttons (Save/Load dialogs) are removed entirely.
- The main content area uses the remaining width.

## Sidebar Component (`Sidebar.tsx`)

### Header
- Title: "Test Cases" (hidden when collapsed)
- Collapse/expand toggle button (chevron icon), always visible
- `+` button: triggers `newCase()` — auto-saves current, resets to blank state

### Case List
Each entry displays:
- **Name** — truncated with ellipsis if too long
- **Mode badge** — `Single` or `Bulk` (small colored badge)
- **Request hint** — `GET /users` for single mode; `12 requests` for bulk mode

The **active case** is highlighted (slate-800 background, white text).

On hover, two icon buttons appear on the right:
- **Duplicate** icon — calls `duplicateCase(name)`, creates `"Name (copy)"` without switching
- **Delete** icon — calls `deleteCase(name)`, red color

Clicking anywhere else on the row calls `switchCase(name)`.

### Save Button
A "Save" button at the bottom of the case list (above the footer):
- If `activeCaseName` is null (unsaved state): opens a small inline input to enter a name, then saves
- If `activeCaseName` is set: saves silently under the current name (overwrites)

### Footer
- **Import** button — file picker for `.json` import (same conflict resolution logic as before)
- **Export** button — enters selection mode to choose cases to export

When collapsed, the sidebar shows only icon buttons stacked vertically (no labels).

## State Changes (`store.ts`)

### New state
```ts
activeCaseName: string | null  // persisted
```
`null` means the current working state has not been saved under any name.

### New/updated actions

**`switchCase(name: string)`**
1. If `activeCaseName` is not null, auto-save current state back to `savedCases` under that name (silent overwrite).
2. Load the named case into active state.
3. Set `activeCaseName = name`.

**`newCase()`**
1. If `activeCaseName` is not null, auto-save current state (silent overwrite).
2. Reset `request` to `DEFAULT_REQUEST`, `bulkItems` to `[]`, `mode` to `'single'`, `result` to `null`.
3. Set `activeCaseName = null`.

**`duplicateCase(name: string)`**
1. Find the case by name in `savedCases`.
2. Generate a unique copy name: `"Name (copy)"`, then `"Name (copy 2)"`, `"Name (copy 3)"`, etc.
3. Append the copy to `savedCases`. Do not switch to it.

**`saveCase` (updated)**
- After saving, set `activeCaseName` to the saved name.

### Persistence
`activeCaseName` is added to the `partialize` list so the active case survives page reload.

## Files Changed

| File | Change |
|------|--------|
| `client/src/store.ts` | Add `activeCaseName`, `switchCase`, `newCase`, `duplicateCase`; update `saveCase` and `partialize` |
| `client/src/App.tsx` | Change layout to flex row with `<Sidebar />` + main content; remove `<TestCaseManager />` from header |
| `client/src/components/Sidebar.tsx` | New component — all sidebar UI |
| `client/src/components/TestCaseManager.tsx` | Deleted (import/export logic inlined into Sidebar) |

## Out of Scope

- Renaming a saved case (double-click to rename) — not requested
- Drag-to-reorder cases in the sidebar — not requested
- Search/filter within case list — not requested
