// ============================================================
// Auto-Resolve Combat Scene (R-v5.13, R-v5.14, R-v5.18)
// UO-style: configure loadout → combat auto-plays → pause to adjust
// ============================================================

import { registerScene, renderScene, icon, bar, elementColor } from '../renderer';
import { getState, getCurrentRoom, getEquippedSpells, getEquippedSkills, getEffectiveStats, saveGame, gainXP, gainAffinityFromCasting, shiftTrait, addItem, discoverRune } from '../state';
import { emit } from '../events';
import type { Enemy, Spell, PhysicalSkill, CombatLogEntry, SpellEffect, ActionPolicy } from '../types';
import { ALL_ITEMS } from '../data';

interface CombatState {
  enemies: (Enemy & { currentHp: number; stunned: number; debuffs: { stat: string; value: number; turns: number }[]; dots: { element: string; damage: number; turns: number }[] })[];
  playerDebuffs: { stat: string; value: number; turns: number }[];
  playerDots: { element: string; damage: number; turns: number }[];
  playerBuffs: { stat: string; value: number; turns: number }[];
  log: CombatLogEntry[];
  turn: number;
  running: boolean;
  paused: boolean;
  victory: boolean;
  defeat: boolean;
  interval: ReturnType<typeof setTimeout> | null;
}

let combat: CombatState | null = null;

function addLog(text: string, type: CombatLogEntry['type'] = 'info'): void {
  if (!combat) return;
  combat.log.push({ text, type, timestamp: Date.now() });
}

function getPlayerDamageMultiplier(element: string | undefined, enemy: Enemy['resistances'] & Enemy['weaknesses'], isResistance: boolean): number {
  if (!element) return 1;
  const map = isResistance ? enemy : enemy;
  return (map as any)[element] ?? 1;
}

function applySpellDamage(spell: Spell, enemy: CombatState['enemies'][0]): number {
  const s = getState();
  let totalDamage = 0;

  for (const effect of spell.effects) {
    const resMult = (enemy.resistances as any)[effect.element || ''] ?? 1;
    const weakMult = (enemy.weaknesses as any)[effect.element || ''] ?? 1;
    const affinityBonus = getAffinityBonus(spell, s);

    switch (effect.type) {
      case 'damage': {
        const dmg = Math.max(1, Math.floor(effect.value * weakMult * (1 / Math.max(0.1, resMult)) * affinityBonus));
        enemy.currentHp -= dmg;
        totalDamage += dmg;
        addLog(`${spell.name} deals ${dmg} ${effect.element || ''} damage to ${enemy.name}`, 'damage');
        break;
      }
      case 'dot': {
        enemy.dots.push({ element: effect.element || '', damage: Math.floor(effect.value * affinityBonus), turns: effect.duration || 3 });
        addLog(`${enemy.name} is afflicted with ${effect.description}`, 'status');
        break;
      }
      case 'heal': {
        const heal = Math.floor(effect.value * affinityBonus);
        s.player.stats.hp = Math.min(s.player.stats.maxHp, s.player.stats.hp + heal);
        addLog(`${spell.name} heals you for ${heal} HP`, 'heal');
        break;
      }
      case 'debuff': {
        enemy.debuffs.push({ stat: 'defense', value: effect.value, turns: effect.duration || 2 });
        addLog(`${enemy.name}: ${effect.description}`, 'status');
        break;
      }
      case 'buff': {
        combat!.playerBuffs.push({ stat: 'defense', value: effect.value, turns: effect.duration || 2 });
        addLog(`You gain: ${effect.description}`, 'status');
        break;
      }
      case 'status': {
        if (effect.description.toLowerCase().includes('stun') || effect.description.toLowerCase().includes('root')) {
          enemy.stunned += (effect.duration || 1);
          addLog(`${enemy.name} is ${effect.description}`, 'status');
        }
        break;
      }
    }
  }
  return totalDamage;
}

function getAffinityBonus(spell: Spell, s: ReturnType<typeof getState>): number {
  let bonus = 1.0;
  for (const runeId of spell.runeIds) {
    const rune = s.player.runes.find(r => r.id === runeId);
    if (rune && rune.discovered && rune.affinityLevel >= 25) {
      bonus += 0.2; // +20% per affinity milestone 1
    }
    if (rune && rune.discovered && rune.affinityLevel >= 50) {
      bonus += 0.15;
    }
  }
  return bonus;
}

