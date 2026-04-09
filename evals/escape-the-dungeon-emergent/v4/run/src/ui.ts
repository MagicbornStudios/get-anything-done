import type { ContentData } from "./content";
import { findRoom } from "./content";
import type { GameState, Room, Spell } from "./types";
import { makeEnemy, playerAttack, playerCastSpell, playerFlee, playerUsePotion, startCombat } from "./combat";
import { craftSpell, findCombo, trainAffinity } from "./forge";
import { saveGame } from "./state";

const ROOM_ICONS: Record<string, string> = {
  start: "game-icons:dungeon-gate",
  combat: "game-icons:crossed-swords",
  elite: "game-icons:spiked-halo",
  forge: "game-icons:anvil",
  rest: "game-icons:campfire",
  event: "game-icons:open-book",
  boss: "game-icons:dragon-head",
};

export class UI {
  private root: HTMLElement;
  private content: ContentData;
  private state!: GameState;
  private toastTimer?: number;
  private onNewGame: () => void;
  private onLoad: () => boolean;

  constructor(root: HTMLElement, content: ContentData, onNewGame: () => void, onLoad: () => boolean) {
    this.root = root;
    this.content = content;
    this.onNewGame = onNewGame;
    this.onLoad = onLoad;
  }

  setState(state: GameState) {
    this.state = state;
    state.onUpdate = () => this.render();
  }

  render() {
    if (!this.state) {
      this.renderTitle();
      return;
    }
    switch (this.state.view) {
      case "title": this.renderTitle(); break;
      case "room": this.renderRoom(); break;
      case "combat": this.renderCombat(); break;
      case "forge": this.renderForge(); break;
      case "rest": this.renderRest(); break;
      case "event": this.renderEvent(); break;
      case "victory": this.renderVictory(); break;
      case "defeat": this.renderDefeat(); break;
    }
    if (this.state.view !== "defeat" && this.state.view !== "title") {
      saveGame(this.state);
    }
  }

  private hud(): string {
    const p = this.state.player;
    const floor = this.content.floors[this.state.currentFloor];
    const hpPct = Math.max(0, Math.min(100, (p.currentHp / p.maxHp) * 100));
    const manaPct = Math.max(0, Math.min(100, (p.currentMana / p.maxMana) * 100));
    return `
      <div class="hud">
        <div class="player-name">
          <iconify-icon icon="game-icons:wizard-face"></iconify-icon>
          ${p.name}
          <span style="color:var(--ink-2);font-weight:normal;font-size:12px;">Lv ${p.level}</span>
        </div>
        <div class="bars">
          <div class="bar hp">
            <span class="label"><iconify-icon icon="game-icons:hearts"></iconify-icon>HP</span>
            <div class="track"><div class="fill" style="width:${hpPct}%"></div><div class="text">${p.currentHp}/${p.maxHp}</div></div>
          </div>
          <div class="bar mana">
            <span class="label"><iconify-icon icon="game-icons:crystal-ball"></iconify-icon>MP</span>
            <div class="track"><div class="fill" style="width:${manaPct}%"></div><div class="text">${p.currentMana}/${p.maxMana}</div></div>
          </div>
        </div>
        <div class="meta">
          <span><iconify-icon icon="${floor?.icon || "game-icons:dungeon-gate"}"></iconify-icon>${floor?.name ?? "??"}</span>
          <span class="gold"><iconify-icon icon="game-icons:crystal-growth"></iconify-icon>${p.crystals}</span>
          <span><iconify-icon icon="game-icons:laurel-crown"></iconify-icon>${p.xp} XP</span>
          <span><iconify-icon icon="game-icons:hourglass"></iconify-icon>T${this.state.tick}</span>
        </div>
        <div class="menu-buttons">
          <button class="btn" data-action="open-spellbook" title="Spellbook"><iconify-icon icon="game-icons:spell-book"></iconify-icon></button>
          <button class="btn" data-action="open-traits" title="Traits"><iconify-icon icon="game-icons:character"></iconify-icon></button>
          <button class="btn" data-action="open-map" title="Map"><iconify-icon icon="game-icons:treasure-map"></iconify-icon></button>
        </div>
      </div>
    `;
  }

