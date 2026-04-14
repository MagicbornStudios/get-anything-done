export interface Item {
  id: string;
  name: string;
  icon: string;
  description: string;
  type: "consumable" | "key" | "currency";
  effect?: ItemEffect;
  value?: number; // sell/buy price in crystals
}

export interface ItemEffect {
  type: "heal_hp" | "heal_mana" | "buff_might" | "buff_defense" | "cure_status";
  amount: number;
  duration?: number;
}

export const ITEMS: Record<string, Item> = {
  health_potion: {
    id: "health_potion",
    name: "Health Potion",
    icon: "🧴",
    description: "Restores 30 HP",
    type: "consumable",
    effect: { type: "heal_hp", amount: 30 },
    value: 8,
  },
  mana_potion: {
    id: "mana_potion",
    name: "Mana Potion",
    icon: "💧",
    description: "Restores 20 Mana",
    type: "consumable",
    effect: { type: "heal_mana", amount: 20 },
    value: 10,
  },
  might_elixir: {
    id: "might_elixir",
    name: "Might Elixir",
    icon: "💪",
    description: "Boosts Might by 5 for 3 turns",
    type: "consumable",
    effect: { type: "buff_might", amount: 5, duration: 3 },
    value: 15,
  },
  shield_potion: {
    id: "shield_potion",
    name: "Shield Potion",
    icon: "🛡️",
    description: "Boosts Defense by 5 for 3 turns",
    type: "consumable",
    effect: { type: "buff_defense", amount: 5, duration: 3 },
    value: 15,
  },
  antidote: {
    id: "antidote",
    name: "Antidote",
    icon: "🌿",
    description: "Cures poison and status effects",
    type: "consumable",
    effect: { type: "cure_status", amount: 0 },
    value: 6,
  },
  golden_crystal: {
    id: "golden_crystal",
    name: "Golden Crystal",
    icon: "💛",
    description: "A rare crystal of immense power. Worth 50 crystals.",
    type: "currency",
    value: 50,
  },
};
