import { registerScene, el, icon, barHTML } from '../renderer';
import { getState, getCurrentRoom, getCurrentFloor, addXP, addGold, addItem, addAffinity, shiftTrait, healPlayer, showToast, setScene, saveGame, discoverRune } from '../state';
import { createHUD } from '../hud';
import type { Enemy, Spell, PhysicalSkill, ActionPolicy, Element } from '../types';
import { bus, EVT } from '../events';
import { ALL_ITEMS } from '../data';

interface CombatState {
  enemies: (Enemy & { currentHp: number; currentMana: number; currentStamina: number; effects: ActiveEffect[]; stunned: boolean })[];
  playerEffects: ActiveEffect[];
  playerDefBuff: number;
  playerAtkBuff: number;
  log: string[];
  paused: boolean;
  running: boolean;
  turn: number;
  won: boolean;
  lost: boolean;
  intervalId: number | null;
  lastSpellUsed: string | null;
}

interface ActiveEffect {
  type: string;
  value: number;
  turns: number;
  element?: Element;
}

let combatState: CombatState | null = null;

function initCombat(): CombatState {
  const room = getCurrentRoom();
  const enemies = (room.enemies || []).map(e => ({
    ...e,
    stats: { ...e.stats },
    currentHp: e.stats.hp,
    currentMana: e.stats.mana,
    currentStamina: e.stats.stamina,
    effects: [] as ActiveEffect[],
    stunned: false,
  }));

  return {
    enemies,
    playerEffects: [],
    playerDefBuff: 0,
    playerAtkBuff: 0,
    log: [`--- Battle begins! ---`],
    paused: false,
    running: false,
    turn: 0,
    won: false,
    lost: false,
    intervalId: null,
    lastSpellUsed: null,
  };
}

function calcDamage(base: number, element: Element | undefined, target: { resistances: any; weaknesses: any }): { damage: number; mod: string } {
  let damage = base;
  let mod = '';
  if (element) {
    const resist = target.resistances?.[element] || 1;
    const weak = target.weaknesses?.[element] || 1;
    if (resist < 1) {
      damage = Math.floor(damage * resist);
      mod = ' (resisted)';
    } else if (weak > 1) {
      damage = Math.floor(damage * weak);
      mod = ' (WEAKNESS!)';
    }
  }
  return { damage: Math.max(1, damage), mod };
}

function resolvePlayerTurn(cs: CombatState): void {
  const state = getState();
  const p = state.player;
  const s = p.stats;

  // Process DoT on player
  for (const eff of cs.playerEffects) {
    if (eff.type === 'dot') {
      s.hp -= eff.value;
      cs.log.push(`<span class="damage">You take ${eff.value} ${eff.element || ''} DoT damage!</span>`);
    }
    eff.turns--;
  }
  cs.playerEffects = cs.playerEffects.filter(e => e.turns > 0);

  // Decrease buffs
  if (cs.playerDefBuff > 0) cs.playerDefBuff--;
  if (cs.playerAtkBuff > 0) cs.playerAtkBuff--;

  if (s.hp <= 0) { cs.lost = true; return; }

  // Use action policies to decide action
  const alive = cs.enemies.filter(e => e.currentHp > 0);
  if (alive.length === 0) { cs.won = true; return; }

  const target = alive[0]; // pick first alive
  const policies = [...p.actionPolicies].sort((a, b) => a.priority - b.priority);

  for (const policy of policies) {
    if (tryPolicy(policy, cs, target, p, s)) break;
  }
}