  private renderTitle() {
    this.root.innerHTML = `
      <div class="frame">
        <div class="title-screen">
          <div class="hero"><iconify-icon icon="game-icons:dungeon-gate"></iconify-icon></div>
          <h1>ESCAPE THE DUNGEON</h1>
          <p class="subtitle">A roguelike of runes, reason, and ruin.</p>
          <div class="menu">
            <button class="btn primary" data-action="new-game"><iconify-icon icon="game-icons:sword-altar"></iconify-icon>New Game</button>
            <button class="btn" data-action="continue"><iconify-icon icon="game-icons:save-arrow"></iconify-icon>Continue</button>
          </div>
          <p style="color:var(--ink-2);font-size:12px;margin-top:40px;">Craft spells. Counter the warden. Survive.</p>
        </div>
      </div>
    `;
    this.bind();
  }

  private renderRoom() {
    const floor = this.content.floors[this.state.currentFloor];
    const room = findRoom(this.content, this.state.currentFloor, this.state.currentRoom);
    if (!room) return this.renderError("Room not found");
    const theme = room.feature;
    const clearedList = this.state.clearedRooms[floor.id] || [];
    const discovered = this.state.discoveredRooms[floor.id] || [];

    const miniMap = floor.rooms.map((r) => {
      const visible = discovered.includes(r.id) || r.feature === "boss";
      const current = r.id === room.id;
      const cleared = clearedList.includes(r.id);
      const cls = `room-cell ${current ? "current" : ""} ${cleared ? "cleared" : ""}`;
      const icon = ROOM_ICONS[r.feature] || "game-icons:dungeon-gate";
      const label = visible ? r.name : "???";
      return `<div class="${cls}"><iconify-icon icon="${icon}"></iconify-icon><span>${label}</span></div>`;
    }).join("");

    let actionsHtml = "";
    if (room.feature === "combat" && !clearedList.includes(room.id)) {
      const enemyDef = room.encounter ? this.content.enemies[room.encounter.enemy] : undefined;
      actionsHtml = `
        <div class="room-content">
          <p>An enemy blocks the way: <strong>${enemyDef?.name ?? "???"}</strong>.</p>
          <button class="btn danger" data-action="engage"><iconify-icon icon="game-icons:crossed-swords"></iconify-icon>Engage</button>
        </div>`;
    } else if (room.feature === "elite" && !clearedList.includes(room.id)) {
      const enemyDef = room.encounter ? this.content.enemies[room.encounter.enemy] : undefined;
      actionsHtml = `
        <div class="room-content">
          <p>An elite foe: <strong>${enemyDef?.name ?? "???"}</strong> (Elite).</p>
          <button class="btn danger" data-action="engage"><iconify-icon icon="game-icons:spiked-halo"></iconify-icon>Engage Elite</button>
        </div>`;
    } else if (room.feature === "boss" && !clearedList.includes(room.id)) {
      const enemyDef = room.encounter ? this.content.enemies[room.encounter.enemy] : undefined;
      actionsHtml = `
        <div class="room-content">
          <p style="color:var(--blood);font-weight:bold;">${enemyDef?.name ?? "???"} awaits.</p>
          <button class="btn danger" data-action="engage"><iconify-icon icon="game-icons:dragon-head"></iconify-icon>Challenge the Boss</button>
        </div>`;
    } else if (room.feature === "forge") {
      actionsHtml = `<div class="room-content"><button class="btn arcane" data-action="open-forge"><iconify-icon icon="game-icons:anvil"></iconify-icon>Approach the Forge</button></div>`;
    } else if (room.feature === "rest") {
      actionsHtml = `<div class="room-content"><button class="btn success" data-action="open-rest"><iconify-icon icon="game-icons:campfire"></iconify-icon>Rest Here</button></div>`;
    } else if (room.feature === "event" && !clearedList.includes(room.id)) {
      actionsHtml = `<div class="room-content"><button class="btn" data-action="open-event"><iconify-icon icon="game-icons:open-book"></iconify-icon>Investigate</button></div>`;
    }

    const exitsHtml = room.exits.map((e) => {
      const target = findRoom(this.content, this.state.currentFloor, e.to);
      const icon = target ? (ROOM_ICONS[target.feature] || "game-icons:path-distance") : "game-icons:path-distance";
      return `<button class="btn" data-action="go" data-target="${e.to}"><iconify-icon icon="${icon}"></iconify-icon>${e.label}</button>`;
    }).join("");

    this.root.innerHTML = `
      <div class="frame">
        ${this.hud()}
        <div class="room-view theme-${theme}" data-theme="${theme}">
          <div class="room-main">
            <div class="room-header">
              <div class="room-icon"><iconify-icon icon="${ROOM_ICONS[theme] || "game-icons:dungeon-gate"}"></iconify-icon></div>
              <div>
                <h2>${room.name}</h2>
                <span class="room-type-tag ${theme}">${theme}</span>
              </div>
            </div>
            <div class="room-description">${room.description}</div>
            ${actionsHtml}
            <div class="exits">
              <h3>Passages</h3>
              ${exitsHtml}
            </div>
          </div>
          <div class="room-aside">
            <h3><iconify-icon icon="game-icons:treasure-map"></iconify-icon> ${floor.name}</h3>
            <div class="mini-map">${miniMap}</div>
            <div class="floor-intel">
              <span class="label">Floor Intel</span>
              ${floor.intel}
            </div>
          </div>
        </div>
      </div>
    `;
    this.bind();
  }

