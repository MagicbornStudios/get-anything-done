import { GameState, Enemy, Spell, PhysicalSkill, CombatLogEntry, ActiveEffect, ElementType, CombatState } from '../types';
import { updateState, getState, saveGame } from '../state';
import { ITEMS, EQUIPMENT } from '../data/items';

export function startCombat(enemies: Enemy[]): void {
  updateState(state => {
    // Deep clone enemies so room data is preserved
    const combatEnemies = enemies.map(e => ({
      ...e,
      hp: e.maxHp, // Reset HP for respawned enemies
    }));
    state.combatState = {
      enemies: combatEnemies,
      turn: 0,
      playerTurnDone: false,
      enemyTurnDone: false,
      isAutoResolving: false,
      autoSpeed: 800,
      combatOver: false,
      result: 'pending',
      activeEffects: [],
    };
    state.combatLog = [];
    state.screen = 'combat';
    state.paused = false;
    addLog(state, `Combat begins! ${combatEnemies.map(e => e.name).join(', ')} appear!`, 'info');
  });
}

function addLog(state: GameState, text: string, type: CombatLogEntry['type']): void {
  state.combatLog.push({ text, type, timestamp: Date.now() });
  // Keep log manageable
  if (state.combatLog.length > 100) {
    state.combatLog = state.combatLog.slice(-80);
  }
}

function addNotif(state: GameState, text: string, type: string): void {
  state.notifications.push({ text, type, id: state.nextNotifId++, expires: Date.now() + 4000 });
}

// Evaluate action policies to pick the best action
function evaluatePolicy(state: GameState): { type: 'spell' | 'skill'; id: string } | null {
  const { player, combatState } = state;
  if (!combatState) return null;

  const livingEnemies = combatState.enemies.filter(e => e.hp > 0);
  if (livingEnemies.length === 0) return null;

  // Sort policies by priority (lower = higher priority)
  const enabledPolicies = player.actionPolicies.filter(p => p.enabled).sort((a, b) => a.priority - b.priority);

  for (const policy of enabledPolicies) {
    const hpPct = player.hp / player.maxHp;
    const manaPct = player.mana / player.maxMana;

    // Check condition
    let conditionMet = false;
    if (policy.condition === 'HP < 30%') conditionMet = hpPct < 0.3;
    else if (policy.condition === 'HP < 20%') conditionMet = hpPct < 0.2;
    else if (policy.condition === 'Mana < 10') conditionMet = player.mana < 10;
    else if (policy.condition === 'Enemy has weakness') {
      conditionMet = livingEnemies.some(e => e.weaknesses.length > 0);
    }
    else if (policy.condition === 'Always') conditionMet = true;

    if (!conditionMet) continue;

    // Resolve action
    if (policy.action === 'Use heal spell') {
      const healSpell = player.equippedSpells.find(s => s && s.effect?.type === 'heal' && player.mana >= s.manaCost);
      if (healSpell) return { type: 'spell', id: healSpell.id };
    }
    else if (policy.action === 'Use element-matched spell') {
      // Find a spell that matches enemy weakness
      for (const enemy of livingEnemies) {
        for (const weakness of enemy.weaknesses) {
          const matchSpell = player.equippedSpells.find(s => s && s.elements.includes(weakness) && player.mana >= s.manaCost);
          if (matchSpell) return { type: 'spell', id: matchSpell.id };
        }
      }
    }
    else if (policy.action === 'Use highest damage spell') {
      const bestSpell = player.equippedSpells
        .filter((s): s is Spell => s !== null && player.mana >= s.manaCost)
        .sort((a, b) => b.damage - a.damage)[0];
      if (bestSpell) return { type: 'spell', id: bestSpell.id };
    }
    else if (policy.action === 'Use Guard skill') {
      const guard = player.equippedSkills.find(s => s && s.effect?.type === 'shield' && player.stamina >= s.staminaCost);
      if (guard) return { type: 'skill', id: guard.id };
    }
    else if (policy.action === 'Use physical skill') {
      const skill = player.equippedSkills
        .filter((s): s is PhysicalSkill => s !== null && player.stamina >= s.staminaCost)
        .sort((a, b) => b.damage - a.damage)[0];
      if (skill) return { type: 'skill', id: skill.id };
    }
  }

  // Fallback: basic attack with first available spell or skill
  const anySpell = player.equippedSpells.find(s => s && player.mana >= s.manaCost);
  if (anySpell) return { type: 'spell', id: anySpell.id };
  const anySkill = player.equippedSkills.find(s => s && player.stamina >= s.staminaCost);
  if (anySkill) return { type: 'skill', id: anySkill.id };

  return null; // No resources left
}

