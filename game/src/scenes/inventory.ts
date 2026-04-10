// ============================================================
// Inventory Scene (R-v5.05)
// ============================================================

import { registerScene, renderScene, icon, elementColor } from '../renderer';
import { getState, saveGame, removeItem } from '../state';
import { emit } from '../events';
import type { Item, EquipSlot } from '../types';

registerScene('inventory', () => {
  const app = document.getElementById('app')!;
  const s = getState();

  const equipSlots: EquipSlot[] = ['main-hand', 'off-hand', 'body', 'trinket'];

  // Equipment display
  const equipHtml = equipSlots.map(slot => {
    const item = s.player.equipment[slot];
    return `
      <div class="equip-slot-panel" data-slot="${slot}">
        <div class="slot-label">${slot}</div>
        ${item ? `
          <div class="equipped-item-card">
            ${icon(item.icon, 24)} ${item.name}
            <button class="btn btn-small btn-danger" data-unequip="${slot}">Unequip</button>
          </div>
        ` : '<div class="empty-slot-msg">Empty</div>'}
      </div>
    `;
  }).join('');

  // Inventory grid
  const invHtml = s.player.inventory.filter(i => i.quantity > 0).map(item => {
    const canEquip = item.category === 'equipment' && item.equipSlot;
    const canUse = item.category === 'consumable';
    return `
      <div class="inv-item" data-item-id="${item.id}">
        <div class="inv-icon">${icon(item.icon, 28)}</div>
        <div class="inv-details">
          <div class="inv-name">${item.name} ${item.element ? `<span style="color:${elementColor(item.element)}">(${item.element})</span>` : ''}</div>
          <div class="inv-desc">${item.description}</div>
          <div class="inv-qty">x${item.quantity}</div>
        </div>
        <div class="inv-actions">
          ${canEquip ? `<button class="btn btn-small btn-primary" data-equip-id="${item.id}">Equip</button>` : ''}
          ${canUse ? `<button class="btn btn-small btn-primary" data-use-id="${item.id}">Use</button>` : ''}
        </div>
      </div>
    `;
  }).join('');

  app.innerHTML = `
    <div class="scene inventory-scene">
      <div class="scene-header">
        <h2>${icon('game-icons:knapsack', 28)} Inventory</h2>
        <button class="btn btn-secondary" id="btn-back">${icon('game-icons:return-arrow', 16)} Back</button>
      </div>

      <div class="inventory-layout">
        <div class="equipment-panel">
          <h3>Equipment</h3>
          ${equipHtml}
        </div>
        <div class="inventory-grid-panel">
          <h3>Bag</h3>
          <div class="inventory-grid">${invHtml || '<p>Your bag is empty.</p>'}</div>
        </div>
      </div>
    </div>
  `;

  // Equip
  app.querySelectorAll('[data-equip-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = (btn as HTMLElement).dataset.equipId!;
      const item = s.player.inventory.find(i => i.id === itemId);
      if (!item || !item.equipSlot) return;

      // Unequip current
      const current = s.player.equipment[item.equipSlot];
      if (current) {
        s.player.inventory.push({ ...current, quantity: 1 });
      }

      // Equip new
      s.player.equipment[item.equipSlot] = { ...item, quantity: 1 };
      removeItem(itemId, 1);
      emit('toast', `Equipped ${item.name}`, 'success');
      emit('state-changed');
      saveGame();
      renderScene('inventory');
    });
  });

  // Unequip
  app.querySelectorAll('[data-unequip]').forEach(btn => {
    btn.addEventListener('click', () => {
      const slot = (btn as HTMLElement).dataset.unequip as EquipSlot;
      const item = s.player.equipment[slot];
      if (!item) return;
      s.player.inventory.push({ ...item, quantity: 1 });
      s.player.equipment[slot] = null;
      emit('toast', `Unequipped ${item.name}`, 'info');
      emit('state-changed');
      saveGame();
      renderScene('inventory');
    });
  });

  // Use consumable
  app.querySelectorAll('[data-use-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = (btn as HTMLElement).dataset.useId!;
      const item = s.player.inventory.find(i => i.id === itemId);
      if (!item || item.quantity <= 0) return;

      // Apply consumable effects
      switch (itemId) {
        case 'item-health-potion':
          s.player.stats.hp = Math.min(s.player.stats.maxHp, s.player.stats.hp + 30);
          emit('toast', 'Restored 30 HP', 'success');
          break;
        case 'item-mana-potion':
          s.player.stats.mana = Math.min(s.player.stats.maxMana, s.player.stats.mana + 20);
          emit('toast', 'Restored 20 MP', 'success');
          break;
        case 'item-stamina-tonic':
          s.player.stats.stamina = Math.min(s.player.stats.maxStamina, s.player.stats.stamina + 15);
          emit('toast', 'Restored 15 SP', 'success');
          break;
      }
      removeItem(itemId, 1);
      emit('state-changed');
      saveGame();
      renderScene('inventory');
    });
  });

  document.getElementById('btn-back')?.addEventListener('click', () => {
    s.currentScene = 'map'; renderScene('map');
  });
});
