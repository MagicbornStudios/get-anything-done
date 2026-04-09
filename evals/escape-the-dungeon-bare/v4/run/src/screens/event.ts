import type { GameState } from "../state";
import { addItem, saveGame } from "../state";
import { updateHUD, showScreen } from "../ui";
import { EVENTS } from "../data/events";

export function enterEvent(state: GameState, eventId: string, onDone: () => void): void {
  showScreen("event-screen");
  updateHUD(state);

  const event = EVENTS[eventId];
  if (!event) {
    onDone();
    return;
  }

  renderEvent(state, event, null, onDone);
}

function renderEvent(
  state: GameState,
  event: typeof EVENTS[string],
  outcomeText: string | null,
  onDone: () => void,
): void {
  const container = document.getElementById("event-screen")!;

  let html = `<div class="event-panel" style="max-width:500px;margin:0 auto">`;
  html += `<div class="npc-portrait">${event.npcPortrait}</div>`;
  html += `<div class="npc-name">${event.npcName}</div>`;

  if (outcomeText) {
    html += `<div class="dialogue-text">${outcomeText}</div>`;
    html += `<button class="btn" id="btn-event-done">Continue →</button>`;
  } else {
    html += `<div class="dialogue-text">${event.greeting}</div>`;
    html += `<div class="choice-buttons">`;
    for (let i = 0; i < event.choices.length; i++) {
      const choice = event.choices[i];
      let canChoose = true;

      // Check requirements
      if (choice.requires) {
        if (choice.requires.stat === "crystals" && choice.requires.minValue) {
          canChoose = state.crystals >= choice.requires.minValue;
        }
      }

      html += `<button class="btn ${canChoose ? "btn-success" : ""}" data-choice="${i}" ${canChoose ? "" : 'disabled style="opacity:0.4"'}>`;
      html += choice.text;
      if (!canChoose && choice.requires?.stat === "crystals") {
        html += ` (Need ${choice.requires.minValue} crystals)`;
      }
      html += `</button>`;
    }
    html += `</div>`;
  }

  html += `</div>`;
  container.innerHTML = html;

  // Bind choice buttons
  container.querySelectorAll("[data-choice]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt((btn as HTMLElement).dataset.choice!, 10);
      const choice = event.choices[idx];
      if (!choice) return;

      // Apply effects
      for (const effect of choice.outcome.effects) {
        switch (effect.type) {
          case "give_item":
            if (effect.itemId) addItem(state, effect.itemId, effect.count ?? 1);
            break;
          case "heal_hp":
            state.stats.currentHp = Math.min(state.stats.maxHp, state.stats.currentHp + (effect.amount ?? 0));
            break;
          case "heal_mana":
            state.stats.currentMana = Math.min(state.stats.maxMana, state.stats.currentMana + (effect.amount ?? 0));
            break;
          case "give_crystals":
            state.crystals += effect.amount ?? 0;
            break;
          case "give_xp":
            state.xp += effect.amount ?? 0;
            break;
          case "damage_hp":
            state.stats.currentHp -= effect.amount ?? 0;
            break;
          case "give_rune_affinity":
            if (effect.runeId) {
              state.runeAffinity[effect.runeId] = (state.runeAffinity[effect.runeId] ?? 0) + (effect.amount ?? 1);
            }
            break;
        }
      }

      saveGame(state);
      updateHUD(state);
      renderEvent(state, event, choice.outcome.text, onDone);
    });
  });

  // Done button
  const doneBtn = document.getElementById("btn-event-done");
  if (doneBtn) {
    doneBtn.addEventListener("click", onDone);
  }
}
