import { makeButton, addCenteredText } from "../systems/ui";
import { getPlayer } from "../systems/state";
import { content } from "../systems/content";

export function bagScene(k: any) {
  const player = getPlayer();

  addCenteredText(k, "-- Bag --", 30, 24, [220, 200, 100]);

  addCenteredText(k, `Crystals: ${player.crystals}`, 65, 16, [220, 200, 50]);

  if (player.inventory.length === 0) {
    addCenteredText(k, "Your bag is empty.", 110, 16, [150, 150, 150]);
  }

  let y = 100;
  player.inventory.forEach((inv) => {
    const item = content.getItem(inv.id);
    if (!item) return;

    k.add([
      k.text(`${item.name} x${inv.quantity}`, { size: 16 }),
      k.pos(40, y),
      k.color(220, 220, 200),
      k.z(10),
    ]);

    k.add([
      k.text(item.description, { size: 12, width: k.width() - 60 }),
      k.pos(40, y + 22),
      k.color(160, 160, 180),
      k.z(10),
    ]);

    y += 50;
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
