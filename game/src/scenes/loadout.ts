// ============================================================
// Loadout Scene — Spell/Skill Slot Management (R-v5.07)
// ============================================================

import { registerScene, renderScene, icon, elementColor } from '../renderer';
import { getState, saveGame } from '../state';
import { emit } from '../events';

registerScene('loadout', () => {
  const app = document.getElementById('app')!;
  const s = getState();

  // Spell loadout
  const spellSlotsHtml = s.player.spellLoadout.map((slotId, idx) => {
    const spell = slotId ? s.player.spells.find(sp => sp.id === slotId) : null;
    return `
      <div class="loadout-slot" data-slot-type="spell" data-slot-idx="${idx}">
        <div class="slot-number">Slot ${idx + 1}</div>
        ${spell ? `
          <div class="slot-content" style="border-color:${elementColor(spell.elements[0])}">
            ${icon(spell.icon, 24)} ${spell.name}
            <span class="slot-cost">${spell.manaCost} MP</span>
            <button class="btn btn-small btn-danger" data-clear-spell="${idx}">&times;</button>
          </div>
        ` : '<div class="slot-empty">Empty — click a spell below to assign</div>'}
      </div>
    `;
  }).join('');

  // Available spells
  const availableSpellsHtml = s.player.spells.map(sp => {
    const isEquipped = s.player.spellLoadout.includes(sp.id);
    return `
      <div class="loadout-option ${isEquipped ? 'equipped' : ''}" data-assign-spell="${sp.id}">
        <span style="color:${elementColor(sp.elements[0])}">${icon(sp.icon, 20)}</span>
        ${sp.name} <span class="option-tier">T${sp.tier}</span> <span class="option-cost">${sp.manaCost} MP</span>
        ${sp.elements.map(el => `<span class="el-badge" style="background:${elementColor(el)}">${el}</span>`).join('')}
      </div>
    `;
  }).join('');

  // Skill loadout
  const skillSlotsHtml = s.player.skillLoadout.map((slotId, idx) => {
    const skill = slotId ? s.player.physicalSkills.find(sk => sk.id === slotId) : null;
    return `
      <div class="loadout-slot" data-slot-type="skill" data-slot-idx="${idx}">
        <div class="slot-number">Slot ${idx + 1}</div>
        ${skill ? `
          <div class="slot-content">
            ${icon(skill.icon, 24)} ${skill.name}
            <span class="slot-cost">${skill.staminaCost} SP</span>
            <button class="btn btn-small btn-danger" data-clear-skill="${idx}">&times;</button>
          </div>
        ` : '<div class="slot-empty">Empty</div>'}
      </div>
    `;
  }).join('');

  // Available skills
  const availableSkillsHtml = s.player.physicalSkills.filter(sk => sk.unlocked).map(sk => {
    const isEquipped = s.player.skillLoadout.includes(sk.id);
    return `
      <div class="loadout-option ${isEquipped ? 'equipped' : ''}" data-assign-skill="${sk.id}">
        ${icon(sk.icon, 20)} ${sk.name} <span class="option-cost">${sk.staminaCost} SP</span>
      </div>
    `;
  }).join('');

  // Action policies
  const policiesHtml = s.player.actionPolicies.map(p => `
    <div class="policy-row">
      <label class="policy-check">
        <input type="checkbox" data-pol-id="${p.id}" ${p.enabled ? 'checked' : ''}>
        <span class="policy-pri">P${p.priority}</span>
        <span class="policy-cond">${p.condition}</span> → <span class="policy-act">${p.action}</span>
      </label>
    </div>
  `).join('');

  app.innerHTML = `
    <div class="scene loadout-scene">
      <div class="scene-header">
        <h2>${icon('game-icons:spell-book', 28)} Loadout Configuration</h2>
        <button class="btn btn-secondary" id="btn-back">${icon('game-icons:return-arrow', 16)} Back</button>
      </div>

      <div class="loadout-layout">
        <div class="loadout-section">
          <h3>Spell Loadout (4 slots)</h3>
          <div class="loadout-slots">${spellSlotsHtml}</div>
          <h4>Available Spells</h4>
          <div class="loadout-options">${availableSpellsHtml}</div>
        </div>

        <div class="loadout-section">
          <h3>Skill Loadout (3 slots)</h3>
          <div class="loadout-slots">${skillSlotsHtml}</div>
          <h4>Available Skills</h4>
          <div class="loadout-options">${availableSkillsHtml}</div>
        </div>

        <div class="loadout-section">
          <h3>Action Policies (Combat AI)</h3>
          <p class="policy-info">Configure how auto-combat resolves. Lower priority number = checked first.</p>
          ${policiesHtml}
        </div>
      </div>
    </div>
  `;

  // Track which slot is being assigned
  let activeSpellSlot = -1;
  let activeSkillSlot = -1;

  // Click spell slot to select it
  app.querySelectorAll('[data-slot-type="spell"]').forEach(el => {
    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-clear-spell]')) return;
      activeSpellSlot = parseInt((el as HTMLElement).dataset.slotIdx || '-1');
      activeSkillSlot = -1;
      // Highlight
      app.querySelectorAll('.loadout-slot').forEach(s => s.classList.remove('active'));
      el.classList.add('active');
    });
  });

  // Click skill slot to select it
  app.querySelectorAll('[data-slot-type="skill"]').forEach(el => {
    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-clear-skill]')) return;
      activeSkillSlot = parseInt((el as HTMLElement).dataset.slotIdx || '-1');
      activeSpellSlot = -1;
      app.querySelectorAll('.loadout-slot').forEach(s => s.classList.remove('active'));
      el.classList.add('active');
    });
  });

  // Assign spell to slot
  app.querySelectorAll('[data-assign-spell]').forEach(el => {
    el.addEventListener('click', () => {
      if (activeSpellSlot < 0) {
        // Find first empty slot
        activeSpellSlot = s.player.spellLoadout.indexOf(null);
        if (activeSpellSlot < 0) activeSpellSlot = 0;
      }
      const spellId = (el as HTMLElement).dataset.assignSpell!;
      // Remove from other slots if already equipped
      s.player.spellLoadout = s.player.spellLoadout.map(id => id === spellId ? null : id);
      s.player.spellLoadout[activeSpellSlot] = spellId;
      saveGame();
      emit('state-changed');
      renderScene('loadout');
    });
  });

  // Assign skill to slot
  app.querySelectorAll('[data-assign-skill]').forEach(el => {
    el.addEventListener('click', () => {
      if (activeSkillSlot < 0) {
        activeSkillSlot = s.player.skillLoadout.indexOf(null);
        if (activeSkillSlot < 0) activeSkillSlot = 0;
      }
      const skillId = (el as HTMLElement).dataset.assignSkill!;
      s.player.skillLoadout = s.player.skillLoadout.map(id => id === skillId ? null : id);
      s.player.skillLoadout[activeSkillSlot] = skillId;
      saveGame();
      emit('state-changed');
      renderScene('loadout');
    });
  });

  // Clear spell slot
  app.querySelectorAll('[data-clear-spell]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt((btn as HTMLElement).dataset.clearSpell || '0');
      s.player.spellLoadout[idx] = null;
      saveGame();
      renderScene('loadout');
    });
  });

  // Clear skill slot
  app.querySelectorAll('[data-clear-skill]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt((btn as HTMLElement).dataset.clearSkill || '0');
      s.player.skillLoadout[idx] = null;
      saveGame();
      renderScene('loadout');
    });
  });

  // Policy toggles
  app.querySelectorAll('[data-pol-id]').forEach(input => {
    input.addEventListener('change', () => {
      const polId = (input as HTMLInputElement).dataset.polId!;
      const policy = s.player.actionPolicies.find(p => p.id === polId);
      if (policy) policy.enabled = (input as HTMLInputElement).checked;
      saveGame();
    });
  });

  document.getElementById('btn-back')?.addEventListener('click', () => {
    s.currentScene = 'map'; renderScene('map');
  });
});
