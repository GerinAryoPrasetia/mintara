# Sidebar Test Case Manager — Implementation Plan

## Step 1: Update store.ts

### 1a. Add `activeCaseName` to state and persistence
- Add `activeCaseName: string | null` to `AppStore` interface
- Add `activeCaseName: null` to initial state
- Add `activeCaseName` to `partialize` in persist middleware

### 1b. Add auto-save helper
A private helper `autoSaveCurrentCase()` that:
- If `activeCaseName` is null, does nothing
- Otherwise silently overwrites the existing saved case with the current state (using the existing `saveCase` logic internally)

### 1c. Add new actions
- `switchCase(name: string)` — auto-saves current, then loads target case, sets `activeCaseName = name`
- `newCase()` — auto-saves current, resets to default blank state, sets `activeCaseName = null`
- `duplicateCase(name: string)` — finds source, generates unique `"Name (copy)"` name, appends to `savedCases` without switching
- `saveCurrentCase(name?: string)` — if name given, saves under that name and sets `activeCaseName = name`; if no name and `activeCaseName` is set, silently overwrites; if no name and `activeCaseName` is null, triggers the save-dialog flow

### 1d. Update `saveCase`
- After saving, set `activeCaseName` to the saved name

### 1e. Update `loadCase`
- Set `activeCaseName` to the loaded case name

## Step 2: Create Sidebar.tsx

### 2a. Component structure
```tsx
export function Sidebar() {
  const { savedCases, activeCaseName, switchCase, newCase, duplicateCase, deleteCase } = useStore()
  const [collapsed, setCollapsed] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  // ...
}
```

### 2b. Sidebar wrapper
- 220px wide when open, 32px icon strip when collapsed
- Dark border-right separator
- Flex column layout

### 2c. Header
- Title "Test Cases" (hidden when collapsed)
- `+` button (Calls `newCase()`)
- Collapse chevron button

### 2d. Case list
Map `savedCases` to rows. Each row:
- Mode badge (colored pill: slate for Single, blue for Bulk)
- Name (truncated)
- Request hint: `METHOD PATH` for single, `N requests` for bulk
- Active case: highlighted background
- Hover: shows duplicate (Copy icon) and delete (Trash icon) buttons

Click row → `switchCase(name)`. Click duplicate → `duplicateCase(name)`. Click delete → `deleteCase(name)`.

### 2e. Save button
- Bottom of list area
- If `activeCaseName` is null: shows an input field for the name, then calls `saveCurrentCase(name)`
- If `activeCaseName` is set: calls `saveCurrentCase()` silently

### 2f. Footer (Import/Export)
- Import button → file picker (same logic as old TestCaseManager)
- Export button → enters selection mode (checkbox list appears on case rows)

### 2g. Collapsed state
When collapsed (32px wide):
- Chevron points right instead of left
- Icons only, no labels
- `+` button becomes a single icon
- Each case row shows a small dot indicator if it's the active case

## Step 3: Update App.tsx

### 3a. Remove TestCaseManager from header
Delete the `<TestCaseManager />` from the header JSX. The header keeps the title and subtitle.

### 3b. Change root layout
```tsx
<div className="flex min-h-screen bg-slate-50">
  <Sidebar />
  <main className="flex-1 max-w-7xl mx-auto px-4 py-6 space-y-4">
    {/* existing content */}
  </main>
</div>
```

## Step 4: Delete TestCaseManager.tsx

Remove the file. All functionality moved into Sidebar.

## Step 5: Verify

- [ ] App renders without TestCaseManager
- [ ] Sidebar shows all saved cases with correct mode/hint
- [ ] Clicking a case switches to it (and auto-saves current)
- [ ] `+` button creates a new blank case
- [ ] Duplicate creates a copy without switching
- [ ] Delete removes a case
- [ ] Save button works for both unnamed and named cases
- [ ] Import/export still work
- [ ] Page reload preserves active case
- [ ] Collapsing/expanding sidebar works

## Files

| File | Action |
|------|--------|
| `client/src/store.ts` | Modify |
| `client/src/components/Sidebar.tsx` | Create |
| `client/src/components/TestCaseManager.tsx` | Delete |
| `client/src/App.tsx` | Modify |