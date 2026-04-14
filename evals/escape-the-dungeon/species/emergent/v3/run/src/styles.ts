// Inject global styles
export function injectStyles(): void {
  const style = document.createElement("style");
  style.textContent = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a1a;
      color: #e0dcd0;
      font-family: 'Inter', sans-serif;
      overflow: hidden;
      width: 100vw;
      height: 100vh;
    }
    #game-root {
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* ===== TITLE SCREEN ===== */
    .title-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: radial-gradient(ellipse at center, #1a1a3e 0%, #0a0a1a 70%);
    }
    .title-screen h1 {
      font-family: 'Cinzel', serif;
      font-size: 3.5rem;
      color: #ffcc44;
      text-shadow: 0 0 30px #ffcc4466, 0 4px 8px #00000088;
      margin-bottom: 0.5rem;
    }
    .title-screen .subtitle {
      font-size: 1.1rem;
      color: #8888aa;
      margin-bottom: 3rem;
    }
    .title-btn {
      font-family: 'Cinzel', serif;
      font-size: 1.2rem;
      padding: 14px 48px;
      margin: 8px;
      border: 2px solid #ffcc44;
      background: linear-gradient(180deg, #2a2a4e, #1a1a3e);
      color: #ffcc44;
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.2s;
    }
    .title-btn:hover {
      background: linear-gradient(180deg, #3a3a5e, #2a2a4e);
      box-shadow: 0 0 20px #ffcc4433;
      transform: translateY(-2px);
    }

    /* ===== HUD BAR ===== */
    .hud-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 8px 16px;
      background: linear-gradient(180deg, #16162e, #0e0e20);
      border-bottom: 2px solid #33335566;
      font-size: 0.85rem;
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .hud-bar .hud-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .hud-bar .hud-icon {
      width: 20px;
      height: 20px;
    }
    .hud-bar .hud-label {
      color: #8888aa;
      font-size: 0.75rem;
    }
    .hud-bar .hud-value {
      font-weight: 600;
    }

    /* ===== RESOURCE BARS ===== */
    .bar-container {
      width: 120px;
      height: 14px;
      background: #1a1a2e;
      border-radius: 7px;
      border: 1px solid #33335566;
      overflow: hidden;
      position: relative;
    }
    .bar-fill {
      height: 100%;
      border-radius: 7px;
      transition: width 0.3s ease;
    }
    .bar-fill.hp { background: linear-gradient(90deg, #cc2222, #ee4444); }
    .bar-fill.mana { background: linear-gradient(90deg, #2244cc, #4466ee); }
    .bar-fill.xp { background: linear-gradient(90deg, #ccaa22, #eedd44); }
    .bar-fill.enemy-hp { background: linear-gradient(90deg, #cc4422, #ee6644); }
    .bar-text {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 0.65rem;
      line-height: 14px;
      color: #fff;
      text-shadow: 0 1px 2px #000;
    }

    /* ===== MAIN CONTENT ===== */
    .game-content {
      flex: 1;
      display: flex;
      overflow: hidden;
    }

    /* ===== ROOM VIEW ===== */
    .room-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 20px;
      overflow-y: auto;
    }
    .room-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .room-icon {
      width: 40px;
      height: 40px;
      padding: 6px;
      border-radius: 8px;
      border: 2px solid #44446688;
    }
    .room-icon.combat { background: #3a1a1a; border-color: #aa333366; color: #ff6644; }
    .room-icon.dialogue { background: #1a2a3a; border-color: #3366aa66; color: #66aaff; }
    .room-icon.treasure { background: #3a3a1a; border-color: #aaaa3366; color: #ffdd44; }
    .room-icon.rest { background: #1a3a2a; border-color: #33aa6666; color: #66ff99; }
    .room-icon.rune_forge { background: #2a1a3a; border-color: #6633aa66; color: #aa66ff; }
    .room-icon.boss { background: #3a1a2a; border-color: #aa336666; color: #ff44aa; }
    .room-icon.start { background: #1a2a2a; border-color: #44888866; color: #88dddd; }
    .room-icon.escape_gate { background: #2a3a1a; border-color: #66aa3366; color: #aaff66; }

    .room-name {
      font-family: 'Cinzel', serif;
      font-size: 1.4rem;
      color: #ffcc44;
    }
    .room-desc {
      color: #aaaacc;
      line-height: 1.5;
      margin-bottom: 16px;
      padding: 12px;
      background: #12122a;
      border-radius: 8px;
      border-left: 3px solid #33335566;
    }
    .floor-constraint {
      color: #ff8866;
      font-size: 0.85rem;
      margin-bottom: 12px;
      padding: 8px 12px;
      background: #2a1a1a;
      border-radius: 6px;
      border-left: 3px solid #cc443366;
    }

    /* ===== NAVIGATION ===== */
    .nav-section {
      margin-top: auto;
    }
    .nav-title {
      font-size: 0.85rem;
      color: #8888aa;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .nav-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .nav-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: linear-gradient(180deg, #22224a, #1a1a3a);
      border: 1px solid #44446688;
      color: #ccccee;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.15s;
    }
    .nav-btn:hover {
      background: linear-gradient(180deg, #33335a, #2a2a4a);
      border-color: #6666aa88;
      transform: translateY(-1px);
    }
    .nav-btn .nav-icon {
      width: 20px;
      height: 20px;
    }
    .nav-btn .room-type-tag {
      font-size: 0.7rem;
      padding: 2px 6px;
      border-radius: 3px;
      margin-left: 4px;
    }
    .tag-combat { background: #aa333344; color: #ff6644; }
    .tag-dialogue { background: #3366aa44; color: #66aaff; }
    .tag-treasure { background: #aaaa3344; color: #ffdd44; }
    .tag-rest { background: #33aa6644; color: #66ff99; }
    .tag-rune_forge { background: #6633aa44; color: #aa66ff; }
    .tag-boss { background: #aa336644; color: #ff44aa; }
    .tag-start { background: #44888844; color: #88dddd; }
    .tag-escape_gate { background: #66aa3344; color: #aaff66; }
    .tag-unknown { background: #44444444; color: #888888; }

    /* ===== SIDE PANEL (map/bag/spells/stats) ===== */
    .side-panel {
      width: 320px;
      background: #0e0e20;
      border-left: 2px solid #22223a;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .side-tabs {
      display: flex;
      border-bottom: 2px solid #22223a;
      flex-shrink: 0;
    }
    .side-tab {
      flex: 1;
      padding: 8px 4px;
      text-align: center;
      font-size: 0.75rem;
      color: #666688;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.15s;
    }
    .side-tab:hover { color: #aaaacc; }
    .side-tab.active {
      color: #ffcc44;
      border-bottom-color: #ffcc44;
    }
    .side-content {
      flex: 1;
      padding: 12px;
      overflow-y: auto;
    }

    /* ===== COMBAT VIEW ===== */
    .combat-view {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 20px;
    }
    .combat-enemy {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: linear-gradient(180deg, #2a1a1a, #1a1010);
      border-radius: 8px;
      border: 1px solid #aa333344;
      margin-bottom: 16px;
    }
    .enemy-portrait {
      width: 64px;
      height: 64px;
      border-radius: 8px;
      border: 2px solid #aa333366;
      background: #1a0a0a;
      padding: 4px;
    }
    .enemy-info { flex: 1; }
    .enemy-name {
      font-family: 'Cinzel', serif;
      font-size: 1.1rem;
      color: #ff8866;
    }
    .enemy-level {
      font-size: 0.8rem;
      color: #886644;
    }
    .combat-log {
      flex: 1;
      padding: 12px;
      background: #0a0a18;
      border-radius: 8px;
      border: 1px solid #22223a;
      overflow-y: auto;
      margin-bottom: 16px;
      font-size: 0.85rem;
      line-height: 1.6;
    }
    .log-player { color: #66aaff; }
    .log-enemy { color: #ff6644; }
    .log-damage { color: #ff4444; }
    .log-heal { color: #44ff66; }
    .log-info { color: #aaaacc; }
    .log-status { color: #ffaa44; }
    .log-resist { color: #aa8866; }
    .log-critical { color: #ff44ff; font-weight: 600; }

    .combat-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .action-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.95rem;
      font-weight: 500;
      border: 2px solid;
      transition: all 0.15s;
    }
    .action-btn:hover { transform: translateY(-2px); }
    .action-btn.fight {
      background: linear-gradient(180deg, #3a2a1a, #2a1a0a);
      border-color: #aa663366;
      color: #ffaa66;
    }
    .action-btn.spells {
      background: linear-gradient(180deg, #2a1a3a, #1a0a2a);
      border-color: #6633aa66;
      color: #aa66ff;
    }
    .action-btn.items {
      background: linear-gradient(180deg, #1a2a3a, #0a1a2a);
      border-color: #3366aa66;
      color: #66aaff;
    }
    .action-btn.flee {
      background: linear-gradient(180deg, #1a3a2a, #0a2a1a);
      border-color: #33aa6666;
      color: #66ff99;
    }
    .action-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
    }
    .action-btn .btn-icon {
      width: 22px;
      height: 22px;
    }

    /* ===== SPELL LIST ===== */
    .spell-list, .item-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .spell-item, .item-entry {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background: #16162e;
      border-radius: 6px;
      border: 1px solid #33335544;
      cursor: pointer;
      transition: all 0.15s;
    }
    .spell-item:hover, .item-entry:hover {
      background: #22224a;
      border-color: #6666aa66;
    }
    .spell-icon { width: 24px; height: 24px; }
    .spell-name { flex: 1; font-weight: 500; }
    .spell-cost { color: #6688cc; font-size: 0.8rem; }
    .spell-desc { color: #888; font-size: 0.75rem; }

    /* ===== DIALOGUE VIEW ===== */
    .dialogue-view {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 20px;
    }
    .dialogue-npc {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: linear-gradient(180deg, #1a2a3a, #101a2a);
      border-radius: 8px;
      border: 1px solid #3366aa44;
      margin-bottom: 16px;
    }
    .npc-portrait {
      width: 64px;
      height: 64px;
      border-radius: 8px;
      border: 2px solid #3366aa66;
      background: #0a1a2a;
      padding: 4px;
    }
    .npc-name {
      font-family: 'Cinzel', serif;
      font-size: 1.1rem;
      color: #66aaff;
    }
    .dialogue-text {
      padding: 16px;
      background: #12122a;
      border-radius: 8px;
      border-left: 3px solid #3366aa66;
      margin-bottom: 16px;
      line-height: 1.6;
    }
    .dialogue-options {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .dialogue-option {
      padding: 12px 16px;
      background: linear-gradient(180deg, #22224a, #1a1a3a);
      border: 1px solid #44446688;
      color: #ccccee;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      text-align: left;
      transition: all 0.15s;
    }
    .dialogue-option:hover {
      background: linear-gradient(180deg, #33335a, #2a2a4a);
      border-color: #6666aa88;
    }
    .dialogue-option .cost-tag {
      font-size: 0.75rem;
      color: #44ddff;
      margin-left: 8px;
    }
    .dialogue-option:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    /* ===== FORGE VIEW ===== */
    .forge-view {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 20px;
      overflow-y: auto;
    }
    .forge-title {
      font-family: 'Cinzel', serif;
      font-size: 1.3rem;
      color: #aa66ff;
      margin-bottom: 16px;
    }
    .rune-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    .rune-slot {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      border: 2px solid #44446688;
      background: #16162e;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s;
    }
    .rune-slot:hover { border-color: #aa66ff88; }
    .rune-slot.selected { border-color: #aa66ff; background: #2a1a3a; }
    .rune-slot .rune-icon { width: 28px; height: 28px; }
    .rune-name { font-size: 0.7rem; color: #aaa; text-align: center; margin-top: 2px; }

    .forge-slots {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
      padding: 12px;
      background: #12122a;
      border-radius: 8px;
    }
    .forge-slot {
      width: 56px;
      height: 56px;
      border: 2px dashed #44446688;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0a0a1a;
    }
    .forge-slot.filled { border-style: solid; border-color: #aa66ff66; }
    .forge-plus { color: #666; font-size: 1.5rem; }
    .forge-result {
      padding: 12px;
      background: #1a1a3a;
      border-radius: 8px;
      border: 1px solid #6633aa44;
      margin-bottom: 16px;
    }

    /* ===== TREASURE VIEW ===== */
    .treasure-view, .rest-view, .event-view {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      text-align: center;
    }
    .treasure-icon, .rest-icon {
      width: 80px;
      height: 80px;
      margin-bottom: 20px;
    }

    /* ===== MAP VIEW ===== */
    .map-grid {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .map-room {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 0.8rem;
    }
    .map-room.current { background: #33335a; border: 1px solid #ffcc4466; }
    .map-room.discovered { background: #1a1a30; }
    .map-room.undiscovered { opacity: 0.3; }
    .map-room-icon { width: 16px; height: 16px; }

    /* ===== STAT VIEW ===== */
    .stat-group {
      margin-bottom: 12px;
    }
    .stat-group-title {
      font-size: 0.8rem;
      color: #8888aa;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 8px;
      font-size: 0.85rem;
    }
    .stat-row:nth-child(even) { background: #16162e; border-radius: 3px; }
    .stat-label { color: #aaa; }
    .stat-value { color: #fff; font-weight: 500; }

    /* ===== OVERLAY ===== */
    .overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: #000000cc;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .overlay-panel {
      background: linear-gradient(180deg, #1a1a3e, #0e0e20);
      border: 2px solid #44446688;
      border-radius: 12px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
      text-align: center;
    }
    .overlay-panel h2 {
      font-family: 'Cinzel', serif;
      color: #ffcc44;
      margin-bottom: 12px;
    }

    /* ===== GAME OVER ===== */
    .game-over-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: radial-gradient(ellipse at center, #2a0a0a 0%, #0a0a1a 70%);
    }
    .victory-screen {
      background: radial-gradient(ellipse at center, #1a2a0a 0%, #0a0a1a 70%);
    }

    /* ===== SCROLLBAR ===== */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: #0a0a1a; }
    ::-webkit-scrollbar-thumb { background: #33335a; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #44446a; }

    /* ===== AFFINITY DISPLAY ===== */
    .affinity-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .affinity-bar {
      flex: 1;
      height: 8px;
      background: #1a1a2e;
      border-radius: 4px;
      overflow: hidden;
    }
    .affinity-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s;
    }
    .affinity-level { font-size: 0.75rem; color: #aaa; width: 24px; text-align: right; }

    /* ===== STATUS EFFECTS ===== */
    .status-effects {
      display: flex;
      gap: 4px;
      margin-top: 4px;
    }
    .status-badge {
      font-size: 0.65rem;
      padding: 2px 6px;
      border-radius: 3px;
    }
    .status-badge.poison { background: #224422; color: #66ff66; }
    .status-badge.burn { background: #442222; color: #ff6644; }
    .status-badge.slow { background: #222244; color: #6688ff; }
    .status-badge.freeze { background: #224444; color: #44ddff; }
    .status-badge.defense-up { background: #333322; color: #dddd44; }
  `;
  document.head.appendChild(style);
}
