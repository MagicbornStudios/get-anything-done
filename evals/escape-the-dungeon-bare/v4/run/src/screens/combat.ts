import type { EnemyType } from "../data/entities";
import type { GameState } from "../state";
import { checkLevelUp, addItem, saveGame } from "../state";
import { updateHUD, showScreen, renderResistanceBadges, renderHPBar } from "../ui";
import { createCombatEnemy, processPlayerAction, type CombatEnemy, type LogEntry } from "../combat";
import { ITEMS } from "../data/items";

export function enterCombat(
  state: GameState,
  enemyTemplate: EnemyType,
  onVictory: () => void,
  onFlee: () => void,
): void {
  state.inCombat = true;
  state.combatTurn = 0;
  state.statusEffects = [];

  const enemy = createCombatEnemy(enemyTemplate);
  const combatLog: LogEntry[] = [];

  combatLog.push({ text: `A ${enemyTemplate.name} appears!`, type: "info" });
  if (enemyTemplate.behavior === "reflector") {
    combatLog.push({ text: "⚠️ This enemy reflects direct damage!", type: "resist" });
  }
  if (enemyTemplate.behavior === "mana_drain") {
    combatLog.push({ text: "⚠️ This enemy drains your mana!", type: "spell" });
  }
  if (enemyTemplate.behavior === "regenerator") {
    combatLog.push({ text: "⚠️ This enemy regenerates HP each turn!", type: "heal" });
  }

  showScreen("combat-screen");
  renderCombat(state, enemy, combatLog, onVictory, onFlee);
}

function renderCombat(
  state: GameState,
  enemy: CombatEnemy,
  log: LogEntry[],
  onVictory: () => void,
  onFlee: () => void,
  showSpells: boolean = false,
  showItems: boolean = false,
): void {
  updateHUD(state);
  const container = document.getElementById("combat-screen")!;

  let html = `<div class="combat-layout">`;

  // Enemy panel
  html += `<div class="enemy-panel">`;
  html += `<div class="enemy-sprite">${enemy.template.sprite}</div>`;
  html += `<div class="enemy-name">${enemy.template.name}</div>`;
  html += `<div class="enemy-info">${enemy.template.description}</div>`;
  html += `<div style="margin:8px 0">${renderResistanceBadges(enemy.template.resistances)}</div>`;
  html += `<div style="display:flex;justify-content:center;gap:8px;align-items:center">`;
  html += `<span style="color:#ff4444">HP:</span>`;
  html += renderHPBar(enemy.currentHp, enemy.maxHp, "hp");
  html += `</div>`;

  // Show enemy status effects
  if (enemy.statusEffects.length > 0) {
    html += `<div style="margin-top:8px;font-size:12px">`;
    for (const se of enemy.statusEffects) {
      html += `<span style="color:#ffaa44;margin:0 4px">⏱️ ${se.name} (${se.turnsRemaining}t)</span>`;
    }
    html += `</div>`;
  }
  html += `</div>`;

  // Player status effects
  if (state.statusEffects.length > 0) {
    html += `<div style="text-align:center;font-size:12px;color:#ff8844">`;
    for (const se of state.statusEffects) {
      html += `<span style="margin:0 4px">⏱️ ${se.name} (${se.turnsRemaining}t)</span>`;
    }
    html += `</div>`;
  }

  // Combat log
  html += `<div class="combat-log">`;
  const recentLog = log.slice(-8);
  for (const entry of recentLog) {
    html += `<div class="log-entry log-${entry.type}">${entry.text}</div>`;
  }
  html += `</div>`;

  // Actions
  if (showSpells) {
    html += `<div class="spell-list">`;
    for (const spell of state.spells) {
      const canCast = state.stats.currentMana >= spell.manaCost;
      const cls = canCast ? `btn btn-small spell-btn spell-type-${spell.element}` : "btn btn-small spell-btn";
      html += `<button class="${cls}" data-spell="${spell.id}" ${canCast ? "" : "disabled style='opacity:0.4'"}>`;
      html += `${spell.icon} ${spell.name}<br><span class="spell-cost">${spell.manaCost} MP</span>`;
      html += `</button>`;
    }
    html += `<button class="btn btn-small" id="btn-back-actions">← Back</button>`;
    html += `</div>`;
  } else if (showItems) {
    html += `<div class="spell-list">`;
    const usableItems = state.inventory.filter((i) => ITEMS[i.itemId]?.type === "consumable");
    if (usableItems.length === 0) {
      html += `<p style="color:#8a7a9a">No usable items.</p>`;
    }
    for (const inv of usableItems) {
      const item = ITEMS[inv.itemId];
      if (!item) continue;
      html += `<button class="btn btn-small" data-item="${item.id}">`;
      html += `${item.icon} ${item.name} x${inv.count}`;
      html += `</button>`;
    }
    html += `<button class="btn btn-small" id="btn-back-actions">← Back</button>`;
    html += `</div>`;
  } else {
    html += `<div class="combat-actions">`;
    html += `<button class="btn" id="btn-fight">⚔️ Fight</button>`;
    html += `<button class="btn" id="btn-spells">✨ Spells</button>`;
    html += `<button class="btn" id="btn-bag">🎒 Bag</button>`;
    html += `<button class="btn btn-danger" id="btn-run">🏃 Run</button>`;
    html += `</div>`;
  }

  html += `</div>`;
  container.innerHTML = html;

  // Bind events
  const bindAction = (id: string, action: () => void) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", action);
  };

  // Main action buttons
  bindAction("btn-fight", () => {
    const result = processPlayerAction(state, enemy, { type: "attack" });
    log.push(...result.messages);
    handleResult(state, enemy, result, log, onVictory, onFlee);
  });

  bindAction("btn-spells", () => {
    renderCombat(state, enemy, log, onVictory, onFlee, true, false);
  });

  bindAction("btn-bag", () => {
    renderCombat(state, enemy, log, onVictory, onFlee, false, true);
  });

  bindAction("btn-run", () => {
    const result = processPlayerAction(state, enemy, { type: "flee" });
    log.push(...result.messages);
    if (result.fled) {
      state.inCombat = false;
      onFlee();
    } else {
      handleResult(state, enemy, result, log, onVictory, onFlee);
    }
  });

  bindAction("btn-back-actions", () => {
    renderCombat(state, enemy, log, onVictory, onFlee, false, false);
  });

  // Spell buttons
  container.querySelectorAll("[data-spell]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const spellId = (btn as HTMLElement).dataset.spell!;
      const result = processPlayerAction(state, enemy, { type: "spell", spellId });
      log.push(...result.messages);
      handleResult(state, enemy, result, log, onVictory, onFlee);
    });
  });

  // Item buttons
  container.querySelectorAll("[data-item]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const itemId = (btn as HTMLElement).dataset.item!;
      const item = ITEMS[itemId];
      if (!item?.effect) return;

      // Apply item effect
      if (item.effect.type === "heal_hp") {
        state.stats.currentHp = Math.min(state.stats.maxHp, state.stats.currentHp + item.effect.amount);
        log.push({ text: `Used ${item.name}. Restored ${item.effect.amount} HP!`, type: "heal" });
      } else if (item.effect.type === "heal_mana") {
        state.stats.currentMana = Math.min(state.stats.maxMana, state.stats.currentMana + item.effect.amount);
        log.push({ text: `Used ${item.name}. Restored ${item.effect.amount} Mana!`, type: "heal" });
      } else if (item.effect.type === "buff_might") {
        state.statusEffects.push({
          name: "Might Boost",
          type: "buff_might",
          power: item.effect.amount,
          turnsRemaining: item.effect.duration ?? 3,
        });
        state.stats.might += item.effect.amount;
        log.push({ text: `Used ${item.name}. Might +${item.effect.amount} for ${item.effect.duration} turns!`, type: "info" });
      } else if (item.effect.type === "buff_defense") {
        state.statusEffects.push({
          name: "Defense Boost",
          type: "buff_defense",
          power: item.effect.amount,
          turnsRemaining: item.effect.duration ?? 3,
        });
        state.stats.defense += item.effect.amount;
        log.push({ text: `Used ${item.name}. Defense +${item.effect.amount} for ${item.effect.duration} turns!`, type: "info" });
      } else if (item.effect.type === "cure_status") {
        state.statusEffects = state.statusEffects.filter((s) => s.type !== "dot");
        log.push({ text: `Used ${item.name}. Status effects cured!`, type: "heal" });
      }

      // Remove item from inventory
      const inv = state.inventory.find((i) => i.itemId === itemId);
      if (inv) {
        inv.count--;
        if (inv.count <= 0) {
          state.inventory = state.inventory.filter((i) => i.itemId !== itemId);
        }
      }

      // Using an item takes the turn — enemy gets to act
      // But we just render combat again without enemy action for item use
      renderCombat(state, enemy, log, onVictory, onFlee, false, false);
    });
  });
}

