import type { KAPLAYCtx } from "kaplay";
import { titleScene } from "./title";
import { roomScene } from "./room";
import { combatScene } from "./combat";
import { dialogueScene } from "./dialogue";
import { statsScene, bagScene, spellbookScene, mapScene } from "./menus";
import { createNewGame, loadGame } from "../state";

export function registerScenes(k: KAPLAYCtx) {
  // Title / main menu
  k.scene("title", () => titleScene(k));

  // New game -- create state, then go to room
  k.scene("newgame", () => {
    createNewGame();
    k.go("room");
  });

  // Load game -- load state, then go to room
  k.scene("loadgame", () => {
    const state = loadGame();
    if (state) {
      k.go("room");
    } else {
      k.go("title");
    }
  });

  // Room exploration
  k.scene("room", () => roomScene(k));

  // Combat
  k.scene("combat", (data: { enemyId: string; isBoss: boolean }) => {
    combatScene(k, data);
  });

  // Dialogue
  k.scene("dialogue", (data: { dialogueId: string }) => {
    dialogueScene(k, data);
  });

  // Menus
  k.scene("stats", () => statsScene(k));
  k.scene("bag", () => bagScene(k));
  k.scene("spellbook", () => spellbookScene(k));
  k.scene("map", () => mapScene(k));
}
