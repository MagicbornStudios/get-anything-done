import type { Player } from "../types";

const SAVE_KEY = "escape-the-dungeon-save";

export function saveGame(player: Player): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(player));
  } catch {
    console.warn("Failed to save game");
  }
}

export function loadGame(): Player | null {
  try {
    const data = localStorage.getItem(SAVE_KEY);
    if (!data) return null;
    return JSON.parse(data) as Player;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