function tryPolicy(policy: ActionPolicy, cs: CombatState, target: any, p: any, s: any): boolean {
  switch (policy.condition) {
    case 'hp_below_30': {
      if (s.hp / s.maxHp > 0.3) return false;
      // Use heal potion if available
      const potion = p.inventory.find((i: any) => i.id === 'item-hp-potion' && i.quantity > 0);
      if (potion) {
        healPlayer(30, 0, 0);
        potion.quantity--;
        if (potion.quantity <= 0) p.inventory = p.inventory.filter((i: any) => i.id !== potion.id);
        cs.log.push(`<span class="heal">You use a Health Potion! +30 HP</span>`);
        return true;
      }
      return false;
    }
    case 'enemy_has_weakness': {
      // Find a spell that exploits weakness
      const loadedSpells = p.spellLoadout.filter((sp: any) => sp !== null) as Spell[];
      for (const spell of loadedSpells) {
        if (s.mana < spell.manaCost) continue;
        for (const elem of spell.elements) {
          if (target.weaknesses?.[elem] && target.weaknesses[elem] > 1) {
            return castSpell(cs, spell, target, p, s);
          }
        }
      }
      return false;
    }
    case 'has_mana': {
      const loadedSpells = p.spellLoadout.filter((sp: any) => sp !== null) as Spell[];
      const usable = loadedSpells.filter((sp: Spell) => s.mana >= sp.manaCost);
      if (usable.length === 0) return false;
      // Prefer different spell than last used
      let spell = usable.find((sp: Spell) => sp.id !== cs.lastSpellUsed) || usable[0];
      return castSpell(cs, spell, target, p, s);
    }
    case 'has_stamina': {
      const loadedSkills = p.skillLoadout.filter((sk: any) => sk !== null && sk.unlocked) as PhysicalSkill[];
      const usable = loadedSkills.filter((sk: PhysicalSkill) => s.stamina >= sk.staminaCost);
      if (usable.length === 0) return false;
      const skill = usable[0];
      return useSkill(cs, skill, target, p, s);
    }
    case 'always': {
      // Basic attack
      const atkPower = s.attack + (cs.playerAtkBuff > 0 ? 3 : 0);
      const { damage, mod } = calcDamage(atkPower, undefined, target);
      target.currentHp -= damage;
      cs.log.push(`You attack ${target.name} for <span class="damage">${damage}</span> damage${mod}`);
      shiftTrait('aggression', 0.02, 'combat');
      return true;
    }
    default: return false;
  }
}

function castSpell(cs: CombatState, spell: Spell, target: any, p: any, s: any): boolean {
  s.mana -= spell.manaCost;
  cs.lastSpellUsed = spell.id;

  let totalDamage = 0;
  for (const eff of spell.effects) {
    if (eff.type === 'damage') {
      const { damage, mod } = calcDamage(eff.value + Math.floor(s.attack * 0.3), eff.element, target);
      target.currentHp -= damage;
      totalDamage += damage;
      cs.log.push(`<span class="action">${spell.name}</span> hits ${target.name} for <span class="damage">${damage}</span> ${eff.element || ''} damage${mod}`);
    } else if (eff.type === 'dot') {
      target.effects.push({ type: 'dot', value: eff.value, turns: eff.duration || 3, element: eff.element });
      cs.log.push(`<span class="action">${spell.name}</span> applies ${eff.element || ''} DoT to ${target.name}`);
    } else if (eff.type === 'heal') {
      healPlayer(eff.value, 0, 0);
      cs.log.push(`<span class="heal">${spell.name} heals you for ${eff.value} HP</span>`);
    } else if (eff.type === 'buff') {
      cs.playerDefBuff = Math.max(cs.playerDefBuff, eff.duration || 2);
      cs.log.push(`<span class="action">${spell.name}</span> buffs your defense`);
    } else if (eff.type === 'debuff') {
      cs.log.push(`<span class="action">${spell.name}</span> debuffs ${target.name}`);
    }
  }

  // Affinity gain from casting (R-v5.01)
  for (const runeId of spell.runeIds) {
    addAffinity(runeId, 3);
  }
  // Also gain for elements used
  for (const elem of spell.elements) {
    const rune = p.runes.find((r: any) => r.element === elem);
    if (rune) addAffinity(rune.id, 2);
  }

  shiftTrait('arcaneAffinity', 0.03, 'spell cast');
  return true;
}

function useSkill(cs: CombatState, skill: PhysicalSkill, target: any, p: any, s: any): boolean {
  s.stamina -= skill.staminaCost;

  for (const eff of skill.effects) {
    if (eff.type === 'damage') {
      const { damage, mod } = calcDamage(eff.value + s.attack, undefined, target);
      target.currentHp -= damage;
      cs.log.push(`<span class="action">${skill.name}</span> hits ${target.name} for <span class="damage">${damage}</span> damage${mod}`);
    } else if (eff.type === 'buff') {
      if (skill.id === 'skill-guard') cs.playerDefBuff = eff.duration || 2;
      else if (skill.id === 'skill-rally') cs.playerAtkBuff = eff.duration || 3;
      cs.log.push(`<span class="action">${skill.name}</span> ${eff.description}`);
    } else if (eff.type === 'status') {
      target.stunned = true;
      cs.log.push(`<span class="action">${skill.name}</span> stuns ${target.name}!`);
    }
  }

  shiftTrait('aggression', 0.02, 'physical skill');
  shiftTrait('resilience', 0.01, 'combat');
  return true;
}