function executePlayerTurn(): void {
  if (!combat || combat.victory || combat.defeat || combat.paused) return;
  const s = getState();
  const stats = getEffectiveStats();
  const spells = getEquippedSpells();
  const skills = getEquippedSkills();
  const policies = s.player.actionPolicies.filter(p => p.enabled).sort((a, b) => a.priority - b.priority);

  // Apply player buffs
  let defBonus = 0;
  for (const buff of combat.playerBuffs) {
    defBonus += buff.value;
  }

  // Apply player DoTs
  for (const dot of combat.playerDots) {
    const dmg = dot.damage;
    s.player.stats.hp -= dmg;
    addLog(`You take ${dmg} ${dot.element} damage from ongoing effect`, 'damage');
    dot.turns--;
  }
  combat.playerDots = combat.playerDots.filter(d => d.turns > 0);

  if (s.player.stats.hp <= 0) {
    combat.defeat = true;
    addLog('You have been defeated!', 'info');
    return;
  }

  // Find living enemy
  const target = combat.enemies.find(e => e.currentHp > 0);
  if (!target) { combat.victory = true; return; }

  // Evaluate policies
  for (const policy of policies) {
    if (tryPolicy(policy, target, spells, skills, stats)) break;
  }
}

function tryPolicy(policy: ActionPolicy, target: CombatState['enemies'][0], spells: Spell[], skills: PhysicalSkill[], stats: ReturnType<typeof getEffectiveStats>): boolean {
  const s = getState();

  switch (policy.condition) {
    case 'self_hp_below_30':
      if (s.player.stats.hp > s.player.stats.maxHp * 0.3) return false;
      // Try to heal
      const healSpell = spells.find(sp => sp.effects.some(e => e.type === 'heal') && s.player.stats.mana >= sp.manaCost);
      if (healSpell) {
        s.player.stats.mana -= healSpell.manaCost;
        applySpellDamage(healSpell, target);
        gainAffinityFromCasting(healSpell);
        shiftTrait('resilience', 0.02);
        return true;
      }
      // Use health potion
      const potion = s.player.inventory.find(i => i.id === 'item-health-potion' && i.quantity > 0);
      if (potion) {
        potion.quantity--;
        s.player.stats.hp = Math.min(s.player.stats.maxHp, s.player.stats.hp + 30);
        addLog('You drink a Health Potion (restore 30 HP)', 'heal');
        return true;
      }
      return false;

    case 'enemy_has_weakness':
      // Find a spell that exploits enemy weakness
      for (const spell of spells) {
        if (s.player.stats.mana < spell.manaCost) continue;
        const hasWeakness = spell.elements.some(el => ((target.weaknesses as any)[el] ?? 1) > 1);
        if (hasWeakness) {
          s.player.stats.mana -= spell.manaCost;
          addLog(`[Policy: Exploit Weakness] Casting ${spell.name}`, 'action');
          applySpellDamage(spell, target);
          gainAffinityFromCasting(spell);
          shiftTrait('cunning', 0.02);
          return true;
        }
      }
      return false;

    case 'self_mana_above_20':
      if (s.player.stats.mana < (s.player.stats.maxMana * 0.2)) return false;
      // Cast best available spell
      const bestSpell = spells.filter(sp => s.player.stats.mana >= sp.manaCost).sort((a, b) => b.power - a.power)[0];
      if (bestSpell) {
        s.player.stats.mana -= bestSpell.manaCost;
        addLog(`[Policy: Cast Spell] Casting ${bestSpell.name}`, 'action');
        applySpellDamage(bestSpell, target);
        gainAffinityFromCasting(bestSpell);
        shiftTrait('arcaneAffinity', 0.01);
        return true;
      }
      return false;

    case 'self_stamina_above_10':
      if (s.player.stats.stamina < 10) return false;
      const bestSkill = skills.filter(sk => sk.unlocked && s.player.stats.stamina >= sk.staminaCost).sort((a, b) => b.damage - a.damage)[0];
      if (bestSkill) {
        s.player.stats.stamina -= bestSkill.staminaCost;
        const dmg = Math.max(1, bestSkill.damage + stats.attack - (target.stats.defense || 0));
        target.currentHp -= dmg;
        addLog(`[Policy: Use Skill] ${bestSkill.name} deals ${dmg} physical damage to ${target.name}`, 'damage');
        // Apply skill effects
        for (const eff of bestSkill.effects) {
          if (eff.type === 'status' && eff.description.toLowerCase().includes('stun')) {
            target.stunned += (eff.duration || 1);
            addLog(`${target.name} is stunned for ${eff.duration || 1} turn(s)`, 'status');
          }
        }
        shiftTrait('aggression', 0.02);
        return true;
      }
      return false;

    case 'always':
      // Basic attack
      const dmg = Math.max(1, stats.attack - (target.stats.defense || 0));
      target.currentHp -= dmg;
      addLog(`Basic Attack deals ${dmg} damage to ${target.name}`, 'damage');
      shiftTrait('aggression', 0.01);
      return true;
  }
  return false;
}

