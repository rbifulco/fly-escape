import * as THREE from "three";
import { SceneAssetRegistry } from "@alterno-dev/spatial-review";
import type { LevelDef } from "@fly-escape/sim-client";
import type { HouseGeometry } from "../../../packages/game-renderer/src/house";
import type { RoomDetail, RoomDetails } from "../../../packages/game-renderer/src/room-details";

/** Static authored artwork only; the ordinary renderer never calls this adapter. */
export function createReviewScene(input: {
  buildId: string; title: string; level: LevelDef; house: HouseGeometry;
  details: readonly RoomDetail[]; roomDetails: RoomDetails;
  fixedModels: ReadonlyMap<string, THREE.Group>;
}) {
  const { level, house } = input;
  const registry = new SceneAssetRegistry(input.buildId);
  const root = new THREE.Group();
  root.name = input.title;
  const source = `apps/web/src/levels/${level.id}.ts#content`;
  const assemblyId = `level-${level.id}`;
  registry.registerAssembly({ assemblyId, name: input.title, sourceRef: source, root });
  const register = (object: THREE.Object3D, key: string, assetId: string, name: string, category: string, sourceRef = source) => {
    root.add(object);
    registry.register({ actorId: `${level.id}-${key}`, assetId, name, category, sourceRef, parentAssemblyId: assemblyId, root: object });
  };
  // Keep full walls only. The other children are overlapping cutaway render passes.
  house.walls.children.forEach((wall, index) => {
    const copy = wall.clone(false);
    copy.add(wall.children[0].clone(true));
    register(copy, `wall-${index + 1}`, "house-wall", `Wall ${index + 1}`, "Walls");
  });
  house.floors.children.forEach(floor => {
    const roomId = floor.userData.roomId;
    // UV tiling is baked per room, so differently sized floors are distinct assets.
    register(floor.clone(true), `room-${roomId}-floor`, `${level.id}-room-${roomId}-floor`, `Room ${roomId} floor`, "Floors");
  });
  house.solids.children.forEach((solid, index) => {
    const prop = level.geometry.solids[index];
    const model = prop.furnishing?.model ?? "solid";
    register(solid.clone(true), `furniture-${prop.id}`, model === "solid" ? `${level.id}-solid-${prop.id}` : `house-${model}`, `${model} ${prop.id}`, "Furniture");
  });
  const mounts = input.roomDetails.root.children.filter(child => !(child instanceof THREE.Light));
  input.details.forEach((detail, index) => {
    const assetId = detail.kind === "doorway" ? `house-doorway-${detail.width}` : `house-${detail.kind}`;
    register(mounts[index].clone(true), `detail-${index + 1}`, assetId, `${detail.kind} ${index + 1}`, "Wall details", "apps/web/src/levels/room-details.ts");
  });
  for (const placement of level.fixedObjects) {
    const model = input.fixedModels.get(placement.kind);
    if (!model) throw new Error(`Missing fixed object model: ${placement.kind}`);
    const copy = model.clone(true);
    copy.position.set(placement.position.x, 0, placement.position.z);
    copy.rotation.y = -placement.heading;
    register(copy, `fixed-${placement.id}`, `object-${placement.kind}`, `${placement.kind} ${placement.id}`, "Fixed objects");
  }
  root.updateMatrixWorld(true);
  assertReviewTexturesSafe(root);
  return { root, registry };
}

/** Fail closed before attaching a bridge; only bundled/decoded artwork is expected. */
export function assertReviewTexturesSafe(root: THREE.Object3D): void {
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material instanceof THREE.ShaderMaterial) throw new Error(`Unsupported review shader: ${material.name}`);
      for (const value of Object.values(material)) {
        if (!(value instanceof THREE.Texture)) continue;
        const image = value.source.data;
        for (const raw of [value.userData.sourceRef, value.userData.requestUrl, image?.currentSrc, image?.src]) {
          if (typeof raw !== "string" || !raw) continue;
          const url = new URL(raw, "https://review.invalid/");
          if (url.username || url.password || url.search || !["https:", "http:", "blob:", "data:"].includes(url.protocol))
            throw new Error(`Unsafe review texture reference on ${material.name || object.name}`);
        }
      }
    }
  });
}