function handleResult(
  state: GameState,
  enemy: CombatEnemy,
  result: ReturnType<typeof processPlayerAction>,
  log: LogEntry[],
  onVictory: () => void,
  onFlee: () => void,
): void {
  if (result.enemyDead) {
    // Victory!
    state.xp += enemy.template.xpReward;
    state.crystals += enemy.template.crystalReward;
    log.push({ text: `+${enemy.template.xpReward} XP, +${enemy.template.crystalReward} crystals!`, type: "info" });

    // Level up check
    const levelMsgs = checkLevelUp(state);
    for (const msg of levelMsgs) {
      log.push({ text: msg, type: "info" });
    }

    // Loot drops
    if (enemy.template.loot) {
      for (const l of enemy.template.loot) {
        if (Math.random() < l.chance) {
          addItem(state, l.itemId, 1);
          const item = ITEMS[l.itemId];
          if (item) {
            log.push({ text: `Loot: ${item.icon} ${item.name}!`, type: "info" });
          }
        }
      }
    }

    state.inCombat = false;
    state.statusEffects = [];
    saveGame(state);

    // Show victory screen briefly
    showScreen("combat-screen");
    const container = document.getElementById("combat-screen")!;
    let html = `<div style="text-align:center;padding:40px">`;
    html += `<h2 style="color:#ffd700;margin-bottom:16px">🏆 Victory!</h2>`;
    html += `<div class="combat-log" style="max-height:200px">`;
    for (const entry of log.slice(-10)) {
      html += `<div class="log-entry log-${entry.type}">${entry.text}</div>`;
    }
    html += `</div>`;
    html += `<button class="btn btn-success" id="btn-continue-victory" style="margin-top:16px">Continue →</button>`;
    html += `</div>`;
    container.innerHTML = html;

    document.getElementById("btn-continue-victory")!.addEventListener("click", () => {
      onVictory();
    });
  } else if (result.playerDead) {
    state.inCombat = false;
    showScreen("gameover-screen");
    const stats = document.getElementById("gameover-stats")!;
    stats.innerHTML = `
      <p>Level: ${state.level} | Floor: ${state.currentFloor}</p>
      <p>Defeated by: ${enemy.template.name}</p>
      <p>Spells Crafted: ${state.spells.filter((s) => s.crafted).length}</p>
    `;
  } else {
    renderCombat(state, enemy, log, onVictory, onFlee, false, false);
  }
}