  private renderCombat() {
    const c = this.state.combat!;
    const p = this.state.player;
    const enemy = c.enemy;
    const hpPct = Math.max(0, (p.currentHp / p.maxHp) * 100);
    const manaPct = Math.max(0, (p.currentMana / p.maxMana) * 100);
    const eHpPct = Math.max(0, (enemy.currentHp / enemy.def.maxHp) * 100);

    const logHtml = c.log.map((l) => `<div class="entry ${l.kind}">${l.text}</div>`).join("");
    const statusBadges = enemy.statuses.map((s) => {
      const ic = s.kind === "burn" ? "game-icons:flame" : s.kind === "bleed" ? "game-icons:bleeding-wound" : s.kind === "poison" ? "game-icons:poison-bottle" : s.kind === "stun" ? "game-icons:knocked-out-stars" : "game-icons:snowflake-1";
      return `<iconify-icon icon="${ic}" title="${s.kind} ${s.turns}t"></iconify-icon>`;
    }).join(" ");

    const playerDamagedRecent = Date.now() - c.playerDamagedTick < 400;
    const enemyDamagedRecent = Date.now() - c.enemyDamagedTick < 400;

    const endButtons = c.ended
      ? `<button class="btn primary" data-action="end-combat"><iconify-icon icon="game-icons:flying-flag"></iconify-icon>Continue</button>`
      : `
        <button class="btn danger" data-action="fight" ${c.turn !== "player" ? "disabled" : ""}><iconify-icon icon="game-icons:crossed-swords"></iconify-icon>Fight</button>
        <button class="btn arcane" data-action="open-spells" ${c.turn !== "player" ? "disabled" : ""}><iconify-icon icon="game-icons:magic-swirl"></iconify-icon>Spells</button>
        <button class="btn success" data-action="potion" ${c.turn !== "player" ? "disabled" : ""}><iconify-icon icon="game-icons:health-potion"></iconify-icon>Potion (3c)</button>
        <button class="btn" data-action="flee" ${c.turn !== "player" ? "disabled" : ""}><iconify-icon icon="game-icons:run"></iconify-icon>Flee</button>
      `;

    this.root.innerHTML = `
      <div class="frame">
        ${this.hud()}
        <div class="combat-view">
          <div class="stage">
            <div class="combatant player ${playerDamagedRecent ? "damaged" : ""}">
              <div class="avatar"><iconify-icon icon="game-icons:wizard-face"></iconify-icon></div>
              <div class="name">${p.name}</div>
              <div class="bars">
                <div class="bar hp"><div class="track"><div class="fill" style="width:${hpPct}%"></div><div class="text">${p.currentHp}/${p.maxHp}</div></div></div>
                <div class="bar mana"><div class="track"><div class="fill" style="width:${manaPct}%"></div><div class="text">${p.currentMana}/${p.maxMana}</div></div></div>
              </div>
            </div>
            <div class="combatant enemy ${enemyDamagedRecent ? "damaged" : ""}">
              <div class="avatar"><iconify-icon icon="${enemy.def.icon}"></iconify-icon></div>
              <div class="name">${enemy.def.name} ${statusBadges}</div>
              <div class="bars">
                <div class="bar hp"><div class="track"><div class="fill" style="width:${eHpPct}%"></div><div class="text">${Math.max(0, enemy.currentHp)}/${enemy.def.maxHp}</div></div></div>
              </div>
            </div>
          </div>
          <div class="combat-log">${logHtml}</div>
          <div class="combat-actions">${endButtons}</div>
        </div>
      </div>
    `;
    this.bind();
  }

