// Global CSS styles injected once
export function injectStyles(): void {
  const style = document.createElement('style');
  style.textContent = `
    :root {
      --bg-dark: #0a0a12;
      --bg-panel: #14141f;
      --bg-panel-light: #1a1a2e;
      --bg-panel-hover: #222240;
      --border: #2a2a4a;
      --border-light: #3a3a5a;
      --text: #e0e0f0;
      --text-dim: #8888aa;
      --text-bright: #ffffff;
      --accent: #6644cc;
      --accent-light: #8866ee;
      --fire: #ff6633;
      --ice: #44bbff;
      --lightning: #ffdd44;
      --shadow: #9944cc;
      --nature: #44cc66;
      --arcane: #cc44ff;
      --hp-bar: #cc3333;
      --hp-bar-bg: #441111;
      --mana-bar: #3366cc;
      --mana-bar-bg: #111144;
      --stamina-bar: #ccaa33;
      --stamina-bar-bg: #443311;
      --xp-bar: #33cc66;
      --xp-bar-bg: #114422;
      --gold: #ffcc33;
      --danger: #cc3333;
      --success: #33cc66;
      --warning: #ccaa33;
      --info: #3388cc;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: var(--bg-dark);
      color: var(--text);
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      line-height: 1.5;
      overflow: hidden;
      height: 100vh;
      width: 100vw;
    }

    #app {
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
    }

    h1, h2, h3 { font-family: 'Cinzel', serif; color: var(--text-bright); }

    .title-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a12 70%);
    }

    .title-screen h1 {
      font-size: 3rem;
      background: linear-gradient(135deg, var(--accent-light), var(--fire), var(--accent));
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
      text-shadow: none;
    }

    .title-screen .subtitle {
      color: var(--text-dim);
      font-size: 1.1rem;
      margin-bottom: 2rem;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: 1px solid var(--border-light);
      border-radius: 6px;
      background: var(--bg-panel-light);
      color: var(--text);
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s ease;
      user-select: none;
    }

    .btn:hover {
      background: var(--bg-panel-hover);
      border-color: var(--accent);
      color: var(--text-bright);
    }

    .btn:active { transform: scale(0.97); }

    .btn-primary {
      background: var(--accent);
      border-color: var(--accent-light);
      color: white;
      font-weight: 600;
    }

    .btn-primary:hover {
      background: var(--accent-light);
    }

    .btn-danger {
      border-color: var(--danger);
      color: var(--danger);
    }

    .btn-danger:hover {
      background: rgba(204, 51, 51, 0.2);
    }

    .btn-success {
      border-color: var(--success);
      color: var(--success);
    }

    .btn-sm { padding: 4px 10px; font-size: 12px; }
    .btn-lg { padding: 12px 24px; font-size: 16px; }

    .btn[disabled] {
      opacity: 0.4;
      cursor: not-allowed;
      pointer-events: none;
    }

    /* HUD */
    .hud {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
      background: var(--bg-panel);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      flex-wrap: wrap;
    }

    .hud-section {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .hud-label {
      color: var(--text-dim);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .hud-value {
      font-weight: 600;
      font-size: 13px;
    }

    .bar-container {
      width: 100px;
      height: 14px;
      background: var(--hp-bar-bg);
      border-radius: 7px;
      overflow: hidden;
      position: relative;
    }

    .bar-fill {
      height: 100%;
      border-radius: 7px;
      transition: width 0.3s ease;
    }

    .bar-text {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 600;
      color: white;
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    }

    .hp-bar .bar-fill { background: var(--hp-bar); }
    .hp-bar { background: var(--hp-bar-bg); }
    .mana-bar .bar-fill { background: var(--mana-bar); }
    .mana-bar { background: var(--mana-bar-bg); }
    .stamina-bar .bar-fill { background: var(--stamina-bar); }
    .stamina-bar { background: var(--stamina-bar-bg); }
    .xp-bar .bar-fill { background: var(--xp-bar); }
    .xp-bar { background: var(--xp-bar-bg); }
    .affinity-bar .bar-fill { background: var(--accent); }
    .affinity-bar { background: var(--bg-panel); width: 60px; height: 10px; }

    /* Main layout */
    .game-layout {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .main-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .side-panel {
      width: 280px;
      background: var(--bg-panel);
      border-left: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      flex-shrink: 0;
    }

    .panel-header {
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      font-family: 'Cinzel', serif;
      font-size: 14px;
      font-weight: 700;
      color: var(--text-bright);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .panel-body {
      padding: 10px 14px;
      overflow-y: auto;
      flex: 1;
    }

    .panel-footer {
      padding: 10px 14px;
      border-top: 1px solid var(--border);
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    /* Room / Map */
    .room-header {
      padding: 16px;
      background: var(--bg-panel-light);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .room-icon {
      font-size: 32px;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-panel);
      border-radius: 8px;
      border: 1px solid var(--border);
    }

    .room-info h2 { font-size: 1.2rem; margin-bottom: 2px; }
    .room-info .room-type { color: var(--text-dim); font-size: 12px; text-transform: uppercase; }

    .room-description {
      padding: 12px 16px;
      color: var(--text-dim);
      font-style: italic;
      border-bottom: 1px solid var(--border);
    }

    .room-content {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
    }

    .room-actions {
      padding: 12px 16px;
      border-top: 1px solid var(--border);
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    /* Map */
    .map-grid {
      display: grid;
      gap: 8px;
      padding: 16px;
      justify-content: center;
    }

    .map-cell {
      width: 72px;
      height: 72px;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      cursor: pointer;
      border: 2px solid transparent;
      transition: all 0.15s;
      position: relative;
    }

    .map-cell.discovered {
      background: var(--bg-panel-light);
      border-color: var(--border);
    }

    .map-cell.current {
      border-color: var(--accent-light);
      box-shadow: 0 0 12px rgba(102, 68, 204, 0.4);
    }

    .map-cell.cleared {
      opacity: 0.7;
    }

    .map-cell.undiscovered {
      background: var(--bg-dark);
      opacity: 0.3;
      cursor: default;
    }

    .map-cell.adjacent {
      border-color: var(--accent);
      cursor: pointer;
    }

    .map-cell.adjacent:hover {
      background: var(--bg-panel-hover);
      transform: scale(1.05);
    }

    .map-cell-icon { font-size: 20px; margin-bottom: 2px; }
    .map-cell-name { text-align: center; line-height: 1.1; overflow: hidden; text-overflow: ellipsis; max-width: 64px; }

    .map-connection {
      position: absolute;
      background: var(--border);
    }

    /* Combat */
    .combat-arena {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      min-height: 200px;
    }

    .combat-side {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 16px;
      border-radius: 12px;
      min-width: 180px;
    }

    .player-side {
      background: rgba(51, 102, 204, 0.1);
      border: 1px solid rgba(51, 102, 204, 0.3);
    }

    .enemy-side {
      background: rgba(204, 51, 51, 0.1);
      border: 1px solid rgba(204, 51, 51, 0.3);
    }

    .combat-entity {
      text-align: center;
    }

    .entity-portrait {
      width: 64px;
      height: 64px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      margin: 0 auto 6px;
    }

    .player-portrait { background: rgba(51, 102, 204, 0.2); border: 2px solid var(--mana-bar); }
    .enemy-portrait { background: rgba(204, 51, 51, 0.2); border: 2px solid var(--hp-bar); }

    .entity-name { font-weight: 600; font-size: 13px; }
    .entity-hp { font-size: 11px; color: var(--text-dim); }

    .combat-vs {
      font-family: 'Cinzel', serif;
      font-size: 2rem;
      color: var(--text-dim);
      font-weight: 700;
    }

    .combat-log {
      flex: 1;
      overflow-y: auto;
      padding: 8px 12px;
      font-size: 12px;
      font-family: 'Inter', monospace;
      line-height: 1.6;
    }

    .log-action { color: var(--info); }
    .log-damage { color: var(--danger); }
    .log-heal { color: var(--success); }
    .log-info { color: var(--text-dim); }
    .log-trait { color: var(--accent-light); }
    .log-policy { color: var(--warning); }

    .combat-controls {
      padding: 10px 16px;
      border-top: 1px solid var(--border);
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }

    .speed-label { font-size: 11px; color: var(--text-dim); }

    /* Forge */
    .forge-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 8px;
    }

    .rune-card, .spell-card, .item-card {
      padding: 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg-panel);
      cursor: pointer;
      transition: all 0.15s;
      text-align: center;
    }

    .rune-card:hover, .spell-card:hover, .item-card:hover {
      border-color: var(--accent);
      background: var(--bg-panel-hover);
    }

    .rune-card.selected, .spell-card.selected {
      border-color: var(--accent-light);
      background: rgba(102, 68, 204, 0.2);
    }

    .rune-card.locked {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .element-tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .el-fire { background: rgba(255, 102, 51, 0.2); color: var(--fire); }
    .el-ice { background: rgba(68, 187, 255, 0.2); color: var(--ice); }
    .el-lightning { background: rgba(255, 221, 68, 0.2); color: var(--lightning); }
    .el-shadow { background: rgba(153, 68, 204, 0.2); color: var(--shadow); }
    .el-nature { background: rgba(68, 204, 102, 0.2); color: var(--nature); }
    .el-arcane { background: rgba(204, 68, 255, 0.2); color: var(--arcane); }

    /* Inventory / Character */
    .inventory-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 8px;
    }

    .equip-slot {
      padding: 8px;
      border: 1px dashed var(--border);
      border-radius: 6px;
      text-align: center;
      min-height: 60px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }

    .equip-slot.filled { border-style: solid; background: var(--bg-panel); }

    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid rgba(42, 42, 74, 0.5);
    }

    .stat-label { color: var(--text-dim); }
    .stat-value { font-weight: 600; }

    .trait-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
    }

    .trait-bar {
      flex: 1;
      height: 8px;
      background: var(--bg-dark);
      border-radius: 4px;
      overflow: hidden;
    }

    .trait-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s;
    }

    /* Skill Tree */
    .skill-tree {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .skill-node {
      padding: 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      text-align: center;
      cursor: pointer;
      transition: all 0.15s;
    }

    .skill-node.unlocked { border-color: var(--success); background: rgba(51, 204, 102, 0.1); }
    .skill-node.available { border-color: var(--accent); }
    .skill-node.locked { opacity: 0.5; cursor: not-allowed; }

    /* Merchant */
    .merchant-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px;
      border: 1px solid var(--border);
      border-radius: 6px;
      margin-bottom: 6px;
    }

    .merchant-item:hover {
      background: var(--bg-panel-hover);
    }

    /* Notifications */
    .notifications {
      position: fixed;
      top: 50px;
      right: 16px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 6px;
      pointer-events: none;
    }

    .notif {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      animation: notifSlide 0.3s ease;
      max-width: 350px;
    }

    .notif-info { background: rgba(51, 136, 204, 0.9); color: white; }
    .notif-reward { background: rgba(255, 204, 51, 0.9); color: #333; }
    .notif-danger { background: rgba(204, 51, 51, 0.9); color: white; }
    .notif-trait { background: rgba(102, 68, 204, 0.9); color: white; }

    @keyframes notifSlide {
      from { transform: translateX(100px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    /* Dialogue */
    .dialogue-box {
      padding: 20px;
      max-width: 600px;
      margin: 0 auto;
    }

    .dialogue-portrait {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .dialogue-portrait .portrait-icon {
      font-size: 48px;
      width: 64px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-panel);
      border-radius: 50%;
      border: 2px solid var(--accent);
    }

    .dialogue-text {
      padding: 16px;
      background: var(--bg-panel-light);
      border-radius: 8px;
      margin-bottom: 12px;
      border-left: 3px solid var(--accent);
      line-height: 1.6;
    }

    .dialogue-choices {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .dialogue-choice {
      padding: 10px 16px;
      border: 1px solid var(--border);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
      text-align: left;
    }

    .dialogue-choice:hover {
      background: var(--bg-panel-hover);
      border-color: var(--accent);
    }

    /* Overlay menus */
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(10, 10, 18, 0.95);
      z-index: 100;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .overlay-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
    }

    .overlay-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .overlay-tabs {
      display: flex;
      gap: 4px;
      padding: 8px 20px;
      border-bottom: 1px solid var(--border);
    }

    .tab-btn {
      padding: 6px 14px;
      border: 1px solid transparent;
      border-radius: 6px 6px 0 0;
      background: transparent;
      color: var(--text-dim);
      cursor: pointer;
      font-size: 13px;
      transition: all 0.15s;
    }

    .tab-btn.active {
      background: var(--bg-panel-light);
      border-color: var(--border);
      border-bottom-color: transparent;
      color: var(--text-bright);
    }

    .tab-btn:hover { color: var(--text); }

    /* Policy editor */
    .policy-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border: 1px solid var(--border);
      border-radius: 6px;
      margin-bottom: 6px;
    }

    .policy-priority {
      width: 30px;
      text-align: center;
      font-weight: 700;
      color: var(--accent);
    }

    .policy-condition { color: var(--warning); font-size: 12px; }
    .policy-action { color: var(--info); font-size: 12px; flex: 1; }

    .policy-toggle {
      width: 36px; height: 18px;
      border-radius: 9px;
      background: var(--border);
      cursor: pointer;
      position: relative;
      transition: background 0.2s;
    }

    .policy-toggle.on { background: var(--success); }

    .policy-toggle::after {
      content: '';
      position: absolute;
      width: 14px; height: 14px;
      border-radius: 50%;
      background: white;
      top: 2px; left: 2px;
      transition: transform 0.2s;
    }

    .policy-toggle.on::after { transform: translateX(18px); }

    /* Victory / Game Over */
    .end-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      text-align: center;
    }

    .end-screen h1 {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }

    .end-screen .stats {
      color: var(--text-dim);
      margin-bottom: 2rem;
      line-height: 2;
    }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--border-light); }

    /* Floor switcher */
    .floor-tabs {
      display: flex;
      gap: 4px;
      padding: 8px 16px;
      border-bottom: 1px solid var(--border);
      background: var(--bg-panel);
    }

    .floor-tab {
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-dim);
    }

    .floor-tab.active { background: var(--accent); color: white; border-color: var(--accent); }
    .floor-tab.locked { opacity: 0.3; cursor: not-allowed; }

    /* Event room */
    .event-text {
      padding: 16px;
      background: var(--bg-panel-light);
      border-radius: 8px;
      margin-bottom: 16px;
      line-height: 1.7;
      border-left: 3px solid var(--warning);
    }

    .event-choices {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    /* Game clock */
    .game-clock {
      font-size: 11px;
      color: var(--text-dim);
    }

    /* Loadout */
    .loadout-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 8px;
    }

    .loadout-slot {
      padding: 10px;
      border: 2px dashed var(--border);
      border-radius: 8px;
      text-align: center;
      min-height: 80px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s;
    }

    .loadout-slot.filled {
      border-style: solid;
      background: var(--bg-panel);
    }

    .loadout-slot:hover {
      border-color: var(--accent);
    }

    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--accent-light);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 16px 0 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--border);
    }
  `;
  document.head.appendChild(style);
}
