import { setWorkerUrl } from 'maplibre-gl';
// `?worker&url` — NOT `?url`.
//
// MapLibre v6 derives its worker URL at runtime from `import.meta.url`
// (`new URL('./maplibre-gl-worker.mjs', import.meta.url)`). After Vite bundles,
// `maplibre-gl.mjs` no longer exists as a standalone file, so that lookup
// resolves to an asset that was never emitted — hence this override.
//
// The override must bundle, though. `?url` copies ONLY maplibre-gl-worker.mjs
// (19 KB) into assets/, but that file does `import ... from
// "./maplibre-gl-shared.mjs"` — a sibling chunk Vite does not emit. The worker
// then fails to instantiate:
//   classic → "Cannot use import statement outside a module"
//   module  → load/parse failure (sibling chunk 404s)
//
// A dead worker breaks ONLY vector basemaps, because vector tiles are decoded
// in the worker while raster tiles are decoded on the main thread. That is why
// Standard and Light rendered blank while Terrain, Satellite and 3D worked —
// and why it reproduced only in the built site, never in dev.
//
// `?worker&url` bundles the worker together with maplibre-gl-shared.mjs into a
// single self-contained module and returns its URL. vite.config.ts sets
// `worker: { format: 'es' }`, which matches MapLibre's `new Worker(url,
// { type: 'module' })`.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

setWorkerUrl(workerUrl);
