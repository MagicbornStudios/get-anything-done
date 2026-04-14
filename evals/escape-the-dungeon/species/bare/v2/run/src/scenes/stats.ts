import { makeButton, addCenteredText } from "../systems/ui";
import { getPlayer } from "../systems/state";
import { content } from "../systems/content";

export function statsScene(k: any) {
  const player = getPlayer();
  const cs = player.combatStats;

  addCenteredText(k, "-- Character Stats --", 30, 24, [220, 200, 100]);

  const lines = [
    `Name: ${player.name}`,
    `Level: ${player.level}  |  XP: ${player.xp}/${player.xpToNext}`,
    `HP: ${cs.currentHp}/${cs.maxHp}`,
    `Mana: ${cs.currentMana}/${cs.maxMana}`,
    `Might: ${cs.might}  |  Defense: ${cs.defense}`,
    `Power: ${cs.power}  |  Agility: ${cs.agility}`,
    `Insight: ${cs.insight}  |  Willpower: ${cs.willpower}`,
    `Crystals: ${player.crystals}`,
    `Floor: ${player.currentFloor + 1}  |  Tick: ${player.dungeonTick}`,
  ];

  lines.forEach((line, i) => {
    k.add([
      k.text(line, { size: 16 }),
      k.pos(40, 70 + i * 28),
      k.color(200, 200, 220),
      k.z(10),
    ]);
  });

  // Spells section
  addCenteredText(k, "Prepared Spells:", 70 + lines.length * 28 + 10, 16, [150, 150, 255]);
  player.spells.forEach((spellId: string, i: number) => {
    const spell = content.getSpell(spellId);
    if (!spell) return;
    k.add([
      k.text(`  ${spell.name} (${spell.manaCost} MP) - ${spell.description}`, { size: 13, width: k.width() - 60 }),
      k.pos(30, 70 + lines.length * 28 + 35 + i * 24),
      k.color(180, 180, 220),
      k.z(10),
    ]);
  });

  makeButton(k, {
    label: "Back",
    x: k.width() / 2,
    y: k.height() - 40,
    width: 140,
    height: 40,
    onClick: () => k.go("room"),
  });
}
