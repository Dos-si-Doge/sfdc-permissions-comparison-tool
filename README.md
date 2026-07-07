# Permission Diff Tool

A standalone, local browser tool for comparing **and editing** Salesforce Profile
(`*.profile-meta.xml`) and Permission Set (`*.permissionset-meta.xml`) files side by side.

This is **not** a Salesforce UI Bundle and is **not deployed** to any org. It runs entirely client-side — drag XML files from your local checkout into the browser tab, nothing is uploaded anywhere.

## Run

```bash
npm install
npm run dev
```

Open the printed local URL, then drag in 2 or more `.profile-meta.xml` / `.permissionset-meta.xml` files to compare. From there you can drag values between files to copy/move them, fill in or delete individual permissions, and save your changes back to disk.

### Optional: Salesforce CLI integration

If the [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`) is installed, the app detects it automatically and shows an org-management panel plus Validate/Deploy actions for selected files. This **requires `npm run dev`** — it's implemented as local API middleware on the Vite dev server, so it's not available in the static build below.

## Build (optional static bundle)

```bash
npm run build
```

Produces a static `dist/` folder that can be served with any static file server (or opened directly, since asset paths are relative). The Salesforce CLI integration is not available in this build — there's no server to back it.