function executeEnemyTurn(enemy: CombatState['enemies'][0]): void {
  if (!combat || combat.victory || combat.defeat) return;
  const s = getState();

  // Apply enemy DoTs
  for (const dot of enemy.dots) {
    const dmg = dot.damage;
    enemy.currentHp -= dmg;
    addLog(`${enemy.name} takes ${dmg} ${dot.element} damage from ongoing effect`, 'damage');
    dot.turns--;
  }
  enemy.dots = enemy.dots.filter(d => d.turns > 0);

  // Remove expired debuffs
  for (const debuff of enemy.debuffs) {
    debuff.turns--;
  }
  enemy.debuffs = enemy.debuffs.filter(d => d.turns > 0);

  if (enemy.currentHp <= 0) return;

  // Stunned check
  if (enemy.stunned > 0) {
    enemy.stunned--;
    addLog(`${enemy.name} is stunned and cannot act`, 'status');
    return;
  }

  // Training dummy does not attack
  if (enemy.stats.attack === 0) return;

  // Enemy action based on traits
  if (enemy.traits.aggression > 0.6) {
    // Aggressive: prioritize attack
    if (enemy.spells.length > 0 && enemy.stats.mana >= enemy.spells[0].manaCost) {
      const spell = enemy.spells[0];
      enemy.stats.mana -= spell.manaCost;
      let dmg = 0;
      for (const eff of spell.effects) {
        if (eff.type === 'damage') {
          dmg += eff.value;
          s.player.stats.hp -= eff.value;
        }
        if (eff.type === 'debuff') {
          combat!.playerDots.push({ element: '', damage: 0, turns: 0 }); // placeholder
          addLog(`${enemy.name}'s ${spell.name}: ${eff.description}`, 'status');
        }
        if (eff.type === 'heal') {
          enemy.currentHp = Math.min(enemy.stats.maxHp, enemy.currentHp + eff.value);
          addLog(`${enemy.name} heals for ${eff.value}`, 'heal');
        }
      }
      if (dmg > 0) addLog(`${enemy.name} casts ${spell.name} for ${dmg} damage`, 'damage');
    } else {
      const dmg = Math.max(1, enemy.stats.attack - getEffectiveStats().defense);
      s.player.stats.hp -= dmg;
      addLog(`${enemy.name} attacks for ${dmg} damage`, 'damage');
    }
  } else if (enemy.traits.cunning > 0.6) {
    // Cunning: try spells first
    if (enemy.spells.length > 0 && enemy.stats.mana >= enemy.spells[0].manaCost) {
      const spell = enemy.spells[Math.floor(Math.random() * enemy.spells.length)];
      if (enemy.stats.mana >= spell.manaCost) {
        enemy.stats.mana -= spell.manaCost;
        let dmg = 0;
        for (const eff of spell.effects) {
          if (eff.type === 'damage') { dmg += eff.value; s.player.stats.hp -= eff.value; }
          if (eff.type === 'dot') { combat!.playerDots.push({ element: eff.element || '', damage: eff.value, turns: eff.duration || 3 }); addLog(`You are afflicted: ${eff.description}`, 'status'); }
          if (eff.type === 'heal') { enemy.currentHp = Math.min(enemy.stats.maxHp, enemy.currentHp + eff.value); addLog(`${enemy.name} heals ${eff.value}`, 'heal'); }
        }
        if (dmg > 0) addLog(`${enemy.name} casts ${spell.name} for ${dmg} damage`, 'damage');
      }
    } else {
      const dmg = Math.max(1, enemy.stats.attack - getEffectiveStats().defense);
      s.player.stats.hp -= dmg;
      addLog(`${enemy.name} attacks for ${dmg} damage`, 'damage');
    }
  } else {
    // Default: basic attack
    const dmg = Math.max(1, enemy.stats.attack - getEffectiveStats().defense);
    s.player.stats.hp -= dmg;
    addLog(`${enemy.name} attacks for ${dmg} damage`, 'damage');
  }

  // Cowardly enemies flee at low HP
  if (enemy.traits.resilience < 0.3 && enemy.currentHp < enemy.stats.maxHp * 0.2) {
    addLog(`${enemy.name} attempts to flee!`, 'info');
    if (Math.random() < 0.5) {
      enemy.currentHp = 0;
      addLog(`${enemy.name} flees the battle!`, 'info');
    }
  }

  if (s.player.stats.hp <= 0) {
    combat!.defeat = true;
    addLog('You have been defeated!', 'info');
  }
}

