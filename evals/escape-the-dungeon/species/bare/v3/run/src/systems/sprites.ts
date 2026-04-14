// SVG-based sprite generator for entities and UI icons
// Avoids external asset dependencies while providing visual polish

export function createEntitySVG(type: string, color: string, size: number = 80): string {
  const s = size;
  const h = s / 2;

  switch (type) {
    case "goblin":
      return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="${h}" cy="${h + 8}" rx="${h - 10}" ry="${h - 5}" fill="${color}"/>
        <circle cx="${h - 12}" cy="${h - 5}" r="8" fill="#fff"/>
        <circle cx="${h + 12}" cy="${h - 5}" r="8" fill="#fff"/>
        <circle cx="${h - 10}" cy="${h - 5}" r="4" fill="#200"/>
        <circle cx="${h + 14}" cy="${h - 5}" r="4" fill="#200"/>
        <polygon points="${h - 18},${h - 15} ${h - 30},${h - 30} ${h - 10},${h - 20}" fill="${color}"/>
        <polygon points="${h + 18},${h - 15} ${h + 30},${h - 30} ${h + 10},${h - 20}" fill="${color}"/>
        <path d="M${h - 8},${h + 10} Q${h},${h + 20} ${h + 8},${h + 10}" fill="#300" stroke="none"/>
      </svg>`;

    case "skeleton":
      return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${h}" cy="${h - 8}" r="${h - 15}" fill="${color}"/>
        <circle cx="${h - 10}" cy="${h - 12}" r="6" fill="#111"/>
        <circle cx="${h + 10}" cy="${h - 12}" r="6" fill="#111"/>
        <polygon points="${h},${h - 4} ${h - 4},${h + 4} ${h + 4},${h + 4}" fill="#333"/>
        <rect x="${h - 12}" y="${h + 8}" width="24" height="3" rx="1" fill="#111"/>
        <rect x="${h - 2}" y="${h - 2}" width="4" height="30" fill="${color}"/>
        <rect x="${h - 14}" y="${h + 14}" width="28" height="4" rx="2" fill="${color}"/>
        <line x1="${h + 20}" y1="${h}" x2="${h + 35}" y2="${h - 15}" stroke="#888" stroke-width="3"/>
        <line x1="${h + 32}" y1="${h - 18}" x2="${h + 38}" y2="${h - 12}" stroke="#888" stroke-width="2"/>
      </svg>`;

    case "mage":
      return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
        <polygon points="${h},2 ${h - 20},${h - 5} ${h + 20},${h - 5}" fill="${color}"/>
        <circle cx="${h}" cy="${h}" r="${h - 18}" fill="#2a1a3a"/>
        <circle cx="${h - 8}" cy="${h - 3}" r="4" fill="#f0f" opacity="0.8"/>
        <circle cx="${h + 8}" cy="${h - 3}" r="4" fill="#f0f" opacity="0.8"/>
        <path d="M${h - 5},${h + 8} Q${h},${h + 14} ${h + 5},${h + 8}" fill="#808" stroke="none"/>
        <rect x="${h - 2}" y="${h + 15}" width="4" height="22" fill="#553"/>
        <circle cx="${h}" cy="${h + 38}" r="5" fill="${color}" opacity="0.6"/>
        <circle cx="${h}" cy="4" r="4" fill="#ff0" opacity="0.8"/>
      </svg>`;

    case "slime":
      return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="${h}" cy="${h + 10}" rx="${h - 8}" ry="${h - 15}" fill="${color}" opacity="0.8"/>
        <ellipse cx="${h}" cy="${h + 10}" rx="${h - 12}" ry="${h - 18}" fill="${color}"/>
        <circle cx="${h - 8}" cy="${h}" r="5" fill="#fff" opacity="0.9"/>
        <circle cx="${h + 8}" cy="${h}" r="5" fill="#fff" opacity="0.9"/>
        <circle cx="${h - 7}" cy="${h}" r="3" fill="#111"/>
        <circle cx="${h + 9}" cy="${h}" r="3" fill="#111"/>
        <ellipse cx="${h + 15}" cy="${h + 20}" rx="8" ry="5" fill="${color}" opacity="0.5"/>
        <ellipse cx="${h - 18}" cy="${h + 18}" rx="6" ry="4" fill="${color}" opacity="0.4"/>
      </svg>`;

    case "boss":
      return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
        <polygon points="${h},0 ${h - 8},14 ${h - 20},8 ${h - 12},20 ${h - 24},18 ${h - 14},28 ${h + 14},28 ${h + 24},18 ${h + 12},20 ${h + 20},8 ${h + 8},14" fill="#ffd700"/>
        <circle cx="${h}" cy="${h + 5}" r="${h - 12}" fill="${color}"/>
        <circle cx="${h - 12}" cy="${h}" r="7" fill="#ff0" opacity="0.8"/>
        <circle cx="${h + 12}" cy="${h}" r="7" fill="#ff0" opacity="0.8"/>
        <circle cx="${h - 12}" cy="${h}" r="4" fill="#800"/>
        <circle cx="${h + 12}" cy="${h}" r="4" fill="#800"/>
        <path d="M${h - 10},${h + 16} L${h - 6},${h + 12} L${h - 2},${h + 16} L${h + 2},${h + 12} L${h + 6},${h + 16} L${h + 10},${h + 12}" fill="none" stroke="#400" stroke-width="2"/>
      </svg>`;

    case "hermit":
      return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
        <polygon points="${h},4 ${h - 22},${h - 2} ${h + 22},${h - 2}" fill="${color}"/>
        <circle cx="${h}" cy="${h + 2}" r="${h - 18}" fill="#d4b896"/>
        <circle cx="${h - 8}" cy="${h - 2}" r="3" fill="#333"/>
        <circle cx="${h + 8}" cy="${h - 2}" r="3" fill="#333"/>
        <path d="M${h - 12},${h + 10} Q${h},${h + 22} ${h + 12},${h + 10}" fill="#aaa" stroke="none"/>
        <rect x="${h - 16}" y="${h + 18}" width="32" height="22" rx="4" fill="${color}"/>
        <line x1="${h + 18}" y1="${h + 10}" x2="${h + 30}" y2="${h + 35}" stroke="#654" stroke-width="3"/>
      </svg>`;

    default:
      return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${h}" cy="${h}" r="${h - 5}" fill="${color}"/>
        <text x="${h}" y="${h + 5}" text-anchor="middle" fill="#fff" font-size="20">?</text>
      </svg>`;
  }
}

// Room type icons
export function getRoomIcon(type: string): string {
  const icons: Record<string, string> = {
    combat: "⚔️",
    dialogue: "💬",
    treasure: "💎",
    rest: "💤",
    forge: "🔨",
    boss: "💀",
    start: "🏠",
  };
  return icons[type] || "❓";
}

// Room type colors
export function getRoomColor(type: string): string {
  const colors: Record<string, string> = {
    combat: "#8b2020",
    dialogue: "#2060a0",
    treasure: "#a08020",
    rest: "#207040",
    forge: "#a04020",
    boss: "#600060",
    start: "#404060",
  };
  return colors[type] || "#404040";
}

// Room type background gradients
export function getRoomBg(type: string): string {
  const bgs: Record<string, string> = {
    combat: "linear-gradient(135deg, #1a0808 0%, #2d0a0a 50%, #1a0808 100%)",
    dialogue: "linear-gradient(135deg, #080818 0%, #0a0a2d 50%, #080818 100%)",
    treasure: "linear-gradient(135deg, #181808 0%, #2d2a0a 50%, #181808 100%)",
    rest: "linear-gradient(135deg, #081808 0%, #0a2d0a 50%, #081808 100%)",
    forge: "linear-gradient(135deg, #180808 0%, #2d1a0a 50%, #180808 100%)",
    boss: "linear-gradient(135deg, #100010 0%, #200020 50%, #100010 100%)",
    start: "linear-gradient(135deg, #0a0a14 0%, #141428 50%, #0a0a14 100%)",
  };
  return bgs[type] || "linear-gradient(135deg, #0a0a0f 0%, #14141e 100%)";
}

// Spell element icons
export function getSpellIcon(element: string): string {
  const icons: Record<string, string> = {
    fire: "🔥",
    ice: "❄️",
    light: "✨",
    lightning: "⚡",
    shadow: "🌑",
    poison: "☠️",
    earth: "🛡️",
  };
  return icons[element] || "✦";
}