function calculateDamage(baseDamage: number, elements: ElementType[], target: Enemy, playerAttack: number, affinities: Record<ElementType, number>): number {
  let dmg = baseDamage + Math.floor(playerAttack * 0.5);

  // Affinity bonus
  for (const el of elements) {
    const aff = affinities[el] || 0;
    dmg += Math.floor(aff / 25) * 2;
  }

  // Resistance reduction
  for (const el of elements) {
    const res = target.resistances[el] || 0;
    dmg = Math.floor(dmg * (1 - res));
  }

  // Weakness bonus
  for (const el of elements) {
    if (target.weaknesses.includes(el)) {
      dmg = Math.floor(dmg * 1.5);
    }
  }

  return Math.max(1, dmg);
}

function processActiveEffects(state: GameState): void {
  if (!state.combatState) return;

  const toRemove: number[] = [];
  for (let i = 0; i < state.combatState.activeEffects.length; i++) {
    const eff = state.combatState.activeEffects[i];
    if (eff.type === 'dot') {
      if (eff.targetType === 'enemy' && eff.targetIndex !== undefined) {
        const enemy = state.combatState.enemies[eff.targetIndex];
        if (enemy && enemy.hp > 0) {
          enemy.hp = Math.max(0, enemy.hp - eff.value);
          addLog(state, `${enemy.name} takes ${eff.value} ${eff.source} damage (DoT)`, 'damage');
        }
      } else if (eff.targetType === 'player') {
        state.player.hp = Math.max(0, state.player.hp - eff.value);
        addLog(state, `You take ${eff.value} ${eff.source} damage (DoT)`, 'damage');
      }
    }
    eff.turnsRemaining--;
    if (eff.turnsRemaining <= 0) toRemove.push(i);
  }

  for (let i = toRemove.length - 1; i >= 0; i--) {
    state.combatState.activeEffects.splice(toRemove[i], 1);
  }
}