  private renderSpellPicker() {
    const p = this.state.player;
    const rows = p.spellbook.map((s) => {
      const affordable = p.currentMana >= s.cost;
      const craftedTag = s.crafted ? `<span style="color:var(--gold);font-size:10px;margin-left:6px;">CRAFTED</span>` : "";
      return `
        <div class="spell-row ${affordable ? "" : "disabled"}" data-action="cast" data-spell-id="${s.id}">
          <iconify-icon icon="${s.icon}"></iconify-icon>
          <div class="info">
            <div class="name">${s.name}${craftedTag}</div>
            <div class="desc">${s.description}</div>
          </div>
          <div class="cost"><iconify-icon icon="game-icons:crystal-ball"></iconify-icon>${s.cost}</div>
        </div>
      `;
    }).join("");
    const modal = document.createElement("div");
    modal.className = "spell-picker";
    modal.innerHTML = `
      <div class="inner">
        <h2><iconify-icon icon="game-icons:spell-book"></iconify-icon> Spellbook</h2>
        <div class="spell-list">${rows}</div>
        <div class="btn-row"><button class="btn" data-action="close-modal">Close</button></div>
      </div>
    `;
    this.root.appendChild(modal);
    this.bind();
  }

  private renderForge() {
    const p = this.state.player;
    const runes = this.content.runes.filter((r) => p.knownRunes.includes(r.id));
    const selected = (this as any)._forgeSel as string[] || [];
    const combo = findCombo(this.content, selected);

    const runeGrid = runes.map((r) => {
      const sel = selected.includes(r.id) ? "selected" : "";
      const aff = p.runeAffinity[r.id] || 0;
      return `
        <div class="rune-chip ${sel} ${r.element}" data-action="toggle-rune" data-rune="${r.id}">
          <iconify-icon icon="${r.icon}"></iconify-icon>
          <div class="rune-name">${r.name}</div>
          <div class="affinity">★${aff}</div>
        </div>
      `;
    }).join("");

    const previewHtml = combo ? `
      <div class="preview-icon"><iconify-icon icon="${combo.icon}"></iconify-icon></div>
      <div class="preview-name">${combo.name}</div>
      <div class="preview-desc">${combo.description}</div>
      <div style="margin-top:10px;color:var(--mana);font-size:12px;">Cost: ${combo.cost} mana</div>
    ` : `
      <div style="font-size:32px;opacity:0.4;"><iconify-icon icon="game-icons:anvil"></iconify-icon></div>
      <div>Select 2 runes to reveal a combination.</div>
    `;

    const spellbookHtml = p.spellbook.map((s) => `
      <div class="spell-row">
        <iconify-icon icon="${s.icon}"></iconify-icon>
        <div class="info">
          <div class="name">${s.name}${s.crafted ? " <span style=\"color:var(--gold);font-size:10px;\">CRAFTED</span>" : ""}</div>
          <div class="desc">${s.description}</div>
        </div>
        <div class="cost"><iconify-icon icon="game-icons:crystal-ball"></iconify-icon>${s.cost}</div>
      </div>
    `).join("");

    this.root.innerHTML = `
      <div class="frame">
        ${this.hud()}
        <div class="forge-view">
          <h2><iconify-icon icon="game-icons:anvil"></iconify-icon> The Runesmithy</h2>
          <div class="flavor">Pick two runes. The forge will speak if they belong together. (5 crystals per craft.)</div>
          <div class="forge-grid">
            <div class="forge-panel">
              <h3>Runes</h3>
              <div class="rune-grid">${runeGrid}</div>
              <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn primary" data-action="forge-craft" ${combo ? "" : "disabled"}><iconify-icon icon="game-icons:flame"></iconify-icon>Forge Spell</button>
                <button class="btn" data-action="forge-clear"><iconify-icon icon="game-icons:cancel"></iconify-icon>Clear</button>
              </div>
            </div>
            <div class="forge-panel">
              <h3>Preview</h3>
              <div class="preview-slot ${combo ? "has-combo" : ""}">${previewHtml}</div>
              <h3 style="margin-top:14px;">Spellbook</h3>
              <div class="spellbook">${spellbookHtml}</div>
            </div>
          </div>
          <div style="margin-top:16px;display:flex;gap:8px;">
            <button class="btn" data-action="leave-forge"><iconify-icon icon="game-icons:exit-door"></iconify-icon>Leave the Forge</button>
            <button class="btn" data-action="train-affinity"><iconify-icon icon="game-icons:upgrade"></iconify-icon>Train Affinity (10 XP)</button>
          </div>
        </div>
      </div>
    `;
    this.bind();
  }

