import { Floor, Room } from '../types';
import { FLOOR1_ENEMIES, FLOOR2_ENEMIES } from './enemies';
import { ITEMS, EQUIPMENT } from './items';
import { createNPCs } from './npcs';

function makeRoom(partial: Partial<Room> & { id: string; name: string; type: Room['type']; floor: number; x: number; y: number }): Room {
  return {
    description: '',
    cleared: false,
    discovered: false,
    connections: [],
    icon: getRoomIcon(partial.type),
    ...partial,
  };
}

function getRoomIcon(type: string): string {
  const icons: Record<string, string> = {
    combat: 'game-icons:crossed-swords',
    elite: 'game-icons:skull-crossed-bones',
    forge: 'game-icons:anvil',
    rest: 'game-icons:campfire',
    event: 'game-icons:scroll-unfurled',
    merchant: 'game-icons:shop',
    boss: 'game-icons:crowned-skull',
    training: 'game-icons:training',
  };
  return icons[type] || 'game-icons:dungeon-gate';
}

export function createFloors(): Floor[] {
  const npcs = createNPCs();

  // ====== FLOOR 1: Stone Depths ======
  // Constraint: enemies resistant to raw physical/fire — need crafted elemental spells
  const f1Rooms: Room[] = [
    makeRoom({
      id: 'f1-entrance', name: 'Dungeon Entrance', type: 'event', floor: 1,
      x: 2, y: 0, discovered: true, description: 'Cold stone steps lead down into darkness. A faint glow beckons ahead.',
      eventData: {
        text: 'You descend into the dungeon. The air is thick with ancient magic. A weathered sign reads: "Only the ingenious escape these depths."',
        choices: [
          { text: 'Press forward with determination.', effect: (s) => { s.player.traits.resilience = Math.min(1, s.player.traits.resilience + 0.05); }, resultText: 'You steel yourself. (+0.05 Resilience)' },
          { text: 'Study the runes carved into the walls.', effect: (s) => { s.player.traits.arcaneAffinity = Math.min(1, s.player.traits.arcaneAffinity + 0.05); }, resultText: 'The runes whisper ancient secrets. (+0.05 Arcane Affinity)' },
        ],
      },
    }),
    makeRoom({
      id: 'f1-combat1', name: 'Spider Nest', type: 'combat', floor: 1,
      x: 1, y: 1, description: 'Webs cover every surface. Something skitters in the dark.',
      enemies: [FLOOR1_ENEMIES.venomSpider(), FLOOR1_ENEMIES.caveBat()],
    }),
    makeRoom({
      id: 'f1-combat2', name: 'Golem Hall', type: 'combat', floor: 1,
      x: 3, y: 1, description: 'Stone constructs stand watch over crumbling pillars.',
      enemies: [FLOOR1_ENEMIES.stoneSentinel(), FLOOR1_ENEMIES.gravelGolem()],
    }),
    makeRoom({
      id: 'f1-event1', name: "Hermit's Alcove", type: 'event', floor: 1,
      x: 0, y: 2, description: 'A small alcove where an old figure sits by a dim fire.',
      npc: npcs[0], // Hermit
    }),
    makeRoom({
      id: 'f1-forge', name: 'Ancient Forge', type: 'forge', floor: 1,
      x: 2, y: 2, description: 'Glowing runes pulse on an ancient stone anvil. The forge still burns.',
    }),
    makeRoom({
      id: 'f1-merchant', name: "Crag's Shop", type: 'merchant', floor: 1,
      x: 4, y: 2, description: 'A merchant has set up shop in a surprisingly clean alcove.',
      merchantStock: [
        ITEMS['potion-small'](),
        ITEMS['potion-small'](),
        ITEMS['potion-large'](),
        ITEMS['mana-potion'](),
        ITEMS['stamina-potion'](),
        EQUIPMENT['iron-sword'](),
        EQUIPMENT['wooden-shield'](),
        EQUIPMENT['leather-armor'](),
        EQUIPMENT['health-amulet'](),
      ] as any[],
    }),
    makeRoom({
      id: 'f1-rest', name: 'Moss Grotto', type: 'rest', floor: 1,
      x: 1, y: 3, description: 'Soft moss and a gentle spring. A place of respite.',
    }),
    makeRoom({
      id: 'f1-elite', name: 'Crystal Chamber', type: 'elite', floor: 1,
      x: 3, y: 3, description: 'Crystals pulse with hostile energy. A guardian stands vigil.',
      enemies: [FLOOR1_ENEMIES.crystalGuardian()],
    }),
    makeRoom({
      id: 'f1-training', name: 'Training Grounds', type: 'training', floor: 1,
      x: 2, y: 3, description: 'Practice dummies and enchanted sparring targets line the walls.',
      enemies: [
        { id: 'dummy-1', name: 'Training Dummy', hp: 999, maxHp: 999, attack: 1, defense: 0,
          resistances: {}, weaknesses: [], traits: { aggression: 0, compassion: 0, arcaneAffinity: 0, cunning: 0, resilience: 1 },
          xpReward: 2, goldReward: 0, icon: 'game-icons:armor-punch', behavior: 'territorial' as const, loot: [] },
      ],
    }),
    makeRoom({
      id: 'f1-boss', name: "Stone King's Throne", type: 'boss', floor: 1,
      x: 2, y: 4, description: 'A massive throne room. The Stone King rises from his seat.',
      enemies: [FLOOR1_ENEMIES.floorBoss1()],
    }),
  ];

  // Set connections (bidirectional)
  const f1Connections: [string, string][] = [
    ['f1-entrance', 'f1-combat1'],
    ['f1-entrance', 'f1-combat2'],
    ['f1-combat1', 'f1-event1'],
    ['f1-combat1', 'f1-forge'],
    ['f1-combat2', 'f1-forge'],
    ['f1-combat2', 'f1-merchant'],
    ['f1-event1', 'f1-rest'],
    ['f1-forge', 'f1-training'],
    ['f1-forge', 'f1-rest'],
    ['f1-forge', 'f1-elite'],
    ['f1-merchant', 'f1-elite'],
    ['f1-rest', 'f1-boss'],
    ['f1-elite', 'f1-boss'],
    ['f1-training', 'f1-boss'],
  ];

  for (const [a, b] of f1Connections) {
    const roomA = f1Rooms.find(r => r.id === a)!;
    const roomB = f1Rooms.find(r => r.id === b)!;
    if (!roomA.connections.includes(b)) roomA.connections.push(b);
    if (!roomB.connections.includes(a)) roomB.connections.push(a);
  }

  // ====== FLOOR 2: Shadow Depths ======
  // Constraint: enemies reflect direct damage, need shadow/nature combo spells
  const f2Rooms: Room[] = [
    makeRoom({
      id: 'f2-entrance', name: 'Shadow Threshold', type: 'event', floor: 2,
      x: 2, y: 0, description: 'The air grows thick with shadow. Reality feels thinner here.',
      eventData: {
        text: 'As you descend deeper, shadows seem to move with purpose. The dungeon itself seems aware of your presence.',
        choices: [
          { text: 'Embrace the darkness within. (+Shadow affinity)', effect: (s) => { s.player.affinities.shadow = Math.min(100, (s.player.affinities.shadow || 0) + 5); }, resultText: 'The shadows welcome you. (+5 Shadow affinity)' },
          { text: 'Light a torch and push through. (+Resilience)', effect: (s) => { s.player.traits.resilience = Math.min(1, s.player.traits.resilience + 0.05); }, resultText: 'Your light pushes back the dark. (+0.05 Resilience)' },
        ],
      },
    }),
    makeRoom({
      id: 'f2-combat1', name: 'Wraith Corridor', type: 'combat', floor: 2,
      x: 1, y: 1, description: 'Ghostly figures drift through translucent walls.',
      enemies: [FLOOR2_ENEMIES.mirrorWraith(), FLOOR2_ENEMIES.manaDrainer()],
    }),
    makeRoom({
      id: 'f2-combat2', name: 'Hound Kennel', type: 'combat', floor: 2,
      x: 3, y: 1, description: 'Growling echoes from the shadows. Red eyes watch your every move.',
      enemies: [FLOOR2_ENEMIES.shadowHound(), FLOOR2_ENEMIES.shadowHound()],
    }),
    makeRoom({
      id: 'f2-event1', name: "Morvyn's Sanctum", type: 'event', floor: 2,
      x: 0, y: 2, description: 'Candles float in the air. A witch peers at you from the darkness.',
      npc: npcs[1], // Shadow Witch
    }),
    makeRoom({
      id: 'f2-forge', name: 'Shadow Forge', type: 'forge', floor: 2,
      x: 2, y: 2, description: 'A forge that burns with dark flame. More powerful but more dangerous.',
    }),
    makeRoom({
      id: 'f2-merchant', name: "Shade's Bazaar", type: 'merchant', floor: 2,
      x: 4, y: 2, description: 'A mysterious merchant who seems to exist between worlds.',
      merchantStock: [
        ITEMS['potion-large'](),
        ITEMS['potion-large'](),
        ITEMS['mana-potion'](),
        ITEMS['mana-crystal'](),
        ITEMS['stamina-potion'](),
        EQUIPMENT['flame-dagger'](),
        EQUIPMENT['crystal-focus'](),
        EQUIPMENT['chain-mail'](),
        EQUIPMENT['mana-ring'](),
      ] as any[],
    }),
    makeRoom({
      id: 'f2-rest', name: 'Spirit Spring', type: 'rest', floor: 2,
      x: 1, y: 3, description: 'A spectral spring pulses with healing energy.',
    }),
    makeRoom({
      id: 'f2-event2', name: "Lyra's Shrine", type: 'event', floor: 2,
      x: 3, y: 3, description: 'A serene glow emanates from an ancient shrine.',
      npc: npcs[2], // Ancient Spirit Lyra
    }),
    makeRoom({
      id: 'f2-elite', name: "Void Weaver's Lair", type: 'elite', floor: 2,
      x: 2, y: 3, description: 'Reality warps and tears around a powerful void entity.',
      enemies: [FLOOR2_ENEMIES.voidWeaver()],
    }),
    makeRoom({
      id: 'f2-combat3', name: 'Dark Garrison', type: 'combat', floor: 2,
      x: 4, y: 3, description: 'Armored knights of the abyss stand guard.',
      enemies: [FLOOR2_ENEMIES.abyssalKnight(), FLOOR2_ENEMIES.shadowHound()],
    }),
    makeRoom({
      id: 'f2-boss', name: "Void Empress's Chamber", type: 'boss', floor: 2,
      x: 2, y: 4, description: 'The heart of the dungeon. The Void Empress awaits.',
      enemies: [FLOOR2_ENEMIES.floorBoss2()],
    }),
  ];

  const f2Connections: [string, string][] = [
    ['f2-entrance', 'f2-combat1'],
    ['f2-entrance', 'f2-combat2'],
    ['f2-combat1', 'f2-event1'],
    ['f2-combat1', 'f2-forge'],
    ['f2-combat2', 'f2-forge'],
    ['f2-combat2', 'f2-merchant'],
    ['f2-event1', 'f2-rest'],
    ['f2-forge', 'f2-elite'],
    ['f2-forge', 'f2-rest'],
    ['f2-forge', 'f2-event2'],
    ['f2-merchant', 'f2-event2'],
    ['f2-merchant', 'f2-combat3'],
    ['f2-rest', 'f2-boss'],
    ['f2-elite', 'f2-boss'],
    ['f2-event2', 'f2-boss'],
    ['f2-combat3', 'f2-boss'],
  ];

  for (const [a, b] of f2Connections) {
    const roomA = f2Rooms.find(r => r.id === a)!;
    const roomB = f2Rooms.find(r => r.id === b)!;
    if (!roomA.connections.includes(b)) roomA.connections.push(b);
    if (!roomB.connections.includes(a)) roomB.connections.push(a);
  }

  return [
    {
      id: 1,
      name: 'Stone Depths',
      rooms: f1Rooms,
      bossRoomId: 'f1-boss',
      mechanicalConstraint: 'Enemies resistant to raw damage. Craft elemental spells using the forge.',
      unlocked: true,
    },
    {
      id: 2,
      name: 'Shadow Depths',
      rooms: f2Rooms,
      bossRoomId: 'f2-boss',
      mechanicalConstraint: 'Enemies reflect direct damage and drain mana. Use combo spells and physical skills.',
      unlocked: false,
    },
  ];
}
