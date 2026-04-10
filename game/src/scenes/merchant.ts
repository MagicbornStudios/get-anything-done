// ============================================================
// Merchant Scene (R-v5.03)
// ============================================================

import { registerScene, renderScene, icon, elementColor } from '../renderer';
import { getState, getCurrentRoom, saveGame, addItem, removeItem } from '../state';
import { emit } from '../events';

registerScene('merchant', () => {
  const app = document.getElementById('app')!;
  const s = getState();
  const room = getCurrentRoom();
  const stock = room.merchantStock || [];
  const hasDiscount = s.player.questFlags['merchant_discount'] || false;
  const discountMult = hasDiscount ? 0.9 : 1.0;

  const stockHtml = stock.filter(item => item.quantity > 0).map(item => {
    const cost = Math.floor(item.value * discountMult);
    const canBuy = s.player.gold >= cost;
    return `
      <div class="merchant-item">
        <div class="item-icon">${icon(item.icon, 28)}</div>
        <div class="item-details">
          <div class="item-name">${item.name} ${item.element ? `<span style="color:${elementColor(item.element)}">(${item.element})</span>` : ''}</div>
          <div class="item-desc">${item.description}</div>
          <div class="item-stock">Stock: ${item.quantity}</div>
        </div>
        <div class="item-price">${icon('game-icons:coins', 14)} ${cost}g</div>
        <button class="btn btn-small ${canBuy ? 'btn-primary' : 'btn-disabled'}" data-buy-id="${item.id}" ${canBuy ? '' : 'disabled'}>Buy</button>
      </div>
    `;
  }).join('');

  const inventoryHtml = s.player.inventory.filter(i => i.quantity > 0).map(item => {
    const sellPrice = Math.floor(item.value * 0.5);
    return `
      <div class="merchant-item">
        <div class="item-icon">${icon(item.icon, 28)}</div>
        <div class="item-details">
          <div class="item-name">${item.name}</div>
          <div class="item-qty">x${item.quantity}</div>
        </div>
        <div class="item-price">${icon('game-icons:coins', 14)} ${sellPrice}g</div>
        <button class="btn btn-small btn-secondary" data-sell-id="${item.id}">Sell</button>
      </div>
    `;
  }).join('');

  app.innerHTML = `
    <div class="scene merchant-scene">
      <div class="scene-header">
        <h2>${icon('game-icons:trade', 28)} ${room.name}</h2>
        <div class="merchant-gold">${icon('game-icons:coins', 20)} ${s.player.gold}g ${hasDiscount ? '<span class="discount-badge">10% discount!</span>' : ''}</div>
        <button class="btn btn-secondary" id="btn-back-map">${icon('game-icons:return-arrow', 16)} Leave</button>
      </div>

      <div class="merchant-layout">
        <div class="merchant-section">
          <h3>For Sale</h3>
          <div class="merchant-list">${stockHtml || '<p>No items available.</p>'}</div>
        </div>
        <div class="merchant-section">
          <h3>Your Items (Sell)</h3>
          <div class="merchant-list">${inventoryHtml || '<p>Nothing to sell.</p>'}</div>
        </div>
      </div>
    </div>
  `;

  // Buy
  app.querySelectorAll('[data-buy-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = (btn as HTMLElement).dataset.buyId!;
      const stockItem = stock.find(i => i.id === itemId);
      if (!stockItem || stockItem.quantity <= 0) return;
      const cost = Math.floor(stockItem.value * discountMult);
      if (s.player.gold < cost) return;
      s.player.gold -= cost;
      stockItem.quantity--;
      addItem({ ...stockItem, quantity: 1 });
      emit('toast', `Bought ${stockItem.name} for ${cost}g`, 'success');
      saveGame();
      renderScene('merchant');
    });
  });

  // Sell
  app.querySelectorAll('[data-sell-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = (btn as HTMLElement).dataset.sellId!;
      const item = s.player.inventory.find(i => i.id === itemId);
      if (!item || item.quantity <= 0) return;
      const sellPrice = Math.floor(item.value * 0.5);
      removeItem(itemId, 1);
      s.player.gold += sellPrice;
      emit('toast', `Sold ${item.name} for ${sellPrice}g`, 'success');
      saveGame();
      renderScene('merchant');
    });
  });

  // Leave
  document.getElementById('btn-back-map')?.addEventListener('click', () => {
    room.cleared = true;
    s.currentScene = 'map'; saveGame(); renderScene('map');
  });
});