  private renderRest() {
    this.root.innerHTML = `
      <div class="frame">
        ${this.hud()}
        <div class="rest-view">
          <div class="bonfire"><iconify-icon icon="game-icons:campfire"></iconify-icon></div>
          <h2>You Rest by the Fire</h2>
          <p style="color:var(--ink-1);">A cap of recovery: restore HP and mana to 75% of max.</p>
          <div class="actions">
            <button class="btn success" data-action="do-rest"><iconify-icon icon="game-icons:hearts"></iconify-icon>Recover</button>
            <button class="btn" data-action="leave-rest"><iconify-icon icon="game-icons:exit-door"></iconify-icon>Move On</button>
          </div>
        </div>
      </div>
    `;
    this.bind();
  }

  private renderEvent() {
    const room = findRoom(this.content, this.state.currentFloor, this.state.currentRoom);
    if (!room || !room.event_id) return this.renderRoom();
    const ev = this.content.events[room.event_id];
    if (!ev) return this.renderRoom();
    const choicesHtml = ev.choices.map((c, i) =>
      `<button class="btn" data-action="event-choice" data-index="${i}">${c.label}</button>`
    ).join("");
    this.root.innerHTML = `
      <div class="frame">
        ${this.hud()}
        <div class="event-view">
          <div class="portrait"><iconify-icon icon="game-icons:open-book"></iconify-icon></div>
          <h2>${ev.title}</h2>
          <div class="story">${ev.story}</div>
          <div class="choices">${choicesHtml}</div>
        </div>
      </div>
    `;
    this.bind();
  }

  private renderVictory() {
    this.root.innerHTML = `
      <div class="frame">
        <div class="end-screen victory">
          <div class="icon"><iconify-icon icon="game-icons:trophy-cup"></iconify-icon></div>
          <h1>ESCAPE ACHIEVED</h1>
          <p class="summary">You have broken free of the dungeon. The runes you forged burn still in memory.</p>
          <button class="btn primary" data-action="title"><iconify-icon icon="game-icons:dungeon-gate"></iconify-icon>Return to Title</button>
        </div>
      </div>
    `;
    this.bind();
  }

  private renderDefeat() {
    this.root.innerHTML = `
      <div class="frame">
        <div class="end-screen defeat">
          <div class="icon"><iconify-icon icon="game-icons:tombstone"></iconify-icon></div>
          <h1>YOU HAVE FALLEN</h1>
          <p class="summary">The dungeon claims another. Perhaps a different combination of runes...</p>
          <button class="btn primary" data-action="title"><iconify-icon icon="game-icons:dungeon-gate"></iconify-icon>Try Again</button>
        </div>
      </div>
    `;
    this.bind();
  }

  private renderError(msg: string) {
    this.root.innerHTML = `<div class="frame"><div class="title-screen"><h1>Error</h1><p>${msg}</p><button class="btn" data-action="title">Return</button></div></div>`;
    this.bind();
  }

