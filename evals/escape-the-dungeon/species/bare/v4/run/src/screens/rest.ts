import type { GameState } from "../state";
import { saveGame } from "../state";
import { updateHUD, showScreen } from "../ui";

export function enterRest(state: GameState, onDone: () => void): void {
  showScreen("rest-screen");
  updateHUD(state);

  const container = document.getElementById("rest-screen")!;

  // Restore up to 60% of max (not full restore — pressure mechanic)
  const hpCap = Math.floor(state.stats.maxHp * 0.6);
  const manaCap = Math.floor(state.stats.maxMana * 0.6);

  const hpRestore = Math.min(hpCap, state.stats.maxHp - state.stats.currentHp);
  const manaRestore = Math.min(manaCap, state.stats.maxMana - state.stats.currentMana);

  let html = `<div class="rest-panel">`;
  html += `<h2 style="color:#88aacc;margin-bottom:16px">🏕️ Resting...</h2>`;
  html += `<p style="color:#c0d0e0;margin-bottom:12px">You take a moment to recover. The spring's healing is limited.</p>`;
  html += `<div style="margin:16px 0;font-size:15px">`;

  if (hpRestore > 0) {
    html += `<p style="color:#66ff88">❤️ Restored ${hpRestore} HP</p>`;
  }
  if (manaRestore > 0) {
    html += `<p style="color:#66aaff">💎 Restored ${manaRestore} Mana</p>`;
  }
  if (hpRestore === 0 && manaRestore === 0) {
    html += `<p style="color:#8a7a9a">You're already well-rested.</p>`;
  }

  html += `</div>`;
  html += `<p style="color:#aa8855;font-size:12px;margin-bottom:16px">Rest rooms restore up to 60% of your maximum. For full recovery, use potions.</p>`;
  html += `<button class="btn" id="btn-rest-done">Continue →</button>`;
  html += `</div>`;

  container.innerHTML = html;

  // Apply healing
  state.stats.currentHp = Math.min(state.stats.maxHp, state.stats.currentHp + hpRestore);
  state.stats.currentMana = Math.min(state.stats.maxMana, state.stats.currentMana + manaRestore);
  state.statusEffects = []; // Clear status effects on rest

  saveGame(state);
  updateHUD(state);

  document.getElementById("btn-rest-done")!.addEventListener("click", onDone);
}
