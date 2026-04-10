import { NPC, GameState } from '../types';

export function createNPCs(): NPC[] {
  return [
    {
      id: 'npc-hermit',
      name: 'Grizzled Hermit',
      icon: 'game-icons:hooded-figure',
      traits: { aggression: 0.2, compassion: 0.6, arcaneAffinity: 0.4, cunning: 0.5, resilience: 0.7 },
      met: false,
      dialogue: [
        {
          id: 'start',
          text: "Hmm... another soul trapped in these depths. I've been here longer than I can remember. I know the secrets of the runes, if you're interested.",
          choices: [
            {
              text: "Please teach me about the runes. (Compassionate)",
              nextId: 'teach',
              traitShift: { compassion: 0.1 },
            },
            {
              text: "Hand over what you know, old man. (Aggressive)",
              nextId: 'threaten',
              traitShift: { aggression: 0.15, compassion: -0.1 },
            },
            {
              text: "What's in it for me? (Cunning)",
              nextId: 'bargain',
              traitShift: { cunning: 0.1 },
            },
          ],
        },
        {
          id: 'teach',
          text: "A kind heart in these dark halls... rare indeed. Here, take this rune. It channels the storms themselves. Use it wisely.",
          choices: [
            {
              text: "Thank you, elder.",
              effect: (state: GameState) => {
                const rune = state.player.discoveredRunes.find(r => r.id === 'rune-lightning');
                if (rune) rune.discovered = true;
                addNotification(state, 'Discovered: Voltus Rune (Lightning)!', 'reward');
              },
            },
          ],
        },
        {
          id: 'threaten',
          text: "Violence? Here? ...Fine. Take this and go. But know that the dungeon remembers cruelty.",
          choices: [
            {
              text: "Whatever.",
              effect: (state: GameState) => {
                const rune = state.player.discoveredRunes.find(r => r.id === 'rune-lightning');
                if (rune) rune.discovered = true;
                state.player.traits.aggression = Math.min(1, state.player.traits.aggression + 0.1);
                addNotification(state, 'Discovered: Voltus Rune (Lightning). +0.1 Aggression.', 'reward');
              },
            },
          ],
        },
        {
          id: 'bargain',
          text: "Sharp one, aren't you? I'll trade: bring me a Stone Chunk from the golems, and I'll give you a rune AND teach you a trick.",
          choices: [
            {
              text: "Deal. I'll be back.",
              effect: (state: GameState) => {
                const hasStone = state.player.inventory.find(i => i.name === 'Stone Chunk');
                if (hasStone) {
                  hasStone.quantity--;
                  if (hasStone.quantity <= 0) {
                    state.player.inventory = state.player.inventory.filter(i => i !== hasStone);
                  }
                  const rune = state.player.discoveredRunes.find(r => r.id === 'rune-lightning');
                  if (rune) rune.discovered = true;
                  state.player.gold += 20;
                  addNotification(state, 'Traded Stone Chunk! Got: Voltus Rune + 20 gold.', 'reward');
                } else {
                  addNotification(state, 'You need a Stone Chunk to trade. Come back later.', 'info');
                }
              },
            },
            {
              text: "Nevermind.",
            },
          ],
        },
      ],
    },
    {
      id: 'npc-witch',
      name: 'Shadow Witch Morvyn',
      icon: 'game-icons:witch-face',
      traits: { aggression: 0.4, compassion: 0.3, arcaneAffinity: 0.9, cunning: 0.7, resilience: 0.5 },
      met: false,
      dialogue: [
        {
          id: 'start',
          text: "The shadows told me you'd come. I am Morvyn, keeper of the dark arts. The Umbra Rune calls to you... but shadow magic has a price.",
          choices: [
            {
              text: "I'll pay any price for power. (Arcane)",
              nextId: 'accept-shadow',
              traitShift: { arcaneAffinity: 0.15, resilience: -0.05 },
            },
            {
              text: "What kind of price? (Cautious)",
              nextId: 'cautious',
              traitShift: { cunning: 0.1 },
            },
            {
              text: "Shadow magic is dangerous. No thanks. (Resilient)",
              nextId: 'refuse',
              traitShift: { resilience: 0.1 },
            },
          ],
        },
        {
          id: 'accept-shadow',
          text: "Bold. The shadows favor the fearless. Take the Umbra Rune. But beware: use it too freely and the Void Empress will sense you.",
          choices: [
            {
              text: "I understand.",
              effect: (state: GameState) => {
                const rune = state.player.discoveredRunes.find(r => r.id === 'rune-shadow');
                if (rune) rune.discovered = true;
                state.player.hp = Math.max(1, state.player.hp - 10);
                addNotification(state, 'Discovered: Umbra Rune (Shadow)! Lost 10 HP from the dark pact.', 'reward');
              },
            },
          ],
        },
        {
          id: 'cautious',
          text: "Smart. The price is a piece of your vitality. 10 HP, permanently until you rest. But the shadow arts can bypass the Crystal Guardian's defenses entirely.",
          choices: [
            {
              text: "Worth it. Give me the rune.",
              effect: (state: GameState) => {
                const rune = state.player.discoveredRunes.find(r => r.id === 'rune-shadow');
                if (rune) rune.discovered = true;
                state.player.hp = Math.max(1, state.player.hp - 10);
                addNotification(state, 'Discovered: Umbra Rune (Shadow)! Cost: 10 HP.', 'reward');
              },
            },
            {
              text: "Too steep. I'll pass.",
            },
          ],
        },
        {
          id: 'refuse',
          text: "Hmph. Resilience without ambition is just stubbornness. Go, then. But you'll be back when the deep halls swallow your light spells whole.",
          choices: [
            {
              text: "We'll see about that.",
              effect: (state: GameState) => {
                state.player.traits.resilience = Math.min(1, state.player.traits.resilience + 0.1);
                addNotification(state, '+0.1 Resilience. Morvyn respects your conviction.', 'trait');
              },
            },
          ],
        },
      ],
    },
    {
      id: 'npc-spirit',
      name: 'Ancient Spirit Lyra',
      icon: 'game-icons:fairy',
      traits: { aggression: 0.1, compassion: 0.8, arcaneAffinity: 0.7, cunning: 0.3, resilience: 0.6 },
      met: false,
      dialogue: [
        {
          id: 'start',
          text: "I am Lyra, bound to this place since before the dungeon swallowed the light. I sense the runes within you... but do you understand their true nature?",
          choices: [
            {
              text: "Teach me about rune harmony. (Compassionate)",
              nextId: 'teach-harmony',
              traitShift: { compassion: 0.1, arcaneAffinity: 0.05 },
            },
            {
              text: "Can you help me fight the Void Empress? (Direct)",
              nextId: 'fight-help',
              traitShift: { aggression: 0.05 },
            },
            {
              text: "Are you trapped here too? (Empathetic)",
              nextId: 'empathy',
              traitShift: { compassion: 0.15 },
            },
          ],
        },
        {
          id: 'teach-harmony',
          text: "When runes of opposing elements merge, they create something neither could alone. Take this Nature rune — it is the opposite of shadow, the antidote to the Empress's power.",
          choices: [
            {
              text: "Thank you, Lyra.",
              effect: (state: GameState) => {
                const rune = state.player.discoveredRunes.find(r => r.id === 'rune-nature');
                if (rune) rune.discovered = true;
                state.player.affinities.nature = Math.min(100, (state.player.affinities.nature || 0) + 10);
                addNotification(state, 'Discovered: Verdis Rune (Nature)! +10 Nature affinity.', 'reward');
              },
            },
          ],
        },
        {
          id: 'fight-help',
          text: "The Empress... she was once like me. A spirit of this place. But she consumed too much void energy. To defeat her, you need nature-infused spells. Take this.",
          choices: [
            {
              text: "I'll end her reign.",
              effect: (state: GameState) => {
                const rune = state.player.discoveredRunes.find(r => r.id === 'rune-nature');
                if (rune) rune.discovered = true;
                addNotification(state, 'Discovered: Verdis Rune (Nature)! Lyra whispers: "Combine it with another element..."', 'reward');
              },
            },
          ],
        },
        {
          id: 'empathy',
          text: "Yes... for centuries. But your kindness gives me hope. Take both my gifts — a rune of nature, and a blessing of the ancients.",
          choices: [
            {
              text: "I'll free you if I can.",
              effect: (state: GameState) => {
                const rune = state.player.discoveredRunes.find(r => r.id === 'rune-nature');
                if (rune) rune.discovered = true;
                state.player.maxHp += 10;
                state.player.hp += 10;
                state.player.affinities.nature = Math.min(100, (state.player.affinities.nature || 0) + 15);
                addNotification(state, 'Discovered: Verdis Rune! +10 max HP! +15 Nature affinity! Lyra blesses you.', 'reward');
              },
            },
          ],
        },
      ],
    },
  ];
}

function addNotification(state: GameState, text: string, type: string) {
  state.notifications.push({
    text,
    type,
    id: state.nextNotifId++,
    expires: Date.now() + 4000,
  });
}