function resolveEnemyTurn(cs: CombatState, enemy: (typeof cs.enemies)[0]): void {
  if (enemy.currentHp <= 0) return;

  const state = getState();
  const s = state.player.stats;

  // Process enemy DoTs
  for (const eff of enemy.effects) {
    if (eff.type === 'dot') {
      enemy.currentHp -= eff.value;
      cs.log.push(`${enemy.name} takes <span class="damage">${eff.value}</span> ${eff.element || ''} DoT damage`);
    }
    eff.turns--;
  }
  enemy.effects = enemy.effects.filter(e => e.turns > 0);

  if (enemy.currentHp <= 0) {
    cs.log.push(`${enemy.name} is defeated!`);
    return;
  }
  if (enemy.stunned) {
    cs.log.push(`${enemy.name} is stunned and cannot act!`);
    enemy.stunned = false;
    return;
  }

  // Enemy uses trait-driven action policies (R-v5.14)
  const policies = [...enemy.actionPolicies].sort((a, b) => a.priority - b.priority);
  let acted = false;

  for (const policy of policies) {
    if (acted) break;
    switch (policy.condition) {
      case 'hp_below_20':
        if (enemy.currentHp / enemy.stats.maxHp > 0.2) continue;
        if (enemy.traits.aggression < 0.5) {
          cs.log.push(`${enemy.name} tries to flee! (cowardly)`);
          // Lower HP enemies may flee
          enemy.currentHp = 0;
          acted = true;
        }
        break;
      case 'hp_below_30':
        if (enemy.currentHp / enemy.stats.maxHp > 0.3) continue;
        if (policy.action === 'heal') {
          const heal = Math.floor(enemy.stats.maxHp * 0.15);
          enemy.currentHp = Math.min(enemy.stats.maxHp, enemy.currentHp + heal);
          cs.log.push(`<span class="heal">${enemy.name} heals for ${heal} HP!</span>`);
          acted = true;
        }
        break;
      case 'hp_below_50':
        if (enemy.currentHp / enemy.stats.maxHp > 0.5) continue;
        // Fall through to spell
      case 'has_mana': {
        const spell = enemy.spells.find(sp => enemy.currentMana >= sp.manaCost);
        if (!spell) continue;
        enemy.currentMana -= spell.manaCost;
        let totalDmg = 0;
        for (const eff of spell.effects) {
          if (eff.type === 'damage') {
            const base = eff.value;
            const def = s.defense + (cs.playerDefBuff > 0 ? 5 : 0);
            const dmg = Math.max(1, base - Math.floor(def * 0.3));
            s.hp -= dmg;
            totalDmg += dmg;
            cs.log.push(`${enemy.name} casts <span class="action">${spell.name}</span> for <span class="damage">${dmg}</span> damage!`);
          } else if (eff.type === 'heal') {
            enemy.currentHp = Math.min(enemy.stats.maxHp, enemy.currentHp + eff.value);
            cs.log.push(`<span class="heal">${enemy.name} heals for ${eff.value}!</span>`);
          } else if (eff.type === 'debuff') {
            cs.log.push(`${enemy.name} debuffs you with ${spell.name}!`);
          }
        }
        acted = true;
        break;
      }
      case 'attacked':
        // Reflect mechanic for Mirror Knight
        if (policy.action === 'reflect') {
          cs.log.push(`${enemy.name} reflects incoming direct damage!`);
        }
        break;
      case 'always': {
        const atkPower = enemy.stats.attack;
        const def = s.defense + (cs.playerDefBuff > 0 ? 5 : 0);
        const dmg = Math.max(1, atkPower - Math.floor(def * 0.3));
        s.hp -= dmg;
        cs.log.push(`${enemy.name} attacks you for <span class="damage">${dmg}</span> damage`);
        acted = true;
        break;
      }
    }
  }

  bus.emit(EVT.PLAYER_UPDATE, state.player);
}

function processTurn(cs: CombatState): void {
  cs.turn++;
  cs.log.push(`<strong>--- Turn ${cs.turn} ---</strong>`);

  resolvePlayerTurn(cs);
  if (cs.won || cs.lost) return;

  for (const enemy of cs.enemies) {
    resolveEnemyTurn(cs, enemy);
    if (getState().player.stats.hp <= 0) {
      cs.lost = true;
      return;
    }
  }

  // Check win
  if (cs.enemies.every(e => e.currentHp <= 0)) {
    cs.won = true;
  }

  // Regen stamina each turn
  const s = getState().player.stats;
  s.stamina = Math.min(s.maxStamina, s.stamina + 3);
}