  // ============================================================
  // Bind and handle actions
  // ============================================================
  private bind() {
    this.root.querySelectorAll<HTMLElement>("[data-action]").forEach((el) => {
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const action = el.dataset.action!;
        this.handle(action, el);
      });
    });
  }

  private handle(action: string, el: HTMLElement) {
    switch (action) {
      case "new-game": this.onNewGame(); break;
      case "continue": {
        if (!this.onLoad()) {
          this.toast("No save found.");
        }
        break;
      }
      case "title": {
        this.state.view = "title";
        this.render();
        break;
      }
      case "go": {
        const target = el.dataset.target!;
        this.goTo(target);
        break;
      }
      case "engage": {
        this.engageEncounter();
        break;
      }
      case "fight": playerAttack(this.state); this.render(); break;
      case "open-spells": this.renderSpellPicker(); break;
      case "cast": {
        const id = el.dataset.spellId!;
        const spell = this.state.player.spellbook.find((s) => s.id === id);
        if (!spell) return;
        const r = playerCastSpell(this.state, spell);
        this.closeModal();
        if (!r.ok) this.toast(r.reason || "Cannot cast");
        this.render();
        break;
      }
      case "potion": playerUsePotion(this.state); this.render(); break;
      case "flee": {
        const ok = playerFlee(this.state);
        if (ok) {
          // return to previous room — just keep currentRoom; but we came from returnTo
          this.state.view = "room";
          this.state.combat = undefined;
        }
        this.render();
        break;
      }
      case "end-combat": {
        this.finishCombat();
        break;
      }
      case "close-modal": this.closeModal(); break;
      case "open-forge": this.state.view = "forge"; this.render(); break;
      case "leave-forge": this.state.view = "room"; (this as any)._forgeSel = []; this.render(); break;
      case "toggle-rune": {
        const r = el.dataset.rune!;
        const sel: string[] = (this as any)._forgeSel || [];
        const idx = sel.indexOf(r);
        if (idx >= 0) sel.splice(idx, 1);
        else {
          if (sel.length >= 2) sel.shift();
          sel.push(r);
        }
        (this as any)._forgeSel = sel;
        this.render();
        break;
      }
      case "forge-craft": {
        const sel: string[] = (this as any)._forgeSel || [];
        const res = craftSpell(this.state, this.content, sel);
        if (!res.ok) this.toast(res.reason || "Cannot craft");
        else {
          this.toast(`Forged: ${res.spell!.name}`);
          (this as any)._forgeSel = [];
        }
        this.render();
        break;
      }
      case "forge-clear": (this as any)._forgeSel = []; this.render(); break;
      case "train-affinity": {
        // train first known rune for simplicity
        const r = this.state.player.knownRunes[0];
        const res = trainAffinity(this.state, r);
        if (!res.ok) this.toast(res.reason || "Cannot train");
        else this.toast(`Trained ${r} affinity.`);
        this.render();
        break;
      }
      case "open-rest": this.state.view = "rest"; this.render(); break;
      case "leave-rest": this.state.view = "room"; this.render(); break;
      case "do-rest": {
        const p = this.state.player;
        p.currentHp = Math.max(p.currentHp, Math.round(p.maxHp * 0.75));
        p.currentMana = Math.max(p.currentMana, Math.round(p.maxMana * 0.75));
        this.toast("You recover.");
        this.render();
        break;
      }
      case "open-event": this.state.view = "event"; this.render(); break;
      case "event-choice": {
        const idx = parseInt(el.dataset.index!, 10);
        const room = findRoom(this.content, this.state.currentFloor, this.state.currentRoom)!;
        const ev = this.content.events[room.event_id!];
        const choice = ev.choices[idx];
        if (choice.effect.heal) this.state.player.currentHp = Math.min(this.state.player.maxHp, this.state.player.currentHp + choice.effect.heal);
        if (choice.effect.crystals) this.state.player.crystals += choice.effect.crystals;
        if (choice.effect.grantRune && !this.state.player.knownRunes.includes(choice.effect.grantRune)) this.state.player.knownRunes.push(choice.effect.grantRune);
        if (choice.effect.trait) {
          for (const [k, v] of Object.entries(choice.effect.trait)) {
            this.state.player.narrativeStats[k] = (this.state.player.narrativeStats[k] || 0) + v;
          }
        }
        if (choice.effect.toast) this.toast(choice.effect.toast);
        const floor = this.content.floors[this.state.currentFloor];
        if (!this.state.clearedRooms[floor.id].includes(room.id)) this.state.clearedRooms[floor.id].push(room.id);
        this.state.view = "room";
        this.render();
        break;
      }
      case "open-spellbook": this.renderSpellPicker(); break;
      case "open-traits": this.openTraits(); break;
      case "open-map": this.toast("Map is shown in the sidebar."); break;
    }
  }

  private goTo(targetId: string) {
    const floor = this.content.floors[this.state.currentFloor];
    const target = findRoom(this.content, this.state.currentFloor, targetId);
    if (!target) return;
    this.state.currentRoom = targetId;
    this.state.tick += 1;
    if (!this.state.discoveredRooms[floor.id]) this.state.discoveredRooms[floor.id] = [];
    if (!this.state.discoveredRooms[floor.id].includes(targetId)) this.state.discoveredRooms[floor.id].push(targetId);
    // discover neighbors
    for (const ex of target.exits) {
      if (!this.state.discoveredRooms[floor.id].includes(ex.to)) this.state.discoveredRooms[floor.id].push(ex.to);
    }
    // tick status effects on player
    const rem = [];
    for (const s of this.state.player.statuses) {
      if (s.dmgPerTurn) this.state.player.currentHp -= s.dmgPerTurn;
      s.turns -= 1;
      if (s.turns > 0) rem.push(s);
    }
    this.state.player.statuses = rem;
    this.state.view = "room";
    this.render();
  }

  private engageEncounter() {
    const room = findRoom(this.content, this.state.currentFloor, this.state.currentRoom);
    if (!room || !room.encounter) return;
    const def = this.content.enemies[room.encounter.enemy];
    if (!def) return;
    const enemy = makeEnemy(room.encounter.enemy, def, room.encounter.elite);
    startCombat(this.state, enemy, room.id);
    this.render();
  }

  private finishCombat() {
    const c = this.state.combat;
    if (!c) return;
    const floor = this.content.floors[this.state.currentFloor];
    const outcome = c.outcome;
    const room = findRoom(this.content, this.state.currentFloor, this.state.currentRoom);

    if (outcome === "win" && room) {
      if (!this.state.clearedRooms[floor.id].includes(room.id)) this.state.clearedRooms[floor.id].push(room.id);
      if (room.feature === "boss") {
        this.state.floorsCleared += 1;
        if (this.state.currentFloor + 1 < this.content.floors.length) {
          // advance to next floor
          this.state.currentFloor += 1;
          const next = this.content.floors[this.state.currentFloor];
          this.state.currentRoom = next.start;
          this.state.discoveredRooms[next.id] = [next.start];
          this.state.clearedRooms[next.id] = [];
          this.toast(`Floor cleared! Descending to ${next.name}.`);
        } else {
          this.state.view = "victory";
          this.state.combat = undefined;
          this.render();
          return;
        }
      }
    }
    this.state.combat = undefined;
    this.state.view = "room";
    this.render();
  }

  private closeModal() {
    this.root.querySelectorAll(".spell-picker, .modal").forEach((n) => n.remove());
  }

  private openTraits() {
    const p = this.state.player;
    const rows = Object.entries(p.narrativeStats).map(([k, v]) =>
      `<div class="trait-row"><span>${k}</span><span class="val">${v}</span></div>`
    ).join("");
    const aff = Object.entries(p.runeAffinity).map(([k, v]) =>
      `<div class="trait-row"><span>${k}</span><span class="val">★${v}</span></div>`
    ).join("");
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="inner">
        <h2><iconify-icon icon="game-icons:character"></iconify-icon> Traits</h2>
        <p style="color:var(--ink-2);font-size:12px;">Narrative stats that shape dialogue and progression.</p>
        <div class="traits-list">${rows}</div>
        <h2 style="margin-top:16px;"><iconify-icon icon="game-icons:rune-stone"></iconify-icon> Rune Affinity</h2>
        <div class="traits-list">${aff}</div>
        <div class="btn-row"><button class="btn" data-action="close-modal">Close</button></div>
      </div>
    `;
    this.root.appendChild(modal);
    this.bind();
  }

  private toast(msg: string) {
    const existing = this.root.querySelector(".toast");
    if (existing) existing.remove();
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = `<iconify-icon icon="game-icons:sparkles"></iconify-icon>${msg}`;
    document.body.appendChild(t);
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.remove(), 2500);
  }
}
