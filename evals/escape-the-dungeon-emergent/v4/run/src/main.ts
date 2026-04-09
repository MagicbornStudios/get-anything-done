import "iconify-icon";
import "./styles.css";
import { loadContent } from "./content";
import { createNewGame, loadGame } from "./state";
import { UI } from "./ui";

async function main() {
  const root = document.getElementById("app");
  if (!root) throw new Error("#app not found");

  root.innerHTML = `<div class="frame"><div class="title-screen"><div class="hero"><iconify-icon icon="game-icons:hourglass"></iconify-icon></div><h1>LOADING</h1></div></div>`;

  let content;
  try {
    content = await loadContent();
  } catch (e) {
    root.innerHTML = `<div class="frame"><div class="title-screen"><h1>Failed to load</h1><p>${(e as Error).message}</p></div></div>`;
    return;
  }

  const ui = new UI(
    root,
    content,
    () => {
      const state = createNewGame(content!);
      ui.setState(state);
      ui.render();
    },
    () => {
      const loaded = loadGame();
      if (!loaded) return false;
      ui.setState(loaded);
      ui.render();
      return true;
    }
  );

  // Initial: try auto-load, otherwise title
  const existing = loadGame();
  if (existing) {
    ui.setState(existing);
    existing.view = "title"; // show title with continue option
  }
  ui.render();
}

main();
