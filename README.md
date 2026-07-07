# Permission Diff Tool

A standalone, local browser tool for comparing Salesforce Profile (`*.profile-meta.xml`) and Permission Set (`*.permissionset-meta.xml`) files side by side.

This is **not** a Salesforce UI Bundle and is **not deployed** to any org. It runs entirely client-side — drag XML files from your local checkout into the browser tab, nothing is uploaded anywhere.

## Run

```bash
cd tools/permission-diff
npm install
npm run dev
```

Open the printed local URL, then drag in 2 or more `.profile-meta.xml` / `.permissionset-meta.xml` files to compare.

## Build (optional static bundle)

```bash
npm run build
```

Produces a static `dist/` folder that can be served with any static file server (or opened directly, since asset paths are relative).
