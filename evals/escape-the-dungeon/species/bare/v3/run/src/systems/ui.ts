// DOM-based UI rendering system
// All game UI is rendered via HTML/CSS for maximum reliability and polish

export class UIRenderer {
  private root: HTMLElement;

  constructor() {
    this.root = document.getElementById("ui-overlay")!;
    this.injectStyles();
  }

  clear(): void {
    this.root.innerHTML = "";
  }

  render(html: string): void {
    this.root.innerHTML = html;
  }

  getRoot(): HTMLElement {
    return this.root;
  }

  // Bind click handlers after render
  bindClick(selector: string, handler: () => void): void {
    const el = this.root.querySelector(selector);
    if (el) {
      (el as HTMLElement).addEventListener("click", handler);
    }
  }

  bindAllClicks(selector: string, handler: (index: number) => void): void {
    const els = this.root.querySelectorAll(selector);
    els.forEach((el, i) => {
      (el as HTMLElement).addEventListener("click", () => handler(i));
    });
  }

  // HP bar component
  static hpBar(current: number, max: number, color: string = "#e44", width: string = "100%"): string {
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    const barColor = pct > 50 ? color : pct > 25 ? "#e80" : "#e22";
    return `
      <div class="bar-container" style="width:${width}">
        <div class="bar-fill" style="width:${pct}%;background:${barColor}"></div>
        <span class="bar-text">${current}/${max}</span>
      </div>
    `;
  }

  // Mana bar component
  static manaBar(current: number, max: number, width: string = "100%"): string {
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    return `
      <div class="bar-container" style="width:${width}">
        <div class="bar-fill" style="width:${pct}%;background:#48f"></div>
        <span class="bar-text">${current}/${max}</span>
      </div>
    `;
  }

  // XP bar component
  static xpBar(current: number, max: number, width: string = "100%"): string {
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    return `
      <div class="bar-container" style="width:${width}">
        <div class="bar-fill" style="width:${pct}%;background:#8c4"></div>
        <span class="bar-text">${current}/${max} XP</span>
      </div>
    `;
  }

