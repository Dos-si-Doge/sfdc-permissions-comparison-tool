# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A standalone, client-side browser tool for comparing **and editing** Salesforce Profile
(`*.profile-meta.xml`) and Permission Set (`*.permissionset-meta.xml`) files side by side. Fully
client-side — no backend, no org connection, nothing uploaded anywhere. This repo *is* the tool
(root-level `package.json`, `src/`, `index.html`) — it is not nested inside a larger SFDX project.

Beyond the read-only diff, users can drag a permission value from one file's column onto another to
copy or move it, manually fill in a value that's missing for a file, delete a value, and save the
result back to disk (or download it, depending on browser support) — see **Editing** below.

## Commands

```bash
npm install
npm run dev      # Vite dev server
npm run build    # tsc -b && vite build -> static dist/
npm run preview  # preview the built dist/ locally
```

There is no test suite and no lint script. `tsc -b` (part of `build`) is the only automated check —
`tsconfig.json` has `noUnusedLocals`/`noUnusedParameters` on, so unused code fails the build, not
just a lint pass.

### Verifying changes without a browser

The fastest way to sanity-check parsing/normalization/diff/editing logic without spinning up a
browser is a throwaway Node script using `jsdom` (not a project dependency — install with
`npm install --no-save jsdom`, and `tsx` to run `.ts` files directly:
`npm install --no-save jsdom tsx`). Set `globalThis.DOMParser`/`Document`/`XMLSerializer`/`Node` from
`new JSDOM().window`, then run the same parse/normalize/serialize logic (`normalizeFileWithDocument`,
`upsertRow`/`removeRow`, `applyFieldEdit`/`applyFieldDelete`/`revertRow`) against a real
`*.profile-meta.xml` / `*.permissionset-meta.xml` file. Run the script from *inside* the repo (e.g.
`npx tsx _verify.mjs`), not from an external scratch directory — Node resolves `node_modules`
relative to the script's own location, so a script outside the repo tree can't see jsdom/tsx even
though they're installed. Delete the script and run a bare `npm install` afterward (with no
`jsdom`/`tsx` in `package.json`, this prunes them back out) — don't leave them installed.

jsdom can't exercise real HTML5 drag-and-drop events or trigger an actual file download, so
verifying those needs a real (headless) browser: `npm install --no-save playwright` +
`npx playwright install chromium`, start `npm run dev` in the background, and drive it with
Playwright's `page.locator(...).dragTo(...)` (real native drag events) and
`page.waitForEvent('download')`. Same cleanup rule — remove the script, `npm install` to drop the
throwaway deps, and kill the dev server. This is also how the two bugs documented in the Editing
section above were actually caught — jsdom's `XMLSerializer` doesn't reproduce the Chromium prolog
quirk, and the namespace bug only became visible once the resulting XML was inspected end-to-end.

## Architecture

Pipeline: **load → parse → normalize → diff → render**.

1. **Load** (`src/components/FileDropZone.tsx`, `src/App.tsx`) — user drags/picks local `.xml`
   files. Each becomes a `FileEntry` (`src/lib/fileEntry.ts`): a `File` plus, when the browser
   supports it, a live `FileSystemFileHandle`.
2. **Parse** (`src/lib/parseXml.ts`) — `DOMParser` wraps the raw XML; helpers read only *direct
   children* of the root element (`getDirectChildren`, `elementToObject`), never deep queries. This
   matters because Salesforce metadata repeats sibling tags (many `<fieldPermissions>` blocks etc.)
   and a deep query would double-count or scoop up nested content from other sections.
3. **Normalize** (`src/lib/normalize/*.ts`) — one file per permission category, each converting the
   raw DOM into `NormalizedRow[]` with a stable `key`, a `displayLabel`, an optional `group`, and a
   `fields` bag of comparable values. `src/lib/normalize/index.ts` orchestrates all categories plus
   `detectSourceType`, which sniffs the root tag (`<Profile>` vs `<PermissionSet>`) rather than
   trusting the filename.
4. **Diff** (`src/lib/diffEngine.ts`) — `computeDiff(files)` builds a per-category row map (rowKey
   → per-file value) and classifies each row `identical` / `different` / `missing`. This is N-way by
   construction (columns = `files.map(...)`) — there is no special-cased 2-file path, so comparing a
   third/fourth file requires no engine changes.
5. **Render** (`src/components/DiffTable.tsx`, `DiffCell.tsx`, `SummaryDashboard.tsx`) — one table
   per category, category switcher with diff-count badges, search + "only differences" filter.

## Category / normalizer pattern

`src/lib/types.ts` is the source of truth: `CATEGORIES` (the tuple), `Category` (derived union
type), and `CATEGORY_LABELS`. To add a new permission category:

