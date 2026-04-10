// ============================================================
// Character Sheet Scene (R-v5.06)
// ============================================================

import { registerScene, renderScene, icon, bar, elementColor } from '../renderer';
import { getState, getEffectiveStats, saveGame } from '../state';

registerScene('character', () => {
  const app = document.getElementById('app')!;
  const s = getState();
  const stats = getEffectiveStats();

  // Traits display
  const traitsHtml = Object.entries(s.player.traits).map(([key, val]) => `
    <div class="trait-row">
      <span class="trait-name">${key}</span>
      <div class="trait-bar-container">
        ${bar(Math.round(val * 100), 100, val > 0.6 ? '#ff9800' : val > 0.3 ? '#4caf50' : '#9e9e9e', `${(val as number).toFixed(2)}`, 14)}
      </div>
    </div>
  `).join('');

  // Affinities
  const affinityHtml = s.player.runes.filter(r => r.discovered).map(r => `
    <div class="affinity-row">
      <span class="affinity-icon" style="color:${elementColor(r.element)}">${icon(r.icon, 20)} ${r.name}</span>
      ${bar(r.affinityLevel, 100, elementColor(r.element), `${r.affinityLevel}/100`, 14)}
      <div class="affinity-milestones">
        ${r.affinityMilestones.map(m => `<span class="ms ${m.claimed ? 'ms-claimed' : r.affinityLevel >= m.level ? 'ms-reached' : 'ms-locked'}">${m.level}: ${m.reward}</span>`).join('')}
      </div>
    </div>
  `).join('');

  // Skills tree
  const skillsHtml = s.player.physicalSkills.map(sk => `
    <div class="skill-node ${sk.unlocked ? 'unlocked' : 'locked'}">
      <div class="skill-icon">${icon(sk.icon, 24)}</div>
      <div class="skill-info">
        <div class="skill-name">${sk.name} <span class="skill-tier">T${sk.tier}</span></div>
        <div class="skill-cost">${sk.staminaCost} SP | ${sk.damage} dmg</div>
        ${!sk.unlocked ? `<div class="skill-prereq">Requires: ${sk.prerequisites.map(p => s.player.physicalSkills.find(ps => ps.id === p)?.name || p).join(', ') || `Level ${sk.tier}`}</div>` : ''}
      </div>
    </div>
  `).join('');

  // Equipment
  const equipSlots = ['main-hand', 'off-hand', 'body', 'trinket'] as const;
  const equipHtml = equipSlots.map(slot => {
    const item = s.player.equipment[slot];
    return `
      <div class="equip-slot">
        <span class="slot-name">${slot}</span>
        ${item ? `
          <span class="equipped-item">${icon(item.icon, 20)} ${item.name}</span>
        ` : '<span class="empty-slot">Empty</span>'}
      </div>
    `;
  }).join('');

  // Known spells
  const spellsHtml = s.player.spells.map(sp => `
    <div class="spell-card" style="border-color:${elementColor(sp.elements[0])}">
      <div class="spell-icon" style="color:${elementColor(sp.elements[0])}">${icon(sp.icon, 24)}</div>
      <div class="spell-name">${sp.name}</div>
      <div class="spell-cost">${sp.manaCost} MP | Pwr ${sp.power}</div>
      <div class="spell-tier">T${sp.tier}</div>
    </div>
  `).join('');

  app.innerHTML = `
    <div class="scene character-scene">
      <div class="scene-header">
        <h2>${icon('game-icons:character-sheet', 28)} Character Sheet</h2>
        <button class="btn btn-secondary" id="btn-back">${icon('game-icons:return-arrow', 16)} Back</button>
      </div>

      <div class="character-layout">
        <div class="char-section">
          <h3>${icon('game-icons:person', 20)} ${s.player.name} — Level ${stats.level}</h3>
          <div class="stat-grid">
            <div class="stat">${icon('game-icons:hearts', 16)} HP: ${s.player.stats.hp}/${stats.maxHp}</div>
            <div class="stat">${icon('game-icons:spell-book', 16)} MP: ${s.player.stats.mana}/${stats.maxMana}</div>
            <div class="stat">${icon('game-icons:running-shoe', 16)} SP: ${s.player.stats.stamina}/${stats.maxStamina}</div>
            <div class="stat">${icon('game-icons:broadsword', 16)} ATK: ${stats.attack}</div>
            <div class="stat">${icon('game-icons:shield', 16)} DEF: ${stats.defense}</div>
            <div class="stat">${icon('game-icons:sprint', 16)} SPD: ${stats.speed}</div>
          </div>
        </div>

        <div class="char-section">
          <h3>${icon('game-icons:brain', 20)} Traits</h3>
          ${traitsHtml}
        </div>

        <div class="char-section">
          <h3>${icon('game-icons:fire-ring', 20)} Affinities</h3>
          ${affinityHtml}
        </div>

        <div class="char-section">
          <h3>${icon('game-icons:sword-clash', 20)} Physical Skills</h3>
          <div class="skill-tree">${skillsHtml}</div>
        </div>

        <div class="char-section">
          <h3>${icon('game-icons:gem-pendant', 20)} Equipment</h3>
          ${equipHtml}
        </div>

        <div class="char-section">
          <h3>${icon('game-icons:spell-book', 20)} Known Spells</h3>
          <div class="spell-grid">${spellsHtml}</div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-back')?.addEventListener('click', () => {
    s.currentScene = 'map'; renderScene('map');
  });
});
