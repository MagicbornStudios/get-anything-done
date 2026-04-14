import { GameState, Room } from '../types';
import { updateState, saveGame } from '../state';
import { startCombat } from './combat';
import { FLOOR1_ENEMIES, FLOOR2_ENEMIES } from '../data/enemies';

export function moveToRoom(roomId: string): void {
  updateState(state => {
    const floor = state.floors[state.currentFloor];
    const currentRoom = floor.rooms.find(r => r.id === state.currentRoomId);
    const targetRoom = floor.rooms.find(r => r.id === roomId);

    if (!currentRoom || !targetRoom) return;
    if (!currentRoom.connections.includes(roomId)) return;

    state.currentRoomId = roomId;
    targetRoom.discovered = true;
    state.roomTransitions++;

    // Discover connected rooms
    for (const connId of targetRoom.connections) {
      const conn = floor.rooms.find(r => r.id === connId);
      if (conn) conn.discovered = true;
    }

    state.notifications.push({
      text: `Entered: ${targetRoom.name}`,
      type: 'info',
      id: state.nextNotifId++,
      expires: Date.now() + 3000,
    });

    // Handle room type
    enterRoom(state, targetRoom);
  });
}

function enterRoom(state: GameState, room: Room): void {
  switch (room.type) {
    case 'combat':
    case 'training': {
      if (!room.cleared || room.type === 'training') {
        // Respawn enemies if needed
        if (!room.enemies || room.enemies.length === 0) {
          respawnEnemies(state, room);
        }
        if (room.enemies && room.enemies.length > 0) {
          // Don't auto-start combat, let the player see the room first
          state.screen = 'exploration';
        }
      }
      break;
    }
    case 'elite': {
      if (!room.cleared) {
        state.screen = 'exploration';
      }
      break;
    }
    case 'boss': {
      if (!room.cleared) {
        state.screen = 'exploration';
      }
      break;
    }
    case 'forge':
      state.screen = 'exploration';
      break;
    case 'rest':
      state.screen = 'exploration';
      break;
    case 'merchant':
      state.screen = 'exploration';
      break;
    case 'event':
      if (room.npc && !room.npc.met) {
        // Show dialogue
        state.dialogueState = { npcId: room.npc.id, currentNodeId: 'start' };
        state.screen = 'dialogue';
      } else if (room.eventData && !room.cleared) {
        state.screen = 'event';
      } else {
        state.screen = 'exploration';
      }
      break;
  }
}

function respawnEnemies(state: GameState, room: Room): void {
  const floorId = state.currentFloor;
  const enemies = floorId === 0 ? FLOOR1_ENEMIES : FLOOR2_ENEMIES;

  // Respawn based on room position (deterministic)
  if (room.type === 'training') {
    room.enemies = [{
      id: 'dummy-' + Math.random().toString(36).slice(2, 6),
      name: 'Training Dummy', hp: 999, maxHp: 999, attack: 1, defense: 0,
      resistances: {}, weaknesses: [], traits: { aggression: 0, compassion: 0, arcaneAffinity: 0, cunning: 0, resilience: 1 },
      xpReward: 2, goldReward: 0, icon: 'game-icons:armor-punch', behavior: 'territorial', loot: [],
    }];
    return;
  }

  // For combat rooms, respawn with fresh enemies
  const enemyList = Object.values(enemies).filter(fn => {
    const e = fn();
    return e.name !== 'The Stone King' && e.name !== 'The Void Empress' &&
           e.name !== 'Crystal Guardian' && e.name !== 'Void Weaver';
  });

  if (enemyList.length > 0) {
    const count = 1 + Math.floor(Math.random() * 2);
    room.enemies = [];
    for (let i = 0; i < count; i++) {
      const fn = enemyList[Math.floor(Math.random() * enemyList.length)];
      room.enemies.push(fn());
    }
  }
}

export function moveToFloor(floorIndex: number): void {
  updateState(state => {
    if (floorIndex < 0 || floorIndex >= state.floors.length) return;
    if (!state.floors[floorIndex].unlocked) return;

    state.currentFloor = floorIndex;
    const floor = state.floors[floorIndex];
    const entrance = floor.rooms[0];
    state.currentRoomId = entrance.id;
    entrance.discovered = true;

    // Discover connected rooms
    for (const connId of entrance.connections) {
      const conn = floor.rooms.find(r => r.id === connId);
      if (conn) conn.discovered = true;
    }

    state.screen = 'exploration';
    state.roomTransitions++;
    saveGame(state);
  });
}

export function getCurrentRoom(state: GameState): Room | undefined {
  return state.floors[state.currentFloor]?.rooms.find(r => r.id === state.currentRoomId);
}
