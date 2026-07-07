# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); dated sections stand in for version numbers since
this tool doesn't currently follow a release/versioning process.

## [Unreleased]

### Added

- **Save All** button — saves every file with unsaved edits in one action, instead of one file at
  a time.
- **Undo history** — every edit (drag copy/move, manual fill-in, delete) is recorded. **Undo**
  reverts the single most recent edit; the **History** dropdown lists every edit and rolling back
  to an older one undoes it and everything after it in one action (multi-step rollback, similar to
  Word's Undo History).
- **Dark mode toggle** — a header button that explicitly switches between light and dark,
  overriding the OS-level preference. Choice persists across reloads (`localStorage`).
- **Salesforce CLI integration** (dev server only — `npm run dev`, not the static build): detects
  an installed `sf` CLI on launch and, if found, shows a panel to list/add/remove Salesforce org
  connections and select an active org, plus per-file selection with **Validate Selected** and
  **Deploy Selected** actions. Both build a disposable, self-contained SFDX project from whichever
  files are currently loaded (dirty or saved, either way) and run the real `sf project deploy
  validate`/`start` against it — nothing is required on disk beyond what's already loaded in the
  tool. Deploying to what looks like a Production org requires an explicit confirmation; Validate
  never writes anything. This is the one deliberate, optional exception to the tool's "no backend,
  no org connection" design — everything else works identically with or without it.

### Fixed

- **Dark mode contrast**: buttons, checkboxes, and several muted labels rendered with illegible
  (often black-on-dark-grey) text in dark mode. Buttons/inputs/selects never had an explicit
  `color`, so browsers fell back to native control colors keyed to the OS's color scheme rather
  than the app's manual toggle; several labels also used a fixed grey/red that didn't meet WCAG
  contrast requirements against dark backgrounds, and the "PermSet" badge's white text failed
  contrast against its green background in *both* themes. All text/background pairs across both
  themes now meet WCAG AA (4.5:1) contrast, verified programmatically rather than eyeballed.

## 2026-07-06 — Editable permissions

### Added

- Drag-and-drop: copy a permission value from one file's column onto another's. A **Copy / Move**
  toggle switches the drag behavior — Move also clears the source value.
- Manual fill-in for a permission that's missing from a given file, via an inline form (checkboxes,
  a dropdown, or text depending on the category).
- Delete a permission entry from a file.
- **Save Changes** / **Discard** per file. Edits are staged in memory and never touch disk until
  Save is clicked; Save writes directly to disk via the File System Access API when the file has a
  live handle, otherwise downloads an edited copy. After a direct write, the file is re-read from
  disk so the UI always reflects what's actually saved.
- Unsaved-edit indicator (blue cell border) and a per-row revert control.
- `.gitignore` (previously missing — `node_modules`/`dist` were untracked).

## 2026-07-06 — Initial release

### Added

- Side-by-side diff of Salesforce Profile and Permission Set XML metadata, N-way across any number
  of loaded files, across all 13 permission categories (object/field/class/page/tab/record type
  visibility, application visibility, user/custom permissions, custom metadata/setting access, flow
  access, license).
- Category switcher with per-category diff-count badges, search, "only differences" filter, sticky
  header/first column, and an expand-to-full-width view.
- File loading via drag-and-drop or a file picker, with live "Reload from disk" support in
  Chromium-based browsers via the File System Access API.
- Profile-only fields section (`layoutAssignments`, `loginIpRanges`, etc.) for fields with no
  Permission Set equivalent — read-only, kept separate from the main diff.
- Fully client-side: no backend, no org connection, no upload of any kind.
