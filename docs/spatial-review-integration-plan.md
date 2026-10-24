# Alterno Spatial Review integration

The requested integration uses the published Alterno SDK and a dedicated
`/spatial-review.html` page. The normal game does not load the SDK or bridge.
The official editor at https://spatial-review.alterno.dev may discover and
capture only the registered authored level artwork. Same-origin access is also
supported; other origins and cross-origin loopback access are disabled.
The initial integration was validated locally. The later GitHub Pages build at
`https://rbifulco.github.io/fly-escape/` publishes the game and dedicated review
page on a separate fork branch. Vercel routes still add a discovery-only CORS
header for the original host; framing defaults are unchanged.

## Representation and source mapping

Each capture selects one campaign level via `?level=open-window` (default) or
`?level=turn-the-corner`. It uses authored defaults, never saved player progress,
random flies, replay time, neural data, or a simulation worker.

A level is a transform-only assembly. Its individual floors, walls, furniture,
wall attachments and fixed household objects are actors. Repeated native models
share asset IDs. Floor UV variants and fitted doorways have separate asset IDs.
Actor IDs include the level ID and authored content ID; walls and details without
source IDs use their authored array slots. Preserve that order when adjusting
coordinates; inserting or reordering those arrays requires an ID migration and a
new review baseline. This limitation does not affect ID-bearing fixed objects,
furniture or room floors.

- Level geometry and fixed placements: `apps/web/src/levels/<level>.ts#content`.
- Room attachments: `apps/web/src/levels/room-details.ts` and `house-lighting.ts`.
- Geometry, transforms and floor UVs: `packages/game-renderer/src/house.ts`.
- Native model and material sources: `assets/house`, `assets/food`,
  `assets/household`; URL mappings in `house-assets.ts`, `room-details.ts`, and
  `assets/tools/registry.ts`. SDK material IDs derive from stable model names and
  traversal order. Generated node suffixes map back to their containing GLB.

Coordinates are world metres with +Y up, unchanged from the renderer. Fixed
object heading is the negative of Three.js Y rotation (radians). Furniture
rotation is `quarterTurns * pi / 2`; its position is the X/Z bounds midpoint.
Apply placement changes to those authoritative definitions, preserving collision
bounds and baked contact geometry. Floor/wall edits require changing Geometry,
not just render meshes. Assembly movement is review context, not an independent
simulation layout setting. Flat clients lose assembly editing but retain actors.

## Appearance and limits

Capture exports full-height opaque wall models only, excluding duplicate
camera-cutaway representations. It retains native materials, floor UV scaling,
and embedded GLB textures. Doorway opacity is the game's deliberate 0.28.
Camera-dependent cutaways, selection rings, diagnostic overlays, grass/meadow,
sun glow, postprocessing, fly animation and player-added objects are excluded.
Scene is composition evidence; Asset detail carries supported texture maps.
Lighting and custom rendering effects are not pixel-identical game evidence.
There is no authored camera journey: free camera and fly-follow controllers
are interactive runtime behavior, so no Experience path is fabricated.

All texture URL metadata is checked before attachment. Embedded image sources
use the SDK's live texture transport. No signed or credential-bearing URL is
registered. The capture page owns its loaded resources and disposes them after
bridge detachment on navigation or hot reload. Catalog geometry is requested
progressively under SDK limits; no review frame loop runs in the game.

## Validation

Baseline: 109 JavaScript tests passed; one Rust-backed test and the build initially
failed because the local toolchain was Rust 1.84 and network access was restricted.
A temporary Rust 1.94.1 toolchain completed the baseline build; all 125 existing
JavaScript tests then passed. Bun 1.4.2 was used locally (the project declares
1.3.14); frozen dependency installation succeeded.

