import kaplay from "kaplay";
import { titleScene } from "./scenes/title";
import { roomScene } from "./scenes/room";
import { combatScene } from "./scenes/combat";
import { forgeScene } from "./scenes/forge";
import { dialogueScene } from "./scenes/dialogue";

// Initialize KAPLAY
const k = kaplay({
  width: 960,
  height: 640,
  background: [10, 10, 26],
  canvas: undefined,
  global: false,
  scale: 1,
  crisp: true,
});

// Register all scenes
k.scene("title", () => titleScene(k));
k.scene("room", () => roomScene(k));
k.scene("combat", (enemyId: string) => combatScene(k, enemyId));
k.scene("forge", () => forgeScene(k));
k.scene("dialogue", (npcId: string) => dialogueScene(k, npcId));

// Start at title
k.go("title");
