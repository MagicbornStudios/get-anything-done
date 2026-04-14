// SVG icon system for visual quality (G3 gate)
// Using inline SVGs for game icons - coherent dark fantasy style

const ICONS: Record<string, string> = {
  // Room type icons
  "combat": `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 24L24 8M8 8l4 4M20 20l4 4"/><circle cx="6" cy="6" r="3"/><circle cx="26" cy="26" r="3"/></svg>`,
  "dialogue": `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="24" height="16" rx="3"/><path d="M12 22l-4 6v-6"/></svg>`,
  "treasure": `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="14" width="20" height="12" rx="2"/><path d="M6 14l4-6h12l4 6M16 14v12M12 20h8"/></svg>`,
  "rest": `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 24c0-6 4-10 10-10 0 6-4 10-10 10z"/><path d="M16 20V8"/><path d="M12 12l4-4 4 4"/></svg>`,
  "rune_forge": `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4l4 8h-8l4-8z"/><path d="M8 16h16"/><path d="M10 20l6 8 6-8"/><circle cx="16" cy="16" r="2" fill="currentColor"/></svg>`,
  "boss": `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4l4 8-4 2-4-2 4-8z"/><path d="M8 12l8 4 8-4"/><path d="M8 12v8l8 8 8-8v-8"/></svg>`,
  "start": `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><circle cx="16" cy="16" r="10"/><path d="M16 10v8"/><circle cx="16" cy="22" r="1.5" fill="currentColor"/></svg>`,
  "escape_gate": `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 28V8l8-4 8 4v20"/><path d="M12 28v-8h8v8"/><circle cx="16" cy="10" r="2" fill="currentColor"/></svg>`,

  // Spell element icons
  "fire": `<svg viewBox="0 0 32 32" fill="none" stroke="#ff4400" stroke-width="2"><path d="M16 4c0 8-8 10-8 18a8 8 0 0016 0c0-8-8-10-8-18z" fill="#ff440033"/></svg>`,
  "water": `<svg viewBox="0 0 32 32" fill="none" stroke="#0088ff" stroke-width="2"><path d="M16 4c-4 8-8 12-8 18a8 8 0 0016 0c0-6-4-10-8-18z" fill="#0088ff33"/></svg>`,
  "earth": `<svg viewBox="0 0 32 32" fill="none" stroke="#886622" stroke-width="2"><rect x="8" y="8" width="16" height="16" rx="2" fill="#88662233"/><path d="M8 16h16M16 8v16"/></svg>`,
  "air": `<svg viewBox="0 0 32 32" fill="none" stroke="#aaddff" stroke-width="2"><path d="M6 12c4-4 12-4 16 0M8 18c3-3 9-3 12 0M10 24c2-2 6-2 8 0"/></svg>`,
  "dark": `<svg viewBox="0 0 32 32" fill="none" stroke="#aa66ff" stroke-width="2"><circle cx="16" cy="16" r="10" fill="#6622aa33"/><path d="M20 10a6 6 0 01-8 12"/></svg>`,

  // Status icons
  "health": `<svg viewBox="0 0 32 32" fill="#cc2222" stroke="none"><path d="M16 28l-10-10a7 7 0 0110-8 7 7 0 0110 8z"/></svg>`,
  "mana": `<svg viewBox="0 0 32 32" fill="#2266cc" stroke="none"><path d="M16 4l6 12-6 12-6-12z"/></svg>`,
  "crystal": `<svg viewBox="0 0 32 32" fill="none" stroke="#44ddff" stroke-width="2"><path d="M16 4l8 10-8 14-8-14z" fill="#44ddff33"/><path d="M8 14h16"/></svg>`,
  "xp": `<svg viewBox="0 0 32 32" fill="none" stroke="#ffdd44" stroke-width="2"><polygon points="16,4 20,12 28,14 22,20 24,28 16,24 8,28 10,20 4,14 12,12" fill="#ffdd4433"/></svg>`,

  // Action icons
  "sword": `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 4l-12 12M10 16l-4 4 6 6 4-4M18 10l4-4"/></svg>`,
  "spell": `<svg viewBox="0 0 32 32" fill="none" stroke="#aa66ff" stroke-width="2"><circle cx="16" cy="12" r="6"/><path d="M16 18v8M12 24h8"/><path d="M10 8l-2-4M22 8l2-4M16 6v-4"/></svg>`,
  "bag": `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="14" width="20" height="14" rx="3"/><path d="M11 14v-4a5 5 0 0110 0v4"/></svg>`,
  "run": `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="6" r="3"/><path d="M14 12l6 4-2 6-4 6M20 16l4 4M14 12l-4 2"/></svg>`,

  // Entity portraits
  "goblin": `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="#4a7c3f"/><circle cx="12" cy="13" r="3" fill="#ff0"/><circle cx="20" cy="13" r="3" fill="#ff0"/><circle cx="12" cy="13" r="1.5" fill="#000"/><circle cx="20" cy="13" r="1.5" fill="#000"/><path d="M10 20q6 4 12 0" stroke="#000" stroke-width="1.5" fill="none"/><path d="M6 8l4 6M26 8l-4 6" stroke="#4a7c3f" stroke-width="2"/></svg>`,
  "skeleton": `<svg viewBox="0 0 32 32"><circle cx="16" cy="14" r="10" fill="#e8e0d0"/><circle cx="12" cy="12" r="3" fill="#222"/><circle cx="20" cy="12" r="3" fill="#222"/><path d="M13 19h6" stroke="#222" stroke-width="1"/><path d="M14 19v2M16 19v2M18 19v2" stroke="#222" stroke-width="1"/></svg>`,
  "slime": `<svg viewBox="0 0 32 32"><ellipse cx="16" cy="20" rx="12" ry="8" fill="#44bb66"/><ellipse cx="16" cy="18" rx="10" ry="8" fill="#55cc77"/><circle cx="12" cy="16" r="2.5" fill="#fff"/><circle cx="20" cy="16" r="2.5" fill="#fff"/><circle cx="12" cy="16" r="1.5" fill="#222"/><circle cx="20" cy="16" r="1.5" fill="#222"/><path d="M13 21q3 2 6 0" stroke="#338855" stroke-width="1.5" fill="none"/></svg>`,
  "wraith": `<svg viewBox="0 0 32 32"><path d="M8 28q0-20 8-24 8 4 8 24l-4-4-4 4-4-4z" fill="#443366" opacity="0.8"/><circle cx="13" cy="14" r="2" fill="#ff44ff"/><circle cx="19" cy="14" r="2" fill="#ff44ff"/></svg>`,
  "orc": `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="#5a8a4f"/><circle cx="12" cy="14" r="2.5" fill="#cc0000"/><circle cx="20" cy="14" r="2.5" fill="#cc0000"/><circle cx="12" cy="14" r="1.2" fill="#000"/><circle cx="20" cy="14" r="1.2" fill="#000"/><path d="M12 22q4 3 8 0" stroke="#000" stroke-width="2" fill="none"/><path d="M11 21l-1-3M21 21l1-3" stroke="#fff" stroke-width="1.5"/></svg>`,
  "dragon_whelp": `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="10" fill="#cc4422"/><circle cx="12" cy="13" r="2.5" fill="#ff8800"/><circle cx="20" cy="13" r="2.5" fill="#ff8800"/><circle cx="12" cy="13" r="1.2" fill="#000"/><circle cx="20" cy="13" r="1.2" fill="#000"/><path d="M11 20q5 4 10 0" stroke="#000" stroke-width="1.5" fill="none"/><path d="M6 6l4 8M26 6l-4 8" stroke="#cc4422" stroke-width="2.5"/></svg>`,
  "dark_mage": `<svg viewBox="0 0 32 32"><path d="M10 28v-10l6-14 6 14v10z" fill="#2a1a3a"/><circle cx="16" cy="14" r="5" fill="#3a2a4a"/><circle cx="14" cy="13" r="1.5" fill="#ff00ff"/><circle cx="18" cy="13" r="1.5" fill="#ff00ff"/><path d="M16 4l-2 6h4z" fill="#6644aa"/></svg>`,
  "human": `<svg viewBox="0 0 32 32"><circle cx="16" cy="12" r="6" fill="#ddb896"/><circle cx="13" cy="11" r="1.5" fill="#446"/><circle cx="19" cy="11" r="1.5" fill="#446"/><path d="M14 15q2 1.5 4 0" stroke="#886" stroke-width="1" fill="none"/><rect x="12" y="18" width="8" height="10" rx="2" fill="#4466aa"/></svg>`,

  // NPC portraits
  "merchant": `<svg viewBox="0 0 32 32"><path d="M8 8l8-4 8 4v4H8z" fill="#664422"/><circle cx="16" cy="16" r="7" fill="#ddb896"/><circle cx="13" cy="15" r="1.5" fill="#442"/><circle cx="19" cy="15" r="1.5" fill="#442"/><path d="M13 19q3 2 6 0" stroke="#886" stroke-width="1" fill="none"/><rect x="10" y="23" width="12" height="6" rx="1" fill="#886644"/></svg>`,
  "ghost": `<svg viewBox="0 0 32 32"><path d="M8 28q0-20 8-22 8 2 8 22l-3-3-2 3-3-3-2 3z" fill="#aaccff" opacity="0.6"/><circle cx="13" cy="14" r="2" fill="#4466aa"/><circle cx="19" cy="14" r="2" fill="#4466aa"/></svg>`,

  // Direction arrows
  "north": `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 26V6M8 14l8-8 8 8"/></svg>`,
  "south": `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 6v20M8 18l8 8 8-8"/></svg>`,
  "east": `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 16h20M18 8l8 8-8 8"/></svg>`,
  "west": `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><path d="M26 16H6M14 8l-8 8 8 8"/></svg>`,
  "down": `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 6v20M8 18l8 8 8-8M6 6h20"/></svg>`,
  "up": `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 26V6M8 14l8-8 8 8M6 26h20"/></svg>`,
};

// Convert SVG to data URL for use in KAPLAY sprites
export function getIconDataUrl(name: string, size: number = 32): string {
  const svg = ICONS[name] || ICONS["combat"];
  const encoded = encodeURIComponent(svg);
  return `data:image/svg+xml,${encoded}`;
}

// Get raw SVG string
export function getIconSvg(name: string): string {
  return ICONS[name] || "";
}

// Get all icon names
export function getAvailableIcons(): string[] {
  return Object.keys(ICONS);
}