Final validation on 2026-09-09 (development URL: http://127.0.0.1:5193;
production preview: http://127.0.0.1:5195):

- Full production build passes, including Rust/WASM and both browser apps.
  Existing large-chunk warnings remain.
- TypeScript passes; 128 JavaScript tests pass, including 3 new adapter tests.
- Chromium: Open Window has 38 actors; Turn the Corner has 46. Both have one
  level assembly, stable actor IDs after reload, working progressive geometry
  requests and successful nonempty live tile-floor image transfers.
- Static discovery returns JSON with the official-editor CORS header. A dedicated
  Turn the Corner manifest keeps the selected level in editor deep links.
- A real cross-origin loopback parent receives an authorization rejection and
  no catalog. Same-origin requests succeed.
- The normal game renders without requesting any review module; no browser
  JavaScript errors occurred. The review page has event-driven rendering, no
  simulation worker or continuous animation loop.
- Screenshots were inspected for both capture previews. All registered models
  load from existing bundled GLBs. Capture has fewer than 50 actors and uses the
  SDK's 64 MiB progressive geometry ceiling; deferred construction is not needed
  for this bounded static representation. No navigation points are exported.

The GitHub Pages workflow built the Rust WASM game and published its static output
under `/fly-escape/`. The hosted game and both authored review levels loaded in
a live browser. Both discovery documents returned 200 with CORS; the hosted
capture generated editor links with the selected level and its discovery URL.

Not verified: a human feedback-export/source-change round trip and exhaustive
appearance comparison of every material. The full optional Python/Rust test suite
was not run; screenshots and command logs from the original local validation
were temporary, not committed historical evidence.

## SDK 0.9.0 update (2026-10-24)

The production source remains the existing `spatial-review-pages` branch and
`.github/workflows/pages.yml` deployment. This update uses the declared Bun
1.3.14 package manager and commits `bun.lock`. The web workspace pins
`@alterno-dev/spatial-review` 0.9.0; its transitive protocol resolves to 0.9.0.
There are no directly declared protocol, validator, or CLI dependencies. The
patched Three.js 0.185.1 version is unchanged.

Capture build IDs now include `fly-escape-sdk-0.9.0`, the GitHub/Vercel source
commit when available, the existing build timestamp, and the selected level.
No actor, asset, assembly, component, material, source reference, approved editor
origin, or registration boundary is intentionally changed. There are no static
geometry exports or prepared review packages to migrate: the production build
regenerates the live producer from source and each capture reloads its native
models. The ordinary game and asset-authoring source are unchanged.

### Appearance and resource review

`createReviewScene` continues cloning placement nodes while retaining shared
native geometry/material/texture resources. Native GLTF materials keep their
source `vertexColors` settings, RGB attributes, UVs and supported texture maps.
No blanket vertex-color enablement was added. Registered house and household
models use standard loaded materials; unsupported `ShaderMaterial` roots are
still rejected by the existing pre-bridge validation. The live game's shader
and diagnostic effects outside the registered artwork remain excluded.

Version 0.9.0 now carries supported UVs/maps into the Scene representation as
well as Asset. The representative subject is the tiled Room 2 floor in Open
Window (`open-window-room-2-floor`), with the corresponding Turn the Corner
floor checked by the existing browser test. The native tile-floor GLB is
325,504 B and embeds one 321,681 B, 1024 x 1024 PNG. Decoded RGBA8 storage is
4,194,304 B per unique image, and an RGBA8 GPU allocation with a complete mip
chain is approximately 5.33 MiB, separately from encoded transfer and geometry.
These are decoded/GPU estimates; actual driver allocations are not measured.
Live texture transfer was verified as nonempty, decodable image transport;
the source PNG length is not claimed as the live re-encoded transfer length.
Repeated placements keep canonical asset IDs and shared resources rather than
multiplying image storage by actor count.

Remaining appearance differences are the existing neutral review lighting,
opaque full-height walls instead of camera cutaways, deliberate 0.28 doorway
opacity, and exclusion of grass/meadow, sun glow, postprocessing, selection and
diagnostic overlays, animation and player-added objects. No authored Experience
route is exposed; interactive free camera/fly-follow is not a navigation export.

### Validation gates

A clean checkout of the actual publishing revision was used, excluding unrelated
source files from other branches. Exact toolchains: Bun 1.3.14, Rust 1.94.1,
wasm-pack 0.15.0, and the existing pinned Python requirements.

Before and after the dependency update:

- 35 Python tests passed (29 graph/metadata and 6 reference tests).
- 178 Rust tests passed; the existing one ignored test remains ignored.
- 128 JavaScript tests passed (32 client, 83 renderer, 2 asset tools, 11 web).
- The complete production build passed: type generation, brain assets,
  release Rust/WASM, game web application, and asset lab application.
- TypeScript checking and the existing Pages staging command passed.
- Frozen-lockfile installation succeeded; no other dependency version changed.

The final complete `bun run test` passed. Existing warnings about large Vite
chunks and test-environment GLTF blob-image loading do not fail the tests.
The separate real-browser texture requests succeeded.

The existing `tests/browser/spatial-review.mjs` assertions passed with a 640 x
400 viewport and the validation environment's proxy certificate trusted in a
disposable Chromium context. Both levels expose the same 38/46 actors and one
assembly, live tile images transfer successfully, refresh retains actor IDs,
and an unauthorized cross-origin loopback parent is rejected. The ordinary game
renders with no review-module request and no browser JavaScript error. The
original 1400 x 1000 smoke run passed both capture paths and authorization but
hit a software-GPU timeout on the ordinary-game canvas; the compact rerun
completed all assertions. This is not a hardware-GPU performance measurement.

The SDK remains absent from the ordinary game's runtime path, so the upgrade
adds no continuous review-only frame or resource work to visitor sessions.
Both capture previews render on demand through their existing controls.

### Published acceptance and remaining editor limitation

[Pages run 40123258600](https://github.com/rbifulco/fly-escape/actions/runs/40123258600)
succeeded for source commit `e95645d4e1e1088643d8e537df2007df6f73fbf5`.
Both deployed discovery documents returned HTTP 200 with JSON content type and
`Access-Control-Allow-Origin: *`. Starting with the ordinary website URL in the
official editor discovered the published capture and reported the exact build:
`fly-escape-sdk-0.9.0-e95645d4e1e1088643d8e537df2007df6f73fbf5-1792868504521-open-window`.

Read-only production checks confirmed:

- Scene loaded 38/38 asset meshes and one level assembly, with the expected
  stable actor/source IDs and no authored path references. The final Scene
  inspection cleared the selection (`Nothing selected`).
- Asset opened `open-window-room-2-floor`: 36 triangles, 64 vertices, four
  nodes, one material, geometry ready, and 1/1 texture ready. The ceramic UV
  layout and visible mapped surface were inspected.
- The floor's Asset component-selection outline remained during that visual
  inspection. Clicking empty canvas clears the selected asset as well and
  returns to the first wall asset. A bounded check found no exposed selection-
  outline toggle. Consequently the floor's fully unhighlighted Asset appearance
  comparison remains unverified; this is a consumer interaction limitation,
  not a passed check. Geometry, UV retention, decoded texture transfer and
  texture readiness were independently verified.
- No browser JavaScript error occurred. No feedback note, comment, or other
  persistent review edit was created. Existing feedback was not modified.

The deployed tile representation contains exactly 1,496 B of Scene geometry and
2,264 B of Asset geometry: 64 positions/UV entries and 108 Uint16 indices, plus
64 supplied normals in Asset. These are actual negotiated Float32/Uint16
attribute/index bytes. Its live PNG transfer was 422,244 B (re-encoded from the
321,681 B source PNG), decodable at 1024 x 1024. Decoded RGBA8 storage is 4 MiB,
with a one-upload full-mipmap estimate of 5.33 MiB. Capture readiness was 2.9 s,
metadata delivery 36 ms, and the representative Scene/Asset responses 8/4 ms
on the shared software-rendering host; these are observed samples rather than
a production performance guarantee.

The official-editor transport audit also covered the complete Open Window
Scene: 23 canonical assets for 38 actors use 1,053,712 B of negotiated typed
geometry buffers. Six unique image resource IDs transferred successfully,
totalling 21,436,771 B of PNG bytes and 67,108,864 B (64 MiB) of estimated
decoded RGBA8 storage. One RGBA8 upload with a complete mip chain per unique
image would use approximately 85.33 MiB. Actual GPU memory is not measured;
separate renderer/cache copies can add to that estimate. Shared image resources
are counted once, not once per placement or material binding. Only two assets
were requested in the Asset-detail profile during that audit, so its partial
aggregate is not reported as a full-catalog Asset cost.

The disposable editor validation context used a 1280 x 800 viewport and spaced
editor animation callbacks by 120 ms to reduce shared software-GPU contention.
No website or editor source was changed for that test. All validation browser
contexts were closed afterward. No Experience test applies because the producer
exports no authored journey.
