import kaplay from "kaplay";
import { registerScenes } from "./scenes";
import { ContentManager } from "./content";

// Initialize KAPLAY
const k = kaplay({
  width: 800,
  height: 600,
  background: [20, 20, 30],
  crisp: true,
  canvas: document.createElement("canvas"),
});

// Append canvas to body
document.body.appendChild(k.canvas);

// Load content packs, then start the game
async function boot() {
  await ContentManager.load();
  registerScenes(k);
  k.go("title");
}

boot();