function startAutoResolve(cs: CombatState, render: () => void): void {
  cs.running = true;
  cs.intervalId = window.setInterval(() => {
    if (cs.paused || cs.won || cs.lost) {
      if (cs.won || cs.lost) {
        if (cs.intervalId) clearInterval(cs.intervalId);
        cs.running = false;
      }
      render();
      return;
    }
    processTurn(cs);
    render();
  }, 800);
}

function endCombat(cs: CombatState): void {
  const state = getState();
  const room = getCurrentRoom();

  if (cs.won) {
    room.cleared = true;
    let totalXP = 0;
    let totalGold = 0;

    for (const enemy of cs.enemies) {
      totalXP += enemy.xpReward;
      totalGold += enemy.goldReward;

      // Loot drops
      for (const loot of enemy.loot) {
        if (Math.random() < loot.chance) {
          const itemDef = ALL_ITEMS.find(i => i.id === loot.itemId);
          if (itemDef) {
            // Check if it's a rune
            if (loot.itemId.startsWith('rune-')) {
              discoverRune(loot.itemId);
            } else {
              addItem({ ...itemDef, quantity: 1 });
              showToast(`Loot: ${itemDef.name}`, 'loot');
            }
          }
        }
      }
    }

    // Room rune reward
    if (room.runeReward) {
      discoverRune(room.runeReward);
    }

    addXP(totalXP);
    addGold(totalGold);
    showToast(`Victory! +${totalXP} XP, +${totalGold} gold`, 'success');

    // Trait shifts from combat
    shiftTrait('resilience', 0.03, 'combat victory');

    bus.emit(EVT.COMBAT_END, { won: true });
    saveGame();
  } else {
    // Death — return to entrance of current floor
    showToast('You have been defeated...', 'danger');
    state.player.stats.hp = Math.floor(state.player.stats.maxHp * 0.3);
    state.player.stats.mana = Math.floor(state.player.stats.maxMana * 0.3);
    state.player.stats.stamina = state.player.stats.maxStamina;
    const floor = getCurrentFloor();
    state.player.currentRoomId = floor.rooms[0].id;
    bus.emit(EVT.COMBAT_END, { won: false });
    saveGame();
  }
}

