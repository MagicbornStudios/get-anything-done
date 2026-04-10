// Reusable HTML component helpers
import { ElementType, Spell, PhysicalSkill, Item, Equipment } from '../types';

export function icon(name: string, size: number = 20): string {
  return `<iconify-icon icon="${name}" width="${size}" height="${size}"></iconify-icon>`;
}

export function bar(current: number, max: number, cssClass: string, width: string = '100px'): string {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0;
  return `
    <div class="bar-container ${cssClass}" style="width:${width}">
      <div class="bar-fill" style="width:${pct}%"></div>
      <div class="bar-text">${current}/${max}</div>
    </div>
  `;
}

export function elementTag(el: ElementType): string {
  return `<span class="element-tag el-${el}">${icon(getElementIcon(el), 12)} ${el}</span>`;
}

export function getElementIcon(el: ElementType): string {
  const icons: Record<ElementType, string> = {
    fire: 'game-icons:fire',
    ice: 'game-icons:snowflake-1',
    lightning: 'game-icons:lightning-bolt',
    shadow: 'game-icons:death-skull',
    nature: 'game-icons:oak-leaf',
    arcane: 'game-icons:crystal-ball',
  };
  return icons[el] || 'game-icons:magic-swirl';
}

export function getElementColor(el: ElementType): string {
  const colors: Record<ElementType, string> = {
    fire: 'var(--fire)',
    ice: 'var(--ice)',
    lightning: 'var(--lightning)',
    shadow: 'var(--shadow)',
    nature: 'var(--nature)',
    arcane: 'var(--arcane)',
  };
  return colors[el] || 'var(--text)';
}

export function spellCard(spell: Spell, selected: boolean = false, onClick?: string): string {
  const els = spell.elements.map(e => elementTag(e as ElementType)).join(' ');
  const effectText = spell.effect ? `<div style="font-size:10px;color:var(--text-dim);">${spell.effect.type}${spell.effect.value ? ': ' + spell.effect.value : ''}${spell.effect.duration ? ' (' + spell.effect.duration + 't)' : ''}</div>` : '';
  return `
    <div class="spell-card ${selected ? 'selected' : ''}" ${onClick ? `onclick="${onClick}"` : ''}>
      <div style="font-size:24px;margin-bottom:4px">${icon(getSpellIcon(spell), 24)}</div>
      <div style="font-weight:600;font-size:12px">${spell.name}</div>
      <div style="font-size:11px;color:var(--text-dim)">${spell.damage > 0 ? spell.damage + ' dmg' : ''} ${spell.manaCost} mana</div>
      <div style="margin-top:4px">${els}</div>
      ${effectText}
      ${spell.isCrafted ? '<div style="font-size:9px;color:var(--accent-light);margin-top:2px">CRAFTED</div>' : ''}
    </div>
  `;
}

function getSpellIcon(spell: Spell): string {
  if (spell.elements.includes('fire')) return 'game-icons:fire-spell-cast';
  if (spell.elements.includes('ice')) return 'game-icons:ice-spell-cast';
  if (spell.elements.includes('lightning')) return 'game-icons:lightning-storm';
  if (spell.elements.includes('shadow')) return 'game-icons:death-zone';
  if (spell.elements.includes('nature')) return 'game-icons:leaf-swirl';
  if (spell.elements.includes('arcane')) return 'game-icons:magic-swirl';
  return 'game-icons:spell-book';
}

export function skillCard(skill: PhysicalSkill): string {
  return `
    <div class="spell-card">
      <div style="font-size:24px;margin-bottom:4px">${icon('game-icons:sword-brandish', 24)}</div>
      <div style="font-weight:600;font-size:12px">${skill.name}</div>
      <div style="font-size:11px;color:var(--text-dim)">${skill.damage > 0 ? skill.damage + ' dmg' : 'Utility'} ${skill.staminaCost} sta</div>
      <div style="font-size:10px;color:var(--accent-light)">Lv.${skill.level}</div>
    </div>
  `;
}

export function itemCard(item: Item, action?: string): string {
  const iconName = item.icon || 'game-icons:swap-bag';
  return `
    <div class="item-card" ${action ? `onclick="${action}"` : ''}>
      <div style="font-size:20px">${icon(iconName, 20)}</div>
      <div style="font-weight:600;font-size:11px">${item.name}${item.quantity > 1 ? ' x' + item.quantity : ''}</div>
      <div style="font-size:10px;color:var(--gold)">${item.value}g</div>
    </div>
  `;
}

export function getRoomTypeColor(type: string): string {
  const colors: Record<string, string> = {
    combat: 'var(--danger)',
    elite: '#ff6600',
    forge: 'var(--fire)',
    rest: 'var(--nature)',
    event: 'var(--warning)',
    merchant: 'var(--gold)',
    boss: '#ff0066',
    training: 'var(--info)',
  };
  return colors[type] || 'var(--text-dim)';
}

export function getTraitColor(trait: string): string {
  const colors: Record<string, string> = {
    aggression: 'var(--danger)',
    compassion: 'var(--nature)',
    arcaneAffinity: 'var(--arcane)',
    cunning: 'var(--warning)',
    resilience: 'var(--info)',
  };
  return colors[trait] || 'var(--text)';
}
