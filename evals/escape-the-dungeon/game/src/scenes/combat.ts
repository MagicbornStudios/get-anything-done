import type { KAPLAYCtx } from "kaplay";
import {
  getGameState,
  calculateDamage,
  calculateSpellDamage,
  applySpellAffinityGain,
  addXP,
  moveToNextFloor,
  useItem,
} from "../systems/gameState";
import type { SpellDefinition } from "../types";

export function loadCombatScene(k: KAPLAYCtx) {
  k.scene("combat", () => {
    const state = getGameState();
    const enemy = state.currentEnemy;

    if (!enemy) {
      k.go("game");
      return;
    }

    const isBoss = enemy.occupationId === "boss";

    // Combat state
    let combatLog: string[] = [`A wild ${enemy.name} appears!`];
    let playerTurn = true;
    let combatOver = false;
    let showingSpells = false;
    let showingBag = false;

    // === BACKGROUND ===
    const bgColor = isBoss ? [40, 15, 15] : [20, 20, 35];
    k.add([k.rect(k.width(), k.height()), k.pos(0, 0), k.color(bgColor[0], bgColor[1], bgColor[2])]);

    // === COMBAT TITLE ===
    k.add([
      k.text(isBoss ? "BOSS BATTLE" : "COMBAT", { size: 28 }),
      k.pos(k.width() / 2, 20),
      k.anchor("center"),
      k.color(isBoss ? 255 : 200, isBoss ? 60 : 200, isBoss ? 60 : 220),
    ]);

    // === ENEMY SECTION (top half) ===
    // Enemy sprite placeholder
    const enemyBoxX = k.width() / 2;
    const enemyBoxY = 120;

    k.add([
      k.rect(120, 120, { radius: 12 }),
      k.pos(enemyBoxX, enemyBoxY),
      k.anchor("center"),
      k.color(isBoss ? 120 : 80, 30, 30),
    ]);

    k.add([
      k.text(isBoss ? "BOSS" : "!", { size: isBoss ? 36 : 48 }),
      k.pos(enemyBoxX, enemyBoxY),
      k.anchor("center"),
      k.color(255, 255, 255),
    ]);

    // Enemy name and level
    k.add([
      k.text(`${enemy.name} Lv.${enemy.level}`, { size: 22 }),
      k.pos(enemyBoxX, enemyBoxY + 80),
      k.anchor("center"),
      k.color(255, 200, 200),
    ]);

    // Enemy HP bar
    const enemyHpBg = k.add([
      k.rect(250, 20, { radius: 4 }),
      k.pos(enemyBoxX - 125, enemyBoxY + 100),
      k.color(40, 20, 20),
    ]);

    const enemyHpBar = k.add([
      k.rect(250, 20, { radius: 4 }),
      k.pos(enemyBoxX - 125, enemyBoxY + 100),
      k.color(200, 50, 50),
    ]);

    const enemyHpText = k.add([
      k.text(`${enemy.combatStats.currentHp}/${enemy.combatStats.maxHp}`, { size: 14 }),
      k.pos(enemyBoxX, enemyBoxY + 110),
      k.anchor("center"),
      k.color(255, 255, 255),
    ]);

    // === PLAYER SECTION (bottom left) ===
    const playerY = 350;

    k.add([
      k.rect(300, 120, { radius: 8 }),
      k.pos(40, playerY),
      k.color(20, 30, 40),
    ]);

    k.add([
      k.text(`${state.player.name} Lv.${state.player.level}`, { size: 20 }),
      k.pos(60, playerY + 10),
      k.color(200, 220, 255),
    ]);

    // Player HP
    k.add([
      k.rect(220, 16, { radius: 3 }),
      k.pos(60, playerY + 40),
      k.color(40, 20, 20),
    ]);

    const playerHpBar = k.add([
      k.rect(220, 16, { radius: 3 }),
      k.pos(60, playerY + 40),
      k.color(80, 200, 80),
    ]);

    const playerHpText = k.add([
      k.text(`HP: ${state.player.combatStats.currentHp}/${state.player.combatStats.maxHp}`, { size: 13 }),
      k.pos(60, playerY + 42),
      k.color(255, 255, 255),
    ]);

    // Player Mana
    k.add([
      k.rect(220, 16, { radius: 3 }),
      k.pos(60, playerY + 65),
      k.color(20, 20, 40),
    ]);

    const playerManaBar = k.add([
      k.rect(220, 16, { radius: 3 }),
      k.pos(60, playerY + 65),
      k.color(80, 80, 200),
    ]);

    const playerManaText = k.add([
      k.text(`Mana: ${state.player.combatStats.currentMana}/${state.player.combatStats.maxMana}`, { size: 13 }),
      k.pos(60, playerY + 67),
      k.color(255, 255, 255),
    ]);

    // === COMBAT LOG ===
    const logX = 40;
    const logY = 490;
    k.add([k.rect(600, 110, { radius: 6 }), k.pos(logX, logY), k.color(15, 15, 25)]);

    const logTexts: ReturnType<typeof k.add>[] = [];

    function updateLog() {
      logTexts.forEach((t) => t.destroy());
      logTexts.length = 0;

      const visibleLines = combatLog.slice(-4);
      visibleLines.forEach((line, i) => {
        const t = k.add([
          k.text(line, { size: 14, width: 580 }),
          k.pos(logX + 10, logY + 10 + i * 24),
          k.color(180, 180, 200),
        ]);
        logTexts.push(t);
      });
    }

    updateLog();

    // === ACTION BUTTONS ===
    const actionX = 700;
    const actionY = 350;
    const btnW = 200;
    const btnH = 40;
    const btnGap = 50;

    const actionButtons: ReturnType<typeof k.add>[] = [];
    const actionLabels: ReturnType<typeof k.add>[] = [];

    function clearActionUI() {
      actionButtons.forEach((b) => b.destroy());
      actionLabels.forEach((l) => l.destroy());
      actionButtons.length = 0;
      actionLabels.length = 0;
    }

    function showMainActions() {
      clearActionUI();
      showingSpells = false;
      showingBag = false;

      const actions = [
        { label: "Fight", color: [120, 40, 40] as [number, number, number], onClick: doFight },
        { label: "Spells", color: [80, 40, 120] as [number, number, number], onClick: doShowSpells },
        { label: "Bag", color: [40, 80, 60] as [number, number, number], onClick: doShowBag },
        { label: "Run", color: [80, 80, 40] as [number, number, number], onClick: doRun },
      ];

      actions.forEach((action, i) => {
        const btn = k.add([
          k.rect(btnW, btnH, { radius: 6 }),
          k.pos(actionX, actionY + i * btnGap),
          k.color(...action.color),
          k.area(),
        ]);

        const label = k.add([
          k.text(action.label, { size: 18 }),
          k.pos(actionX + btnW / 2, actionY + i * btnGap + btnH / 2),
          k.anchor("center"),
          k.color(220, 220, 240),
        ]);

        btn.onClick(() => {
          if (playerTurn && !combatOver) action.onClick();
        });

        btn.onHover(() => {
          btn.color = k.rgb(
            Math.min(255, action.color[0] + 30),
            Math.min(255, action.color[1] + 30),
            Math.min(255, action.color[2] + 30)
          );
        });
        btn.onHoverEnd(() => { btn.color = k.rgb(...action.color); });

        actionButtons.push(btn);
        actionLabels.push(label);
      });
    }

    function showSpellActions() {
      clearActionUI();
      showingSpells = true;

      const prepared = state.player.preparedSlots.filter((s): s is SpellDefinition => s !== null);

      if (prepared.length === 0) {
        combatLog.push("No spells prepared!");
        updateLog();
        showMainActions();
        return;
      }

      prepared.forEach((spell, i) => {
        const canAfford = state.player.combatStats.currentMana >= spell.manaCost;
        const color: [number, number, number] = canAfford ? [60, 40, 100] : [40, 40, 50];

        const btn = k.add([
          k.rect(btnW + 100, btnH, { radius: 6 }),
          k.pos(actionX - 50, actionY + i * btnGap),
          k.color(...color),
          k.area(),
        ]);

        const label = k.add([
          k.text(`${spell.name} (${spell.manaCost} mana)`, { size: 15 }),
          k.pos(actionX, actionY + i * btnGap + btnH / 2),
          k.anchor("left"),
          k.color(canAfford ? [200, 200, 255] : [100, 100, 120]),
        ]);

        btn.onClick(() => {
          if (playerTurn && !combatOver && canAfford) {
            doCastSpell(spell);
          }
        });

        actionButtons.push(btn);
        actionLabels.push(label);
      });

      // Back button
      const backBtn = k.add([
        k.rect(100, 30, { radius: 4 }),
        k.pos(actionX, actionY + prepared.length * btnGap + 10),
        k.color(60, 60, 80),
        k.area(),
      ]);
      const backLabel = k.add([
        k.text("Back", { size: 14 }),
        k.pos(actionX + 50, actionY + prepared.length * btnGap + 25),
        k.anchor("center"),
        k.color(200, 200, 220),
      ]);
      backBtn.onClick(showMainActions);

      actionButtons.push(backBtn);
      actionLabels.push(backLabel);
    }

    function showBagActions() {
      clearActionUI();
      showingBag = true;

      const usables = state.player.inventory.filter((i) => i.kind === "consumable" && i.quantity > 0);

      if (usables.length === 0) {
        combatLog.push("No usable items!");
        updateLog();
        showMainActions();
        return;
      }

      usables.forEach((item, i) => {
        const btn = k.add([
          k.rect(btnW + 60, btnH, { radius: 6 }),
          k.pos(actionX - 30, actionY + i * btnGap),
          k.color(40, 70, 50),
          k.area(),
        ]);

        const label = k.add([
          k.text(`${item.name} x${item.quantity}`, { size: 15 }),
          k.pos(actionX - 15, actionY + i * btnGap + btnH / 2),
          k.anchor("left"),
          k.color(200, 255, 200),
        ]);

        btn.onClick(() => {
          if (playerTurn && !combatOver) {
            const result = useItem(item.itemId);
            if (result) {
              combatLog.push(result);
              updateUI();
              updateLog();
              playerTurn = false;
              k.wait(1, enemyTurn);
              showMainActions();
            }
          }
        });

        actionButtons.push(btn);
        actionLabels.push(label);
      });

      // Back
      const backBtn = k.add([
        k.rect(100, 30, { radius: 4 }),
        k.pos(actionX, actionY + usables.length * btnGap + 10),
        k.color(60, 60, 80),
        k.area(),
      ]);
      const backLabel = k.add([
        k.text("Back", { size: 14 }),
        k.pos(actionX + 50, actionY + usables.length * btnGap + 25),
        k.anchor("center"),
        k.color(200, 200, 220),
      ]);
      backBtn.onClick(showMainActions);

      actionButtons.push(backBtn);
      actionLabels.push(backLabel);
    }

    // === COMBAT ACTIONS ===

    function doFight() {
      const dmg = calculateDamage(state.player.combatStats, enemy!.combatStats);
      enemy!.combatStats.currentHp -= dmg;
      combatLog.push(`You attack ${enemy!.name} for ${dmg} damage!`);

      if (enemy!.combatStats.currentHp <= 0) {
        enemy!.combatStats.currentHp = 0;
        handleWin();
      } else {
        playerTurn = false;
        updateUI();
        updateLog();
        k.wait(1, enemyTurn);
      }
    }

    function doCastSpell(spell: SpellDefinition) {
      state.player.combatStats.currentMana -= spell.manaCost;
      applySpellAffinityGain(spell);

      spell.effects?.forEach((eff) => {
        if (eff.kind === "damage" && eff.target === "enemy") {
          const dmg = calculateSpellDamage(state.player.combatStats, spell);
          enemy!.combatStats.currentHp -= dmg;
          combatLog.push(`You cast ${spell.name} for ${dmg} damage!`);
        } else if (eff.kind === "heal" && eff.target === "self") {
          const heal = eff.value;
          state.player.combatStats.currentHp = Math.min(
            state.player.combatStats.maxHp,
            state.player.combatStats.currentHp + heal
          );
          combatLog.push(`You cast ${spell.name} and heal ${heal} HP!`);
        } else if (eff.kind === "buff" && eff.target === "self") {
          combatLog.push(`You cast ${spell.name}! (${eff.statusId || "buff applied"})`);
          if (eff.statusId === "shielded") {
            state.player.combatStats.defense += eff.value;
          }
        }
      });

      if (enemy!.combatStats.currentHp <= 0) {
        enemy!.combatStats.currentHp = 0;
        handleWin();
      } else {
        playerTurn = false;
        updateUI();
        updateLog();
        showMainActions();
        k.wait(1, enemyTurn);
      }
    }

    function doShowSpells() {
      showSpellActions();
    }

    function doShowBag() {
      showBagActions();
    }

    function doRun() {
      // Flee chance based on agility
      const chance = state.player.combatStats.agility / (state.player.combatStats.agility + enemy!.combatStats.agility);
      if (Math.random() < chance) {
        combatLog.push("You flee from battle!");
        combatOver = true;
        updateLog();
        k.wait(1.5, () => {
          state.isInCombat = false;
          state.currentEnemy = null;
          k.go("game");
        });
      } else {
        combatLog.push("Couldn't escape!");
        playerTurn = false;
        updateLog();
        k.wait(1, enemyTurn);
      }
    }

    function enemyTurn() {
      if (combatOver) return;

      const dmg = calculateDamage(enemy!.combatStats, state.player.combatStats);
      state.player.combatStats.currentHp -= dmg;
      combatLog.push(`${enemy!.name} attacks you for ${dmg} damage!`);

      if (state.player.combatStats.currentHp <= 0) {
        state.player.combatStats.currentHp = 0;
        handleLose();
      } else {
        playerTurn = true;
        updateUI();
        updateLog();
      }
    }

    function handleWin() {
      combatOver = true;
      const xpGain = enemy!.xpReward || 10;
      const crystalGain = enemy!.crystalReward || 5;

      const { leveledUp, newLevel } = addXP(xpGain);
      state.player.manaCrystals += crystalGain;

      combatLog.push(`${enemy!.name} defeated!`);
      combatLog.push(`+${xpGain} XP, +${crystalGain} crystals`);
      if (leveledUp) {
        combatLog.push(`LEVEL UP! Now level ${newLevel}!`);
      }

      updateUI();
      updateLog();

      // If boss, advance to next floor
      if (isBoss) {
        combatLog.push("The way forward opens!");
        updateLog();
        k.wait(2.5, () => {
          state.isInCombat = false;
          state.currentEnemy = null;
          if (moveToNextFloor()) {
            k.go("game");
          } else {
            // Escaped the dungeon!
            k.go("mainMenu");
          }
        });
      } else {
        k.wait(2, () => {
          state.isInCombat = false;
          state.currentEnemy = null;
          // Remove enemy from room
          k.go("game");
        });
      }
    }

    function handleLose() {
      combatOver = true;
      combatLog.push("You have been defeated...");
      updateUI();
      updateLog();

      k.wait(2, () => {
        state.isInCombat = false;
        state.currentEnemy = null;
        k.go("gameOver");
      });
    }

    // === UI UPDATE ===

    function updateUI() {
      // Enemy HP bar
      const hpRatio = Math.max(0, enemy!.combatStats.currentHp / enemy!.combatStats.maxHp);
      enemyHpBar.width = 250 * hpRatio;
      enemyHpText.text = `${Math.max(0, enemy!.combatStats.currentHp)}/${enemy!.combatStats.maxHp}`;

      // Player HP
      const pHpRatio = Math.max(0, state.player.combatStats.currentHp / state.player.combatStats.maxHp);
      playerHpBar.width = 220 * pHpRatio;
      playerHpText.text = `HP: ${Math.max(0, state.player.combatStats.currentHp)}/${state.player.combatStats.maxHp}`;

      // Player Mana
      const pManaRatio = Math.max(0, state.player.combatStats.currentMana / state.player.combatStats.maxMana);
      playerManaBar.width = 220 * pManaRatio;
      playerManaText.text = `Mana: ${state.player.combatStats.currentMana}/${state.player.combatStats.maxMana}`;
    }

    // Show initial actions
    showMainActions();
  });
}
