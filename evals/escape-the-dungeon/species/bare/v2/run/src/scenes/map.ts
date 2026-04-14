import { makeButton, addCenteredText } from "../systems/ui";
import { getPlayer } from "../systems/state";
import { content } from "../systems/content";

export function mapScene(k: any) {
  const player = getPlayer();
  const floor = content.getFloor(player.currentFloor);

  addCenteredText(k, "-- Floor Map --", 30, 24, [150, 200, 150]);

  if (!floor) {
    addCenteredText(k, "No floor data.", 80, 16);
    return;
  }

  addCenteredText(k, floor.name, 60, 18, [200, 200, 220]);

  const roomTypeColors: Record<string, [number, number, number]> = {
    start: [100, 200, 100],
    combat: [220, 80, 80],
    dialogue: [100, 150, 220],
    treasure: [220, 200, 50],
    rest: [100, 220, 180],
    boss: [200, 50, 200],
    forge: [220, 140, 50],
  };

  let y = 90;
  floor.rooms.forEach((room) => {
    const discovered = player.discoveredRooms.includes(room.id);
    const current = player.currentRoomId === room.id;
    const defeated = player.defeatedEnemies.includes(room.id);

    const col = discovered ? (roomTypeColors[room.type] ?? [200, 200, 200]) : [80, 80, 80];
    const prefix = current ? ">> " : "   ";
    const suffix = defeated ? " [cleared]" : "";
    const name = discovered ? room.name : "???";

    k.add([
      k.text(`${prefix}${name} (${room.type})${suffix}`, { size: 14 }),
      k.pos(30, y),
      k.color(col[0], col[1], col[2]),
      k.z(10),
    ]);

    y += 24;
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
