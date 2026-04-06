import kaplay from "kaplay";
import { loadMainMenuScene } from "./scenes/mainMenu";
import { loadGameScene } from "./scenes/game";
import { loadIntroScene } from "./scenes/intro";
import { loadCombatScene } from "./scenes/combat";
import { loadRuneForgeScene } from "./scenes/runeForge";
import { loadGameOverScene } from "./scenes/gameOver";

// Initialize KAPLAY
const k = kaplay({
  width: 1280,
  height: 720,
  background: [26, 26, 46],
  canvas: document.createElement("canvas"),
  global: false,
  letterbox: true,
  stretch: true,
});

document.body.appendChild(k.canvas);

// Load all scenes
loadMainMenuScene(k);
loadIntroScene(k);
loadGameScene(k);
loadCombatScene(k);
loadRuneForgeScene(k);
loadGameOverScene(k);

// Start at main menu
k.go("mainMenu");