function executeCombatTurn(): void {
  if (!combat || combat.paused || combat.victory || combat.defeat) return;

  combat.turn++;
  addLog(`--- Turn ${combat.turn} ---`, 'info');

  // Player turn
  executePlayerTurn();
  if (combat.victory || combat.defeat) { finishCombat(); return; }

  // Enemy turns
  for (const enemy of combat.enemies) {
    if (enemy.currentHp > 0) {
      executeEnemyTurn(enemy);
      if (combat.defeat) { finishCombat(); return; }
    }
  }

  // Check victory
  if (combat.enemies.every(e => e.currentHp <= 0)) {
    combat.victory = true;
  }

  // Tick player buff/debuff durations
  for (const buff of combat.playerBuffs) buff.turns--;
  combat.playerBuffs = combat.playerBuffs.filter(b => b.turns > 0);

  // Regen: small stamina regen each turn
  const s = getState();
  s.player.stats.stamina = Math.min(s.player.stats.maxStamina, s.player.stats.stamina + 2);

  if (combat.victory || combat.defeat) {
    finishCombat();
  } else {
    renderCombatUI();
  }
}

function finishCombat(): void {
  if (!combat) return;
  combat.running = false;
  if (combat.interval) { clearInterval(combat.interval); combat.interval = null; }
  renderCombatUI();
}

function startCombatLoop(): void {
  if (!combat) return;
  combat.running = true;
  combat.paused = false;
  combat.interval = setInterval(() => {
    if (combat && !combat.paused && !combat.victory && !combat.defeat) {
      executeCombatTurn();
    }
  }, 1200);
}

function pauseCombat(): void {
  if (!combat) return;
  combat.paused = true;
  addLog('--- PAUSED --- Adjust your loadout and policies', 'info');
  renderCombatUI();
}

function resumeCombat(): void {
  if (!combat) return;
  combat.paused = false;
  addLog('--- RESUMED ---', 'info');
}

