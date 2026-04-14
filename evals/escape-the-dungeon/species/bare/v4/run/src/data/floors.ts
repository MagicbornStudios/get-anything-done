export type RoomType = "start" | "combat" | "elite" | "forge" | "rest" | "event" | "boss" | "treasure";

export interface RoomDef {
  id: string;
  name: string;
  type: RoomType;
  description: string;
  exits: { direction: string; targetId: string; label?: string }[];
  enemyIds?: string[];        // for combat/elite/boss rooms
  eventId?: string;           // for event rooms
  loot?: { itemId: string; count: number }[];  // for treasure rooms
}

export interface FloorDef {
  id: number;
  name: string;
  description: string;
  mechanicalConstraint: string;
  rooms: RoomDef[];
}

export const ROOM_ICONS: Record<RoomType, string> = {
  start: "🚪",
  combat: "⚔️",
  elite: "💀",
  forge: "🔨",
  rest: "🏕️",
  event: "💬",
  boss: "👹",
  treasure: "🎁",
};

export const ROOM_COLORS: Record<RoomType, string> = {
  start: "#3a3a5a",
  combat: "#5a2a2a",
  elite: "#7a3a1a",
  forge: "#6a4a1a",
  rest: "#2a4a6a",
  event: "#2a5a3a",
  boss: "#6a1a5a",
  treasure: "#5a4a1a",
};

