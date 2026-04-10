import { registerScene, el, icon, barHTML } from '../renderer';
import { getState, getCurrentFloor, getCurrentRoom, moveToRoom, setScene, moveToFloor } from '../state';
import { createHUD } from '../hud';
import type { Room } from '../types';

const ROOM_ICONS: Record<string, string> = {
  combat: 'game-icons:crossed-swords',
  elite: 'game-icons:crowned-skull',
  forge: 'game-icons:anvil',
  rest: 'game-icons:camp-fire',
  event: 'game-icons:conversation',
  merchant: 'game-icons:shop',
  boss: 'game-icons:skull-crossed-bones',
  training: 'game-icons:target-dummy',
};

function isAdjacent(room: Room, currentRoom: Room): boolean {
  return currentRoom.connections.includes(room.id);
}

function roomColor(type: string): string {
  const map: Record<string, string> = {
    combat: 'var(--room-combat)', elite: 'var(--room-elite)',
    forge: 'var(--room-forge)', rest: 'var(--room-rest)',
    event: 'var(--room-event)', merchant: 'var(--room-merchant)',
    boss: 'var(--room-boss)', training: 'var(--room-training)',
  };
  return map[type] || 'var(--border)';
}

registerScene('map', (container) => {
  const state = getState();
  const floor = getCurrentFloor();
  const current = getCurrentRoom();

  container.appendChild(createHUD());

  const scene = el('div', { className: 'map-scene' });

  // Map area
  const mapContainer = el('div', { className: 'map-container' });

  // Build grid
  const maxX = Math.max(...floor.rooms.map(r => r.gridX)) + 1;
  const maxY = Math.max(...floor.rooms.map(r => r.gridY)) + 1;
  const grid = el('div', { className: 'map-grid', style: { gridTemplateColumns: `repeat(${maxX}, 90px)`, gridTemplateRows: `repeat(${maxY}, 80px)` } });

  // Place rooms
  for (let y = 0; y < maxY; y++) {
    for (let x = 0; x < maxX; x++) {
      const room = floor.rooms.find(r => r.gridX === x && r.gridY === y);
      if (!room) {
        grid.appendChild(el('div', { style: { width: '90px', height: '80px' } }));
        continue;
      }

      if (!room.discovered) {
        const hidden = el('div', { className: 'map-room locked', style: { gridColumn: x + 1, gridRow: y + 1 } },
          icon('game-icons:locked-chest', 'icon-sm'),
          el('span', { className: 'room-name' }, '???'),
        );
        grid.appendChild(hidden);
        continue;
      }

      const isCurrent = room.id === current.id;
      const adj = isAdjacent(room, current);
      const classes = [
        'map-room',
        `type-${room.type}`,
        isCurrent ? 'current' : '',
        room.cleared ? 'cleared' : '',
        adj && !isCurrent ? 'adjacent' : '',
        !adj && !isCurrent ? '' : '',
      ].filter(Boolean).join(' ');

      const roomEl = el('div', {
        className: classes,
        onclick: () => {
          if (adj || isCurrent) {
            handleRoomClick(room);
          }
        },
        style: { gridColumn: x + 1, gridRow: y + 1 },
      },
        isCurrent ? icon('game-icons:knight-banner', 'icon-sm') : icon(ROOM_ICONS[room.type] || 'game-icons:dungeon-gate', 'icon-sm'),
        el('span', { className: 'room-name' }, room.name.length > 12 ? room.name.slice(0, 11) + '...' : room.name),
        room.cleared ? el('span', { style: { fontSize: '9px', color: 'var(--accent-heal)' } }, 'CLEAR') : el('span', {}),
      );

      grid.appendChild(roomEl);
    }
  }

  mapContainer.appendChild(grid);

  // Draw connection lines as simple CSS lines
  // Using an SVG overlay
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'map-connections');
  svg.style.width = `${maxX * 98 + 48}px`;
  svg.style.height = `${maxY * 88 + 48}px`;
  svg.style.position = 'absolute';
  svg.style.top = '24px';
  svg.style.left = '24px';

  for (const room of floor.rooms) {
    if (!room.discovered) continue;
    for (const connId of room.connections) {
      const conn = floor.rooms.find(r => r.id === connId);
      if (!conn || !conn.discovered) continue;
      const x1 = room.gridX * 98 + 45;
      const y1 = room.gridY * 88 + 40;
      const x2 = conn.gridX * 98 + 45;
      const y2 = conn.gridY * 88 + 40;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(x1));
      line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(x2));
      line.setAttribute('y2', String(y2));
      line.setAttribute('stroke', 'rgba(74,74,106,0.5)');
      line.setAttribute('stroke-width', '2');
      svg.appendChild(line);
    }
  }

  mapContainer.style.position = 'relative';
  mapContainer.appendChild(svg);

  scene.appendChild(mapContainer);

  // Sidebar with room details
  const sidebar = el('div', { className: 'map-sidebar' },
    el('div', { className: 'panel' },
      el('div', { className: 'panel-header' },
        el('h3', {}, floor.name),
        el('span', { style: { fontSize: '11px', color: 'var(--text-dim)' } }, `Floor ${floor.id}`),
      ),
      el('p', { style: { fontSize: '12px', color: 'var(--text-dim)', marginBottom: '8px' } }, floor.mechanicalConstraint),
    ),
    el('div', { className: 'panel' },
      el('div', { className: 'panel-header' },
        el('h3', {}, current.name),
        el('span', { style: { fontSize: '11px', color: roomColor(current.type) } }, current.type.toUpperCase()),
      ),
      icon(ROOM_ICONS[current.type] || 'game-icons:dungeon-gate', 'icon-lg'),
      el('p', { style: { fontSize: '12px', marginTop: '8px', lineHeight: '1.5' } }, current.description),
      ...(current.type !== 'combat' && current.type !== 'elite' && current.type !== 'boss' && !current.cleared ? [
        el('button', {
          className: 'btn btn-primary',
          style: { marginTop: '12px', width: '100%' },
          onclick: () => handleRoomClick(current),
        }, 'Enter Room'),
      ] : []),
      ...(current.cleared && floor.bossRoomId === current.id && !floor.cleared ? [
        el('button', {
          className: 'btn btn-gold',
          style: { marginTop: '12px', width: '100%' },
          onclick: () => {
            const nextFloor = state.floors.find(f => f.id === floor.id + 1);
            if (nextFloor) {
              floor.cleared = true;
              moveToFloor(nextFloor.id);
              setScene('map');
            } else {
              // Game won!
              setScene('victory');
            }
          },
        }, icon('game-icons:stairs', 'icon-sm'), 'Descend to Next Floor'),
      ] : []),
    ),
    // Connections list
    el('div', { className: 'panel' },
      el('h3', { style: { marginBottom: '8px' } }, 'Exits'),
      ...current.connections.map(connId => {
        const conn = floor.rooms.find(r => r.id === connId);
        if (!conn) return el('span', {});
        return el('div', {
          style: { display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', cursor: conn.discovered ? 'pointer' : 'default', opacity: conn.discovered ? 1 : 0.4 },
          onclick: () => { if (conn.discovered) handleRoomClick(conn); },
        },
          icon(conn.discovered ? (ROOM_ICONS[conn.type] || 'game-icons:dungeon-gate') : 'game-icons:locked-chest', 'icon-sm'),
          el('span', { style: { fontSize: '12px' } }, conn.discovered ? conn.name : '???'),
          conn.cleared ? el('span', { style: { fontSize: '10px', color: 'var(--accent-heal)' } }, 'CLEAR') : el('span', {}),
        );
      }),
    ),
  );

  scene.appendChild(sidebar);
  container.appendChild(scene);
});

function handleRoomClick(room: Room): void {
  const current = getCurrentRoom();
  const isAdj = isAdjacent(room, current);
  const isCurrent = room.id === current.id;

  if (!isAdj && !isCurrent) return;

  if (!isCurrent) {
    moveToRoom(room.id);
  }

  // Enter room based on type
  if (room.type === 'combat' || room.type === 'elite' || room.type === 'boss' || room.type === 'training') {
    if (!room.cleared && room.enemies && room.enemies.length > 0) {
      setScene('combat');
    } else {
      setScene('map');
    }
  } else if (room.type === 'forge') {
    setScene('forge');
  } else if (room.type === 'rest') {
    setScene('rest');
  } else if (room.type === 'event' && room.npc && !room.cleared) {
    setScene('dialogue');
  } else if (room.type === 'merchant') {
    setScene('merchant');
  } else {
    setScene('map');
  }
}
