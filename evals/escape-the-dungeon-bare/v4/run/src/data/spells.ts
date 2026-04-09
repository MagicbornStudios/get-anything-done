import type { SpellEffect, SpellElement } from "./runes";

// A spell instance the player has in their spellbook
export interface PlayerSpell {
  id: string;
  name: string;
  icon: string;
  manaCost: number;
  effects: SpellEffect[];
  description: string;
  crafted: boolean;       // was this crafted at the forge?
  runeIds?: string[];     // which runes were used
  element: SpellElement;  // primary element for UI coloring
}

// Starter spells - deliberately weak to force forge usage
export const STARTER_SPELLS: PlayerSpell[] = [
  {
    id: "spark",
    name: "Spark",
    icon: "✨",
    manaCost: 5,
    effects: [{ type: "damage", element: "arcane", power: 12, description: "Weak arcane damage" }],
    description: "A basic spark of magic. Weak but cheap.",
    crafted: false,
    element: "arcane",
  },
  {
    id: "minor_heal",
    name: "Minor Heal",
    icon: "💚",
    manaCost: 8,
    effects: [{ type: "heal", element: "holy", power: 20, description: "Restores 20 HP" }],
    description: "A small healing spell.",
    crafted: false,
    element: "holy",
  },
];