function executePlayerAction(state: GameState): void {
  if (!state.combatState || state.combatState.combatOver) return;

  const action = evaluatePolicy(state);
  const livingEnemies = state.combatState.enemies.filter(e => e.hp > 0);

  if (!action || livingEnemies.length === 0) {
    // No resources - basic attack
    const target = livingEnemies[0];
    if (target) {
      const dmg = Math.max(1, state.player.attack - Math.floor(target.defense * 0.3));
      target.hp = Math.max(0, target.hp - dmg);
      addLog(state, `You strike ${target.name} for ${dmg} damage (basic attack - no resources left)`, 'action');
    }
    return;
  }

  if (action.type === 'spell') {
    const spell = state.player.equippedSpells.find(s => s && s.id === action.id) as Spell;
    if (!spell) return;

    state.player.mana -= spell.manaCost;

    // Increase affinity for all elements used
    for (const el of spell.elements) {
      const gain = spell.isCrafted ? 3 : 2;
      state.player.affinities[el] = Math.min(100, (state.player.affinities[el] || 0) + gain);
      if (gain > 0) {
        addLog(state, `+${gain} ${el} affinity (casting ${spell.name})`, 'trait');
      }
    }

    // Update spell affinity
    const knownSpell = state.player.knownSpells.find(s => s.id === spell.id);
    if (knownSpell) {
      knownSpell.affinity = Math.min(100, knownSpell.affinity + 2);
    }

    if (spell.effect?.type === 'heal') {
      const healAmt = spell.effect.value;
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + healAmt);
      addLog(state, `[Policy: ${getPolicyName(action, state)}] Cast ${spell.name}: Heal ${healAmt} HP (${state.player.mana} mana left)`, 'heal');
    } else {
      // Attack - pick best target (weakest or most weak to element)
      let target = livingEnemies[0];
      for (const enemy of livingEnemies) {
        for (const el of spell.elements) {
          if (enemy.weaknesses.includes(el)) {
            target = enemy;
            break;
          }
        }
      }

      const dmg = calculateDamage(spell.damage, spell.elements as ElementType[], target, state.player.attack, state.player.affinities);
      target.hp = Math.max(0, target.hp - dmg);

      const weaknessText = spell.elements.some(el => target.weaknesses.includes(el as ElementType)) ? ' (SUPER EFFECTIVE!)' : '';
      addLog(state, `[Policy: ${getPolicyName(action, state)}] Cast ${spell.name} on ${target.name}: ${dmg} damage${weaknessText} (${state.player.mana} mana left)`, 'action');

      // Apply spell effects
      if (spell.effect?.type === 'dot' && target.hp > 0) {
        const idx = state.combatState!.enemies.indexOf(target);
        state.combatState!.activeEffects.push({
          targetType: 'enemy', targetIndex: idx,
          type: 'dot', value: spell.effect.value,
          turnsRemaining: spell.effect.duration || 3,
          source: spell.name,
        });
        addLog(state, `${target.name} is burning! (${spell.effect.value} dmg/turn for ${spell.effect.duration || 3} turns)`, 'info');
      }
      if (spell.effect?.type === 'stun' && target.hp > 0) {
        addLog(state, `${target.name} is stunned!`, 'info');
      }
    }
  } else {
    // Physical skill
    const skill = state.player.equippedSkills.find(s => s && s.id === action.id) as PhysicalSkill;
    if (!skill) return;

    state.player.stamina -= skill.staminaCost;

    // Level up skill
    skill.currentXp += 1;
    if (skill.currentXp >= skill.xpToNext) {
      skill.level++;
      skill.currentXp = 0;
      skill.xpToNext = Math.floor(skill.xpToNext * 1.5);
      skill.damage += 2;
      addLog(state, `${skill.name} leveled up to ${skill.level}!`, 'info');
    }

    if (skill.effect?.type === 'shield') {
      state.combatState!.activeEffects.push({
        targetType: 'player', type: 'shield', value: skill.effect.value,
        turnsRemaining: skill.effect.duration || 1, source: skill.name,
      });
      addLog(state, `[Policy: ${getPolicyName(action, state)}] Use ${skill.name}: Shield ${skill.effect.value} for ${skill.effect.duration || 1} turns`, 'action');
    } else {
      const target = livingEnemies[0];
      if (target) {
        const dmg = Math.max(1, skill.damage + state.player.attack - Math.floor(target.defense * 0.3));
        target.hp = Math.max(0, target.hp - dmg);
        addLog(state, `[Policy: ${getPolicyName(action, state)}] Use ${skill.name} on ${target.name}: ${dmg} damage (${state.player.stamina} stamina left)`, 'action');

        if (skill.effect?.type === 'heal') {
          state.player.hp = Math.min(state.player.maxHp, state.player.hp + skill.effect.value);
          addLog(state, `Drained ${skill.effect.value} HP from ${target.name}`, 'heal');
        }
      }
    }
  }
}

