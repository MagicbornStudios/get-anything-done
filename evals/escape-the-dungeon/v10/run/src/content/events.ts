import type { GameEvent } from "../types";

export const EVENTS: Record<string, GameEvent> = {
  scholar: {
    id: "scholar",
    npcName: "Vellin the Bound",
    portrait: "game-icons:wizard-face",
    text:
      "A gaunt scholar, wrists chained to a lectern. He watches you with hollow eyes. " +
      "'You — you still have spells. Please. I'll trade, if you free me, or if you don't. " +
      "The Warden above cannot be struck by blade or bolt. It can only be rotted. " +
      "Take this — take it and live.'",
    choices: [
      {
        label: "Free him and take the Tox rune.",
        outcome: "He unfurls the chains with a word, presses a blighted rune into your palm, and vanishes into the dark.",
        effect: (s) => {
          if (!s.knownRunes.includes("rune_tox")) s.knownRunes.push("rune_tox");
          s.narrativeStats.Empathy = (s.narrativeStats.Empathy ?? 0) + 1;
          s.log.push("[info] Gained rune: Tox.");
        },
      },
      {
        label: "Take the rune without freeing him.",
        outcome: "You pluck the rune from his palm. He says nothing. His chains rattle once.",
        effect: (s) => {
          if (!s.knownRunes.includes("rune_tox")) s.knownRunes.push("rune_tox");
          s.crystals += 5;
          s.narrativeStats.Guile = (s.narrativeStats.Guile ?? 0) + 1;
          s.log.push("[info] Gained rune: Tox. +5 crystals.");
        },
      },
      {
        label: "Ask about the Pyre Lich.",
        outcome: "'Fire only feeds it. Steel only returns to you. Rot — only rot endures in mirrored places.' He says nothing more.",
        effect: (s) => {
          s.narrativeStats.Comprehension = (s.narrativeStats.Comprehension ?? 0) + 1;
          s.log.push("[info] You learned something true.");
        },
      },
    ],
  },
};