  private injectStyles(): void {
    if (document.getElementById("game-styles")) return;
    const style = document.createElement("style");
    style.id = "game-styles";
    style.textContent = `
      #ui-overlay {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100vw;
        height: 100vh;
        color: #e0dcc8;
        font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      }

      /* Title screen */
      .title-screen {
        text-align: center;
        animation: fadeIn 0.5s ease;
      }
      .title-screen h1 {
        font-size: 3.5rem;
        color: #ffd700;
        text-shadow: 0 0 30px rgba(255,215,0,0.4), 0 4px 8px rgba(0,0,0,0.6);
        margin-bottom: 0.5rem;
        letter-spacing: 2px;
      }
      .title-screen .subtitle {
        font-size: 1.1rem;
        color: #888;
        margin-bottom: 2.5rem;
        font-style: italic;
      }

      /* Buttons */
      .btn {
        display: inline-block;
        padding: 12px 32px;
        margin: 6px 8px;
        background: linear-gradient(180deg, #3a3a50 0%, #2a2a3a 100%);
        border: 2px solid #555;
        border-radius: 8px;
        color: #e0dcc8;
        font-size: 1rem;
        font-family: inherit;
        cursor: pointer;
        transition: all 0.15s ease;
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
      }
      .btn:hover {
        background: linear-gradient(180deg, #4a4a60 0%, #3a3a4a 100%);
        border-color: #ffd700;
        color: #ffd700;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(255,215,0,0.2);
      }
      .btn:active { transform: translateY(1px); }
      .btn-primary {
        background: linear-gradient(180deg, #6a4a20 0%, #4a3010 100%);
        border-color: #ffd700;
        color: #ffd700;
        font-size: 1.2rem;
        padding: 14px 44px;
      }
      .btn-primary:hover {
        background: linear-gradient(180deg, #8a6a30 0%, #6a5020 100%);
        box-shadow: 0 4px 20px rgba(255,215,0,0.3);
      }
      .btn-danger {
        background: linear-gradient(180deg, #6a2020 0%, #4a1010 100%);
        border-color: #c44;
      }
      .btn-danger:hover {
        border-color: #f66;
        color: #f66;
      }
      .btn-small {
        padding: 6px 16px;
        font-size: 0.85rem;
      }
      .btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
        transform: none !important;
        box-shadow: none !important;
      }

      /* HP/Mana bars */
      .bar-container {
        position: relative;
        height: 22px;
        background: #1a1a24;
        border-radius: 4px;
        border: 1px solid #333;
        overflow: hidden;
      }
      .bar-fill {
        height: 100%;
        border-radius: 3px;
        transition: width 0.3s ease;
      }
      .bar-text {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.75rem;
        font-weight: bold;
        color: #fff;
        text-shadow: 0 1px 3px rgba(0,0,0,0.8);
      }

      /* Game panels */
      .game-container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      /* HUD */
      .hud {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 8px 16px;
        background: linear-gradient(180deg, #1a1a28 0%, #12121c 100%);
        border-bottom: 2px solid #333;
        flex-shrink: 0;
      }
      .hud-name {
        font-weight: bold;
        color: #ffd700;
        font-size: 0.95rem;
        min-width: 80px;
      }
      .hud-bars {
        display: flex;
        gap: 10px;
        flex: 1;
        max-width: 400px;
      }
      .hud-bar-group {
        flex: 1;
      }
      .hud-bar-label {
        font-size: 0.65rem;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 2px;
      }
      .hud-info {
        display: flex;
        gap: 16px;
        font-size: 0.8rem;
        color: #aaa;
      }
      .hud-info span { white-space: nowrap; }
      .hud-info .floor-num { color: #ffd700; }
      .hud-menus {
        display: flex;
        gap: 6px;
        margin-left: auto;
      }

      /* Main content area */
      .main-area {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 20px;
        overflow-y: auto;
      }

      /* Room panel */
      .room-panel {
        max-width: 700px;
        width: 100%;
        text-align: center;
      }
      .room-header {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        margin-bottom: 8px;
      }
      .room-icon {
        font-size: 2rem;
      }
      .room-name {
        font-size: 1.8rem;
        color: #ffd700;
        text-shadow: 0 2px 8px rgba(255,215,0,0.3);
      }
      .room-type-badge {
        display: inline-block;
        padding: 3px 12px;
        border-radius: 12px;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 12px;
      }
      .room-description {
        font-size: 1rem;
        color: #b0aaa0;
        line-height: 1.6;
        margin-bottom: 24px;
        font-style: italic;
      }
      .room-exits {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: center;
      }
      .exit-btn {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      /* Combat */
      .combat-panel {
        max-width: 700px;
        width: 100%;
      }
      .combat-header {
        text-align: center;
        font-size: 1.4rem;
        color: #e44;
        margin-bottom: 16px;
      }
      .combat-arena {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        gap: 20px;
      }
      .combatant {
        flex: 1;
        text-align: center;
        padding: 16px;
        background: rgba(0,0,0,0.3);
        border-radius: 12px;
        border: 1px solid #333;
      }
      .combatant-name {
        font-size: 1.1rem;
        font-weight: bold;
        margin-bottom: 8px;
      }
      .combatant-sprite {
        margin: 8px auto;
      }
      .combatant-bars {
        margin-top: 8px;
      }
      .combat-vs {
        font-size: 1.5rem;
        color: #ffd700;
        font-weight: bold;
        flex-shrink: 0;
      }
      .combat-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: center;
        margin-bottom: 16px;
      }
      .combat-log {
        background: rgba(0,0,0,0.4);
        border: 1px solid #333;
        border-radius: 8px;
        padding: 12px;
        max-height: 120px;
        overflow-y: auto;
        font-size: 0.85rem;
        color: #aaa;
      }
      .combat-log .log-entry {
        padding: 2px 0;
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }
      .combat-log .log-damage { color: #e66; }
      .combat-log .log-heal { color: #6e6; }
      .combat-log .log-info { color: #aaa; }

      /* Damage number animation */
      .damage-num {
        color: #f44;
        font-weight: bold;
        font-size: 1.2rem;
        animation: floatUp 1s ease forwards;
      }
      .heal-num {
        color: #4f4;
        font-weight: bold;
        font-size: 1.2rem;
        animation: floatUp 1s ease forwards;
      }

      /* Dialogue */
      .dialogue-panel {
        max-width: 700px;
        width: 100%;
      }
      .npc-section {
        display: flex;
        gap: 20px;
        align-items: flex-start;
        margin-bottom: 20px;
        padding: 16px;
        background: rgba(0,0,0,0.3);
        border-radius: 12px;
        border: 1px solid #334;
      }
      .npc-portrait {
        flex-shrink: 0;
      }
      .npc-text {
        flex: 1;
      }
      .npc-name {
        font-size: 1.2rem;
        color: #ffd700;
        margin-bottom: 8px;
      }
      .npc-dialogue {
        font-size: 1rem;
        color: #c8c4b0;
        line-height: 1.6;
        font-style: italic;
      }
      .dialogue-choices {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .dialogue-choice {
        text-align: left;
        padding: 10px 20px;
      }

      /* Forge */
      .forge-panel {
        max-width: 700px;
        width: 100%;
      }
      .forge-title {
        text-align: center;
        font-size: 1.6rem;
        color: #ffd700;
        margin-bottom: 16px;
      }
      .rune-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        justify-content: center;
        margin-bottom: 20px;
      }
      .rune-slot {
        width: 70px;
        height: 70px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.4);
        border: 2px solid #444;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .rune-slot:hover {
        border-color: #ffd700;
        background: rgba(255,215,0,0.1);
      }
      .rune-slot.selected {
        border-color: #ffd700;
        background: rgba(255,215,0,0.15);
        box-shadow: 0 0 12px rgba(255,215,0,0.3);
      }
      .rune-slot .rune-symbol {
        font-size: 1.8rem;
      }
      .rune-slot .rune-name {
        font-size: 0.65rem;
        color: #aaa;
        margin-top: 2px;
      }
      .forge-selection {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-bottom: 20px;
        padding: 16px;
        background: rgba(0,0,0,0.3);
        border: 1px solid #444;
        border-radius: 10px;
      }
      .forge-slot {
        width: 64px;
        height: 64px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.4);
        border: 2px dashed #555;
        border-radius: 10px;
        font-size: 1.6rem;
      }
      .forge-slot.filled {
        border-style: solid;
        border-color: #ffd700;
      }
      .forge-plus {
        font-size: 1.8rem;
        color: #666;
      }
      .forge-arrow {
        font-size: 1.8rem;
        color: #ffd700;
      }
      .forge-result {
        min-width: 100px;
        text-align: center;
      }
      .forge-result-name {
        color: #ffd700;
        font-weight: bold;
      }
      .forge-result-desc {
        font-size: 0.8rem;
        color: #aaa;
      }

      /* Overlay menus */
      .overlay-menu {
        position: fixed;
        top: 50px;
        left: 50%;
        transform: translateX(-50%);
        width: 90%;
        max-width: 500px;
        max-height: 70vh;
        overflow-y: auto;
        background: linear-gradient(180deg, #1e1e2e 0%, #16161f 100%);
        border: 2px solid #555;
        border-radius: 12px;
        padding: 20px;
        z-index: 100;
        animation: slideDown 0.2s ease;
      }
      .overlay-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        padding-bottom: 8px;
        border-bottom: 1px solid #333;
      }
      .overlay-title {
        font-size: 1.3rem;
        color: #ffd700;
      }
      .item-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }
      .item-icon { font-size: 1.3rem; }
      .item-info { flex: 1; }
      .item-name { font-weight: bold; color: #ddd; }
      .item-desc { font-size: 0.8rem; color: #888; }
      .item-qty { color: #aaa; font-size: 0.85rem; }

      /* Spell list in menu */
      .spell-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }
      .spell-icon { font-size: 1.3rem; }
      .spell-info { flex: 1; }
      .spell-name { font-weight: bold; color: #ddd; }
      .spell-desc { font-size: 0.8rem; color: #888; }
      .spell-cost { color: #48f; font-size: 0.85rem; }

      /* Stats panel */
      .stat-row {
        display: flex;
        justify-content: space-between;
        padding: 6px 0;
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }
      .stat-label { color: #aaa; }
      .stat-value { color: #ffd700; font-weight: bold; }

      /* Map */
      .map-room {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        margin: 3px;
        border-radius: 6px;
        border: 1px solid #333;
        font-size: 0.85rem;
      }
      .map-room.current {
        border-color: #ffd700;
        background: rgba(255,215,0,0.1);
      }
      .map-room.visited {
        opacity: 0.8;
      }
      .map-room.undiscovered {
        opacity: 0.3;
      }

      /* Victory / Game Over */
      .result-panel {
        text-align: center;
        padding: 40px;
      }
      .result-panel h2 {
        font-size: 2rem;
        margin-bottom: 16px;
      }
      .result-panel .rewards {
        margin: 20px 0;
        font-size: 1.1rem;
        color: #aaa;
      }

      /* Animations */
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes slideDown {
        from { opacity: 0; transform: translate(-50%, -10px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }
      @keyframes floatUp {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-30px); }
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      /* Level up notification */
      .level-up {
        text-align: center;
        padding: 12px;
        background: rgba(255,215,0,0.15);
        border: 1px solid #ffd700;
        border-radius: 8px;
        margin: 10px 0;
        color: #ffd700;
        font-weight: bold;
        animation: pulse 1s ease 3;
      }

      /* Scrollbar styling */
      ::-webkit-scrollbar { width: 6px; }
      ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
      ::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
      ::-webkit-scrollbar-thumb:hover { background: #555; }
    `;
    document.head.appendChild(style);
  }
}