function executeEnemyActions(state: GameState): void {
  if (!state.combatState || state.combatState.combatOver) return;

  for (const enemy of state.combatState.enemies) {
    if (enemy.hp <= 0) continue;

    // Cowardly enemies flee at low HP
    if (enemy.behavior === 'cowardly' && enemy.hp < enemy.maxHp * 0.25) {
      addLog(state, `${enemy.name} cowers in fear!`, 'info');
      continue;
    }

    // Check shield effects
    let shieldBlock = 0;
    for (const eff of state.combatState.activeEffects) {
      if (eff.targetType === 'player' && eff.type === 'shield') {
        shieldBlock += eff.value;
      }
    }

    // Enemy uses spell if it has one (and is aggressive/cunning)
    if (enemy.spells && enemy.spells.length > 0 && (enemy.traits.aggression > 0.5 || enemy.traits.cunning > 0.5)) {
      const spell = enemy.spells[Math.floor(Math.random() * enemy.spells.length)];
      if (spell.name === 'Rock Shield' || spell.name === 'Reflect') {
        addLog(state, `${enemy.name} uses ${spell.name}! (Defense up)`, 'action');
        enemy.defense += 3;
        continue;
      }
      if (spell.name === 'Mana Drain' || spell.name === 'Mana Siphon' || spell.name === 'Essence Drain') {
        const drain = Math.floor(spell.damage * 0.8);
        state.player.mana = Math.max(0, state.player.mana - drain);
        const rawDmg = spell.damage;
        const actualDmg = Math.max(0, rawDmg - shieldBlock);
        state.player.hp = Math.max(0, state.player.hp - actualDmg);
        addLog(state, `${enemy.name} uses ${spell.name}: ${actualDmg} damage, drains ${drain} mana!`, 'damage');
        continue;
      }

      const rawDmg = spell.damage;
      const actualDmg = Math.max(0, rawDmg - shieldBlock);
      state.player.hp = Math.max(0, state.player.hp - actualDmg);
      addLog(state, `${enemy.name} casts ${spell.name}: ${actualDmg} damage${shieldBlock > 0 ? ` (${shieldBlock} blocked)` : ''}`, 'damage');
    } else {
      // Basic attack - behavior influences damage
      let atkMod = 1.0;
      if (enemy.behavior === 'aggressive') atkMod = 1.2;
      if (enemy.behavior === 'defensive') atkMod = 0.8;

      const rawDmg = Math.max(1, Math.floor(enemy.attack * atkMod) - Math.floor(state.player.defense * 0.3));
      const actualDmg = Math.max(0, rawDmg - shieldBlock);
      state.player.hp = Math.max(0, state.player.hp - actualDmg);

      const behaviorText = enemy.behavior === 'aggressive' ? ' (aggressive!)' : enemy.behavior === 'defensive' ? ' (cautiously)' : '';
      addLog(state, `${enemy.name} attacks${behaviorText}: ${actualDmg} damage${shieldBlock > 0 ? ` (${shieldBlock} blocked)` : ''}`, 'damage');
    }
  }
}

function getPolicyName(action: { type: string; id: string }, state: GameState): string {
  // Find which policy triggered
  if (action.type === 'spell') {
    const spell = state.player.equippedSpells.find(s => s && s.id === action.id);
    if (spell?.effect?.type === 'heal') return 'Heal when low';
    for (const e of state.combatState?.enemies || []) {
      if (e.hp > 0 && e.weaknesses.some(w => spell?.elements.includes(w))) return 'Target weakness';
    }
    return 'Highest damage';
  }
  return 'Physical fallback';
}

function checkCombatEnd(state: GameState): boolean {
  if (!state.combatState) return true;

  const allEnemiesDead = state.combatState.enemies.every(e => e.hp <= 0);
  const playerDead = state.player.hp <= 0;

  if (allEnemiesDead) {
    state.combatState.combatOver = true;
    state.combatState.result = 'victory';
    // Grant rewards
    let totalXp = 0, totalGold = 0;
    for (const enemy of state.combatState.enemies) {
      totalXp += enemy.xpReward;
      totalGold += enemy.goldReward;
      // Check for loot drops
      for (const loot of enemy.loot || []) {
        if (Math.random() < loot.chance) {
          // Check if it's a rune
          if (loot.itemId.startsWith('rune-')) {
            const rune = state.player.discoveredRunes.find(r => r.id === loot.itemId);
            if (rune && !rune.discovered) {
              rune.discovered = true;
              addLog(state, `Discovered rune: ${rune.name}!`, 'info');
              addNotif(state, `Discovered: ${rune.name}!`, 'reward');
            }
          } else if (EQUIPMENT[loot.itemId]) {
            const equip = EQUIPMENT[loot.itemId]();
            state.player.inventory.push({ id: equip.id, name: equip.name, category: 'equipment', description: equip.description, value: equip.value, quantity: 1, icon: 'game-icons:chest-armor' });
            addLog(state, `Looted: ${equip.name}!`, 'info');
          } else if (ITEMS[loot.itemId]) {
            const item = ITEMS[loot.itemId]();
            const existing = state.player.inventory.find(i => i.name === item.name);
            if (existing) existing.quantity++;
            else state.player.inventory.push(item);
            addLog(state, `Looted: ${item.name}!`, 'info');
          }
        }
      }
    }

    state.player.xp += totalXp;
    state.player.gold += totalGold;
    addLog(state, `Victory! Gained ${totalXp} XP and ${totalGold} gold.`, 'info');

    // Check level up
    while (state.player.xp >= state.player.xpToNext) {
      state.player.xp -= state.player.xpToNext;
      state.player.level++;
      state.player.xpToNext = Math.floor(state.player.xpToNext * 1.4);
      state.player.maxHp += 8;
      state.player.hp = Math.min(state.player.hp + 8, state.player.maxHp);
      state.player.maxMana += 4;
      state.player.mana = Math.min(state.player.mana + 4, state.player.maxMana);
      state.player.maxStamina += 3;
      state.player.stamina = Math.min(state.player.stamina + 3, state.player.maxStamina);
      state.player.attack += 1;
      state.player.defense += 1;
      state.player.skillPoints += 1;
      addLog(state, `LEVEL UP! You are now level ${state.player.level}! +1 Skill Point`, 'info');
      addNotif(state, `Level ${state.player.level}! +8 HP, +4 Mana, +3 Stamina, +1 Skill Point`, 'reward');
    }

    // Regenerate a little stamina on victory
    state.player.stamina = Math.min(state.player.maxStamina, state.player.stamina + 5);

    return true;
  }

  if (playerDead) {
    state.combatState.combatOver = true;
    state.combatState.result = 'defeat';
    addLog(state, 'You have been defeated...', 'info');
    return true;
  }

  return false;
}

