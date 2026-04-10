import { registerScene, el, icon, barHTML } from '../renderer';
import { getState, setScene, unlockSkill, saveGame, showToast } from '../state';
import { createHUD } from '../hud';

registerScene('character', (container) => {
  const state = getState();
  const p = state.player;
  const s = p.stats;

  container.appendChild(createHUD());

  const scene = el('div', { className: 'char-sheet' });

  const main = el('div', { className: 'char-main' });

  // Header
  main.appendChild(el('div', { className: 'panel-header' },
    el('h2', {}, icon('game-icons:character', 'icon-lg'), ` ${p.name} — Level ${s.level}`),
    el('button', { className: 'btn btn-sm', onclick: () => setScene('map') }, 'Back'),
  ));

  // Combat Stats
  const statsPanel = el('div', { className: 'panel' });
  statsPanel.appendChild(el('h3', {}, 'Combat Stats'));
  const statRows: [string, number, string][] = [
    ['Attack', s.attack, 'game-icons:sword-brandish'],
    ['Defense', s.defense, 'game-icons:shield-reflect'],
    ['Speed', s.speed, 'game-icons:running-ninja'],
    ['Level', s.level, 'game-icons:level-four-advanced'],
  ];
  for (const [name, val, ic] of statRows) {
    statsPanel.appendChild(el('div', { className: 'stat-row' },
      el('span', { style: { display: 'flex', alignItems: 'center', gap: '4px' } }, icon(ic, 'icon-sm'), name),
      el('span', { className: 'stat-val' }, String(val)),
    ));
  }
  // Resource bars
  statsPanel.appendChild(el('div', { style: { marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' } },
    barHTML(s.hp, s.maxHp, 'bar-hp', `HP ${s.hp}/${s.maxHp}`),
    barHTML(s.mana, s.maxMana, 'bar-mana', `MP ${s.mana}/${s.maxMana}`),
    barHTML(s.stamina, s.maxStamina, 'bar-stamina', `SP ${s.stamina}/${s.maxStamina}`),
    barHTML(s.xp, s.xpToLevel, 'bar-xp', `XP ${s.xp}/${s.xpToLevel}`),
  ));
  main.appendChild(statsPanel);

  // Traits (R-v5.14 — visible numeric values)
  const traitsPanel = el('div', { className: 'panel' });
  traitsPanel.appendChild(el('h3', {}, 'Traits'));
  for (const [key, val] of Object.entries(p.traits)) {
    const v = val as number;
    const color = v > 0.6 ? 'var(--accent-fire)' : v > 0.3 ? 'var(--accent-gold)' : 'var(--accent-ice)';
    traitsPanel.appendChild(el('div', { className: 'trait-row' },
      el('span', {}, key.replace(/([A-Z])/g, ' $1').trim()),
      el('span', { style: { color, fontWeight: '600' } }, v.toFixed(2)),
      el('div', { className: 'trait-bar' },
        el('div', { className: 'trait-bar-fill', style: { width: `${v * 100}%`, background: color } }),
      ),
    ));
  }
  main.appendChild(traitsPanel);

  // Equipment
  const equipPanel = el('div', { className: 'panel' });
  equipPanel.appendChild(el('h3', {}, 'Equipment'));
  const slots = el('div', { className: 'equip-slots' });
  for (const [slotName, item] of Object.entries(p.equipment) as [string, any][]) {
    slots.appendChild(el('div', { className: `equip-slot ${item ? 'filled' : ''}` },
      item ? icon(item.icon, 'icon-sm') : icon('game-icons:perspective-dice-five', 'icon-sm'),
      el('div', {},
        el('div', { className: 'slot-label' }, slotName),
        el('div', { style: { fontSize: '12px' } }, item ? item.name : 'Empty'),
      ),
    ));
  }
  equipPanel.appendChild(slots);
  main.appendChild(equipPanel);

  // Known Spells
  const spellPanel = el('div', { className: 'panel' });
  spellPanel.appendChild(el('h3', {}, `Known Spells (${p.spells.length})`));
  for (const spell of p.spells) {
    spellPanel.appendChild(el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', borderBottom: '1px solid var(--border)' } },
      icon(spell.icon, 'icon-sm'),
      el('span', { style: { fontWeight: '600', fontSize: '12px' } }, spell.name),
      el('span', { style: { fontSize: '11px', color: 'var(--text-dim)' } }, `T${spell.tier} | ${spell.elements.join(',')} | ${spell.manaCost} MP | ${spell.power} pow`),
    ));
  }
  main.appendChild(spellPanel);

  scene.appendChild(main);

  // Sidebar — Skill Tree
  const sidebar = el('div', { className: 'char-sidebar' });
  sidebar.appendChild(el('h3', { style: { marginBottom: '8px' } }, 'Physical Skill Tree'));
  sidebar.appendChild(el('p', { style: { fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px' } },
    'Skills cost Stamina (not Mana). Unlock with XP.'));

  const tree = el('div', { className: 'skill-tree-grid' });
  for (const skill of p.physicalSkills) {
    const canUnlock = !skill.unlocked && skill.prerequisites.every(
      pid => p.physicalSkills.find(s => s.id === pid)?.unlocked
    );
    const node = el('div', {
      className: `skill-node ${skill.unlocked ? 'unlocked' : canUnlock ? '' : 'locked'}`,
      onclick: () => {
        if (canUnlock) {
          // Cost: 15 XP per tier
          const cost = skill.tier * 15;
          if (s.xp >= cost) {
            s.xp -= cost;
            unlockSkill(skill.id);
            saveGame();
            setScene('character');
          } else {
            showToast(`Need ${cost} XP to unlock (have ${s.xp})`, 'danger');
          }
        }
      },
    },
      icon(skill.icon),
      el('div', { className: 'skill-name' }, skill.name),
      el('div', { style: { fontSize: '10px', color: 'var(--text-dim)' } }, `${skill.staminaCost} SP`),
      !skill.unlocked ? el('div', { className: 'skill-cost' }, canUnlock ? `Unlock: ${skill.tier * 15} XP` : 'Locked') : el('div', { style: { fontSize: '10px', color: 'var(--accent-heal)' } }, 'Unlocked'),
    );
    tree.appendChild(node);
  }
  sidebar.appendChild(tree);

  // Affinities
  sidebar.appendChild(el('h3', { style: { marginTop: '16px', marginBottom: '8px' } }, 'Rune Affinities'));
  for (const rune of p.runes.filter(r => r.discovered)) {
    sidebar.appendChild(el('div', { className: 'affinity-row' },
      icon(rune.icon, 'icon-sm'),
      el('span', { className: `elem-${rune.element}`, style: { fontSize: '11px', minWidth: '60px' } }, rune.name),
      el('div', { style: { flex: '1' } }, barHTML(rune.affinityLevel, 100, 'bar-xp')),
    ));
  }

  scene.appendChild(sidebar);
  container.appendChild(scene);
});
