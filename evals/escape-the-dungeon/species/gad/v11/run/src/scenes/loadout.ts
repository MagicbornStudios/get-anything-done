import { registerScene, el, icon } from '../renderer';
import { getState, setScene, showToast, saveGame } from '../state';
import { createHUD } from '../hud';
import type { Spell, PhysicalSkill, ActionPolicy } from '../types';

registerScene('loadout', (container) => {
  const state = getState();
  const p = state.player;

  container.appendChild(createHUD());

  const scene = el('div', { className: 'char-sheet' });

  function renderLoadout() {
    scene.innerHTML = '';

    const main = el('div', { className: 'char-main' });

    main.appendChild(el('div', { className: 'panel-header' },
      el('h2', {}, icon('game-icons:spell-book', 'icon-lg'), ' Loadout & Policies'),
      el('button', { className: 'btn btn-sm', onclick: () => setScene('map') }, 'Back'),
    ));

    // Spell Loadout (R-v5.07 — 4 slots)
    const spellSection = el('div', { className: 'panel' });
    spellSection.appendChild(el('h3', {}, `Spell Loadout (${p.spellLoadout.filter(Boolean).length}/4)`));
    spellSection.appendChild(el('p', { style: { fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px' } },
      'Equipped spells are used in auto-combat based on action policies.'));

    const spellSlots = el('div', { className: 'loadout-slots' });
    for (let i = 0; i < 4; i++) {
      const spell = p.spellLoadout[i];
      spellSlots.appendChild(el('div', {
        className: `loadout-slot ${spell ? 'filled' : ''}`,
        onclick: () => {
          if (spell) {
            p.spellLoadout[i] = null;
            saveGame();
            renderLoadout();
          }
        },
      },
        spell ? el('span', { style: { fontSize: '9px', textAlign: 'center' } },
          icon(spell.icon, 'icon-sm'), el('br', {}), spell.name) :
          el('span', { style: { fontSize: '10px', color: 'var(--text-dim)' } }, `${i + 1}`),
      ));
    }
    spellSection.appendChild(spellSlots);

    // All known spells to equip
    spellSection.appendChild(el('div', { style: { marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' } },
      ...p.spells.map(spell => {
        const equipped = p.spellLoadout.some(s => s?.id === spell.id);
        return el('button', {
          className: `btn btn-sm ${equipped ? 'btn-gold' : ''}`,
          onclick: () => {
            if (equipped) {
              const idx = p.spellLoadout.findIndex(s => s?.id === spell.id);
              if (idx !== -1) p.spellLoadout[idx] = null;
            } else {
              const emptyIdx = p.spellLoadout.indexOf(null);
              if (emptyIdx !== -1) {
                p.spellLoadout[emptyIdx] = spell;
              } else {
                showToast('All spell slots full — remove one first', 'danger');
                return;
              }
            }
            saveGame();
            renderLoadout();
          },
        }, icon(spell.icon, 'icon-sm'), `${spell.name} (${spell.manaCost}MP)`);
      }),
    ));
    main.appendChild(spellSection);

    // Skill Loadout (R-v5.07 — 3 slots)
    const skillSection = el('div', { className: 'panel' });
    skillSection.appendChild(el('h3', {}, `Physical Skill Loadout (${p.skillLoadout.filter(Boolean).length}/3)`));
    skillSection.appendChild(el('p', { style: { fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px' } },
      'Physical skills use Stamina instead of Mana.'));

    const skillSlots = el('div', { className: 'loadout-slots' });
    for (let i = 0; i < 3; i++) {
      const skill = p.skillLoadout[i];
      skillSlots.appendChild(el('div', {
        className: `loadout-slot ${skill ? 'filled' : ''}`,
        onclick: () => {
          if (skill) {
            p.skillLoadout[i] = null;
            saveGame();
            renderLoadout();
          }
        },
      },
        skill ? el('span', { style: { fontSize: '9px', textAlign: 'center' } },
          icon(skill.icon, 'icon-sm'), el('br', {}), skill.name) :
          el('span', { style: { fontSize: '10px', color: 'var(--text-dim)' } }, `${i + 1}`),
      ));
    }
    skillSection.appendChild(skillSlots);

    // Unlocked skills to equip
    const unlocked = p.physicalSkills.filter(s => s.unlocked);
    skillSection.appendChild(el('div', { style: { marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' } },
      ...unlocked.map(skill => {
        const equipped = p.skillLoadout.some(s => s?.id === skill.id);
        return el('button', {
          className: `btn btn-sm ${equipped ? 'btn-gold' : ''}`,
          onclick: () => {
            if (equipped) {
              const idx = p.skillLoadout.findIndex(s => s?.id === skill.id);
              if (idx !== -1) p.skillLoadout[idx] = null;
            } else {
              const emptyIdx = p.skillLoadout.indexOf(null);
              if (emptyIdx !== -1) {
                p.skillLoadout[emptyIdx] = skill;
              } else {
                showToast('All skill slots full — remove one first', 'danger');
                return;
              }
            }
            saveGame();
            renderLoadout();
          },
        }, icon(skill.icon, 'icon-sm'), `${skill.name} (${skill.staminaCost}SP)`);
      }),
    ));
    main.appendChild(skillSection);

    // Action Policies (R-v5.13)
    const policySection = el('div', { className: 'panel' });
    policySection.appendChild(el('h3', {}, 'Action Policies (Auto-Combat Rules)'));
    policySection.appendChild(el('p', { style: { fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px' } },
      'Combat resolves automatically. Policies determine what actions your hero takes. Lower priority = checked first.'));

    const policyEditor = el('div', { className: 'policy-editor' });
    const sortedPolicies = [...p.actionPolicies].sort((a, b) => a.priority - b.priority);

    for (const policy of sortedPolicies) {
      const row = el('div', { className: 'policy-rule' },
        el('span', { style: { minWidth: '40px', color: 'var(--accent-gold)', fontWeight: '600' } }, `#${policy.priority}`),
        el('span', { style: { minWidth: '140px' } }, `IF ${formatCondition(policy.condition)}`),
        el('span', { style: { color: 'var(--accent-ice)' } }, `THEN ${formatAction(policy.action)}`),
        el('button', {
          className: 'btn btn-sm',
          onclick: () => {
            // Move priority up (lower number)
            policy.priority = Math.max(1, policy.priority - 1);
            saveGame();
            renderLoadout();
          },
        }, '\u2191'),
        el('button', {
          className: 'btn btn-sm',
          onclick: () => {
            policy.priority++;
            saveGame();
            renderLoadout();
          },
        }, '\u2193'),
      );
      policyEditor.appendChild(row);
    }

    policySection.appendChild(policyEditor);
    main.appendChild(policySection);

    scene.appendChild(main);
  }

  renderLoadout();
  container.appendChild(scene);
});

function formatCondition(c: string): string {
  const map: Record<string, string> = {
    hp_below_30: 'HP below 30%',
    enemy_has_weakness: 'Enemy has elemental weakness',
    has_mana: 'Have enough mana',
    has_stamina: 'Have enough stamina',
    always: 'Always (fallback)',
  };
  return map[c] || c;
}

function formatAction(a: string): string {
  const map: Record<string, string> = {
    heal: 'Use Health Potion',
    exploit_weakness: 'Cast spell that exploits weakness',
    use_spell: 'Cast equipped spell',
    use_skill: 'Use physical skill',
    attack: 'Basic attack',
  };
  return map[a] || a;
}
