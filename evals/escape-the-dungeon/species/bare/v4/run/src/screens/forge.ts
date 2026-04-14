import type { GameState } from "../state";
import { saveGame } from "../state";
import { updateHUD, showScreen } from "../ui";
import { RUNES, findRecipe, type SpellRecipe } from "../data/runes";
import type { PlayerSpell } from "../data/spells";

export function enterForge(state: GameState, onDone: () => void): void {
  showScreen("forge-screen");
  updateHUD(state);

  const selectedRunes: string[] = [];
  renderForge(state, selectedRunes, null, onDone);
}

function renderForge(
  state: GameState,
  selectedRunes: string[],
  preview: SpellRecipe | null,
  onDone: () => void,
): void {
  const container = document.getElementById("forge-screen")!;

  let html = `<div class="forge-layout">`;

  // Header
  html += `<div style="text-align:center">`;
  html += `<h2 style="color:#ffaa44">🔨 Spell Forge</h2>`;
  html += `<p style="color:#aa8855;font-size:13px">Select two runes to combine into a spell. Each combination creates a unique effect.</p>`;
  html += `</div>`;

  // Rune grid
  html += `<div class="rune-grid">`;
  for (const rune of RUNES) {
    const isSelected = selectedRunes.includes(rune.id);
    const affinity = state.runeAffinity[rune.id] ?? 0;
    const affinityPct = Math.min(100, (affinity / 5) * 100);
    html += `<div class="rune-slot ${isSelected ? "selected" : ""}" data-rune="${rune.id}">`;
    html += `<span class="rune-symbol">${rune.symbol}</span>`;
    html += `<span class="rune-name">${rune.name}</span>`;
    html += `<div class="affinity-bar" style="width:50px"><div class="affinity-fill" style="width:${affinityPct}%"></div></div>`;
    html += `<span style="font-size:9px;color:#8a7a9a">${affinity.toFixed(1)}</span>`;
    html += `</div>`;
  }
  html += `</div>`;

  // Selected runes display
  html += `<div style="text-align:center;font-size:14px;color:#aa8855">`;
  if (selectedRunes.length === 0) {
    html += `Select your first rune...`;
  } else if (selectedRunes.length === 1) {
    const r = RUNES.find((r) => r.id === selectedRunes[0]);
    html += `${r?.symbol} ${r?.name} + ???`;
  } else {
    const r1 = RUNES.find((r) => r.id === selectedRunes[0]);
    const r2 = RUNES.find((r) => r.id === selectedRunes[1]);
    html += `${r1?.symbol} ${r1?.name} + ${r2?.symbol} ${r2?.name}`;
  }
  html += `</div>`;

  // Preview
  html += `<div class="craft-preview">`;
  if (preview) {
    const alreadyHas = state.spells.some(
      (s) => s.name === preview.spellName && s.crafted
    );
    html += `<h3 style="color:#ffaa44;margin-bottom:8px">${preview.icon} ${preview.spellName}</h3>`;
    html += `<p style="color:#c8c0b0;font-size:14px">${preview.description}</p>`;
    html += `<p style="color:#88aaff;font-size:13px;margin-top:4px">Mana Cost: ${preview.manaCost}</p>`;
    html += `<div style="margin:8px 0">`;
    for (const effect of preview.effects) {
      html += `<div style="font-size:12px;color:#c8c0b0">• ${effect.description}</div>`;
    }
    html += `</div>`;
    if (alreadyHas) {
      html += `<p style="color:#aa8855;font-size:13px">You already know this spell.</p>`;
    } else {
      html += `<button class="btn btn-forge" id="btn-craft">⚒️ Craft Spell</button>`;
    }
  } else {
    html += `<p style="color:#666">Select two runes to preview a spell...</p>`;
  }
  html += `</div>`;

  // Affinity training section
  html += `<div style="text-align:center;padding:12px;background:rgba(30,25,50,0.6);border-radius:10px;border:1px solid #3a2a5a">`;
  html += `<h3 style="color:#bb88ff;margin-bottom:8px">Affinity Training</h3>`;
  html += `<p style="color:#8a7a9a;font-size:12px;margin-bottom:8px">Spend XP to boost rune affinity. Higher affinity = stronger crafted spells.</p>`;
  html += `<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center">`;
  for (const rune of RUNES) {
    const cost = 10;
    const canTrain = state.xp >= cost;
    html += `<button class="btn btn-small ${canTrain ? "" : ""}" data-train="${rune.id}" ${canTrain ? "" : 'disabled style="opacity:0.4"'}>`;
    html += `${rune.symbol} Train (${cost} XP)`;
    html += `</button>`;
  }
  html += `</div></div>`;

  // Known spells
  html += `<div style="padding:12px;background:rgba(20,15,35,0.6);border-radius:10px;border:1px solid #2a2040">`;
  html += `<h3 style="color:#88aaff;margin-bottom:8px;text-align:center">Known Spells</h3>`;
  const craftedSpells = state.spells.filter((s) => s.crafted);
  if (craftedSpells.length === 0) {
    html += `<p style="color:#666;text-align:center;font-size:13px">No crafted spells yet. Combine runes above!</p>`;
  } else {
    for (const spell of craftedSpells) {
      html += `<div style="display:flex;align-items:center;gap:8px;padding:6px;margin:4px 0;background:rgba(40,30,10,0.4);border-radius:6px;border:1px solid #4a3a2a">`;
      html += `<span style="font-size:20px">${spell.icon}</span>`;
      html += `<div><div style="font-size:13px">${spell.name}</div><div style="font-size:11px;color:#8a7a9a">${spell.manaCost} MP — ${spell.description}</div></div>`;
      html += `</div>`;
    }
  }
  html += `</div>`;

  // Back button
  html += `<div style="text-align:center;margin-top:8px">`;
  html += `<button class="btn" id="btn-forge-done">← Leave Forge</button>`;
  html += `</div>`;

  html += `</div>`;
  container.innerHTML = html;

  // Bind rune clicks
  container.querySelectorAll("[data-rune]").forEach((el) => {
    el.addEventListener("click", () => {
      const runeId = (el as HTMLElement).dataset.rune!;
      const idx = selectedRunes.indexOf(runeId);

      if (idx >= 0) {
        selectedRunes.splice(idx, 1);
      } else if (selectedRunes.length < 2) {
        selectedRunes.push(runeId);
      } else {
        // Replace second rune
        selectedRunes[1] = runeId;
      }

      let newPreview: SpellRecipe | null = null;
      if (selectedRunes.length === 2) {
        newPreview = findRecipe(selectedRunes[0], selectedRunes[1]) ?? null;
      }
      renderForge(state, selectedRunes, newPreview, onDone);
    });
  });

  // Craft button
  const craftBtn = document.getElementById("btn-craft");
  if (craftBtn && preview) {
    craftBtn.addEventListener("click", () => {
      // Create the spell
      const newSpell: PlayerSpell = {
        id: `crafted_${Date.now()}`,
        name: preview.spellName,
        icon: preview.icon,
        manaCost: preview.manaCost,
        effects: preview.effects,
        description: preview.description,
        crafted: true,
        runeIds: [...preview.runes],
        element: preview.effects[0]?.element ?? "arcane",
      };

      // Apply affinity bonus to crafted spell damage
      const avgAffinity = preview.runes.reduce((sum, rid) => sum + (state.runeAffinity[rid] ?? 0), 0) / preview.runes.length;
      if (avgAffinity > 0) {
        for (const effect of newSpell.effects) {
          if (effect.type === "damage" || effect.type === "dot") {
            effect.power += Math.floor(avgAffinity * 2);
          }
        }
      }

      state.spells.push(newSpell);

      // Boost affinity from crafting
      for (const runeId of preview.runes) {
        state.runeAffinity[runeId] = (state.runeAffinity[runeId] ?? 0) + 0.5;
      }

      saveGame(state);
      renderForge(state, [], null, onDone);
    });
  }

  // Training buttons
  container.querySelectorAll("[data-train]").forEach((el) => {
    el.addEventListener("click", () => {
      const runeId = (el as HTMLElement).dataset.train!;
      const cost = 10;
      if (state.xp >= cost) {
        state.xp -= cost;
        state.runeAffinity[runeId] = (state.runeAffinity[runeId] ?? 0) + 0.5;
        saveGame(state);
        renderForge(state, selectedRunes, preview, onDone);
      }
    });
  });

  // Done button
  document.getElementById("btn-forge-done")!.addEventListener("click", onDone);
}