export const FLOORS: FloorDef[] = [
  {
    id: 1,
    name: "The Stone Depths",
    description: "Caverns of hardened stone. Enemies here are physically tough — swords bounce off their hides.",
    mechanicalConstraint: "Enemies resist physical damage. Use elemental spells or DoT (poison/fire) to deal real damage. Craft at the forge!",
    rooms: [
      {
        id: "f1_start",
        name: "Dungeon Entrance",
        type: "start",
        description: "Cold air seeps from the tunnel ahead. Your adventure begins here.",
        exits: [
          { direction: "North", targetId: "f1_combat1", label: "Dark Tunnel" },
          { direction: "East", targetId: "f1_event1", label: "Glowing Passage" },
        ],
      },
      {
        id: "f1_combat1",
        name: "Slime Cavern",
        type: "combat",
        description: "Gelatinous ooze drips from the ceiling. Something moves in the shadows.",
        enemyIds: ["slime"],
        exits: [
          { direction: "South", targetId: "f1_start", label: "Back to Entrance" },
          { direction: "North", targetId: "f1_forge", label: "Warm Glow Ahead" },
          { direction: "East", targetId: "f1_combat2", label: "Clicking Sounds" },
        ],
      },
      {
        id: "f1_event1",
        name: "Hermit's Alcove",
        type: "event",
        description: "A weathered figure sits by a dim lantern, surrounded by old tomes.",
        eventId: "hermit_advice",
        exits: [
          { direction: "West", targetId: "f1_start", label: "Back to Entrance" },
          { direction: "North", targetId: "f1_treasure", label: "Hidden Nook" },
        ],
      },
      {
        id: "f1_treasure",
        name: "Hidden Cache",
        type: "treasure",
        description: "A small chamber with a dusty chest tucked behind fallen rocks.",
        loot: [
          { itemId: "health_potion", count: 2 },
          { itemId: "mana_potion", count: 1 },
        ],
        exits: [
          { direction: "South", targetId: "f1_event1", label: "Hermit's Alcove" },
        ],
      },
      {
        id: "f1_combat2",
        name: "Beetle Nest",
        type: "combat",
        description: "The walls are covered in scratch marks. Iron-shelled beetles guard their territory.",
        enemyIds: ["iron_beetle"],
        exits: [
          { direction: "West", targetId: "f1_combat1", label: "Slime Cavern" },
          { direction: "North", targetId: "f1_rest", label: "Quiet Clearing" },
        ],
      },
      {
        id: "f1_forge",
        name: "Ancient Forge",
        type: "forge",
        description: "A magical anvil thrums with power. Runes are etched into the walls. You can craft spells here.",
        exits: [
          { direction: "South", targetId: "f1_combat1", label: "Slime Cavern" },
          { direction: "East", targetId: "f1_rest", label: "Quiet Clearing" },
          { direction: "North", targetId: "f1_elite", label: "Crystal Chamber" },
        ],
      },
      {
        id: "f1_rest",
        name: "Underground Spring",
        type: "rest",
        description: "A natural spring bubbles up through the rock. The air here is fresh and healing.",
        exits: [
          { direction: "West", targetId: "f1_forge", label: "Ancient Forge" },
          { direction: "South", targetId: "f1_combat2", label: "Beetle Nest" },
          { direction: "North", targetId: "f1_boss", label: "Warden's Gate" },
        ],
      },
      {
        id: "f1_elite",
        name: "Crystal Chamber",
        type: "elite",
        description: "Crystals pulse with inner light. A massive crystal entity blocks the path.",
        enemyIds: ["crystal_guardian"],
        exits: [
          { direction: "South", targetId: "f1_forge", label: "Ancient Forge" },
          { direction: "East", targetId: "f1_boss", label: "Warden's Gate" },
        ],
      },
      {
        id: "f1_boss",
        name: "Warden's Gate",
        type: "boss",
        description: "An enormous stone figure stands before the stairway down. The Stone Warden will not let you pass easily.",
        enemyIds: ["warden_stone"],
        exits: [
          { direction: "South", targetId: "f1_rest", label: "Underground Spring" },
          { direction: "West", targetId: "f1_elite", label: "Crystal Chamber" },
        ],
      },
    ],
  },
  {
    id: 2,
    name: "The Void Halls",
    description: "Shadows twist and writhe. Enemies here drain mana and reflect direct damage. Conserve resources and use DoT.",
    mechanicalConstraint: "Enemies reflect direct damage and drain mana. Use DoT spells, indirect attacks, and conserve your mana pool. The forge is critical here.",
    rooms: [
      {
        id: "f2_start",
        name: "Void Threshold",
        type: "start",
        description: "The stairway opens into a dark expanse. Shadows dance at the edges of your vision.",
        exits: [
          { direction: "North", targetId: "f2_combat1", label: "Whispering Gallery" },
          { direction: "East", targetId: "f2_event1", label: "Faint Glow" },
        ],
      },
      {
        id: "f2_combat1",
        name: "Wraith Corridor",
        type: "combat",
        description: "Translucent figures drift through the walls. They shimmer and shift.",
        enemyIds: ["mirror_wraith"],
        exits: [
          { direction: "South", targetId: "f2_start", label: "Void Threshold" },
          { direction: "North", targetId: "f2_forge", label: "Violet Flame" },
          { direction: "East", targetId: "f2_combat2", label: "Dark Pool" },
        ],
      },
      {
        id: "f2_event1",
        name: "Shadow Merchant",
        type: "event",
        description: "A cloaked figure offers wares from beyond the veil.",
        eventId: "shadow_merchant",
        exits: [
          { direction: "West", targetId: "f2_start", label: "Void Threshold" },
          { direction: "North", targetId: "f2_treasure", label: "Shadowed Vault" },
        ],
      },
      {
        id: "f2_treasure",
        name: "Shadowed Vault",
        type: "treasure",
        description: "A vault sealed with shadow magic. Its contents shimmer invitingly.",
        loot: [
          { itemId: "mana_potion", count: 2 },
          { itemId: "shield_potion", count: 1 },
          { itemId: "health_potion", count: 1 },
        ],
        exits: [
          { direction: "South", targetId: "f2_event1", label: "Shadow Merchant" },
        ],
      },
      {
        id: "f2_combat2",
        name: "Leech Pool",
        type: "combat",
        description: "Dark water churns with tentacled creatures that hunger for magic.",
        enemyIds: ["void_leech"],
        exits: [
          { direction: "West", targetId: "f2_combat1", label: "Wraith Corridor" },
          { direction: "North", targetId: "f2_rest", label: "Dim Sanctuary" },
        ],
      },
      {
        id: "f2_forge",
        name: "Void Forge",
        type: "forge",
        description: "A forge of violet flame burns in the darkness. The runes here pulse with void energy.",
        exits: [
          { direction: "South", targetId: "f2_combat1", label: "Wraith Corridor" },
          { direction: "East", targetId: "f2_rest", label: "Dim Sanctuary" },
          { direction: "North", targetId: "f2_elite", label: "Devourer's Lair" },
        ],
      },
      {
        id: "f2_rest",
        name: "Dim Sanctuary",
        type: "rest",
        description: "A pocket of calm in the void. Faint warmth emanates from glowing fungi.",
        exits: [
          { direction: "West", targetId: "f2_forge", label: "Void Forge" },
          { direction: "South", targetId: "f2_combat2", label: "Leech Pool" },
          { direction: "North", targetId: "f2_combat3", label: "Stalker's Den" },
        ],
      },
      {
        id: "f2_combat3",
        name: "Stalker's Den",
        type: "combat",
        description: "The shadows here are alive. Something hunts in the dark.",
        enemyIds: ["shadow_stalker", "shadow_stalker"],
        exits: [
          { direction: "South", targetId: "f2_rest", label: "Dim Sanctuary" },
          { direction: "North", targetId: "f2_boss", label: "Void Throne" },
        ],
      },
      {
        id: "f2_elite",
        name: "Devourer's Lair",
        type: "elite",
        description: "A massive creature of pure void energy swirls before you, draining all magic nearby.",
        enemyIds: ["mana_devourer"],
        exits: [
          { direction: "South", targetId: "f2_forge", label: "Void Forge" },
          { direction: "East", targetId: "f2_boss", label: "Void Throne" },
        ],
      },
      {
        id: "f2_boss",
        name: "Void Throne",
        type: "boss",
        description: "An immense figure sits upon a throne of darkness. The Void King surveys you with ancient malice.",
        enemyIds: ["void_king"],
        exits: [
          { direction: "South", targetId: "f2_combat3", label: "Stalker's Den" },
          { direction: "West", targetId: "f2_elite", label: "Devourer's Lair" },
        ],
      },
    ],
  },
];
