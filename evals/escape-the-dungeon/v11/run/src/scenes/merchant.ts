import { registerScene, el, icon } from '../renderer';
import { getState, getCurrentRoom, addItem, removeItem, addGold, showToast, setScene, saveGame, discoverRune } from '../state';
import { createHUD } from '../hud';
import type { Item } from '../types';

registerScene('merchant', (container) => {
  const state = getState();
  const room = getCurrentRoom();
  const stock = room.merchantStock || [];

  container.appendChild(createHUD());

  const scene = el('div', { className: 'merchant-scene' });

  let tab: 'buy' | 'sell' | 'trade' = 'buy';

  function renderMerchant() {
    scene.innerHTML = '';

    const main = el('div', { className: 'merchant-stock' });

    // Header
    main.appendChild(el('div', { className: 'panel-header' },
      el('h2', {}, icon('game-icons:shop', 'icon-lg'), ' Underground Market'),
      el('div', { style: { display: 'flex', gap: '4px' } },
        el('span', { className: 'hud-stat' }, icon('game-icons:two-coins', 'icon-sm'), el('span', { className: 'value' }, `${state.player.gold} gold`)),
        el('button', { className: 'btn btn-sm', onclick: () => setScene('map') }, 'Leave'),
      ),
    ));

    // Tabs
    const tabs = el('div', { className: 'tabs' });
    for (const t of ['buy', 'sell', 'trade'] as const) {
      tabs.appendChild(el('div', {
        className: `tab ${tab === t ? 'active' : ''}`,
        onclick: () => { tab = t; renderMerchant(); },
      }, t.charAt(0).toUpperCase() + t.slice(1)));
    }
    main.appendChild(tabs);

    if (tab === 'buy') {
      if (stock.length === 0) {
        main.appendChild(el('p', { style: { color: 'var(--text-dim)' } }, 'Nothing left to buy.'));
      }
      for (const item of stock) {
        if (item.quantity <= 0) continue;
        const discount = state.player.questFlags['merchant_discount'] ? 0.8 : 1;
        const cost = Math.floor(item.value * discount);
        const canAfford = state.player.gold >= cost;

        main.appendChild(el('div', { className: 'merchant-item' },
          icon(item.icon),
          el('div', { className: 'merchant-item-info' },
            el('div', { className: 'merchant-item-name' }, item.name),
            el('div', { className: 'merchant-item-desc' }, item.description || ''),
            el('div', { style: { fontSize: '10px', color: 'var(--text-dim)' } }, `Qty: ${item.quantity}`),
          ),
          el('div', { className: 'merchant-price' }, icon('game-icons:two-coins', 'icon-sm'), `${cost}`),
          el('button', {
            className: 'btn btn-sm btn-gold',
            disabled: !canAfford || item.quantity <= 0,
            onclick: () => {
              if (!canAfford) return;
              addGold(-cost);
              item.quantity--;
              // Check if it's a rune
              if (item.id?.startsWith('rune-')) {
                discoverRune(item.id);
              } else {
                addItem({ ...item, quantity: 1, value: item.value });
              }
              showToast(`Bought ${item.name}`, 'loot');
              saveGame();
              renderMerchant();
            },
          }, 'Buy'),
        ));
      }
    } else if (tab === 'sell') {
      const sellable = state.player.inventory.filter(i => i.value > 0);
      if (sellable.length === 0) {
        main.appendChild(el('p', { style: { color: 'var(--text-dim)' } }, 'Nothing to sell.'));
      }
      for (const item of sellable) {
        const sellPrice = Math.floor(item.value * 0.5);
        main.appendChild(el('div', { className: 'merchant-item' },
          icon(item.icon),
          el('div', { className: 'merchant-item-info' },
            el('div', { className: 'merchant-item-name' }, item.name),
            el('div', { className: 'merchant-item-desc' }, `Qty: ${item.quantity}`),
          ),
          el('div', { className: 'merchant-price' }, icon('game-icons:two-coins', 'icon-sm'), `${sellPrice}`),
          el('button', {
            className: 'btn btn-sm',
            onclick: () => {
              removeItem(item.id);
              addGold(sellPrice);
              showToast(`Sold ${item.name} for ${sellPrice} gold`, 'success');
              saveGame();
              renderMerchant();
            },
          }, 'Sell'),
        ));
      }
    } else if (tab === 'trade') {
      const playerItems = state.player.inventory.filter(i => i.value > 0);
      const merchantItems = stock.filter(i => i.quantity > 0);

      main.appendChild(el('p', { style: { fontSize: '12px', color: 'var(--text-dim)', marginBottom: '8px' } },
        'Trade your items for merchant stock. Items of similar value can be traded directly.'));

      if (playerItems.length === 0 || merchantItems.length === 0) {
        main.appendChild(el('p', { style: { color: 'var(--text-dim)' } }, 'No trade options available.'));
      } else {
        for (const yours of playerItems) {
          for (const theirs of merchantItems) {
            const ratio = theirs.value / Math.max(1, yours.value);
            if (ratio > 0.5 && ratio < 2) {
              main.appendChild(el('div', { className: 'merchant-item' },
                el('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } },
                  icon(yours.icon, 'icon-sm'),
                  el('span', { style: { fontSize: '12px' } }, yours.name),
                ),
                el('span', { style: { color: 'var(--accent-gold)', margin: '0 8px' } }, '→'),
                el('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } },
                  icon(theirs.icon, 'icon-sm'),
                  el('span', { style: { fontSize: '12px' } }, theirs.name),
                ),
                el('button', {
                  className: 'btn btn-sm btn-gold',
                  onclick: () => {
                    removeItem(yours.id);
                    theirs.quantity--;
                    if (theirs.id?.startsWith('rune-')) {
                      discoverRune(theirs.id);
                    } else {
                      addItem({ ...theirs, quantity: 1 });
                    }
                    showToast(`Traded ${yours.name} for ${theirs.name}`, 'success');
                    saveGame();
                    renderMerchant();
                  },
                }, 'Trade'),
              ));
            }
          }
        }
      }
    }

    scene.appendChild(main);
  }

  renderMerchant();
  container.appendChild(scene);
});
