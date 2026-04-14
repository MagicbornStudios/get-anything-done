import { createNewGame, loadGame, hasSave, deleteSave, type GameState } from "./state";
import { showScreen, hideHUD, updateHUD, openOverlay, closeAllOverlays } from "./ui";
import { enterRoom } from "./screens/room";

// Game initialization
let gameState: GameState | null = null;

function init(): void {
  // Check for save
  if (hasSave()) {
    const continueBtn = document.getElementById("btn-continue")!;
    continueBtn.style.display = "block";
    continueBtn.addEventListener("click", () => {
      gameState = loadGame();
      if (gameState) {
        startGame();
      }
    });
  }

  // New Game button
  document.getElementById("btn-new-game")!.addEventListener("click", () => {
    deleteSave();
    gameState = createNewGame();
    startGame();
  });

  // Restart buttons
  document.getElementById("btn-restart")!.addEventListener("click", () => {
    deleteSave();
    gameState = createNewGame();
    startGame();
  });
  document.getElementById("btn-victory-restart")!.addEventListener("click", () => {
    deleteSave();
    gameState = createNewGame();
    startGame();
  });

  // Expose overlay controls for menu bar
  (window as any).game = {
    openOverlay: (name: string) => {
      if (gameState) openOverlay(name, gameState);
    },
    closeOverlay: () => {
      closeAllOverlays();
    },
  };

  // Keyboard shortcut for closing overlays
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllOverlays();
    }
  });
}

function startGame(): void {
  if (!gameState) return;
  updateHUD(gameState);
  enterRoom(gameState);
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", init);