function renderCombatUI(): void {
  if (!combat) return;
  const app = document.getElementById('app')!;
  const s = getState();
  const room = getCurrentRoom();
  const stats = getEffectiveStats();

  const enemyHtml = combat.enemies.map(e => `
    <div class="combat-entity combat-enemy ${e.currentHp <= 0 ? 'defeated' : ''}">
      <div class="entity-icon enemy-icon">${icon(e.icon, 48)}</div>
      <div class="entity-info">
        <div class="entity-name">${e.name} <span class="entity-level">Lv.${e.stats.level}</span></div>
        ${bar(Math.max(0, e.currentHp), e.stats.maxHp, '#e53935', `HP ${Math.max(0, e.currentHp)}/${e.stats.maxHp}`)}
        <div class="entity-traits">
          ${Object.entries(e.traits).filter(([_, v]) => v > 0.4).map(([k, v]) => `<span class="trait-badge">${k}: ${(v as number).toFixed(1)}</span>`).join('')}
        </div>
        ${e.dots.length > 0 ? `<div class="status-effects">${e.dots.map(d => `<span class="dot-badge" style="color:${elementColor(d.element)}">${d.element} ${d.damage}/t (${d.turns})</span>`).join('')}</div>` : ''}
        ${e.stunned > 0 ? '<span class="stunned-badge">STUNNED</span>' : ''}
        <div class="enemy-resists">
          ${Object.entries(e.resistances).filter(([_, v]) => (v as number) < 1).map(([el, v]) => `<span class="resist-badge" style="color:${elementColor(el)}">Resist ${el} ${Math.round((1 - (v as number)) * 100)}%</span>`).join('')}
          ${Object.entries(e.weaknesses).filter(([_, v]) => (v as number) > 1).map(([el, v]) => `<span class="weak-badge" style="color:${elementColor(el)}">Weak ${el} +${Math.round(((v as number) - 1) * 100)}%</span>`).join('')}
        </div>
      </div>
    </div>
  `).join('');

  const logHtml = combat.log.slice(-15).map(l =>
    `<div class="log-entry log-${l.type}">${l.text}</div>`
  ).join('');

  const spells = getEquippedSpells();
  const skills = getEquippedSkills();

  app.innerHTML = `
    <div class="scene combat-scene">
      <div class="combat-header">
        <h2>${icon(room.icon, 24)} ${room.name} — ${room.type.toUpperCase()} Encounter</h2>
        <div class="combat-turn">Turn ${combat.turn}</div>
      </div>

      <div class="combat-arena">
        <div class="combat-player">
          <div class="entity-icon player-icon">${icon('game-icons:knight-banner', 48)}</div>
          <div class="entity-info">
            <div class="entity-name">${s.player.name} <span class="entity-level">Lv.${stats.level}</span></div>
            ${bar(s.player.stats.hp, stats.maxHp, '#e53935', `HP ${s.player.stats.hp}/${stats.maxHp}`)}
            ${bar(s.player.stats.mana, stats.maxMana, '#1e88e5', `MP ${s.player.stats.mana}/${stats.maxMana}`)}
            ${bar(s.player.stats.stamina, stats.maxStamina, '#43a047', `SP ${s.player.stats.stamina}/${stats.maxStamina}`)}
          </div>
        </div>
        <div class="combat-vs">${icon('game-icons:crossed-swords', 32)}</div>
        <div class="combat-enemies">${enemyHtml}</div>
      </div>

      <div class="combat-log">${logHtml}</div>

      <div class="combat-controls">
        ${combat.victory ? `
          <div class="combat-result victory">
            <h3>${icon('game-icons:laurels', 24)} Victory!</h3>
            <button class="btn btn-primary" id="btn-collect-rewards">${icon('game-icons:coins', 20)} Collect Rewards</button>
          </div>
        ` : combat.defeat ? `
          <div class="combat-result defeat">
            <h3>${icon('game-icons:skull', 24)} Defeated!</h3>
            <button class="btn btn-danger" id="btn-death">${icon('game-icons:return-arrow', 20)} Return to Title</button>
          </div>
        ` : combat.paused ? `
          <div class="combat-paused-controls">
            <p class="pause-info">${icon('game-icons:pause-button', 20)} PAUSED — Adjust loadout and policies</p>
            <div class="pause-loadout">
              <h4>Equipped Spells:</h4>
              <div class="loadout-pills">${spells.map(sp => `<span class="spell-pill" style="border-color:${elementColor(sp.elements[0])}">${icon(sp.icon, 16)} ${sp.name} (${sp.manaCost} MP)</span>`).join('')}</div>
              <h4>Equipped Skills:</h4>
              <div class="loadout-pills">${skills.filter(sk => sk.unlocked).map(sk => `<span class="skill-pill">${icon(sk.icon, 16)} ${sk.name} (${sk.staminaCost} SP)</span>`).join('')}</div>
              <h4>Active Policies:</h4>
              <div class="policy-list">${s.player.actionPolicies.map(p => `
                <label class="policy-toggle">
                  <input type="checkbox" data-policy-id="${p.id}" ${p.enabled ? 'checked' : ''}>
                  <span>P${p.priority}: ${p.condition} → ${p.action}</span>
                </label>
              `).join('')}</div>
            </div>
            <button class="btn btn-primary" id="btn-resume">${icon('game-icons:play-button', 20)} Resume</button>
          </div>
        ` : `
          <button class="btn btn-warning" id="btn-pause">${icon('game-icons:pause-button', 20)} Pause</button>
        `}
      </div>
    </div>
  `;

  // Bind buttons
  document.getElementById('btn-pause')?.addEventListener('click', pauseCombat);
  document.getElementById('btn-resume')?.addEventListener('click', () => {
    // Save policy toggle states
    app.querySelectorAll('.policy-toggle input').forEach(input => {
      const pId = (input as HTMLInputElement).dataset.policyId;
      const policy = s.player.actionPolicies.find(p => p.id === pId);
      if (policy) policy.enabled = (input as HTMLInputElement).checked;
    });
    resumeCombat();
  });

  document.getElementById('btn-collect-rewards')?.addEventListener('click', () => {
    collectRewards();
  });

  document.getElementById('btn-death')?.addEventListener('click', () => {
    s.currentScene = 'title';
    renderScene('title');
  });

  // Auto-scroll log
  const logEl = app.querySelector('.combat-log');
  if (logEl) logEl.scrollTop = logEl.scrollHeight;
}

