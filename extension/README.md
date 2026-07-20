# StyleSnap Web Picker (Browser Extension)

Chrome MV3 extension — the "Web Picker" surface of StyleSnap. Click any element on any
website to capture its design tokens into the shared `StyleSnapExport` JSON, then paste
into the StyleSnap webtool alongside Figma tokens.

**Owner:** Murtaza · **Branch:** `murtaza`

See [UX.md](./UX.md) for the interaction spec.

## Stack
- Manifest V3 · React + Vite · TypeScript
- `@crxjs/vite-plugin` for MV3 bundling
- Side-panel UI tokens from team [`../DESIGN.md`](../DESIGN.md) (see [`DESIGN.md`](./DESIGN.md))
- Shared token schema imported from [`../docs/types.ts`](../docs/types.ts) — never redefined locally

## Structure
```
extension/
├─ manifest.config.ts        # MV3 manifest
├─ src/
│  ├─ background/            # service worker (owns side-panel behavior)
│  ├─ content/               # in-page picker overlay + CSS→token extraction
│  ├─ sidepanel/             # React workspace UI
│  └─ shared/types.ts        # re-export of docs/types.ts + message types
```

## Develop
```bash
cd extension
npm install
npm run dev        # builds to dist/ in watch mode
```
Then in Chrome: `chrome://extensions` → enable Developer mode → **Load unpacked** → select `extension/dist`.

## Build
```bash
npm run build
npm run typecheck
```

## How it works
1. Open the side panel (click the extension icon).
2. **Start picking** → hover the page (outline + inspector chip preview) → click to capture.
3. Review/remove tokens in the panel.
4. **Copy to StyleSnap** → schema-v2.0 JSON on clipboard: a flat `tokens[]` list where
   tokens from the same element share a `captureId` and carry a best-effort `context`
   (`cssProperty`, `element`, `ariaRole`, `selector`, `authoredName`). `meta.source =
   "browser-extension"`. The Webtool derives semantic roles from that context.
