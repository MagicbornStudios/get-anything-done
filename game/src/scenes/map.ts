// ============================================================
// Map / Navigation Scene (R-v5.12, R-v5.17)
// ============================================================

import { registerScene, renderScene, icon, roomTypeIcon, elementColor } from '../renderer';
import { getState, getCurrentFloor, getCurrentRoom, saveGame } from '../state';
import { emit } from '../events';

registerScene('map', () => {
  const app = document.getElementById('app')!;
  const s = getState();
  const floor = getCurrentFloor();
  const currentRoom = getCurrentRoom();

  // Discover connected rooms
  for (const connId of currentRoom.connections) {
    const connRoom = floor.rooms.find(r => r.id === connId);
    if (connRoom && !connRoom.discovered) {
      connRoom.discovered = true;
    }
  }

  // Build the visual map as a grid
  const maxX = Math.max(...floor.rooms.filter(r => r.discovered).map(r => r.gridX));
  const maxY = Math.max(...floor.rooms.filter(r => r.discovered).map(r => r.gridY));

  let mapHtml = '<div class="map-grid">';
  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x <= maxX + 1; x++) {
      const room = floor.rooms.find(r => r.discovered && r.gridX === x && r.gridY === y);
      if (room) {
        const isCurrent = room.id === currentRoom.id;
        const isConnected = currentRoom.connections.includes(room.id);
        const classes = [
          'map-room',
          `room-type-${room.type}`,
          isCurrent ? 'map-room-current' : '',
          room.cleared ? 'map-room-cleared' : '',
          isConnected ? 'map-room-connected' : '',
        ].filter(Boolean).join(' ');

        mapHtml += `
          <div class="${classes}" data-room-id="${room.id}" style="grid-column:${x + 1};grid-row:${y + 1}" title="${room.name} (${room.type})">
            <div class="map-room-icon">${icon(room.icon || roomTypeIcon(room.type), 28)}</div>
            <div class="map-room-name">${room.name}</div>
            ${isCurrent ? `<div class="map-player-marker">${icon('game-icons:person', 16)}</div>` : ''}
            ${room.cleared ? '<div class="map-cleared-mark">&#10003;</div>' : ''}
          </div>
        `;
      } else {
        mapHtml += `<div class="map-empty" style="grid-column:${x + 1};grid-row:${y + 1}"></div>`;
      }
    }
  }
  mapHtml += '</div>';

  // Draw connections
  // (connections drawn via CSS borders/lines between adjacent rooms)

  app.innerHTML = `
    <div class="scene map-scene">
      <div class="scene-header">
        <h2>${icon('game-icons:treasure-map', 28)} ${floor.name} — Floor ${floor.id}</h2>
        <p class="floor-constraint">${icon('game-icons:info', 16)} ${floor.mechanicalConstraint}</p>
      </div>
      ${mapHtml}
      <div class="room-info-panel">
        <h3>${icon(currentRoom.icon || roomTypeIcon(currentRoom.type), 24)} ${currentRoom.name}</h3>
        <p class="room-type-badge room-type-${currentRoom.type}">${currentRoom.type.toUpperCase()}</p>
        <p>${currentRoom.description}</p>
        ${!currentRoom.cleared ? `<button class="btn btn-primary" id="btn-enter-room">${icon('game-icons:door', 20)} Enter Room</button>` : '<p class="cleared-text">&#10003; Cleared</p>'}
      </div>
    </div>
  `;

  // Room click to navigate
  app.querySelectorAll('.map-room-connected').forEach(el => {
    el.addEventListener('click', () => {
      const roomId = (el as HTMLElement).dataset.roomId;
      if (roomId && roomId !== currentRoom.id) {
        s.player.currentRoomId = roomId;
        s.currentScene = 'map';
        saveGame();
        renderScene('map');
        emit('state-changed');
      }
    });
  });

  // Enter room button
  document.getElementById('btn-enter-room')?.addEventListener('click', () => {
    enterRoom(currentRoom.type);
  });
});

function enterRoom(type: string): void {
  const s = getState();
  switch (type) {
    case 'combat':
    case 'elite':
    case 'boss':
    case 'training':
      s.currentScene = 'combat';
      renderScene('combat');
      break;
    case 'forge':
      s.currentScene = 'forge';
      renderScene('forge');
      break;
    case 'rest':
      s.currentScene = 'rest';
      renderScene('rest');
      break;
    case 'event':
      s.currentScene = 'dialogue';
      renderScene('dialogue');
      break;
    case 'merchant':
      s.currentScene = 'merchant';
      renderScene('merchant');
      break;
    default:
      s.currentScene = 'map';
      renderScene('map');
  }
}