function collectRewards(): void {
  if (!combat) return;
  const s = getState();
  const room = getCurrentRoom();

  let totalXP = 0;
  let totalGold = 0;

  for (const enemy of combat.enemies) {
    totalXP += enemy.xpReward;
    totalGold += enemy.goldReward;

    // Loot drops
    for (const loot of enemy.loot) {
      if (Math.random() < loot.chance) {
        const itemTemplate = ALL_ITEMS.find(i => i.id === loot.itemId);
        if (itemTemplate) {
          addItem({ ...itemTemplate, quantity: 1 });
          emit('toast', `Looted: ${itemTemplate.name}`, 'success');
        }
      }
    }
  }

  s.player.gold += totalGold;
  gainXP(totalXP);
  emit('toast', `+${totalXP} XP, +${totalGold} gold`, 'success');

  // Rune reward from room
  if (room.runeReward) {
    discoverRune(room.runeReward);
  }

  // Mark room cleared
  room.cleared = true;

  // Check if this was a boss room
  if (room.type === 'boss') {
    const floor = s.floors.find(f => f.bossRoomId === room.id);
    if (floor) {
      floor.cleared = true;
      // If floor 2 boss, victory!
      if (floor.id === 2) {
        s.victory = true;
        s.currentScene = 'victory';
        saveGame();
        renderScene('victory');
        return;
      }
      // Move to next floor
      s.player.currentFloor = floor.id + 1;
      const nextFloor = s.floors.find(f => f.id === floor.id + 1);
      if (nextFloor) {
        s.player.currentRoomId = nextFloor.rooms[0].id;
        emit('toast', `Descending to ${nextFloor.name}...`, 'info');
      }
    }
  }

  // Clean up combat state
  if (combat.interval) clearInterval(combat.interval);
  combat = null;

  saveGame();
  s.currentScene = 'map';
  renderScene('map');
  emit('state-changed');
}

registerScene('combat', () => {
  const room = getCurrentRoom();
  if (!room.enemies || room.enemies.length === 0) {
    // No enemies, go back to map
    const s = getState();
    room.cleared = true;
    s.currentScene = 'map';
    renderScene('map');
    return;
  }

  // Initialize combat state
  combat = {
    enemies: room.enemies.map(e => ({
      ...e,
      stats: { ...e.stats },
      traits: { ...e.traits },
      currentHp: e.stats.hp,
      stunned: 0,
      debuffs: [],
      dots: [],
    })),
    playerDebuffs: [],
    playerDots: [],
    playerBuffs: [],
    log: [],
    turn: 0,
    running: false,
    paused: false,
    victory: false,
    defeat: false,
    interval: null,
  };

  addLog(`Encounter: ${room.enemies.map(e => e.name).join(', ')}`, 'info');
  addLog('Combat begins! Configure loadout then watch the battle unfold.', 'info');

  renderCombatUI();
  startCombatLoop();
});
