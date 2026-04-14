export interface EventChoice {
  text: string;
  requires?: { stat?: string; minValue?: number; itemId?: string };
  outcome: EventOutcome;
}

export interface EventOutcome {
  text: string;
  effects: EventEffect[];
}

export interface EventEffect {
  type: "give_item" | "heal_hp" | "heal_mana" | "give_crystals" | "give_xp" | "damage_hp" | "give_rune_affinity";
  itemId?: string;
  count?: number;
  amount?: number;
  runeId?: string;
}

export interface GameEvent {
  id: string;
  npcName: string;
  npcPortrait: string;
  greeting: string;
  choices: EventChoice[];
}

export const EVENTS: Record<string, GameEvent> = {
  hermit_advice: {
    id: "hermit_advice",
    npcName: "Old Hermit",
    npcPortrait: "🧙",
    greeting: "\"Ah, another adventurer. These stone creatures won't fall to mere swords, you know. Visit the forge — combine runes to craft spells that exploit their weaknesses. Fire melts stone. Poison eats through it. Your fists? Useless here.\"",
    choices: [
      {
        text: "\"Thanks for the advice.\" (Receive a health potion)",
        outcome: {
          text: "The hermit nods and hands you a small vial. \"You'll need this more than I do.\"",
          effects: [
            { type: "give_item", itemId: "health_potion", count: 1 },
          ],
        },
      },
      {
        text: "\"Tell me about the runes.\" (Gain rune affinity boost)",
        outcome: {
          text: "\"Each rune holds an elemental essence. Combine two at the forge to create a spell. Fire + Poison? Toxic Flame — melts through armor. Experiment! The forge remembers what you learn.\"",
          effects: [
            { type: "give_rune_affinity", runeId: "rune_ignis", amount: 1 },
            { type: "give_rune_affinity", runeId: "rune_venenum", amount: 1 },
          ],
        },
      },
      {
        text: "\"I don't need help.\" (Leave)",
        outcome: {
          text: "The hermit shrugs. \"Pride is a fine weapon, until it isn't.\"",
          effects: [],
        },
      },
    ],
  },
  shadow_merchant: {
    id: "shadow_merchant",
    npcName: "Shadow Merchant",
    npcPortrait: "🎭",
    greeting: "\"Welcome, mortal. I trade in things of... value. The creatures here feed on magic — your mana is their feast. Stock up, or perish in darkness.\"",
    choices: [
      {
        text: "Buy Health Potion (8 crystals)",
        requires: { stat: "crystals", minValue: 8 },
        outcome: {
          text: "The merchant slides a vial across the counter. \"Use it wisely.\"",
          effects: [
            { type: "give_item", itemId: "health_potion", count: 1 },
            { type: "give_crystals", amount: -8 },
          ],
        },
      },
      {
        text: "Buy Mana Potion (10 crystals)",
        requires: { stat: "crystals", minValue: 10 },
        outcome: {
          text: "\"Liquid starlight. It'll keep the void from draining you dry.\"",
          effects: [
            { type: "give_item", itemId: "mana_potion", count: 1 },
            { type: "give_crystals", amount: -10 },
          ],
        },
      },
      {
        text: "Buy Shield Potion (15 crystals)",
        requires: { stat: "crystals", minValue: 15 },
        outcome: {
          text: "\"A barrier of solid shadow. It won't last forever, but it might keep you alive.\"",
          effects: [
            { type: "give_item", itemId: "shield_potion", count: 1 },
            { type: "give_crystals", amount: -15 },
          ],
        },
      },
      {
        text: "\"I'll pass.\" (Leave)",
        outcome: {
          text: "\"Come back when the void has humbled you.\"",
          effects: [],
        },
      },
    ],
  },
};
