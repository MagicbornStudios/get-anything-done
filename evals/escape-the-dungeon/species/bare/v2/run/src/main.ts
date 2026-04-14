import kaplay from "kaplay";
import { titleScene } from "./scenes/title";
import { roomScene } from "./scenes/room";
import { combatScene, combatSpellsScene, combatBagScene } from "./scenes/combat";
import { dialogueScene, dialogueResponseScene, type DialogueResponseData } from "./scenes/dialogue";
import { statsScene } from "./scenes/stats";
import { bagScene } from "./scenes/bag";
import { mapScene } from "./scenes/map";
import { gameoverScene } from "./scenes/gameover";

// Initialize KAPLAY - it auto-creates and appends a canvas to document.body
const k = kaplay({
  width: 640,
  height: 480,
  background: [26, 26, 46],
  crisp: true,
  global: false,
});

// Register all scenes
k.scene("title", () => titleScene(k));
k.scene("room", () => roomScene(k));
k.scene("combat", (roomId: string) => combatScene(k, roomId));
k.scene("combatSpells", (roomId: string) => combatSpellsScene(k, roomId));
k.scene("combatBag", (roomId: string) => combatBagScene(k, roomId));
k.scene("dialogue", (npcId: string) => dialogueScene(k, npcId));
k.scene("dialogueResponse", (data: DialogueResponseData) =>
  dialogueResponseScene(k, data)
);
k.scene("stats", () => statsScene(k));
k.scene("bag", () => bagScene(k));
k.scene("map", () => mapScene(k));
k.scene("gameover", () => gameoverScene(k));

// Start at title
k.go("title");