1. Add the tag to `CATEGORIES` + a label in `CATEGORY_LABELS`.
2. Add `src/lib/normalize/<category>.ts` exporting `normalize<Category>(doc, sourceType?)`.
3. Wire it into the `rows` object in both branches of `src/lib/normalize/index.ts`'s
   `normalizeFile` (the happy path and the catch-block's empty-rows fallback — TypeScript will fail
   the build if you miss one, since `Record<Category, NormalizedRow[]>` requires every key).
4. Add a matching entry to `CATEGORY_SCHEMAS` in `src/lib/editing/editSchema.ts` (container tag, key
   child tag, `FieldSpec[]`) — without it the category won't be editable (no manual fill-in form, and
   `serializeEdit.ts`'s `upsertRow`/`removeRow` will throw looking up a missing schema entry).
   `Record<Category, CategorySchema>` is exhaustive the same way `rows` is, so a missing entry is a
   type error, not a silent gap.

Profile vs. PermissionSet shape differences are handled per-normalizer via an optional `sourceType`
param (e.g. `tabVisibility.ts` maps `tabVisibilities`↔`tabSettings`, `license.ts` maps
`userLicense`↔`license`). Profile-only fields with no permission-set equivalent
(`layoutAssignments`, `loginIpRanges`, top-level `custom`, etc.) are handled separately in
`normalizeProfileOnlyFields` (`src/lib/normalize/profileOnlyFields.ts`) and rendered in their own
non-diffable section (`ProfileOnlySection.tsx`) — they should never be added to the main category
diff.

## Grouped rows (e.g. Field Permissions)

A `NormalizedRow` can carry an optional `group` (e.g. the object name for a field permission row —
`Account.FirstName` becomes `displayLabel: "FirstName"`, `group: "Account"`). `diffEngine` sorts by
`group` then `displayLabel` so same-group rows stay contiguous, and `DiffTable` turns contiguous
runs into a bolded section-header row via its `displayItems` derivation. If you add grouping to
another category, follow the same pattern (split the key, set `group`, keep `key` as the *full*
unique identifier) — don't invent a second mechanism.

## Editing (drag-copy/move, manual fill-in, delete, save)

On top of the read-only diff pipeline, `src/lib/editing/` adds a schema-driven layer for mutating
permission rows and writing the result back to disk. Edits are **staged in memory**, not
auto-saved — nothing touches disk until the user clicks **Save Changes** (or discards via
**Discard**), both rendered per-file in `FileList.tsx`.

1. **Schema** (`src/lib/editing/editSchema.ts`) — `CATEGORY_SCHEMAS: Record<Category, CategorySchema>`
   is the single source of truth for every category's XML shape from the *editing* side: container
   tag (sourceType-variant for `tabVisibility`), key child tag, and a `FieldSpec[]` describing each
   editable field's XML tag, UI label, editor kind (`boolean` / `enum` / `string`), and default. This
   drives both the manual fill-in form (`InlineFieldEditor.tsx`) and the DOM serializer below. 9 of
   13 categories share an identical `{key + enabled:boolean}` shape (see the `enabledCategory()`
   helper); `license` and `tabVisibility` are the bespoke ones (singleton/self-text, and
   sourceType-dependent enum + tag respectively).
