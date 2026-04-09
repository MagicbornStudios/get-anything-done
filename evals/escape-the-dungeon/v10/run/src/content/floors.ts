import type { Room, Floor } from "../types";

// Authored dungeon. No procedural generation.
// Floor 1: 7 rooms + boss. Floor 2: 6 rooms + boss.

export const ROOMS: Record<string, Room> = {
  // ===== FLOOR 1: THE RUSTED CELLS =====
  f1_entry: {
    id: "f1_entry",
    floor: 1,
    name: "Rusted Gate",
    type: "start",
    desc: "A gate of corroded iron. You entered here — you must leave through the Gaoler.",
    icon: "game-icons:dungeon-gate",
    exits: [
      { dir: "North", to: "f1_guard_hall" },
      { dir: "East", to: "f1_forge" },
    ],
    discovered: true,
  },
  f1_guard_hall: {
    id: "f1_guard_hall",
    floor: 1,
    name: "Guard Hall",
    type: "combat",
    desc: "Abandoned uniforms rot on pegs. A shape shudders in the corner.",
    icon: "game-icons:bone-knife",
    exits: [
      { dir: "South", to: "f1_entry" },
      { dir: "North", to: "f1_atrium" },
    ],
    enemyId: "slime_mote",
    respawnCadence: 6,
  },
  f1_forge: {
    id: "f1_forge",
    floor: 1,
    name: "Apprentice Forge",
    type: "forge",
    desc: "A cold anvil of star-iron. Runes glimmer on the walls, waiting to be spoken.",
    icon: "game-icons:anvil",
    exits: [
      { dir: "West", to: "f1_entry" },
      { dir: "North", to: "f1_rest" },
    ],
  },
  f1_atrium: {
    id: "f1_atrium",
    floor: 1,
    name: "Ash Atrium",
    type: "combat",
    desc: "A hollow cathedral of soot. Wisps drift between the pillars.",
    icon: "game-icons:stone-pile",
    exits: [
      { dir: "South", to: "f1_guard_hall" },
      { dir: "East", to: "f1_rest" },
      { dir: "North", to: "f1_warden_room" },
    ],
    enemyId: "ember_wisp",
    respawnCadence: 8,
  },
  f1_rest: {
    id: "f1_rest",
    floor: 1,
    name: "Shrine of Dim Light",
    type: "rest",
    desc: "A small altar still warm to the touch. You may rest, but its flame is weak.",
    icon: "game-icons:campfire",
    exits: [
      { dir: "South", to: "f1_forge" },
      { dir: "West", to: "f1_atrium" },
      { dir: "East", to: "f1_event" },
    ],
  },
  f1_event: {
    id: "f1_event",
    floor: 1,
    name: "Bound Scholar",
    type: "event",
    desc: "A robed figure manacled to a lectern, muttering about runes.",
    icon: "game-icons:scroll-unfurled",
    exits: [
      { dir: "West", to: "f1_rest" },
      { dir: "North", to: "f1_warden_room" },
    ],
    eventId: "scholar",
  },
  // Elite room — Stone Warden — gates access to boss
  f1_warden_room: {
    id: "f1_warden_room",
    floor: 1,
    name: "Warden's Vault",
    type: "elite",
    desc: "A slab of dungeon stone watches the archway to the final keep. It does not blink.",
    icon: "game-icons:stone-tower",
    exits: [
      { dir: "South", to: "f1_atrium" },
      { dir: "North", to: "f1_boss" },
    ],
    enemyId: "stone_warden",
  },
  // Boss room
  f1_boss: {
    id: "f1_boss",
    floor: 1,
    name: "The Lower Keep",
    type: "boss",
    desc: "The Iron Gaoler rises, key-ring clattering. He is rust and fury and does not care for blades.",
    icon: "game-icons:prisoner",
    exits: [
      { dir: "South", to: "f1_warden_room" },
      { dir: "Up — Floor 2", to: "f2_landing" },
    ],
    enemyId: "iron_gaoler",
  },

  // ===== FLOOR 2: THE MIRRORED DEEP =====
  f2_landing: {
    id: "f2_landing",
    floor: 2,
    name: "Mirror Landing",
    type: "start",
    desc: "The walls are polished obsidian. Your reflection lags by a heartbeat.",
    icon: "game-icons:stairs",
    exits: [
      { dir: "Down — Floor 1", to: "f1_boss" },
      { dir: "North", to: "f2_crypt" },
      { dir: "East", to: "f2_forge" },
    ],
    discovered: true,
  },
  f2_crypt: {
    id: "f2_crypt",
    floor: 2,
    name: "Whispering Crypt",
    type: "combat",
    desc: "Coffins stacked like books. Something hisses your name.",
    icon: "game-icons:tombstone",
    exits: [
      { dir: "South", to: "f2_landing" },
      { dir: "North", to: "f2_mirror_hall" },
    ],
    enemyId: "wraith",
    respawnCadence: 8,
  },
  f2_forge: {
    id: "f2_forge",
    floor: 2,
    name: "Umbral Forge",
    type: "forge",
    desc: "A second anvil, darker than the first. Affinities deepen here.",
    icon: "game-icons:anvil",
    exits: [
      { dir: "West", to: "f2_landing" },
      { dir: "North", to: "f2_rest" },
    ],
  },
  f2_rest: {
    id: "f2_rest",
    floor: 2,
    name: "Moonwell",
    type: "rest",
    desc: "A still pool of silver water. You may rest, but only once it runs clear.",
    icon: "game-icons:water-drop",
    exits: [
      { dir: "South", to: "f2_forge" },
      { dir: "West", to: "f2_mirror_hall" },
    ],
  },
  f2_mirror_hall: {
    id: "f2_mirror_hall",
    floor: 2,
    name: "Hall of Mirrors",
    type: "elite",
    desc: "Every wall is a mirror. The djinn inside smiles with your face.",
    icon: "game-icons:djinn",
    exits: [
      { dir: "South", to: "f2_crypt" },
      { dir: "East", to: "f2_rest" },
      { dir: "North", to: "f2_boss" },
    ],
    enemyId: "mirror_djinn",
  },
  f2_boss: {
    id: "f2_boss",
    floor: 2,
    name: "The Pyre Throne",
    type: "boss",
    desc: "The Pyre Lich rises from a throne of ember-bones. The air is too hot to breathe; the stone is too bright to look at.",
    icon: "game-icons:death-skull",
    exits: [
      { dir: "South", to: "f2_mirror_hall" },
      { dir: "The Surface", to: "__victory__" },
    ],
    enemyId: "pyre_lich",
  },
};

export const FLOORS: Floor[] = [
  {
    number: 1,
    name: "The Rusted Cells",
    description: "Stone, rust, and slime. The Iron Gaoler keeps the lower keep.",
    startRoomId: "f1_entry",
    bossRoomId: "f1_boss",
    constraint: "Direct damage barely scratches the warden. Something must rot or burn it away.",
  },
  {
    number: 2,
    name: "The Mirrored Deep",
    description: "Obsidian halls that return every strike. The Pyre Lich waits.",
    startRoomId: "f2_landing",
    bossRoomId: "f2_boss",
    constraint: "Direct spells reflect back. Fire feeds the throne. Only the slow and indirect endure here.",
  },
];

export function roomById(id: string): Room | undefined {
  return ROOMS[id];
}

export function floorByNumber(n: number): Floor | undefined {
  return FLOORS.find((f) => f.number === n);
}