registerScene('combat', (container) => {
  combatState = initCombat();
  const cs = combatState;
  const state = getState();
  const p = state.player;

  container.appendChild(createHUD());

  const scene = el('div', { className: 'combat-scene' });

  function renderCombat() {
    scene.innerHTML = '';

    // Combat field — player vs enemies
    const field = el('div', { className: 'combat-field' });

    // Player side
    const playerSide = el('div', { className: 'combat-entity player-side' },
      el('div', { className: 'combat-portrait' }, icon('game-icons:knight-banner', 'icon-xl')),
      el('span', { className: 'combat-entity-name', style: { color: 'var(--accent-ice)' } }, p.name),
      el('div', { className: 'combat-entity-bars' },
        barHTML(p.stats.hp, p.stats.maxHp, 'bar-hp'),
        barHTML(p.stats.mana, p.stats.maxMana, 'bar-mana'),
        barHTML(p.stats.stamina, p.stats.maxStamina, 'bar-stamina'),
      ),
    );

    field.appendChild(playerSide);
    field.appendChild(el('div', { className: 'combat-vs' }, 'VS'));

    // Enemy side
    for (const enemy of cs.enemies) {
      const alive = enemy.currentHp > 0;
      const enemySide = el('div', {
        className: 'combat-entity enemy-side',
        style: { opacity: alive ? '1' : '0.3' },
      },
        el('div', { className: 'combat-portrait' }, icon(enemy.icon, 'icon-xl')),
        el('span', { className: 'combat-entity-name', style: { color: 'var(--hp-bar)' } }, enemy.name),
        el('div', { className: 'combat-entity-bars' },
          barHTML(Math.max(0, enemy.currentHp), enemy.stats.maxHp, 'bar-hp'),
          enemy.stats.maxMana > 0 ? barHTML(enemy.currentMana, enemy.stats.maxMana, 'bar-mana') : el('span', {}),
        ),
        // Traits display
        el('div', { style: { fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' } },
          ...Object.entries(enemy.traits).filter(([_, v]) => v > 0.3).map(([k, v]) =>
            el('span', { style: { marginRight: '6px' } }, `${k}: ${(v as number).toFixed(1)}`)
          ),
        ),
      );
      field.appendChild(enemySide);
    }

    // Pause overlay
    const pauseOverlay = el('div', { className: `combat-paused-overlay ${cs.paused ? 'visible' : ''}` },
      el('h3', { style: { marginBottom: '12px' } }, 'PAUSED — Adjust Loadout'),
      el('div', { className: 'policy-editor' },
        el('p', { style: { fontSize: '12px', color: 'var(--text-dim)', marginBottom: '8px' } }, 'Current action policies (priority order):'),
        ...p.actionPolicies.sort((a, b) => a.priority - b.priority).map(policy =>
          el('div', { className: 'policy-rule' },
            el('span', { style: { minWidth: '30px', color: 'var(--accent-gold)' } }, `#${policy.priority}`),
            el('span', {}, `IF ${policy.condition}`),
            el('span', { style: { color: 'var(--accent-ice)' } }, `THEN ${policy.action}`),
          )
        ),
      ),
      el('div', { style: { marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        el('h4', { style: { width: '100%', marginBottom: '4px' } }, 'Spell Loadout:'),
        ...p.spellLoadout.map((spell, idx) =>
          el('div', { className: `loadout-slot ${spell ? 'filled' : ''}` },
            spell ? el('span', { style: { fontSize: '10px' } },
              icon(spell.icon, 'icon-sm'),
              el('br', {}),
              spell.name,
            ) : el('span', { style: { fontSize: '10px', color: 'var(--text-dim)' } }, `Slot ${idx + 1}`),
          )
        ),
      ),
      el('button', {
        className: 'btn btn-primary',
        style: { marginTop: '16px' },
        onclick: () => {
          cs.paused = false;
          renderCombat();
        },
      }, 'Resume Combat'),
    );
    field.appendChild(pauseOverlay);

    scene.appendChild(field);

    // Combat log
    const logPanel = el('div', { className: 'combat-log-panel' });
    for (const entry of cs.log) {
      const div = el('div', { className: 'combat-log-entry' });
      div.innerHTML = entry;
      logPanel.appendChild(div);
    }
    logPanel.scrollTop = logPanel.scrollHeight;
    scene.appendChild(logPanel);

    // Controls
    const controls = el('div', { className: 'combat-controls' });

    if (cs.won || cs.lost) {
      controls.appendChild(el('span', { className: 'combat-status-label' },
        icon(cs.won ? 'game-icons:trophy' : 'game-icons:death-skull', 'icon-sm'),
        cs.won ? 'VICTORY!' : 'DEFEATED...',
      ));
      controls.appendChild(el('button', {
        className: 'btn btn-primary',
        onclick: () => {
          endCombat(cs);
          setScene('map');
        },
      }, cs.won ? 'Continue' : 'Return to Entrance'));
    } else {
      controls.appendChild(el('span', { className: 'combat-status-label' },
        icon('game-icons:crossed-swords', 'icon-sm'),
        cs.running ? (cs.paused ? 'PAUSED' : `Turn ${cs.turn} — Auto-resolving...`) : 'Ready',
      ));

      if (!cs.running) {
        controls.appendChild(el('button', {
          className: 'btn btn-primary',
          onclick: () => startAutoResolve(cs, renderCombat),
        }, icon('game-icons:play-button', 'icon-sm'), 'Start Combat'));
      } else if (!cs.paused) {
        controls.appendChild(el('button', {
          className: 'btn btn-gold',
          onclick: () => {
            cs.paused = true;
            renderCombat();
          },
        }, icon('game-icons:pause-button', 'icon-sm'), 'Pause'));
      }

      controls.appendChild(el('button', {
        className: 'btn btn-danger',
        onclick: () => {
          if (cs.intervalId) clearInterval(cs.intervalId);
          cs.lost = true;
          cs.running = false;
          renderCombat();
        },
      }, icon('game-icons:running-ninja', 'icon-sm'), 'Flee'));
    }

    scene.appendChild(controls);
  }

  renderCombat();
  container.appendChild(scene);
}, () => {
  // Cleanup
  if (combatState?.intervalId) {
    clearInterval(combatState.intervalId);
  }
  combatState = null;
});
