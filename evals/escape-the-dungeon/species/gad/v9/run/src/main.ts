import kaplay from "kaplay";

// Initialize KAPLAY
const k = kaplay({
  width: 960,
  height: 640,
  background: [20, 20, 40],
  canvas: document.createElement("canvas"),
  global: false,
});

document.body.appendChild(k.canvas);

// Export k for use in other modules
export { k };

// Register all scenes
import { titleScene } from "./scenes/title";
import { roomScene } from "./scenes/room";
import { combatScene } from "./scenes/combat";
import { forgeScene } from "./scenes/forge";
import { dialogueScene } from "./scenes/dialogue";

k.scene("title", () => titleScene(k));
k.scene("room", () => roomScene(k));
k.scene("combat", (enemyId: string) => combatScene(k, enemyId));
k.scene("forge", () => forgeScene(k));
k.scene("dialogue", (npcId: string) => dialogueScene(k, npcId));

// Start at title screen
k.go("title");
