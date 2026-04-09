import type { KAPLAYCtx } from "kaplay";
import { getState, addXp, addCrystals, saveGame, getCurrentRoom } from "../systems/gameState";
import { drawHUD, COLORS } from "../systems/ui";
import { ENEMIES } from "../data/enemies";
import type { EnemyDef, Spell, DamageType } from "../types/game";
import { getIconSvg } from "../systems/icons";

interface CombatState {
  enemy: EnemyDef & { currentHp: number };
  playerTurn: boolean;
  log: string[];
  finished: boolean;
  victory: boolean;
  lastSpellUsed: string | null;
  spellUsageCount: Record<string, number>;
}

export function combatScene(k: KAPLAYCtx, enemyId: string) {
  const state = getState();
  const p = state.player;
  const enemyDef = ENEMIES.find(e => e.id === enemyId);
  if (!enemyDef) {
    k.go("room");
    return;
  }

  const combat: CombatState = {
    enemy: { ...JSON.parse(JSON.stringify(enemyDef)), currentHp: enemyDef.combatStats.maxHp },
    playerTurn: true,
    log: [`A ${enemyDef.name} appears!`],
    finished: false,
    victory: false,
    lastSpellUsed: null,
    spellUsageCount: {},
  };

  function render() {
    k.destroyAll("combat-ui");
    drawHUD(k);

    const topY = 56;

    // Combat background
    k.add([k.rect(k.width() - 40, k.height() - topY - 20, { radius: 8 }), k.color(k.Color.fromHex("#1a0a0a")), k.outline(2, k.Color.fromHex("#663333")), k.pos(20, topY), "combat-ui"]);

    // Enemy area (right side)
    const enemyX = k.width() - 280;
    const enemyY = topY + 30;

    // Enemy icon
    const iconUrl = getIconSvg(enemyDef.icon, enemyDef.color, 80);
    const spriteName = `enemy-${enemyDef.id}`;
    k.loadSprite(spriteName, iconUrl);
    k.wait(0.05, () => {
      try {
        k.add([k.sprite(spriteName), k.pos(enemyX + 80, enemyY), "combat-ui"]);
      } catch { /* ignore */ }
    });

    // Enemy name and level
    k.add([k.text(enemyDef.name, { size: 20 }), k.pos(enemyX, enemyY + 90), k.color(k.Color.fromHex(enemyDef.color)), "combat-ui"]);
    k.add([k.text(enemyDef.description, { size: 11, width: 220 }), k.pos(enemyX, enemyY + 115), k.color(k.Color.fromHex(COLORS.textDim)), "combat-ui"]);

    // Enemy HP bar
    const eHpPct = Math.max(0, combat.enemy.currentHp / combat.enemy.combatStats.maxHp);
    k.add([k.rect(200, 18, { radius: 3 }), k.color(k.Color.fromHex(COLORS.hpBarBg)), k.pos(enemyX, enemyY + 145), "combat-ui"]);
    k.add([k.rect(Math.max(1, 200 * eHpPct), 18, { radius: 3 }), k.color(k.Color.fromHex(COLORS.hpBar)), k.pos(enemyX, enemyY + 145), "combat-ui"]);
    k.add([k.text(`HP ${combat.enemy.currentHp}/${combat.enemy.combatStats.maxHp}`, { size: 10 }), k.pos(enemyX + 100, enemyY + 154), k.anchor("center"), k.color(255, 255, 255), "combat-ui"]);

    // Resistances display
    const resKeys = Object.keys(combat.enemy.resistances) as DamageType[];
    if (resKeys.length > 0 || combat.enemy.immunities.length > 0) {
      let resText = "";
      resKeys.forEach(r => {
        const val = combat.enemy.resistances[r]!;
        if (val < 1) resText += `${r}: ${Math.round(val * 100)}% resist  `;
        else if (val > 1) resText += `${r}: ${Math.round((val - 1) * 100)}% weak  `;
      });
      if (combat.enemy.immunities.length > 0) {
        resText += `Immune: ${combat.enemy.immunities.join(", ")}`;
      }
      k.add([k.text(resText, { size: 10, width: 220 }), k.pos(enemyX, enemyY + 170), k.color(k.Color.fromHex(COLORS.warning)), "combat-ui"]);
    }

    // Player actions (left side)
    const actX = 40;
    const actY = topY + 40;

    k.add([k.text("Your Turn", { size: 16 }), k.pos(actX, actY), k.color(k.Color.fromHex(combat.playerTurn && !combat.finished ? COLORS.success : COLORS.textDim)), "combat-ui"]);

    if (combat.playerTurn && !combat.finished) {
      // Fight button
      const fightBtn = makeButton(k, actX, actY + 30, 140, 36, "Fight", "#663322", "#cc6633");
      fightBtn.onClick(() => {
        const dmg = calcPhysicalDamage(p.combatStats.might, combat.enemy.combatStats.defense, combat.enemy.resistances, combat.enemy.immunities);
        combat.enemy.currentHp = Math.max(0, combat.enemy.currentHp - dmg);
        combat.log.push(`You attack for ${dmg} physical damage!`);
        endPlayerTurn();
      });

      // Spells button area
      k.add([k.text("Spells:", { size: 12 }), k.pos(actX, actY + 76), k.color(k.Color.fromHex(COLORS.text)), "combat-ui"]);
      p.spells.forEach((spell, i) => {
        const canCast = p.combatStats.currentMana >= spell.manaCost;
        const btnColor = canCast ? "#222255" : "#1a1a1a";
        const textColor = canCast ? "#6666ff" : "#444444";
        const spellBtn = makeButton(k, actX, actY + 96 + i * 40, 250, 34, `${spell.name} (${spell.manaCost} MP, ${spell.damage} ${spell.damageType})`, btnColor, textColor);
        if (canCast) {
          spellBtn.onClick(() => {
            castSpell(spell);
          });
        }
      });

      // Bag button
      const bagY = actY + 96 + p.spells.length * 40 + 10;
      const hasPotions = p.items.some(i => i.type === "potion");
      if (hasPotions) {
        const bagBtn = makeButton(k, actX, bagY, 140, 36, "Use Potion", "#223322", "#66cc66");
        bagBtn.onClick(() => {
          const potionIdx = p.items.findIndex(i => i.type === "potion");
          if (potionIdx >= 0) {
            const potion = p.items[potionIdx];
            p.combatStats.currentHp = Math.min(p.combatStats.currentHp + potion.value, p.combatStats.maxHp);
            combat.log.push(`Used ${potion.name}, restored ${potion.value} HP!`);
            p.items.splice(potionIdx, 1);
            endPlayerTurn();
          }
        });
      }

      // Run button
      const runY = bagY + (hasPotions ? 44 : 0);
      const runBtn = makeButton(k, actX, runY, 140, 36, "Run", "#332222", "#cc6666");
      runBtn.onClick(() => {
        const fleeChance = 0.3 + p.combatStats.agility * 0.05;
        if (Math.random() < fleeChance) {
          combat.log.push("You fled successfully!");
          combat.finished = true;
          render();
          k.wait(1, () => k.go("room"));
        } else {
          combat.log.push("Failed to flee!");
          endPlayerTurn();
        }
      });
    }

    // Combat finished state
    if (combat.finished) {
      if (combat.victory) {
        k.add([k.text("VICTORY!", { size: 32 }), k.pos(k.width() / 2, k.height() / 2), k.anchor("center"), k.color(k.Color.fromHex(COLORS.gold)), "combat-ui"]);
        k.add([k.text(`+${enemyDef.xpReward} XP  +${enemyDef.crystalReward} Crystals`, { size: 18 }), k.pos(k.width() / 2, k.height() / 2 + 40), k.anchor("center"), k.color(k.Color.fromHex(COLORS.success)), "combat-ui"]);
        const contBtn = makeButton(k, k.width() / 2 - 70, k.height() / 2 + 80, 140, 40, "Continue", "#224422", "#66ff66");
        contBtn.onClick(() => {
          k.go("room");
        });
      } else {
        k.add([k.text("DEFEATED", { size: 32 }), k.pos(k.width() / 2, k.height() / 2), k.anchor("center"), k.color(k.Color.fromHex(COLORS.danger)), "combat-ui"]);
        const retryBtn = makeButton(k, k.width() / 2 - 70, k.height() / 2 + 60, 140, 40, "Return to Title", "#442222", "#ff6666");
        retryBtn.onClick(() => {
          k.go("title");
        });
      }
    }

    // Combat log (bottom)
    const logY = k.height() - 120;
    k.add([k.rect(k.width() - 80, 80, { radius: 4 }), k.color(k.Color.fromHex("#0a0a1a")), k.outline(1, k.Color.fromHex("#333333")), k.pos(40, logY), "combat-ui"]);
    const recentLog = combat.log.slice(-3);
    recentLog.forEach((msg, i) => {
      k.add([k.text(msg, { size: 12, width: k.width() - 120 }), k.pos(50, logY + 8 + i * 22), k.color(k.Color.fromHex(COLORS.text)), "combat-ui"]);
    });
  }

  function castSpell(spell: Spell) {
    const p = state.player;
    p.combatStats.currentMana -= spell.manaCost;

    // Track spell usage for repetition punishment
    combat.spellUsageCount[spell.id] = (combat.spellUsageCount[spell.id] || 0) + 1;
    combat.lastSpellUsed = spell.id;

    let dmg = spell.damage + Math.floor(p.combatStats.power * 0.5);

    // Apply resistance/weakness
    const resistance = combat.enemy.resistances[spell.damageType];
    if (combat.enemy.immunities.includes(spell.damageType)) {
      combat.log.push(`${combat.enemy.name} is IMMUNE to ${spell.damageType}! No damage!`);
      endPlayerTurn();
      return;
    }
    if (resistance !== undefined) {
      if (resistance < 1) {
        dmg = Math.floor(dmg * resistance);
        combat.log.push(`${combat.enemy.name} resists ${spell.damageType}!`);
      } else if (resistance > 1) {
        dmg = Math.floor(dmg * resistance);
        combat.log.push(`${combat.enemy.name} is WEAK to ${spell.damageType}!`);
      }
    }

    // Apply affinity bonus
    const runeAffinities = spell.runes.map(r => p.runeAffinity[r] || 0);
    const avgAffinity = runeAffinities.length > 0 ? runeAffinities.reduce((a, b) => a + b, 0) / runeAffinities.length : 0;
    if (avgAffinity >= 3) dmg = Math.floor(dmg * 1.15);
    if (avgAffinity >= 5) dmg = Math.floor(dmg * 1.1);

    combat.enemy.currentHp = Math.max(0, combat.enemy.currentHp - dmg);
    combat.log.push(`${spell.name} deals ${dmg} ${spell.damageType} damage!`);

    // Build affinity
    spell.runes.forEach(r => {
      p.runeAffinity[r] = (p.runeAffinity[r] || 0) + 0.2;
    });

    // Spell effects
    if (spell.effect === "dot") {
      const dotDmg = Math.floor(dmg * 0.3);
      combat.log.push(`${combat.enemy.name} takes ${dotDmg} damage over time!`);
      combat.enemy.currentHp = Math.max(0, combat.enemy.currentHp - dotDmg);
    } else if (spell.effect === "heal") {
      const healAmt = Math.floor(spell.damage * 0.5);
      p.combatStats.currentHp = Math.min(p.combatStats.currentHp + healAmt, p.combatStats.maxHp);
      combat.log.push(`You heal ${healAmt} HP!`);
    } else if (spell.effect === "drain") {
      const drainAmt = Math.floor(dmg * 0.2);
      p.combatStats.currentMana = Math.min(p.combatStats.currentMana + drainAmt, p.combatStats.maxMana);
      combat.log.push(`You drain ${drainAmt} mana!`);
    }

    endPlayerTurn();
  }

  function endPlayerTurn() {
    // Check if enemy is dead
    if (combat.enemy.currentHp <= 0) {
      combat.finished = true;
      combat.victory = true;
      const room = getCurrentRoom();
      room.cleared = true;
      state.player.clearedRooms.push(room.id);
      const leveled = addXp(enemyDef.xpReward);
      addCrystals(enemyDef.crystalReward);
      if (leveled) combat.log.push("LEVEL UP!");
      saveGame();
      render();
      return;
    }

    // Enemy turn
    combat.playerTurn = false;
    render();

    k.wait(0.5, () => {
      enemyTurn();
    });
  }

  function enemyTurn() {
    const p = state.player;
    const enemy = combat.enemy;

    // Enemy behavior
    let dmg = Math.max(1, enemy.combatStats.might - Math.floor(p.combatStats.defense * 0.5));

    // Special behaviors
    if (enemy.behavior === "reflect" && combat.lastSpellUsed) {
      dmg = Math.floor(dmg * 1.5);
      combat.log.push(`${enemy.name} reflects energy! Enhanced attack for ${dmg} damage!`);
    } else if (enemy.behavior === "punish-repeat") {
      // Punish spell repetition
      const repeated = Object.values(combat.spellUsageCount).some(c => c > 2);
      if (repeated) {
        dmg = Math.floor(dmg * 2);
        combat.log.push(`${enemy.name} punishes your repetitive magic! ${dmg} damage!`);
      } else {
        combat.log.push(`${enemy.name} attacks for ${dmg} damage!`);
      }
    } else if (enemy.behavior === "regenerate") {
      const regen = Math.floor(enemy.combatStats.maxHp * 0.1);
      enemy.currentHp = Math.min(enemy.currentHp + regen, enemy.combatStats.maxHp);
      combat.log.push(`${enemy.name} regenerates ${regen} HP and attacks for ${dmg} damage!`);
    } else {
      combat.log.push(`${enemy.name} attacks for ${dmg} damage!`);
    }

    p.combatStats.currentHp = Math.max(0, p.combatStats.currentHp - dmg);

    // Check player death
    if (p.combatStats.currentHp <= 0) {
      combat.finished = true;
      combat.victory = false;
      state.gameOver = true;
      render();
      return;
    }

    combat.playerTurn = true;
    combat.lastSpellUsed = null;
    render();
  }

  // Initial render
  render();
}

function calcPhysicalDamage(might: number, defense: number, resistances: Partial<Record<DamageType, number>>, immunities: DamageType[]): number {
  let dmg = Math.max(1, might - Math.floor(defense * 0.4));
  const physRes = resistances["physical"];
  if (immunities.includes("physical")) return 0;
  if (physRes !== undefined && physRes < 1) {
    dmg = Math.floor(dmg * physRes);
  }
  return Math.max(1, dmg);
}

function makeButton(k: KAPLAYCtx, x: number, y: number, w: number, h: number, label: string, bgColor: string, textColor: string) {
  const btn = k.add([
    k.rect(w, h, { radius: 4 }),
    k.color(k.Color.fromHex(bgColor)),
    k.outline(1, k.Color.fromHex(textColor)),
    k.pos(x, y),
    k.area(),
    "combat-ui",
  ]);
  k.add([
    k.text(label, { size: 13 }),
    k.pos(x + w / 2, y + h / 2),
    k.anchor("center"),
    k.color(k.Color.fromHex(textColor)),
    "combat-ui",
  ]);
  return btn;
}
