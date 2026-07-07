# permission-diff

Standalone browser tool for comparing Salesforce Profile (`*.profile-meta.xml`) and Permission Set
(`*.permissionset-meta.xml`) files side by side. Fully client-side — no backend, no org connection,
nothing uploaded anywhere. Lives at `tools/permission-diff/` in this repo, isolated from the SFDX
packages: it has its own `package.json`/`node_modules` and is never touched by `sf project deploy`
or the SFDX build.

## Run

```bash
cd tools/permission-diff
npm install
npm run dev      # Vite dev server
npm run build    # tsc -b && vite build -> static dist/
```

## Architecture

Pipeline: **load → parse → normalize → diff → render**.

1. **Load** (`components/FileDropZone.tsx`, `App.tsx`) — user drags/picks local `.xml` files.
   Each becomes a `FileEntry` (`lib/fileEntry.ts`): a `File` plus, when the browser supports it, a
   live `FileSystemFileHandle`.
2. **Parse** (`lib/parseXml.ts`) — `DOMParser` wraps the raw XML; helpers read only *direct
   children* of the root element (`getDirectChildren`, `elementToObject`), never deep queries. This
   matters because Salesforce metadata repeats sibling tags (many `<fieldPermissions>` blocks etc.)
   and a deep query would double-count or scoop up nested content from other sections.
3. **Normalize** (`lib/normalize/*.ts`) — one file per permission category, each converting the raw
   DOM into `NormalizedRow[]` with a stable `key`, a `displayLabel`, an optional `group`, and a
   `fields` bag of comparable values. `lib/normalize/index.ts` orchestrates all categories plus
   `detectSourceType`, which sniffs the root tag (`<Profile>` vs `<PermissionSet>`) rather than
   trusting the filename.
4. **Diff** (`lib/diffEngine.ts`) — `computeDiff(files)` builds a `Map<rowKey, Map<fileId, value>>`
   per category and classifies each row `identical` / `different` / `missing`. This is N-way by
   construction (columns = `files.map(...)`) — there is no special-cased 2-file path, so adding a
   third/fourth file to compare requires no engine changes.
5. **Render** (`components/DiffTable.tsx`, `DiffCell.tsx`, `SummaryDashboard.tsx`) — one table per
   category, category switcher with diff-count badges, search + "only differences" filter.

## Category / normalizer pattern

`lib/types.ts` is the source of truth: `CATEGORIES` (the tuple), `Category` (derived union type),
and `CATEGORY_LABELS`. To add a new permission category:

1. Add the tag to `CATEGORIES` + a label in `CATEGORY_LABELS`.
2. Add `lib/normalize/<category>.ts` exporting `normalize<Category>(doc, sourceType?)`.
3. Wire it into the `rows` object in both branches of `lib/normalize/index.ts`'s `normalizeFile`
   (the happy path and the catch-block's empty-rows fallback — TypeScript will fail the build if
   you miss one, since `Record<Category, NormalizedRow[]>` requires every key).

Profile vs. PermissionSet shape differences (`tabVisibilities`↔`tabSettings`,
`userLicense`↔`license`, profile-only fields with no permission-set equivalent) are documented in
`crdApps/ccrsApp/main/default/permissionsets/convertedPs/Unsupported_Metadata_Notes.md` — treat
that file as the spec when a normalizer's mapping looks wrong or incomplete. Profile-only fields
(`layoutAssignments`, `loginIpRanges`, top-level `custom`, etc.) are handled separately in
`normalizeProfileOnlyFields` and rendered in their own non-diffable section
(`ProfileOnlySection.tsx`) — they should never be added to the main category diff.

## Grouped rows (e.g. Field Permissions)

A `NormalizedRow` can carry an optional `group` (e.g. the object name for a field permission row —
`Account.FirstName` becomes `displayLabel: "FirstName"`, `group: "Account"`). `diffEngine` sorts by
`group` then `displayLabel` so same-group rows stay contiguous, and `DiffTable` turns contiguous
runs into a bolded section-header row via its `displayItems` derivation. If you add grouping to
another category, follow the same pattern (split the key, set `group`, keep `key` as the *full*
unique identifier) — don't invent a second mechanism.

## CSS gotchas already solved — don't re-break these

- **Sticky header + sticky first column**: requires `.table-scroll` to have an explicit
  `max-height` + `overflow: auto`. Sticky positioning is relative to the nearest scrolling
  ancestor; if `.table-scroll` has no bounded height, nothing actually scrolls inside it and
  `position: sticky` silently does nothing (a classic gotcha). Also: `border-collapse: collapse`
  breaks sticky cells (borders belong to the table, not the cell) — this table uses
  `border-collapse: separate` with per-cell borders instead.
- **Sticky column needs an opaque background.** `.col-name` sets `background: var(--surface)`
  explicitly so cells scrolling underneath it horizontally don't show through.
- **Field-permission color coding must out-rank the generic diff highlight.** `.cell.cell-fp-*`
  rules are written with equal-or-higher specificity than `.row-different .cell` and placed later
  in the stylesheet, so a field's read/write color always wins over the generic amber
  "different" tint for that category.
- **"Expand to full width" breakout**: `.diff-table-wrapper.expanded` uses the
  `width: 100vw; margin-left: calc(-50vw + 50%)` trick to escape `.app`'s `max-width: 1200px`
  without restructuring the DOM.

## Live reload from disk

`App.tsx` keeps a `Map<fileId, FileSystemFileHandle>` (in a ref, not state) for any file loaded via
the File System Access API. The "Reload from disk" button re-reads each handle's current file
content and re-normalizes in place, preserving file IDs. **This only works in Chromium-based
browsers** (Chrome/Edge) — Firefox and Safari don't implement `showOpenFilePicker` /
`DataTransferItem.getAsFileSystemHandle`, so `lib/fileEntry.ts`'s `supportsFileSystemAccess()`
gates it and the UI degrades to a disabled button with an explanatory hint rather than failing.
Ambient types for these APIs (not fully in TS's DOM lib) live in `src/file-system-access.d.ts` —
extend that file, don't add `any`/`@ts-ignore` casts elsewhere if new FS Access surface is needed.

## Verifying changes without a browser

There's no test suite. The fastest way to sanity-check parsing/normalization/diff logic without
spinning up a browser is a throwaway Node script using `jsdom` (not a project dependency — install
with `npm install --no-save jsdom`, write a script that sets
`globalThis.DOMParser = new JSDOM().window.DOMParser`, run the same parse/normalize logic against a
real file under `crdApps/*/main/default/{profiles,permissionsets}/`, then `npm uninstall jsdom` and
delete the script. Don't leave `jsdom` in `package.json` — this tool has zero runtime deps beyond
React by design.

## Non-goals

- No org connection, no `sf` CLI calls, no upload/backend of any kind — this is explicitly a local,
  offline tool.
- No SFDX/CI integration — it isn't deployed metadata and isn't part of the pipeline.
