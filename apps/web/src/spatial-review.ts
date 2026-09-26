import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { attachSceneAssetRegistryBridge, attachSpatialReviewDiscoveryBridge, createSpatialReviewEditorAuthorization, spatialReviewEditorUrl } from "@alterno-dev/spatial-review";
import { HouseGeometry } from "../../../packages/game-renderer/src/house";
import { loadHouseAssets } from "../../../packages/game-renderer/src/house-assets";
import { loadRoomDetails, type RoomDetails } from "../../../packages/game-renderer/src/room-details";
import { loadPlacementModel } from "../../../packages/game-renderer/src/placement-models";
import { disposeObjectResources } from "../../../packages/game-renderer/src/resources";
import { placementAssetUrls } from "../../../assets/tools/registry";
import { campaignLevels } from "./campaign-content";
import { createReviewScene } from "./spatial-review-scene";

declare const __SPATIAL_REVIEW_BUILD_ID__: string;
const status = document.querySelector<HTMLParagraphElement>("#status")!;
const select = document.querySelector<HTMLSelectElement>("#level")!;
const requested = new URLSearchParams(location.search).get("level") ?? "open-window";
const selected = campaignLevels.find(item => item.level.id === requested);
select.value = requested;
select.addEventListener("change", () => { location.href = `?level=${encodeURIComponent(select.value)}`; });
const discoveryUrl = `${import.meta.env.BASE_URL}.well-known/spatial-review${requested === "turn-the-corner" ? "-turn-the-corner" : ""}.json`;
document.querySelector<HTMLAnchorElement>("#editor")!.href = spatialReviewEditorUrl(location.href, { discoveryUrl });

const authorization = createSpatialReviewEditorAuthorization({
  allowOfficialEditor: true,
  allowLoopbackPeers: false,
  allowedOrigins: [],
  advertiseEditorOriginPolicy: { publicOrigins: ["https://spatial-review.alterno.dev"] },
});
const detachDiscovery = attachSpatialReviewDiscoveryBridge({
  name: `Fly Escape — ${selected?.title ?? "Spatial Review"}`,
  websiteUrl: location.href,
  discoveryUrl,
  liveCapture: location.href,
}, authorization);
let active = true;
let detachCapture: (() => void) | undefined;
let disposePreview: (() => void) | undefined;
const owned = new THREE.Group();
const isCurrent = () => active;
function dispose() {
  active = false;
  detachCapture?.();
  detachDiscovery();
  disposePreview?.();
  disposeObjectResources(owned);
  owned.clear();
}
window.addEventListener("pagehide", dispose, { once: true });
// A restored bfcache document needs new bridge listeners and fresh resources.
window.addEventListener("pageshow", event => { if (event.persisted) location.reload(); });
if (import.meta.hot) import.meta.hot.dispose(dispose);

async function start() {
  if (!selected) throw new Error(`Unknown review level: ${requested}`);
  const { level, title } = selected;
  const house = new HouseGeometry(level.geometry, selected.roomFloors);
  owned.add(house.root);
  let roomDetails: RoomDetails | undefined;
  const fixedModels = new Map<string, THREE.Group>();
  const results = await Promise.allSettled([
    loadHouseAssets({ houseAssetKeys: house.assetKeys, setHousePart: (part, root) => house.replace(part, root) }, isCurrent),
    loadRoomDetails({ setRoomDetails: details => { roomDetails = details; owned.add(details.root); } }, selected.roomDetails ?? [], isCurrent),
    ...[...new Set(level.fixedObjects.map(object => object.kind))].map(async kind => {
      const response = await fetch(placementAssetUrls[kind]);
      if (!response.ok) throw new Error(`${kind} asset request failed (${response.status})`);
      const model = await loadPlacementModel(await response.arrayBuffer(), kind);
      if (!active) { model.dispose(); return; }
      owned.add(model.root);
      fixedModels.set(kind, model.root);
    }),
  ]);
  if (!active) return;
  const failure = results.find(result => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
  if (!roomDetails) throw new Error("Room details did not finish loading");
  const { root, registry } = createReviewScene({ buildId: `${__SPATIAL_REVIEW_BUILD_ID__}-${level.id}`, title, level, house, details: selected.roomDetails ?? [], roomDetails, fixedModels });
  owned.add(root);
  disposePreview = preview(root);
  detachCapture = attachSceneAssetRegistryBridge(registry, { authorization, maxGeometryBytes: 64 * 1024 * 1024 });
  status.textContent = `${title} ready for review. Select individual objects in Alterno.`;
  status.dataset.state = "ready";
}

function preview(root: THREE.Group) {
  const container = document.querySelector<HTMLDivElement>("#world")!;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#eef1e7");
  scene.add(root, new THREE.HemisphereLight("#fff0cb", "#718d80", 2.5));
  const sun = new THREE.DirectionalLight("#ffe0a0", 3.4);
  sun.position.set(10, 20, 10);
  scene.add(sun);
  const bounds = new THREE.Box3().setFromObject(root);
  const center = bounds.getCenter(new THREE.Vector3());
  const span = bounds.getSize(new THREE.Vector3()).length();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
  camera.position.copy(center).add(new THREE.Vector3(span * 0.65, span, span * 0.8));
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(center);
  controls.update();
  const render = () => renderer.render(scene, camera);
  const resize = () => {
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    render();
  };
  controls.addEventListener("change", render);
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  return () => {
    observer.disconnect(); controls.dispose(); renderer.dispose(); renderer.domElement.remove();
    // Return shared capture resources to their disposal owner.
    owned.add(root);
  };
}

start().catch(error => {
  dispose();
  status.textContent = `Review unavailable: ${error instanceof Error ? error.message : String(error)}`;
  status.dataset.state = "error";
});