let autoResolveTimer: number | null = null;

export function startAutoResolve(): void {
  updateState(state => {
    if (!state.combatState) return;
    state.combatState.isAutoResolving = true;
    state.paused = false;
  });
  runAutoResolveTick();
}

function runAutoResolveTick(): void {
  const state = getState();
  if (!state.combatState || state.combatState.combatOver || state.paused) {
    if (autoResolveTimer) clearTimeout(autoResolveTimer);
    autoResolveTimer = null;
    return;
  }

  executeTurn();

  if (!state.combatState.combatOver) {
    autoResolveTimer = window.setTimeout(runAutoResolveTick, state.combatState.autoSpeed);
  }
}

export function pauseCombat(): void {
  updateState(state => {
    state.paused = true;
    if (state.combatState) state.combatState.isAutoResolving = false;
  });
  if (autoResolveTimer) {
    clearTimeout(autoResolveTimer);
    autoResolveTimer = null;
  }
}

export function resumeCombat(): void {
  updateState(state => {
    state.paused = false;
    if (state.combatState) state.combatState.isAutoResolving = true;
  });
  runAutoResolveTick();
}

export function executeTurn(): void {
  updateState(state => {
    if (!state.combatState || state.combatState.combatOver) return;

    state.combatState.turn++;
    addLog(state, `--- Turn ${state.combatState.turn} ---`, 'info');

    // Process DoT effects
    processActiveEffects(state);
    if (checkCombatEnd(state)) return;

    // Player auto-action
    executePlayerAction(state);
    if (checkCombatEnd(state)) return;

    // Enemy actions
    executeEnemyActions(state);
    checkCombatEnd(state);
  });
}

export function endCombat(): void {
  if (autoResolveTimer) {
    clearTimeout(autoResolveTimer);
    autoResolveTimer = null;
  }

  updateState(state => {
    if (!state.combatState) return;

    if (state.combatState.result === 'victory') {
      // Mark room as cleared
      const floor = state.floors[state.currentFloor];
      const room = floor.rooms.find(r => r.id === state.currentRoomId);
      if (room) {
        room.cleared = true;

        // Check if boss was killed
        if (room.type === 'boss' && state.currentFloor < state.floors.length - 1) {
          state.floors[state.currentFloor + 1].unlocked = true;
          addNotif(state, `Floor ${state.currentFloor + 2} unlocked!`, 'reward');
        }

        // Check if final boss
        if (room.type === 'boss' && state.currentFloor === state.floors.length - 1) {
          state.screen = 'victory';
          state.combatState = null;
          saveGame(state);
          return;
        }
      }

      state.screen = 'exploration';
      state.combatState = null;
      saveGame(state);
    } else if (state.combatState.result === 'defeat') {
      state.screen = 'gameover';
      state.combatState = null;
    }
  });
}

export function fleeCombat(): void {
  if (autoResolveTimer) {
    clearTimeout(autoResolveTimer);
    autoResolveTimer = null;
  }
  updateState(state => {
    state.combatState = null;
    state.screen = 'exploration';
    state.paused = false;
    addNotif(state, 'Fled from combat!', 'info');
  });
}

export function setAutoSpeed(speed: number): void {
  updateState(state => {
    if (state.combatState) {
      state.combatState.autoSpeed = speed;
    }
  });
}
