import { expect, test } from "bun:test";
import * as THREE from "three";
import { HouseGeometry } from "../../../packages/game-renderer/src/house";
import { RoomDetails } from "../../../packages/game-renderer/src/room-details";
import { disposeObjectResources } from "../../../packages/game-renderer/src/resources";
import openWindow from "./levels/open-window";
import turnTheCorner from "./levels/turn-the-corner";
import { createReviewScene, assertReviewTexturesSafe } from "./spatial-review-scene";

for (const { level } of [openWindow, turnTheCorner]) {
  test(`${level.id}: independent placements, full walls, canonical assets and reversible coordinates`, () => {
    const house = new HouseGeometry(level.geometry, [{ roomId: 2, finish: "tile" }]);
    const template = new THREE.Group();
    template.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial()));
    const fixedModels = new Map(level.fixedObjects.map(item => [item.kind, template]));
    const input = { buildId: "test", title: level.id, level, house, fixedModels, details: [], roomDetails: new RoomDetails([], new Map()) };
    const { root, registry } = createReviewScene(input);
    expect(registry.size).toBe(level.geometry.walls.length + level.geometry.rooms.length + level.geometry.solids.length + level.fixedObjects.length);
    expect(registry.assemblySize).toBe(1);
    const scene = registry.toScene();
    expect(new Set(scene.actors.map(actor => actor.actorId)).size).toBe(registry.size);
    const wall = root.children.find(child => child.userData.spatialReviewAsset.actorId.endsWith('-wall-1'))!;
    expect(wall.children.length).toBe(1);
    expect(new THREE.Box3().setFromObject(wall).max.y).toBeCloseTo(2.5);
    expect(house.walls.children[0].children.length).toBe(4);
    for (const placement of level.fixedObjects) {
      const object = root.children.find(child => child.userData.spatialReviewAsset.actorId === `${level.id}-fixed-${placement.id}`)!;
      expect(object.position.toArray()).toEqual([placement.position.x, 0, placement.position.z]);
      expect(-object.rotation.y).toBeCloseTo(placement.heading);
      expect(object.userData.spatialReviewAsset.assetId).toBe(`object-${placement.kind}`);
    }
    expect(createReviewScene(input).registry.toScene().actors.map(actor => actor.actorId)).toEqual(scene.actors.map(actor => actor.actorId));
    expect(registry.toScene(false).actors.length).toBe(registry.size);
    disposeObjectResources(new THREE.Group().add(root, house.root, template));
  });
}

test("credential-bearing texture references fail before capture", () => {
  const map = new THREE.Texture();
  const root = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map }));
  for (const sourceRef of ["https://user:secret@example.com/image.png", "https://example.com/image.png?token=secret"]) {
    map.userData.sourceRef = sourceRef;
    expect(() => assertReviewTexturesSafe(root)).toThrow("Unsafe review texture reference");
  }
  map.userData.sourceRef = "https://example.com/image.png";
  expect(() => assertReviewTexturesSafe(root)).not.toThrow();
  disposeObjectResources(root);
});
