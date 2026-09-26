# Alterno Spatial Review integration

The requested integration uses the published Alterno SDK and a dedicated
`/spatial-review.html` page. The normal game does not load the SDK or bridge.
The official editor at https://spatial-review.alterno.dev may discover and
capture only the registered authored level artwork. Same-origin access is also
supported; other origins and cross-origin loopback access are disabled.
No deployment was made. Vercel routes add a discovery-only CORS header for the
official editor; framing defaults are unchanged. Both pages are embeddable under
the current host configuration.

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

Not verified: deployed response/framing behavior, hosted-editor UI acceptance,
a human feedback-export/source-change round trip, and exhaustive appearance
comparison of every material. The full optional Python/Rust test suite was not
run; this change is limited to browser integration. Screenshots and command logs
from local validation are temporary, not committed historical evidence.
