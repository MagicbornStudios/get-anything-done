import { registerScene, el, icon } from '../renderer';
import { getState, equipItem, removeItem, healPlayer, showToast, setScene, saveGame } from '../state';
import { createHUD } from '../hud';
import type { Item } from '../types';

registerScene('inventory', (container) => {
  const state = getState();
  const p = state.player;
  let selectedItem: Item | null = null;

  container.appendChild(createHUD());

  const scene = el('div', { className: 'char-sheet' });

  function renderInventory() {
    scene.innerHTML = '';

    const main = el('div', { className: 'char-main' });

    main.appendChild(el('div', { className: 'panel-header' },
      el('h2', {}, icon('game-icons:knapsack', 'icon-lg'), ' Inventory'),
      el('button', { className: 'btn btn-sm', onclick: () => setScene('map') }, 'Back'),
    ));

    // Inventory grid (R-v5.05)
    const grid = el('div', { className: 'inventory-grid' });
    const totalSlots = 24;

    for (let i = 0; i < totalSlots; i++) {
      const item = p.inventory[i];
      const slot = el('div', {
        className: `inv-slot ${item ? 'filled' : ''}`,
        onclick: () => {
          if (item) {
            selectedItem = item;
            renderInventory();
          }
        },
        style: selectedItem?.id === item?.id ? { borderColor: 'var(--accent-gold)' } : {},
      });

      if (item) {
        slot.appendChild(icon(item.icon));
        if (item.quantity > 1) {
          slot.appendChild(el('span', { className: 'qty' }, `${item.quantity}`));
        }
      }
      grid.appendChild(slot);
    }
    main.appendChild(grid);

    // Item details
    if (selectedItem) {
      const detail = el('div', { className: 'panel', style: { marginTop: '12px' } });
      detail.appendChild(el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' } },
        icon(selectedItem.icon, 'icon-lg'),
        el('div', {},
          el('h3', {}, selectedItem.name),
          el('p', { style: { fontSize: '12px', color: 'var(--text-dim)' } }, selectedItem.description),
          el('p', { style: { fontSize: '11px', color: 'var(--text-dim)' } },
            `Category: ${selectedItem.category} | Value: ${selectedItem.value}g | Qty: ${selectedItem.quantity}`),
          selectedItem.statBonuses ? el('p', { style: { fontSize: '11px', color: 'var(--accent-heal)' } },
            Object.entries(selectedItem.statBonuses).map(([k, v]) => `+${v} ${k}`).join(', ')) : el('span', {}),
        ),
      ));

      const actions = el('div', { style: { display: 'flex', gap: '8px' } });

      if (selectedItem.equipSlot) {
        actions.appendChild(el('button', {
          className: 'btn btn-primary btn-sm',
          onclick: () => {
            equipItem(selectedItem!);
            selectedItem = null;
            showToast(`Equipped ${selectedItem?.name || 'item'}`, 'success');
            saveGame();
            renderInventory();
          },
        }, 'Equip'));
      }

      if (selectedItem.category === 'consumable') {
        actions.appendChild(el('button', {
          className: 'btn btn-sm',
          onclick: () => {
            useConsumable(selectedItem!);
            selectedItem = null;
            saveGame();
            renderInventory();
          },
        }, 'Use'));
      }

      actions.appendChild(el('button', {
        className: 'btn btn-sm btn-danger',
        onclick: () => {
          removeItem(selectedItem!.id);
          showToast(`Discarded ${selectedItem!.name}`, 'info');
          selectedItem = null;
          saveGame();
          renderInventory();
        },
      }, 'Discard'));

      detail.appendChild(actions);
      main.appendChild(detail);
    }

    scene.appendChild(main);

    // Equipment sidebar
    const sidebar = el('div', { className: 'char-sidebar' });
    sidebar.appendChild(el('h3', { style: { marginBottom: '8px' } }, 'Equipment'));

    const equipSlots = el('div', { className: 'equip-slots' });
    for (const [slotName, item] of Object.entries(p.equipment) as [string, any][]) {
      equipSlots.appendChild(el('div', { className: `equip-slot ${item ? 'filled' : ''}` },
        item ? icon(item.icon, 'icon-sm') : icon('game-icons:perspective-dice-five', 'icon-sm'),
        el('div', {},
          el('div', { className: 'slot-label' }, slotName),
          el('div', { style: { fontSize: '12px' } }, item ? item.name : 'Empty'),
        ),
      ));
    }
    sidebar.appendChild(equipSlots);

    // Gold
    sidebar.appendChild(el('div', { className: 'panel', style: { marginTop: '12px' } },
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
        icon('game-icons:two-coins', 'icon-lg'),
        el('span', { style: { fontSize: '18px', fontWeight: '600', color: 'var(--accent-gold)' } }, `${p.gold} Gold`),
      ),
    ));

    scene.appendChild(sidebar);
  }

  renderInventory();
  container.appendChild(scene);
});

function useConsumable(item: Item): void {
  switch (item.id) {
    case 'item-hp-potion':
      healPlayer(30, 0, 0);
      showToast('Restored 30 HP', 'success');
      break;
    case 'item-mana-potion':
      healPlayer(0, 20, 0);
      showToast('Restored 20 MP', 'success');
      break;
    case 'item-stamina-potion':
      healPlayer(0, 0, 20);
      showToast('Restored 20 SP', 'success');
      break;
    case 'item-antidote':
      showToast('Cured poison', 'success');
      break;
    default:
      showToast(`Used ${item.name}`, 'info');
  }
  removeItem(item.id);
}
