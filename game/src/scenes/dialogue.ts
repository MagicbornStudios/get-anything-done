import { registerScene, el, icon } from '../renderer';
import { getState, getCurrentRoom, shiftTrait, addGold, addItem, discoverRune, showToast, setScene, saveGame } from '../state';
import { createHUD } from '../hud';
import { ALL_ITEMS } from '../data';
import type { NPC, DialogueNode, DialogueChoice, DialogueEffect } from '../types';

registerScene('dialogue', (container) => {
  const state = getState();
  const room = getCurrentRoom();
  const npc = room.npc;
  if (!npc) { setScene('map'); return; }

  let currentNodeId = npc.dialogue[0]?.id;

  container.appendChild(createHUD());

  const scene = el('div', { className: 'dialogue-scene' });

  function renderDialogue() {
    scene.innerHTML = '';

    const node = npc!.dialogue.find(d => d.id === currentNodeId);
    if (!node) {
      // End dialogue
      room.cleared = true;
      saveGame();
      setScene('map');
      return;
    }

    const area = el('div', { className: 'dialogue-npc-area' });

    // NPC portrait
    area.appendChild(el('div', { className: 'dialogue-portrait' },
      icon(npc!.portrait, 'icon-xl'),
    ));

    // Text area
    const textArea = el('div', { className: 'dialogue-text-area' });
    textArea.appendChild(el('div', { className: 'dialogue-name' }, npc!.name));

    // Show NPC traits
    textArea.appendChild(el('div', { style: { fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px', display: 'flex', gap: '8px' } },
      ...Object.entries(npc!.traits).filter(([_, v]) => (v as number) > 0.3).map(([k, v]) =>
        el('span', { className: 'elem-arcane' }, `${k}: ${(v as number).toFixed(1)}`)
      ),
    ));

    textArea.appendChild(el('p', { className: 'dialogue-text' }, node.text));

    // Choices
    const choices = el('div', { className: 'dialogue-choices' });
    for (const choice of node.choices) {
      // Check trait requirement
      const meetsReq = !choice.traitRequirement ||
        state.player.traits[choice.traitRequirement.trait] >= choice.traitRequirement.minValue;

      const choiceBtn = el('div', {
        className: 'dialogue-choice',
        style: { opacity: meetsReq ? '1' : '0.4', cursor: meetsReq ? 'pointer' : 'not-allowed' },
        onclick: () => {
          if (!meetsReq) {
            showToast(`Requires ${choice.traitRequirement!.trait} >= ${choice.traitRequirement!.minValue}`, 'danger');
            return;
          }
          applyEffects(choice.effects);
          if (choice.nextNodeId) {
            currentNodeId = choice.nextNodeId;
            renderDialogue();
          } else {
            room.cleared = true;
            saveGame();
            setScene('map');
          }
        },
      },
        el('span', {}, choice.text),
        choice.traitRequirement ? el('div', { className: 'dialogue-trait-req' },
          `Requires ${choice.traitRequirement.trait} >= ${choice.traitRequirement.minValue}`) : el('span', {}),
      );
      choices.appendChild(choiceBtn);
    }
    textArea.appendChild(choices);
    area.appendChild(textArea);
    scene.appendChild(area);
  }

  function applyEffects(effects: DialogueEffect[]) {
    for (const eff of effects) {
      switch (eff.type) {
        case 'trait':
          if (eff.traitKey && eff.value) shiftTrait(eff.traitKey, eff.value, 'dialogue');
          break;
        case 'gold':
          if (eff.value) addGold(eff.value);
          if (eff.value! > 0) showToast(`+${eff.value} gold`, 'loot');
          else if (eff.value! < 0) showToast(`${eff.value} gold`, 'danger');
          break;
        case 'item':
          if (eff.id) {
            const itemDef = ALL_ITEMS.find(i => i.id === eff.id);
            if (itemDef) {
              addItem({ ...itemDef, quantity: 1 });
              showToast(`Received: ${itemDef.name}`, 'loot');
            }
          }
          break;
        case 'rune':
          if (eff.id) discoverRune(eff.id);
          break;
        case 'quest_flag':
          if (eff.id) {
            state.player.questFlags[eff.id] = true;
            showToast(`Quest updated`, 'info');
          }
          break;
        case 'merchant_discount':
          state.player.questFlags['merchant_discount'] = true;
          showToast('Merchant discount unlocked!', 'success');
          break;
      }
    }
  }

  renderDialogue();
  container.appendChild(scene);
});
