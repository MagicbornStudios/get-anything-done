// ============================================================
// Dialogue / Event Scene (R-v5.04, R-v5.14)
// ============================================================

import { registerScene, renderScene, icon, elementColor } from '../renderer';
import { getState, getCurrentRoom, saveGame, shiftTrait, discoverRune, addItem } from '../state';
import { emit } from '../events';
import type { DialogueNode, DialogueChoice, NPC } from '../types';
import { ALL_ITEMS } from '../data';

let currentNodeId: string | null = null;

function applyEffects(effects: DialogueChoice['effects']): void {
  const s = getState();
  for (const eff of effects) {
    switch (eff.type) {
      case 'rune':
        if (eff.id) discoverRune(eff.id);
        break;
      case 'item': {
        const template = ALL_ITEMS.find(i => i.id === eff.id);
        if (template) addItem({ ...template, quantity: 1 });
        break;
      }
      case 'gold':
        s.player.gold += (eff.value || 0);
        if (eff.value) emit('toast', `${eff.value > 0 ? '+' : ''}${eff.value} gold`, eff.value > 0 ? 'success' : 'warning');
        break;
      case 'trait':
        if (eff.traitKey && eff.value) shiftTrait(eff.traitKey, eff.value);
        break;
      case 'quest_flag':
        if (eff.id) s.player.questFlags[eff.id] = true;
        break;
      case 'merchant_discount':
        s.player.questFlags['merchant_discount'] = true;
        emit('toast', 'Merchant discount unlocked!', 'success');
        break;
      case 'spawn_enemy':
        emit('toast', 'An enemy appears!', 'danger');
        // Could trigger combat but for simplicity, just a narrative beat
        break;
    }
  }
  emit('state-changed');
}

registerScene('dialogue', () => {
  const app = document.getElementById('app')!;
  const s = getState();
  const room = getCurrentRoom();
  const npc = room.npc;

  if (!npc || !npc.dialogue || npc.dialogue.length === 0) {
    // No NPC, show event text and return
    room.cleared = true;
    app.innerHTML = `
      <div class="scene dialogue-scene">
        <div class="scene-header">
          <h2>${icon(room.icon, 28)} ${room.name}</h2>
        </div>
        <div class="dialogue-text">
          <p>${room.description}</p>
        </div>
        <button class="btn btn-primary" id="btn-back">${icon('game-icons:return-arrow', 16)} Return to Map</button>
      </div>
    `;
    document.getElementById('btn-back')?.addEventListener('click', () => {
      s.currentScene = 'map'; saveGame(); renderScene('map');
    });
    return;
  }

  // Get current dialogue node
  if (!currentNodeId) currentNodeId = npc.dialogue[0].id;
  const node = npc.dialogue.find(n => n.id === currentNodeId);

  if (!node) {
    // Dialogue ended
    room.cleared = true;
    currentNodeId = null;
    s.currentScene = 'map';
    saveGame();
    renderScene('map');
    return;
  }

  // Filter choices by trait requirements
  const availableChoices = node.choices.filter(c => {
    if (!c.traitRequirement) return true;
    return (s.player.traits[c.traitRequirement.trait] ?? 0) >= c.traitRequirement.minValue;
  });

  app.innerHTML = `
    <div class="scene dialogue-scene">
      <div class="scene-header">
        <h2>${icon(room.icon, 28)} ${room.name}</h2>
      </div>

      <div class="dialogue-panel">
        <div class="npc-portrait">
          ${icon(npc.portrait || npc.icon, 64)}
          <div class="npc-name">${npc.name}</div>
          <div class="npc-traits">
            ${Object.entries(npc.traits).filter(([_, v]) => v > 0.4).map(([k, v]) => `<span class="trait-badge">${k}: ${(v as number).toFixed(1)}</span>`).join('')}
          </div>
        </div>

        <div class="dialogue-content">
          <div class="dialogue-speaker">${node.speaker || npc.name}</div>
          <div class="dialogue-text">${node.text}</div>

          <div class="dialogue-choices">
            ${availableChoices.map((c, i) => `
              <button class="btn btn-dialogue" data-choice-idx="${i}">
                ${c.traitRequirement ? `<span class="trait-req">[${c.traitRequirement.trait} >= ${c.traitRequirement.minValue}]</span>` : ''}
                ${c.text}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  // Bind choices
  app.querySelectorAll('.btn-dialogue').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt((btn as HTMLElement).dataset.choiceIdx || '0');
      const choice = availableChoices[idx];
      if (choice) {
        applyEffects(choice.effects);
        if (choice.nextNodeId) {
          currentNodeId = choice.nextNodeId;
          renderScene('dialogue');
        } else {
          // End dialogue
          room.cleared = true;
          currentNodeId = null;
          s.currentScene = 'map';
          saveGame();
          renderScene('map');
        }
      }
    });
  });
});