2. **Document retention** (`src/lib/normalize/index.ts`'s `normalizeFileWithDocument`) — the normal
   read-only pipeline parses-then-discards the DOM (`normalizeFile`). Editing needs the live
   `Document` to mutate, so `App.tsx` keeps a `Map<fileId, Document>` (`docsRef`, alongside the
   existing `handlesRef` pattern) plus `originalRawRef`/`originalFilesRef` snapshots of each file's
   last-loaded/last-saved state — those snapshots are the baseline for dirty-tracking and for
   "Discard"/per-row revert.
3. **DOM read/write** (`src/lib/editing/serializeEdit.ts`) — `upsertRow`/`removeRow` mutate the
   retained `Document` directly: update an existing element's children in place, or synthesize a new
   container element (alphabetical child order, matching the convention already present in every
   sample file) inserted after the last same-tag sibling. `applyEdit.ts` keeps this DOM mutation and
   the in-memory `NormalizedFile.rows` update atomic, and exposes `applyFieldEdit` /
   `applyFieldDelete` / `revertRow` — the last one is a single function covering all three "undo"
   cases (edited / newly-created / pending-delete) by diffing against `originalFilesRef`, not three
   separate code paths.
4. **Dirty tracking** (`App.tsx`'s `editedByFile` memo) — recomputed from `files` vs.
   `originalFilesRef` on every render (using `fieldsEqual`, exported from `diffEngine.ts` for this).
   Drives the blue-border `.cell-edited` indicator, the per-row "↩" revert control, and each file's
   Save/Discard visibility in `FileList.tsx`. **Refs alone don't trigger this recompute** — any code
   path that mutates `docsRef`/`originalFilesRef` without also calling `setFiles` (even a no-op
   `setFiles((prev) => [...prev])`) will leave stale dirty state on screen (hit this in the
   download-fallback save path; see `handleSaveFile`).
5. **Drag-and-drop** (`DiffCell.tsx`) — a custom `application/x-permdiff-cell` MIME payload carries
   `{ sourceFileId }`; using a custom type (not `text/plain` or the OS file-drag types
   `FileDropZone.tsx` reacts to) keeps this from colliding with the unrelated external-file drop
   zone. A **Copy / Move** toggle (`DiffTable.tsx`'s `.mode-toggle`, state lives in `App.tsx` as
   `dragMode`) controls whether `handleCopyValue` also deletes the source row after copying — the
   move is just "copy, then `applyFieldDelete` on the source" chained inside one `setFiles` updater.
6. **Save** (`src/lib/editing/saveFile.ts`) — writes via `handle.createWritable()` (requesting
   `readwrite` permission if needed) when a file has a live `FileSystemFileHandle`; otherwise falls
   back to a Blob-based browser download. After a handle-based save, `App.tsx` **re-reads the file
   from disk** (reusing the same logic as "Reload from disk") rather than trusting the in-memory
   mutation, so the UI always reflects what's actually on disk.

### Two real bugs hit while building this — don't reintroduce them

- **`document.createElement` always creates elements in the null namespace.** This document's root
  declares a default `xmlns`, so a plain `createElement` on a newly-inserted permission row
  serializes with a spurious `xmlns=""` override that breaks consistency with every sibling element.
  `serializeEdit.ts`'s `createEl()` helper uses `doc.createElementNS(doc.documentElement.namespaceURI, tag)`
  instead — use it (not raw `createElement`) for any new element added to a retained `Document`.
- **`XMLSerializer.serializeToString` re-emitting the `<?xml ?>` prolog is engine-dependent.** jsdom
  never includes it (it's `Document` metadata, not a node); some Chromium builds *do* re-emit it when
  the source document had one, which duplicated the declaration when `saveFile.ts` also prepended its
  own. `serializeDocument()` now strips any leading `<?xml ... ?>` before prepending the canonical
  one — don't assume either engine's behavior when touching this function.

## CSS gotchas already solved — don't re-break these (`src/styles/global.css`)

- **Sticky header + sticky first column**: requires `.table-scroll` to have an explicit
  `max-height` + `overflow: auto`. Sticky positioning is relative to the nearest scrolling
  ancestor; if `.table-scroll` has no bounded height, nothing actually scrolls inside it and
  `position: sticky` silently does nothing (a classic gotcha). Also: `border-collapse: collapse`
  breaks sticky cells (borders belong to the table, not the cell) — this table uses
  `border-collapse: separate` with per-cell borders instead.
- **Sticky column needs an opaque background.** `.col-name` sets `background: var(--surface)`
  explicitly so cells scrolling underneath it horizontally don't show through.
- **Field-permission color coding must out-rank the generic diff highlight.** `.cell.cell-fp-*`
  rules (driven by `DiffCell.tsx`'s `fieldPermissionClass`) are written with equal-or-higher
  specificity than `.row-different .cell` and placed later in the stylesheet, so a field's
  read/write color always wins over the generic amber "different" tint for that category.
- **"Expand to full width" breakout**: `.diff-table-wrapper.expanded` uses the
  `width: 100vw; margin-left: calc(-50vw + 50%)` trick to escape `.app`'s `max-width: 1200px`
  without restructuring the DOM.
- **Unsaved-edit indicator (`.cell-edited`) is an `outline`, not a `background-color`**, specifically
  so it layers over both the generic amber "different" tint and the fieldPermissions read/write
  background colors without having to win a specificity fight against either — the same problem the
  `.cell-fp-*` rule above solves, deliberately sidestepped here instead of re-solved.

## Live reload from disk

`App.tsx` keeps a `Map<fileId, FileSystemFileHandle>` (in a ref, not state) for any file loaded via
the File System Access API. The "Reload from disk" button re-reads each handle's current file
content and re-normalizes in place, preserving file IDs — and now first checks `dirtyIds` (see
Editing above), prompting via `window.confirm` if reloading would discard unsaved edits. Same guard
on file removal. **Live reload only works in Chromium-based browsers** (Chrome/Edge) — Firefox and
Safari don't implement `showOpenFilePicker` / `DataTransferItem.getAsFileSystemHandle`, so
`src/lib/fileEntry.ts`'s `supportsFileSystemAccess()` gates it and the UI degrades to a disabled
button with an explanatory hint rather than failing. Ambient types for these APIs (not fully in TS's
DOM lib, including the newer `createWritable`/`requestPermission` write-path additions) live in
`src/file-system-access.d.ts` — extend that file, don't add `any`/`@ts-ignore` casts elsewhere if new
FS Access surface is needed. `FileDropZone.tsx` mirrors this same handle-vs-plain-`File` fallback for
drag-and-drop (`DataTransferItem.getAsFileSystemHandle`) and the click-to-browse path
(`showOpenFilePicker`).

## Non-goals

- No org connection, no `sf` CLI calls, no upload/backend of any kind — this is explicitly a local,
  offline tool.
- No SFDX/CI integration.
