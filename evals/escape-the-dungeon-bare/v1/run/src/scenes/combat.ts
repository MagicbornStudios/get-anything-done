import type { KAPLAYCtx } from "kaplay";
import type { GameState, CombatStats } from "../types";
import { content } from "../systems/content";
import {
  createEnemy,
  calcAttackDamage,
  castSpell,
  enemyTurn,
  tryRun,
  computeRewards,
  type CombatEntity,
} from "../systems/combat";
import { saveGame } from "../systems/gamestate";

interface CombatParams {
  state: GameState;
  roomId: string;
  enemyId: string;
  enemyArchetype: string;
  isBoss: boolean;
  bossName?: string;
  bossStats?: CombatStats;
}

export function setupCombatScene(k: KAPLAYCtx) {
  k.scene("combat", (params: CombatParams) => {
    const { state, roomId } = params;

    const enemy: CombatEntity = params.isBoss && params.bossStats
      ? createEnemy(params.enemyId, params.enemyArchetype, params.bossStats, params.bossName)
      : createEnemy(params.enemyId, params.enemyArchetype);

    const player: CombatEntity = {
      name: state.player.name,
      stats: state.player.combatStats,
      isPlayer: true,
    };

    let combatLog: string[] = [`A wild ${enemy.name} appears!`];
    let combatOver = false;
    let showSpells = false;
    let waitingForInput = true;

    function render() {
      k.destroyAll("combat-ui");

      // Background
      k.add([k.rect(800, 600), k.pos(0, 0), k.color(15, 10, 25), "combat-ui"]);

      // Enemy section
      k.add([
        k.rect(300, 120, { radius: 8 }),
        k.pos(400, 80),
        k.anchor("center"),
        k.color(35, 25, 40),
        k.outline(2, k.rgb(100, 50, 50)),
        "combat-ui",
      ]);

      k.add([
        k.text(enemy.name, { size: 20 }),
        k.pos(400, 40),
        k.anchor("center"),
        k.color(255, 150, 150),
        "combat-ui",
      ]);

      // Enemy HP bar
      const eHpRatio = enemy.stats.currentHp / enemy.stats.maxHp;
      k.add([k.rect(200, 14), k.pos(300, 70), k.color(60, 20, 20), "combat-ui"]);
      k.add([k.rect(Math.max(0, 200 * eHpRatio), 14), k.pos(300, 70), k.color(200, 50, 50), "combat-ui"]);
      k.add([
        k.text(`HP: ${enemy.stats.currentHp}/${enemy.stats.maxHp}`, { size: 11 }),
        k.pos(305, 72),
        k.color(255, 255, 255),
        "combat-ui",
      ]);

      // Enemy stats
      k.add([
        k.text(`MIG:${enemy.stats.might} DEF:${enemy.stats.defense} AGI:${enemy.stats.agility}`, { size: 10 }),
        k.pos(300, 92),
        k.color(180, 180, 200),
        "combat-ui",
      ]);

      // Player section
      k.add([
        k.rect(300, 100, { radius: 8 }),
        k.pos(400, 200),
        k.anchor("center"),
        k.color(25, 25, 45),
        k.outline(2, k.rgb(50, 50, 120)),
        "combat-ui",
      ]);

      k.add([
        k.text(player.name, { size: 18 }),
        k.pos(400, 165),
        k.anchor("center"),
        k.color(150, 200, 255),
        "combat-ui",
      ]);

      // Player HP
      const pHpRatio = player.stats.currentHp / player.stats.maxHp;
      k.add([k.rect(200, 14), k.pos(300, 188), k.color(60, 20, 20), "combat-ui"]);
      k.add([k.rect(Math.max(0, 200 * pHpRatio), 14), k.pos(300, 188), k.color(50, 200, 50), "combat-ui"]);
      k.add([
        k.text(`HP: ${player.stats.currentHp}/${player.stats.maxHp}`, { size: 11 }),
        k.pos(305, 190),
        k.color(255, 255, 255),
        "combat-ui",
      ]);

      // Player Mana
      const pManaRatio = player.stats.currentMana / player.stats.maxMana;
      k.add([k.rect(200, 14), k.pos(300, 208), k.color(20, 20, 60), "combat-ui"]);
      k.add([k.rect(Math.max(0, 200 * pManaRatio), 14), k.pos(300, 208), k.color(50, 50, 200), "combat-ui"]);
      k.add([
        k.text(`MP: ${player.stats.currentMana}/${player.stats.maxMana}`, { size: 11 }),
        k.pos(305, 210),
        k.color(255, 255, 255),
        "combat-ui",
      ]);

      // Combat log
      k.add([
        k.rect(760, 120, { radius: 6 }),
        k.pos(400, 310),
        k.anchor("center"),
        k.color(10, 10, 20),
        k.outline(1, k.rgb(60, 60, 80)),
        "combat-ui",
      ]);

      const visibleLog = combatLog.slice(-5);
      visibleLog.forEach((msg, i) => {
        k.add([
          k.text(msg, { size: 12, width: 720 }),
          k.pos(30, 258 + i * 20),
          k.color(200, 200, 220),
          "combat-ui",
        ]);
      });

      // Action buttons
      if (!combatOver && waitingForInput) {
        if (showSpells) {
          renderSpellList();
        } else {
          renderActionButtons();
        }
      }

      // Continue button after combat ends
      if (combatOver) {
        const btn = k.add([
          k.rect(200, 45, { radius: 6 }),
          k.pos(400, 520),
          k.anchor("center"),
          k.color(60, 120, 60),
          k.area(),
          "combat-ui",
        ]);
        k.add([
          k.text("Continue", { size: 18 }),
          k.pos(400, 520),
          k.anchor("center"),
          k.color(255, 255, 255),
          "combat-ui",
        ]);
        btn.onClick(() => {
          if (player.stats.currentHp <= 0) {
            k.go("gameover", { state });
          } else {
            k.go("game", { newGame: false, savedState: state });
          }
        });
      }
    }

    function renderActionButtons() {
      const actions = [
        { label: "Fight", color: [180, 50, 50] as const, action: doFight },
        { label: "Spells", color: [80, 50, 180] as const, action: () => { showSpells = true; render(); } },
        { label: "Bag", color: [50, 120, 50] as const, action: doBag },
        { label: "Run", color: [120, 120, 50] as const, action: doRun },
      ];

      actions.forEach((act, i) => {
        const x = 120 + i * 160;
        const btn = k.add([
          k.rect(140, 45, { radius: 6 }),
          k.pos(x, 400),
          k.color(act.color[0], act.color[1], act.color[2]),
          k.area(),
          "combat-ui",
        ]);
        k.add([
          k.text(act.label, { size: 16 }),
          k.pos(x + 70, 422),
          k.anchor("center"),
          k.color(255, 255, 255),
          "combat-ui",
        ]);
        btn.onClick(act.action);
      });
    }

    function renderSpellList() {
      // Back button
      const backBtn = k.add([
        k.rect(80, 35, { radius: 4 }),
        k.pos(30, 390),
        k.color(100, 50, 50),
        k.area(),
        "combat-ui",
      ]);
      k.add([
        k.text("Back", { size: 14 }),
        k.pos(70, 407),
        k.anchor("center"),
        k.color(255, 255, 255),
        "combat-ui",
      ]);
      backBtn.onClick(() => { showSpells = false; render(); });

      state.player.preparedSpells.forEach((spellId, i) => {
        const spell = content.getSpell(spellId);
        if (!spell) return;

        const x = 130 + (i % 3) * 220;
        const y = 390 + Math.floor(i / 3) * 55;
        const canCast = player.stats.currentMana >= spell.manaCost;

        const spBtn = k.add([
          k.rect(200, 45, { radius: 4 }),
          k.pos(x, y),
          k.color(canCast ? 60 : 30, canCast ? 50 : 30, canCast ? 120 : 50),
          k.area(),
          "combat-ui",
        ]);
        k.add([
          k.text(`${spell.name} (${spell.manaCost} MP)`, { size: 12 }),
          k.pos(x + 10, y + 8),
          k.color(canCast ? 220 : 120, canCast ? 220 : 120, canCast ? 255 : 140),
          "combat-ui",
        ]);
        k.add([
          k.text(spell.description, { size: 9, width: 180 }),
          k.pos(x + 10, y + 25),
          k.color(150, 150, 170),
          "combat-ui",
        ]);

        if (canCast) {
          spBtn.onClick(() => {
            doSpell(spellId);
          });
        }
      });
    }

    function doFight() {
      if (!waitingForInput || combatOver) return;
      waitingForInput = false;

      const dmg = calcAttackDamage(player, enemy);
      enemy.stats.currentHp = Math.max(0, enemy.stats.currentHp - dmg);
      combatLog.push(`${player.name} attacks for ${dmg} damage!`);

      checkCombatEnd();
      if (!combatOver) doEnemyTurn();

      waitingForInput = true;
      render();
    }

    function doSpell(spellId: string) {
      if (!waitingForInput || combatOver) return;
      waitingForInput = false;
      showSpells = false;

      const spell = content.getSpell(spellId);
      if (!spell) { waitingForInput = true; render(); return; }

      const msgs = castSpell(spell, player, enemy);
      combatLog.push(...msgs);

      checkCombatEnd();
      if (!combatOver) doEnemyTurn();

      waitingForInput = true;
      render();
    }

    function doBag() {
      if (!waitingForInput || combatOver) return;
      // Use first health potion if available
      const potion = state.player.inventory.find((i) => i.id === "health_potion" && i.quantity > 0);
      if (potion) {
        const item = content.getItem("health_potion");
        if (item) {
          state.player.combatStats.currentHp = Math.min(
            state.player.combatStats.maxHp,
            state.player.combatStats.currentHp + item.effect.amount
          );
          potion.quantity--;
          if (potion.quantity <= 0) {
            state.player.inventory = state.player.inventory.filter((x) => x.id !== potion.id);
          }
          combatLog.push(`${player.name} uses ${item.name}! Healed ${item.effect.amount} HP.`);
        }
      } else {
        combatLog.push("No potions available!");
      }

      waitingForInput = false;
      if (!combatOver) doEnemyTurn();
      waitingForInput = true;
      render();
    }

    function doRun() {
      if (!waitingForInput || combatOver) return;
      waitingForInput = false;

      if (tryRun(player, enemy)) {
        combatLog.push("You fled successfully!");
        combatOver = true;
      } else {
        combatLog.push("Couldn't escape!");
        doEnemyTurn();
      }

      waitingForInput = true;
      render();
    }

    function doEnemyTurn() {
      const msgs = enemyTurn(enemy, player);
      combatLog.push(...msgs);
      checkCombatEnd();
    }

    function checkCombatEnd() {
      if (enemy.stats.currentHp <= 0) {
        combatLog.push(`${enemy.name} is defeated!`);
        const rewards = computeRewards(enemy, state);
        combatLog.push(...rewards.messages);
        state.clearedRooms.push(roomId);
        if (params.isBoss) {
          state.defeatedBosses.push(roomId);
        }
        saveGame(state);
        combatOver = true;
      }
      if (player.stats.currentHp <= 0) {
        combatLog.push(`${player.name} has been defeated...`);
        state.gameOver = true;
        combatOver = true;
      }
    }

    render();
  });
}
