// Icon utility: converts @iconify-json/game-icons SVGs to data URLs for KAPLAY sprites
import icons from "@iconify-json/game-icons/icons.json";

/**
 * Get an SVG data URL for a game-icons icon by name.
 * Icon names use the iconify format without prefix, e.g. "crossed-swords", "heart-organ", etc.
 */
export function getIconSvg(name: string, color = "#ffffff", size = 64): string {
  const iconData = (icons.icons as Record<string, { body: string }>)[name];
  if (!iconData) {
    console.warn(`Icon not found: ${name}`);
    return createFallbackSvg(color, size);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
    <g fill="${color}">${iconData.body}</g>
  </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function createFallbackSvg(color: string, size: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
    <rect x="8" y="8" width="48" height="48" rx="8" fill="${color}" opacity="0.3"/>
    <text x="32" y="40" text-anchor="middle" font-size="24" fill="${color}">?</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Load an icon as a KAPLAY sprite. Call during scene setup. */
export async function loadIconSprite(
  k: { loadSprite: (name: string, src: string) => void },
  spriteName: string,
  iconName: string,
  color = "#ffffff",
  size = 64
): Promise<void> {
  const url = getIconSvg(iconName, color, size);
  k.loadSprite(spriteName, url);
}

// Common icon mappings for the game
export const GAME_ICONS = {
  // Room types
  combat: "crossed-swords",
  elite: "skull-crossed-bones",
  forge: "anvil",
  rest: "campfire",
  event: "scroll-unfurled",
  boss: "dragon-head",
  dialogue: "conversation",
  treasure: "chest",
  start: "doorway",

  // UI
  heart: "hearts",
  mana: "lightning-helix",
  shield: "shield",
  crystal: "crystal-growth",
  sword: "broadsword",
  potion: "potion-ball",

  // Enemies
  goblin: "goblin-head",
  skeleton: "skull-signet",
  slime: "gooey-daemon",
  dragon: "dragon-head",
  ghost: "ghost",
  bat: "bat-wing",

  // Runes / Elements
  fire: "fire",
  ice: "ice-bolt",
  lightning: "lightning-bolt",
  poison: "poison-bottle",
  arcane: "magic-swirl",

  // Actions
  run: "running-shoe",
  bag: "knapsack",
  spell: "spell-book",
  fight: "sword-clash",
} as const;
