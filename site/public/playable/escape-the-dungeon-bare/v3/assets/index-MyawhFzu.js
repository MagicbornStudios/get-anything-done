(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))s(t);new MutationObserver(t=>{for(const o of t)if(o.type==="childList")for(const i of o.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&s(i)}).observe(document,{childList:!0,subtree:!0});function a(t){const o={};return t.integrity&&(o.integrity=t.integrity),t.referrerPolicy&&(o.referrerPolicy=t.referrerPolicy),t.crossOrigin==="use-credentials"?o.credentials="include":t.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function s(t){if(t.ep)return;t.ep=!0;const o=a(t);fetch(t.href,o)}})();const v=[{id:"goblin",name:"Cave Goblin",description:"A sneaky goblin lurking in the shadows.",combatStats:{currentHp:25,maxHp:25,currentMana:5,maxMana:5,might:6,agility:8,defense:3,power:2,insight:2,willpower:2},xpReward:15,crystalReward:5,sprite:"goblin",color:"#4a7c3f"},{id:"skeleton",name:"Skeleton Warrior",description:"Animated bones wielding a rusty sword.",combatStats:{currentHp:35,maxHp:35,currentMana:0,maxMana:0,might:8,agility:4,defense:6,power:1,insight:1,willpower:1},xpReward:22,crystalReward:8,sprite:"skeleton",color:"#c8c8b0"},{id:"dark_mage",name:"Dark Mage",description:"A corrupted spellcaster wreathed in shadow.",combatStats:{currentHp:30,maxHp:30,currentMana:20,maxMana:20,might:3,agility:5,defense:4,power:10,insight:8,willpower:6},xpReward:30,crystalReward:12,sprite:"mage",color:"#6b3fa0"},{id:"slime",name:"Dungeon Slime",description:"A wobbling mass of corrosive goo.",combatStats:{currentHp:20,maxHp:20,currentMana:0,maxMana:0,might:4,agility:3,defense:2,power:1,insight:1,willpower:1},xpReward:10,crystalReward:3,sprite:"slime",color:"#39bf5c"},{id:"floor_boss",name:"Dungeon Keeper",description:"The ancient guardian of this dungeon floor.",combatStats:{currentHp:80,maxHp:80,currentMana:30,maxMana:30,might:12,agility:6,defense:8,power:8,insight:6,willpower:6},xpReward:60,crystalReward:25,sprite:"boss",color:"#c43030"}],x=[{floor:1,rooms:[{id:"f1_start",name:"Dungeon Entrance",description:"Cold stone steps descend into darkness. Torches flicker on moss-covered walls.",type:"start",floor:1,exits:[{direction:"North",targetRoomId:"f1_combat1"},{direction:"East",targetRoomId:"f1_dialogue1"}]},{id:"f1_combat1",name:"Goblin Den",description:"Bones and scraps litter the floor. Something moves in the shadows.",type:"combat",floor:1,enemyId:"goblin",exits:[{direction:"South",targetRoomId:"f1_start"},{direction:"West",targetRoomId:"f1_treasure1"},{direction:"North",targetRoomId:"f1_forge1"}]},{id:"f1_dialogue1",name:"Hermit's Alcove",description:"A small lantern illuminates a cramped nook. An old figure sits cross-legged.",type:"dialogue",floor:1,npcId:"hermit",exits:[{direction:"West",targetRoomId:"f1_start"},{direction:"North",targetRoomId:"f1_combat2"}]},{id:"f1_treasure1",name:"Hidden Cache",description:"A small chamber with a dusty chest against the far wall.",type:"treasure",floor:1,loot:["health_potion","mana_potion"],exits:[{direction:"East",targetRoomId:"f1_combat1"},{direction:"North",targetRoomId:"f1_rest1"}]},{id:"f1_rest1",name:"Quiet Spring",description:"A natural spring bubbles softly. The air feels calm and restorative.",type:"rest",floor:1,exits:[{direction:"South",targetRoomId:"f1_treasure1"},{direction:"East",targetRoomId:"f1_forge1"}]},{id:"f1_forge1",name:"Rune Forge",description:"An ancient anvil pulses with arcane energy. Rune symbols glow on the walls.",type:"forge",floor:1,exits:[{direction:"South",targetRoomId:"f1_combat1"},{direction:"West",targetRoomId:"f1_rest1"},{direction:"North",targetRoomId:"f1_combat3"}]},{id:"f1_combat2",name:"Skeleton Crypt",description:"Stone coffins line the walls. The dead do not rest easy here.",type:"combat",floor:1,enemyId:"skeleton",exits:[{direction:"South",targetRoomId:"f1_dialogue1"},{direction:"West",targetRoomId:"f1_combat3"}]},{id:"f1_combat3",name:"Shadow Corridor",description:"Dark mist swirls through this narrow passage. Arcane whispers echo.",type:"combat",floor:1,enemyId:"dark_mage",exits:[{direction:"East",targetRoomId:"f1_combat2"},{direction:"South",targetRoomId:"f1_forge1"},{direction:"North",targetRoomId:"f1_boss"}]},{id:"f1_boss",name:"Keeper's Chamber",description:"A massive hall. The Dungeon Keeper stands guard before the stairway down.",type:"boss",floor:1,enemyId:"floor_boss",exits:[{direction:"South",targetRoomId:"f1_combat3"}]}]}],$=[{id:"health_potion",name:"Health Potion",description:"Restores 20 HP.",icon:"potion-red",type:"potion",effect:{stat:"currentHp",value:20},quantity:1},{id:"mana_potion",name:"Mana Potion",description:"Restores 15 Mana.",icon:"potion-blue",type:"potion",effect:{stat:"currentMana",value:15},quantity:1},{id:"greater_health_potion",name:"Greater Health Potion",description:"Restores 50 HP.",icon:"potion-red-big",type:"potion",effect:{stat:"currentHp",value:50},quantity:1},{id:"scroll_of_might",name:"Scroll of Might",description:"Temporarily increases Might by 5.",icon:"scroll",type:"scroll",effect:{stat:"might",value:5},quantity:1}],w=[{id:"fireball",name:"Fireball",description:"Hurls a ball of fire at the enemy.",manaCost:8,damage:18,icon:"spell-fire",element:"fire",effect:"damage",runeComposition:["ignis","ventus"]},{id:"ice_shard",name:"Ice Shard",description:"Launches a razor-sharp shard of ice.",manaCost:6,damage:14,icon:"spell-ice",element:"ice",effect:"damage",runeComposition:["aqua","terra"]},{id:"heal_light",name:"Healing Light",description:"Restores HP with gentle radiance.",manaCost:10,damage:0,icon:"spell-heal",element:"light",effect:"heal",effectValue:25,runeComposition:["lux","vitae"]},{id:"lightning_bolt",name:"Lightning Bolt",description:"Calls down a bolt of lightning.",manaCost:12,damage:24,icon:"spell-lightning",element:"lightning",effect:"damage",runeComposition:["ventus","lux"]},{id:"shadow_strike",name:"Shadow Strike",description:"A dark energy blast that weakens the enemy.",manaCost:7,damage:12,icon:"spell-shadow",element:"shadow",effect:"debuff",effectValue:3,runeComposition:["umbra","terra"]},{id:"poison_cloud",name:"Poison Cloud",description:"A noxious cloud that corrodes armor.",manaCost:9,damage:16,icon:"spell-poison",element:"poison",effect:"damage",runeComposition:["vitae","umbra"]},{id:"earth_shield",name:"Earth Shield",description:"Raises your defense temporarily.",manaCost:8,damage:0,icon:"spell-earth",element:"earth",effect:"buff",effectValue:5,runeComposition:["terra","ignis"]}],S=[{id:"ignis",name:"Ignis",symbol:"🔥",color:"#ff4400",description:"The rune of fire and passion."},{id:"aqua",name:"Aqua",symbol:"💧",color:"#0088ff",description:"The rune of water and flow."},{id:"terra",name:"Terra",symbol:"🪨",color:"#8B6914",description:"The rune of earth and stability."},{id:"ventus",name:"Ventus",symbol:"💨",color:"#88ccff",description:"The rune of wind and speed."},{id:"lux",name:"Lux",symbol:"✨",color:"#ffdd00",description:"The rune of light and revelation."},{id:"umbra",name:"Umbra",symbol:"🌑",color:"#6633aa",description:"The rune of shadow and mystery."},{id:"vitae",name:"Vitae",symbol:"🌿",color:"#44bb44",description:"The rune of life and growth."}],R=[{rune1:"ignis",rune2:"ventus",resultSpellId:"fireball"},{rune1:"aqua",rune2:"terra",resultSpellId:"ice_shard"},{rune1:"lux",rune2:"vitae",resultSpellId:"heal_light"},{rune1:"ventus",rune2:"lux",resultSpellId:"lightning_bolt"},{rune1:"umbra",rune2:"terra",resultSpellId:"shadow_strike"},{rune1:"vitae",rune2:"umbra",resultSpellId:"poison_cloud"},{rune1:"terra",rune2:"ignis",resultSpellId:"earth_shield"}],k=[{id:"hermit",name:"Old Hermit Aldric",portrait:"hermit",color:"#7a6440",greeting:"Ah, another soul wandering these depths. I've been here longer than I care to remember.",dialogueOptions:[{text:"Do you know the way out?",response:"The stairs down are guarded by the Keeper. Defeat him, and the next floor awaits. But be warned — he grows stronger with each passing tick.",effect:{type:"info"}},{text:"Can you help me?",response:"Take this potion. You'll need it more than I will. And here — this rune may prove useful at the forge.",effect:{type:"giveItem",itemId:"health_potion"}},{text:"I found a strange rune...",response:"A rune! Take it to the forge room. Combine two runes to craft a spell. The ancient magic still lingers there.",effect:{type:"giveRune",runeId:"ignis"}},{text:"Farewell.",response:"May the light guide you, adventurer. These halls are not kind to the lost."}]}];class M{constructor(){this.enemies=new Map,this.rooms=new Map,this.items=new Map,this.spells=new Map,this.runes=new Map,this.recipes=[],this.npcs=new Map}load(){for(const e of v)this.enemies.set(e.id,e);for(const e of x)for(const a of e.rooms)this.rooms.set(a.id,a);for(const e of $)this.items.set(e.id,e);for(const e of w)this.spells.set(e.id,e);for(const e of S)this.runes.set(e.id,e);this.recipes=R;for(const e of k)this.npcs.set(e.id,e)}getEnemy(e){const a=this.enemies.get(e);if(a)return JSON.parse(JSON.stringify(a))}getRoom(e){return this.rooms.get(e)}getRoomsForFloor(e){return Array.from(this.rooms.values()).filter(a=>a.floor===e)}getItem(e){const a=this.items.get(e);if(a)return JSON.parse(JSON.stringify(a))}getSpell(e){return this.spells.get(e)}getAllSpells(){return Array.from(this.spells.values())}getRune(e){return this.runes.get(e)}getAllRunes(){return Array.from(this.runes.values())}getRecipes(){return this.recipes}findRecipe(e,a){return this.recipes.find(s=>s.rune1===e&&s.rune2===a||s.rune1===a&&s.rune2===e)}getNPC(e){return this.npcs.get(e)}}class c{constructor(){this.root=document.getElementById("ui-overlay"),this.injectStyles()}clear(){this.root.innerHTML=""}render(e){this.root.innerHTML=e}getRoot(){return this.root}bindClick(e,a){const s=this.root.querySelector(e);s&&s.addEventListener("click",a)}bindAllClicks(e,a){this.root.querySelectorAll(e).forEach((t,o)=>{t.addEventListener("click",()=>a(o))})}static hpBar(e,a,s="#e44",t="100%"){const o=Math.max(0,Math.min(100,e/a*100)),i=o>50?s:o>25?"#e80":"#e22";return`
      <div class="bar-container" style="width:${t}">
        <div class="bar-fill" style="width:${o}%;background:${i}"></div>
        <span class="bar-text">${e}/${a}</span>
      </div>
    `}static manaBar(e,a,s="100%"){const t=Math.max(0,Math.min(100,e/a*100));return`
      <div class="bar-container" style="width:${s}">
        <div class="bar-fill" style="width:${t}%;background:#48f"></div>
        <span class="bar-text">${e}/${a}</span>
      </div>
    `}static xpBar(e,a,s="100%"){const t=Math.max(0,Math.min(100,e/a*100));return`
      <div class="bar-container" style="width:${s}">
        <div class="bar-fill" style="width:${t}%;background:#8c4"></div>
        <span class="bar-text">${e}/${a} XP</span>
      </div>
    `}injectStyles(){if(document.getElementById("game-styles"))return;const e=document.createElement("style");e.id="game-styles",e.textContent=`
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
    `,document.head.appendChild(e)}}const u="escape-the-dungeon-save";function l(r){try{localStorage.setItem(u,JSON.stringify(r))}catch{console.warn("Failed to save game")}}function C(){try{const r=localStorage.getItem(u);return r?JSON.parse(r):null}catch{return null}}function I(){return localStorage.getItem(u)!==null}function H(){localStorage.removeItem(u)}function p(r,e,a=80){const s=a,t=s/2;switch(r){case"goblin":return`<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="${t}" cy="${t+8}" rx="${t-10}" ry="${t-5}" fill="${e}"/>
        <circle cx="${t-12}" cy="${t-5}" r="8" fill="#fff"/>
        <circle cx="${t+12}" cy="${t-5}" r="8" fill="#fff"/>
        <circle cx="${t-10}" cy="${t-5}" r="4" fill="#200"/>
        <circle cx="${t+14}" cy="${t-5}" r="4" fill="#200"/>
        <polygon points="${t-18},${t-15} ${t-30},${t-30} ${t-10},${t-20}" fill="${e}"/>
        <polygon points="${t+18},${t-15} ${t+30},${t-30} ${t+10},${t-20}" fill="${e}"/>
        <path d="M${t-8},${t+10} Q${t},${t+20} ${t+8},${t+10}" fill="#300" stroke="none"/>
      </svg>`;case"skeleton":return`<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${t}" cy="${t-8}" r="${t-15}" fill="${e}"/>
        <circle cx="${t-10}" cy="${t-12}" r="6" fill="#111"/>
        <circle cx="${t+10}" cy="${t-12}" r="6" fill="#111"/>
        <polygon points="${t},${t-4} ${t-4},${t+4} ${t+4},${t+4}" fill="#333"/>
        <rect x="${t-12}" y="${t+8}" width="24" height="3" rx="1" fill="#111"/>
        <rect x="${t-2}" y="${t-2}" width="4" height="30" fill="${e}"/>
        <rect x="${t-14}" y="${t+14}" width="28" height="4" rx="2" fill="${e}"/>
        <line x1="${t+20}" y1="${t}" x2="${t+35}" y2="${t-15}" stroke="#888" stroke-width="3"/>
        <line x1="${t+32}" y1="${t-18}" x2="${t+38}" y2="${t-12}" stroke="#888" stroke-width="2"/>
      </svg>`;case"mage":return`<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
        <polygon points="${t},2 ${t-20},${t-5} ${t+20},${t-5}" fill="${e}"/>
        <circle cx="${t}" cy="${t}" r="${t-18}" fill="#2a1a3a"/>
        <circle cx="${t-8}" cy="${t-3}" r="4" fill="#f0f" opacity="0.8"/>
        <circle cx="${t+8}" cy="${t-3}" r="4" fill="#f0f" opacity="0.8"/>
        <path d="M${t-5},${t+8} Q${t},${t+14} ${t+5},${t+8}" fill="#808" stroke="none"/>
        <rect x="${t-2}" y="${t+15}" width="4" height="22" fill="#553"/>
        <circle cx="${t}" cy="${t+38}" r="5" fill="${e}" opacity="0.6"/>
        <circle cx="${t}" cy="4" r="4" fill="#ff0" opacity="0.8"/>
      </svg>`;case"slime":return`<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="${t}" cy="${t+10}" rx="${t-8}" ry="${t-15}" fill="${e}" opacity="0.8"/>
        <ellipse cx="${t}" cy="${t+10}" rx="${t-12}" ry="${t-18}" fill="${e}"/>
        <circle cx="${t-8}" cy="${t}" r="5" fill="#fff" opacity="0.9"/>
        <circle cx="${t+8}" cy="${t}" r="5" fill="#fff" opacity="0.9"/>
        <circle cx="${t-7}" cy="${t}" r="3" fill="#111"/>
        <circle cx="${t+9}" cy="${t}" r="3" fill="#111"/>
        <ellipse cx="${t+15}" cy="${t+20}" rx="8" ry="5" fill="${e}" opacity="0.5"/>
        <ellipse cx="${t-18}" cy="${t+18}" rx="6" ry="4" fill="${e}" opacity="0.4"/>
      </svg>`;case"boss":return`<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
        <polygon points="${t},0 ${t-8},14 ${t-20},8 ${t-12},20 ${t-24},18 ${t-14},28 ${t+14},28 ${t+24},18 ${t+12},20 ${t+20},8 ${t+8},14" fill="#ffd700"/>
        <circle cx="${t}" cy="${t+5}" r="${t-12}" fill="${e}"/>
        <circle cx="${t-12}" cy="${t}" r="7" fill="#ff0" opacity="0.8"/>
        <circle cx="${t+12}" cy="${t}" r="7" fill="#ff0" opacity="0.8"/>
        <circle cx="${t-12}" cy="${t}" r="4" fill="#800"/>
        <circle cx="${t+12}" cy="${t}" r="4" fill="#800"/>
        <path d="M${t-10},${t+16} L${t-6},${t+12} L${t-2},${t+16} L${t+2},${t+12} L${t+6},${t+16} L${t+10},${t+12}" fill="none" stroke="#400" stroke-width="2"/>
      </svg>`;case"hermit":return`<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
        <polygon points="${t},4 ${t-22},${t-2} ${t+22},${t-2}" fill="${e}"/>
        <circle cx="${t}" cy="${t+2}" r="${t-18}" fill="#d4b896"/>
        <circle cx="${t-8}" cy="${t-2}" r="3" fill="#333"/>
        <circle cx="${t+8}" cy="${t-2}" r="3" fill="#333"/>
        <path d="M${t-12},${t+10} Q${t},${t+22} ${t+12},${t+10}" fill="#aaa" stroke="none"/>
        <rect x="${t-16}" y="${t+18}" width="32" height="22" rx="4" fill="${e}"/>
        <line x1="${t+18}" y1="${t+10}" x2="${t+30}" y2="${t+35}" stroke="#654" stroke-width="3"/>
      </svg>`;default:return`<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${t}" cy="${t}" r="${t-5}" fill="${e}"/>
        <text x="${t}" y="${t+5}" text-anchor="middle" fill="#fff" font-size="20">?</text>
      </svg>`}}function h(r){return{combat:"⚔️",dialogue:"💬",treasure:"💎",rest:"💤",forge:"🔨",boss:"💀",start:"🏠"}[r]||"❓"}function f(r){return{combat:"#8b2020",dialogue:"#2060a0",treasure:"#a08020",rest:"#207040",forge:"#a04020",boss:"#600060",start:"#404060"}[r]||"#404040"}function _(r){return{combat:"linear-gradient(135deg, #1a0808 0%, #2d0a0a 50%, #1a0808 100%)",dialogue:"linear-gradient(135deg, #080818 0%, #0a0a2d 50%, #080818 100%)",treasure:"linear-gradient(135deg, #181808 0%, #2d2a0a 50%, #181808 100%)",rest:"linear-gradient(135deg, #081808 0%, #0a2d0a 50%, #081808 100%)",forge:"linear-gradient(135deg, #180808 0%, #2d1a0a 50%, #180808 100%)",boss:"linear-gradient(135deg, #100010 0%, #200020 50%, #100010 100%)",start:"linear-gradient(135deg, #0a0a14 0%, #141428 50%, #0a0a14 100%)"}[r]||"linear-gradient(135deg, #0a0a0f 0%, #14141e 100%)"}function m(r){return{fire:"🔥",ice:"❄️",light:"✨",lightning:"⚡",shadow:"🌑",poison:"☠️",earth:"🛡️"}[r]||"✦"}class D{constructor(){this.combatSpellSelect=!1,this.combatBagOpen=!1,this.currentDialogueIndex=0,this.dialogueResponse=null,this.forgeRune1=null,this.forgeRune2=null,this.forgeResult=null,this.data=new M,this.ui=new c}start(){this.data.load(),this.showTitle()}showTitle(){const e=I();this.ui.render(`
      <div class="title-screen">
        <h1>Escape the Dungeon</h1>
        <p class="subtitle">A roguelike dungeon crawler</p>
        <div>
          <button class="btn btn-primary" data-action="new-game">New Game</button>
          ${e?'<button class="btn" data-action="continue">Continue</button>':""}
        </div>
        ${e?'<div style="margin-top:12px"><button class="btn btn-small btn-danger" data-action="delete-save">Delete Save</button></div>':""}
      </div>
    `),this.ui.bindClick('[data-action="new-game"]',()=>this.newGame()),e&&(this.ui.bindClick('[data-action="continue"]',()=>this.continueGame()),this.ui.bindClick('[data-action="delete-save"]',()=>{H(),this.showTitle()}))}newGame(){const e={name:"Adventurer",level:1,xp:0,xpToNext:30,combatStats:{currentHp:60,maxHp:60,currentMana:25,maxMana:25,might:8,agility:6,defense:5,power:5,insight:4,willpower:4},inventory:[],spells:[],runes:[],crystals:0,currentRoomId:"f1_start",currentFloor:1,discoveredRooms:["f1_start"],tick:0},a=this.data.getItem("health_potion");a&&(a.quantity=2,e.inventory.push(a));const s=this.data.getItem("mana_potion");s&&(s.quantity=1,e.inventory.push(s));const t=["aqua","terra","ventus"];for(const o of t){const i=this.data.getRune(o);i&&e.runes.push(i)}this.state={scene:"room",player:e,combatLog:[],menuOpen:null},l(this.state.player),this.showRoom()}continueGame(){const e=C();if(!e){this.newGame();return}this.state={scene:"room",player:e,combatLog:[],menuOpen:null},this.showRoom()}renderHUD(){const e=this.state.player;return`
      <div class="hud">
        <div class="hud-name">${e.name} Lv.${e.level}</div>
        <div class="hud-bars">
          <div class="hud-bar-group">
            <div class="hud-bar-label">HP</div>
            ${c.hpBar(e.combatStats.currentHp,e.combatStats.maxHp,"#e44")}
          </div>
          <div class="hud-bar-group">
            <div class="hud-bar-label">Mana</div>
            ${c.manaBar(e.combatStats.currentMana,e.combatStats.maxMana)}
          </div>
          <div class="hud-bar-group">
            <div class="hud-bar-label">XP</div>
            ${c.xpBar(e.xp,e.xpToNext)}
          </div>
        </div>
        <div class="hud-info">
          <span>Floor: <span class="floor-num">${e.currentFloor}</span></span>
          <span>Tick: ${e.tick}</span>
          <span>💎 ${e.crystals}</span>
        </div>
        <div class="hud-menus">
          <button class="btn btn-small" data-menu="map">🗺️ Map</button>
          <button class="btn btn-small" data-menu="bag">🎒 Bag</button>
          <button class="btn btn-small" data-menu="spellbook">📖 Spells</button>
          <button class="btn btn-small" data-menu="stats">📊 Stats</button>
        </div>
      </div>
    `}bindHUDMenus(){const e=["map","bag","spellbook","stats"];for(const a of e)this.ui.bindClick(`[data-menu="${a}"]`,()=>this.toggleMenu(a))}toggleMenu(e){if(this.state.menuOpen===e){this.state.menuOpen=null,this.rerenderScene();return}this.state.menuOpen=e,this.rerenderScene()}rerenderScene(){switch(this.state.scene){case"room":this.showRoom();break;case"combat":this.showCombat();break;case"dialogue":this.showDialogue();break;case"forge":this.showForge();break}}renderMenuOverlay(){if(!this.state.menuOpen)return"";const e=this.state.player;switch(this.state.menuOpen){case"bag":return`
          <div class="overlay-menu">
            <div class="overlay-header">
              <span class="overlay-title">🎒 Inventory</span>
              <button class="btn btn-small" data-close-menu>Close</button>
            </div>
            ${e.inventory.length===0?"<p style='color:#888'>Your bag is empty.</p>":e.inventory.map((a,s)=>`
                <div class="item-row">
                  <span class="item-icon">${this.getItemIcon(a.type)}</span>
                  <div class="item-info">
                    <div class="item-name">${a.name}</div>
                    <div class="item-desc">${a.description}</div>
                  </div>
                  <span class="item-qty">x${a.quantity}</span>
                  ${this.state.scene!=="combat"?`<button class="btn btn-small" data-use-item="${s}">Use</button>`:""}
                </div>
              `).join("")}
            <div style="margin-top:12px;color:#888;font-size:0.85rem">💎 Crystals: ${e.crystals}</div>
          </div>
        `;case"spellbook":return`
          <div class="overlay-menu">
            <div class="overlay-header">
              <span class="overlay-title">📖 Spellbook</span>
              <button class="btn btn-small" data-close-menu>Close</button>
            </div>
            ${e.spells.length===0?"<p style='color:#888'>No spells learned. Visit the Rune Forge!</p>":e.spells.map(a=>`
                <div class="spell-row">
                  <span class="spell-icon">${m(a.element)}</span>
                  <div class="spell-info">
                    <div class="spell-name">${a.name}</div>
                    <div class="spell-desc">${a.description}</div>
                  </div>
                  <span class="spell-cost">${a.manaCost} MP</span>
                </div>
              `).join("")}
            <div style="margin-top:12px;padding-top:12px;border-top:1px solid #333">
              <div style="color:#888;font-size:0.85rem;margin-bottom:8px">Runes:</div>
              ${e.runes.length===0?"<span style='color:#555'>None</span>":e.runes.map(a=>`<span style="margin-right:8px" title="${a.name}: ${a.description}">${a.symbol} ${a.name}</span>`).join("")}
            </div>
          </div>
        `;case"stats":return`
          <div class="overlay-menu">
            <div class="overlay-header">
              <span class="overlay-title">📊 Stats</span>
              <button class="btn btn-small" data-close-menu>Close</button>
            </div>
            <div class="stat-row"><span class="stat-label">Level</span><span class="stat-value">${e.level}</span></div>
            <div class="stat-row"><span class="stat-label">XP</span><span class="stat-value">${e.xp} / ${e.xpToNext}</span></div>
            <div class="stat-row"><span class="stat-label">Might</span><span class="stat-value">${e.combatStats.might}</span></div>
            <div class="stat-row"><span class="stat-label">Agility</span><span class="stat-value">${e.combatStats.agility}</span></div>
            <div class="stat-row"><span class="stat-label">Defense</span><span class="stat-value">${e.combatStats.defense}</span></div>
            <div class="stat-row"><span class="stat-label">Power</span><span class="stat-value">${e.combatStats.power}</span></div>
            <div class="stat-row"><span class="stat-label">Insight</span><span class="stat-value">${e.combatStats.insight}</span></div>
            <div class="stat-row"><span class="stat-label">Willpower</span><span class="stat-value">${e.combatStats.willpower}</span></div>
            <div class="stat-row"><span class="stat-label">Crystals</span><span class="stat-value">💎 ${e.crystals}</span></div>
          </div>
        `;case"map":return this.renderMapOverlay();default:return""}}renderMapOverlay(){const e=this.state.player,a=this.data.getRoomsForFloor(e.currentFloor);return`
      <div class="overlay-menu">
        <div class="overlay-header">
          <span class="overlay-title">🗺️ Floor ${e.currentFloor} Map</span>
          <button class="btn btn-small" data-close-menu>Close</button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center">
          ${a.map(s=>{const t=e.discoveredRooms.includes(s.id),o=s.id===e.currentRoomId;return`
              <div class="map-room ${o?"current":t?"visited":"undiscovered"}" style="border-color:${t?f(s.type):"#333"}">
                ${t?`${h(s.type)} ${s.name}`:"???"}
                ${o?" 📍":""}
              </div>
            `}).join("")}
        </div>
        <div style="margin-top:12px;font-size:0.75rem;color:#666;text-align:center">
          Discovered: ${e.discoveredRooms.length} / ${a.length} rooms
        </div>
      </div>
    `}bindMenuClose(){this.ui.bindClick("[data-close-menu]",()=>{this.state.menuOpen=null,this.rerenderScene()}),this.state.menuOpen==="bag"&&this.ui.bindAllClicks("[data-use-item]",e=>this.useItem(e))}getItemIcon(e){return{potion:"🧪",scroll:"📜",equipment:"🛡️",key:"🔑"}[e]||"📦"}showRoom(){this.state.scene="room";const e=this.state.player,a=this.data.getRoom(e.currentRoomId);if(!a){console.error("Room not found:",e.currentRoomId);return}for(const o of a.exits)e.discoveredRooms.includes(o.targetRoomId)||e.discoveredRooms.push(o.targetRoomId);const s=f(a.type),t=_(a.type);this.ui.render(`
      <div class="game-container" style="background:${t}">
        ${this.renderHUD()}
        <div class="main-area">
          <div class="room-panel" style="animation:fadeIn 0.3s ease">
            <div class="room-header">
              <span class="room-icon">${h(a.type)}</span>
              <span class="room-name">${a.name}</span>
            </div>
            <div class="room-type-badge" style="background:${s};color:#fff">${a.type}</div>
            <p class="room-description">${a.description}</p>

            ${this.renderRoomContent(a)}

            <div class="room-exits" style="margin-top:16px">
              ${a.exits.map((o,i)=>{const n=this.data.getRoom(o.targetRoomId),d=e.discoveredRooms.includes(o.targetRoomId),g=n&&d?n.type:"unknown",b=n&&d?n.name:"???",y=d?h(g):"❓";return`
                  <button class="btn exit-btn" data-exit="${i}">
                    ${y} ${o.direction} — ${b}
                  </button>
                `}).join("")}
            </div>
          </div>
          ${this.renderMenuOverlay()}
        </div>
      </div>
    `),a.exits.forEach((o,i)=>{this.ui.bindClick(`[data-exit="${i}"]`,()=>this.navigateTo(a.exits[i].targetRoomId))}),this.bindHUDMenus(),this.bindMenuClose(),this.bindRoomActions()}renderRoomContent(e){switch(e.type){case"rest":return`
          <div style="margin:16px 0">
            <p style="color:#6c6;margin-bottom:12px">The soothing waters offer rest and recovery.</p>
            <button class="btn" data-action="rest">💤 Rest (Restore HP & Mana)</button>
          </div>
        `;case"treasure":return e.loot&&e.loot.length>0&&!e.visited?`
            <div style="margin:16px 0">
              <p style="color:#cc0;margin-bottom:12px">A treasure chest awaits!</p>
              <button class="btn btn-primary" data-action="open-chest">💎 Open Chest</button>
            </div>
          `:'<p style="color:#666;margin:16px 0">The chest has already been opened.</p>';case"combat":return!e.visited&&e.enemyId?`
            <div style="margin:16px 0">
              <p style="color:#c44;margin-bottom:12px">An enemy lurks here!</p>
              <button class="btn btn-danger" data-action="engage">⚔️ Engage Enemy</button>
            </div>
          `:'<p style="color:#666;margin:16px 0">The room is clear.</p>';case"boss":return!e.visited&&e.enemyId?`
            <div style="margin:16px 0">
              <p style="color:#c06;margin-bottom:12px;font-weight:bold">The Dungeon Keeper blocks your path!</p>
              <button class="btn btn-danger" data-action="engage">💀 Challenge the Boss</button>
            </div>
          `:'<p style="color:#6c6;margin:16px 0">The boss has been defeated. The path forward is clear.</p>';case"dialogue":return e.npcId?`
            <div style="margin:16px 0">
              <button class="btn" data-action="talk">💬 Talk to NPC</button>
            </div>
          `:"";case"forge":return`
          <div style="margin:16px 0">
            <p style="color:#f80;margin-bottom:12px">The ancient forge thrums with arcane power.</p>
            <button class="btn btn-primary" data-action="forge">🔨 Use Rune Forge</button>
          </div>
        `;default:return""}}navigateTo(e){this.state.menuOpen=null,this.state.player.currentRoomId=e,this.state.player.tick++,this.state.player.discoveredRooms.includes(e)||this.state.player.discoveredRooms.push(e),l(this.state.player),this.showRoom()}bindRoomActions(){const e=this.data.getRoom(this.state.player.currentRoomId);e&&(this.ui.bindClick('[data-action="rest"]',()=>this.doRest()),this.ui.bindClick('[data-action="open-chest"]',()=>this.openChest(e)),this.ui.bindClick('[data-action="engage"]',()=>this.startCombat(e)),this.ui.bindClick('[data-action="talk"]',()=>this.startDialogue(e)),this.ui.bindClick('[data-action="forge"]',()=>this.showForge()))}doRest(){const e=this.state.player;e.combatStats.currentHp=e.combatStats.maxHp,e.combatStats.currentMana=e.combatStats.maxMana,l(e),this.showRoom()}openChest(e){if(!e.loot)return;const a=this.state.player;for(const t of e.loot){const o=this.data.getItem(t);if(o){const i=a.inventory.find(n=>n.id===o.id);i?i.quantity+=o.quantity:a.inventory.push(o)}}a.crystals+=10,e.visited=!0;const s=this.data.getRoom(e.id);s&&(s.visited=!0),l(a),this.showRoom(),this.bindRoomActions()}startCombat(e){if(!e.enemyId)return;const a=this.data.getEnemy(e.enemyId);a&&(this.state.scene="combat",this.state.currentEnemy=a,this.state.combatLog=[`A ${a.name} appears!`],this.state.menuOpen=null,this.showCombat())}showCombat(){const e=this.state.player,a=this.state.currentEnemy;if(!a){this.showRoom();return}const s=e.spells.length>0,t=e.inventory.length>0;this.ui.render(`
      <div class="game-container" style="background:linear-gradient(135deg, #1a0808 0%, #0a0a0f 100%)">
        ${this.renderHUD()}
        <div class="main-area">
          <div class="combat-panel" style="animation:fadeIn 0.3s ease">
            <div class="combat-header">⚔️ COMBAT ⚔️</div>
            <div class="combat-arena">
              <div class="combatant">
                <div class="combatant-name" style="color:#4af">${e.name}</div>
                <div class="combatant-sprite">${p("hermit","#4488ff",64)}</div>
                <div class="combatant-bars">
                  <div style="font-size:0.7rem;color:#888;margin-bottom:2px">HP</div>
                  ${c.hpBar(e.combatStats.currentHp,e.combatStats.maxHp,"#4a4")}
                  <div style="font-size:0.7rem;color:#888;margin:4px 0 2px">MP</div>
                  ${c.manaBar(e.combatStats.currentMana,e.combatStats.maxMana)}
                </div>
              </div>
              <div class="combat-vs">VS</div>
              <div class="combatant">
                <div class="combatant-name" style="color:${a.color}">${a.name}</div>
                <div class="combatant-sprite">${p(a.sprite,a.color,64)}</div>
                <div class="combatant-bars">
                  <div style="font-size:0.7rem;color:#888;margin-bottom:2px">HP</div>
                  ${c.hpBar(a.combatStats.currentHp,a.combatStats.maxHp,"#e44")}
                </div>
              </div>
            </div>

            <div class="combat-actions">
              <button class="btn" data-combat="fight">⚔️ Fight</button>
              <button class="btn" data-combat="spells" ${s?"":"disabled"}>✨ Spells</button>
              <button class="btn" data-combat="bag" ${t?"":"disabled"}>🎒 Bag</button>
              <button class="btn btn-danger" data-combat="run">🏃 Run</button>
            </div>

            ${this.combatSpellSelect?this.renderSpellSelect():""}
            ${this.combatBagOpen?this.renderCombatBag():""}

            <div class="combat-log">
              ${this.state.combatLog.slice(-6).map(o=>`<div class="log-entry ${o.includes("damage")||o.includes("hits")?"log-damage":o.includes("heal")||o.includes("restore")?"log-heal":"log-info"}">${o}</div>`).join("")}
            </div>
          </div>
          ${this.renderMenuOverlay()}
        </div>
      </div>
    `),this.ui.bindClick('[data-combat="fight"]',()=>this.combatFight()),this.ui.bindClick('[data-combat="spells"]',()=>{this.combatSpellSelect=!this.combatSpellSelect,this.combatBagOpen=!1,this.showCombat()}),this.ui.bindClick('[data-combat="bag"]',()=>{this.combatBagOpen=!this.combatBagOpen,this.combatSpellSelect=!1,this.showCombat()}),this.ui.bindClick('[data-combat="run"]',()=>this.combatRun()),this.combatSpellSelect&&this.state.player.spells.forEach((o,i)=>{this.ui.bindClick(`[data-cast-spell="${i}"]`,()=>this.combatCastSpell(i))}),this.combatBagOpen&&this.state.player.inventory.forEach((o,i)=>{this.ui.bindClick(`[data-combat-use-item="${i}"]`,()=>this.combatUseItem(i))}),this.bindHUDMenus(),this.bindMenuClose()}renderSpellSelect(){const e=this.state.player;return`
      <div style="margin-bottom:12px;padding:12px;background:rgba(0,0,0,0.3);border:1px solid #444;border-radius:8px">
        <div style="font-size:0.85rem;color:#888;margin-bottom:8px">Select a spell:</div>
        ${e.spells.map((a,s)=>{const t=e.combatStats.currentMana>=a.manaCost;return`
            <button class="btn btn-small" data-cast-spell="${s}" ${t?"":"disabled"}
              style="margin:3px;text-align:left;display:block;width:100%">
              ${m(a.element)} ${a.name} (${a.manaCost} MP) — ${a.damage>0?a.damage+" dmg":a.description}
            </button>
          `}).join("")}
      </div>
    `}renderCombatBag(){return`
      <div style="margin-bottom:12px;padding:12px;background:rgba(0,0,0,0.3);border:1px solid #444;border-radius:8px">
        <div style="font-size:0.85rem;color:#888;margin-bottom:8px">Use an item:</div>
        ${this.state.player.inventory.map((a,s)=>`
          <button class="btn btn-small" data-combat-use-item="${s}"
            style="margin:3px;text-align:left;display:block;width:100%">
            ${this.getItemIcon(a.type)} ${a.name} x${a.quantity} — ${a.description}
          </button>
        `).join("")}
      </div>
    `}combatFight(){const e=this.state.player,a=this.state.currentEnemy;if(!a)return;const s=Math.max(1,e.combatStats.might-Math.floor(a.combatStats.defense/2)+Math.floor(Math.random()*4));if(a.combatStats.currentHp-=s,this.state.combatLog.push(`You hit ${a.name} for ${s} damage!`),a.combatStats.currentHp<=0){this.combatVictory();return}this.enemyTurn()}combatCastSpell(e){const a=this.state.player,s=this.state.currentEnemy;if(!s)return;const t=a.spells[e];if(!(!t||a.combatStats.currentMana<t.manaCost)){if(a.combatStats.currentMana-=t.manaCost,this.combatSpellSelect=!1,t.effect==="heal"){const o=t.effectValue||25;a.combatStats.currentHp=Math.min(a.combatStats.maxHp,a.combatStats.currentHp+o),this.state.combatLog.push(`You cast ${t.name} and restore ${o} HP!`)}else if(t.effect==="buff"){const o=t.effectValue||5;a.combatStats.defense+=o,this.state.combatLog.push(`You cast ${t.name}! Defense +${o}!`)}else if(t.effect==="debuff"){const o=t.effectValue||3;s.combatStats.defense=Math.max(0,s.combatStats.defense-o);const i=t.damage+Math.floor(a.combatStats.power/2);s.combatStats.currentHp-=i,this.state.combatLog.push(`You cast ${t.name} for ${i} damage! Enemy defense -${o}!`)}else{const o=t.damage+Math.floor(a.combatStats.power/2);s.combatStats.currentHp-=o,this.state.combatLog.push(`You cast ${t.name} for ${o} damage!`)}if(s.combatStats.currentHp<=0){this.combatVictory();return}this.enemyTurn()}}combatUseItem(e){const a=this.state.player,s=a.inventory[e];if(s){if(this.combatBagOpen=!1,s.effect){const t=s.effect.stat;t==="currentHp"?(a.combatStats.currentHp=Math.min(a.combatStats.maxHp,a.combatStats.currentHp+s.effect.value),this.state.combatLog.push(`You use ${s.name} and restore ${s.effect.value} HP!`)):t==="currentMana"?(a.combatStats.currentMana=Math.min(a.combatStats.maxMana,a.combatStats.currentMana+s.effect.value),this.state.combatLog.push(`You use ${s.name} and restore ${s.effect.value} Mana!`)):(a.combatStats[t]+=s.effect.value,this.state.combatLog.push(`You use ${s.name}! ${t} +${s.effect.value}!`))}s.quantity--,s.quantity<=0&&a.inventory.splice(e,1),this.enemyTurn()}}combatRun(){const a=.4+this.state.player.combatStats.agility/30;Math.random()<a?(this.state.combatLog.push("You successfully fled!"),this.combatSpellSelect=!1,this.combatBagOpen=!1,this.state.currentEnemy=void 0,this.state.scene="room",this.showRoom(),this.bindRoomActions()):(this.state.combatLog.push("You failed to flee!"),this.enemyTurn())}enemyTurn(){const e=this.state.player,a=this.state.currentEnemy;if(!a)return;const s=Math.max(1,a.combatStats.might-Math.floor(e.combatStats.defense/2)+Math.floor(Math.random()*3));if(e.combatStats.currentHp-=s,this.state.combatLog.push(`${a.name} hits you for ${s} damage!`),e.combatStats.currentHp<=0){e.combatStats.currentHp=0,this.combatDefeat();return}l(e),this.showCombat()}combatVictory(){const e=this.state.currentEnemy,a=this.state.player;e.combatStats.currentHp=0;const s=e.xpReward,t=e.crystalReward;a.xp+=s,a.crystals+=t;const o=this.data.getRoom(a.currentRoomId);o&&(o.visited=!0);let i=!1;for(;a.xp>=a.xpToNext;)a.xp-=a.xpToNext,a.level++,a.xpToNext=Math.floor(a.xpToNext*1.5),a.combatStats.maxHp+=8,a.combatStats.currentHp=a.combatStats.maxHp,a.combatStats.maxMana+=4,a.combatStats.currentMana=a.combatStats.maxMana,a.combatStats.might+=2,a.combatStats.defense+=1,a.combatStats.power+=1,a.combatStats.agility+=1,i=!0;this.combatSpellSelect=!1,this.combatBagOpen=!1,this.ui.render(`
      <div class="game-container" style="background:linear-gradient(135deg, #081808 0%, #0a0a0f 100%)">
        ${this.renderHUD()}
        <div class="main-area">
          <div class="result-panel" style="animation:fadeIn 0.5s ease">
            <h2 style="color:#4c4">Victory!</h2>
            <div class="combatant-sprite" style="opacity:0.3">${p(e.sprite,e.color,80)}</div>
            <p style="margin:12px 0;color:#aaa">You defeated the ${e.name}!</p>
            <div class="rewards">
              <p>🌟 +${s} XP</p>
              <p>💎 +${t} Crystals</p>
            </div>
            ${i?`<div class="level-up">🎉 Level Up! You are now Level ${a.level}!</div>`:""}
            <button class="btn btn-primary" data-action="continue">Continue</button>
          </div>
        </div>
      </div>
    `),l(a),this.ui.bindClick('[data-action="continue"]',()=>{this.state.currentEnemy=void 0,this.state.scene="room",this.showRoom(),this.bindRoomActions()}),this.bindHUDMenus()}combatDefeat(){this.combatSpellSelect=!1,this.combatBagOpen=!1,this.ui.render(`
      <div class="game-container" style="background:linear-gradient(135deg, #1a0808 0%, #0a0a0f 100%)">
        <div class="main-area">
          <div class="result-panel" style="animation:fadeIn 0.5s ease">
            <h2 style="color:#c44">Defeat!</h2>
            <p style="color:#888;margin:16px 0">You have fallen in the dungeon...</p>
            <div style="display:flex;gap:12px;justify-content:center">
              <button class="btn btn-primary" data-action="retry">🔄 Try Again</button>
              <button class="btn" data-action="title">🏠 Title Screen</button>
            </div>
          </div>
        </div>
      </div>
    `),this.ui.bindClick('[data-action="retry"]',()=>{const e=this.state.player;e.combatStats.currentHp=Math.floor(e.combatStats.maxHp/2),e.combatStats.currentMana=Math.floor(e.combatStats.maxMana/2),e.currentRoomId="f1_start",this.state.currentEnemy=void 0,this.state.scene="room",l(e),this.showRoom(),this.bindRoomActions()}),this.ui.bindClick('[data-action="title"]',()=>{this.showTitle()})}startDialogue(e){if(!e.npcId)return;const a=this.data.getNPC(e.npcId);a&&(this.state.scene="dialogue",this.state.currentNPC=a,this.currentDialogueIndex=0,this.dialogueResponse=null,this.state.menuOpen=null,this.showDialogue())}showDialogue(){const e=this.state.currentNPC;if(!e){this.showRoom(),this.bindRoomActions();return}const a=this.dialogueResponse||e.greeting;this.ui.render(`
      <div class="game-container" style="background:linear-gradient(135deg, #080818 0%, #0a0a2d 100%)">
        ${this.renderHUD()}
        <div class="main-area">
          <div class="dialogue-panel" style="animation:fadeIn 0.3s ease">
            <div class="npc-section">
              <div class="npc-portrait">${p(e.portrait,e.color,80)}</div>
              <div class="npc-text">
                <div class="npc-name">${e.name}</div>
                <div class="npc-dialogue">"${a}"</div>
              </div>
            </div>

            ${this.dialogueResponse?`
              <div style="text-align:center;margin-top:16px">
                <button class="btn" data-action="back-to-choices">Ask something else</button>
                <button class="btn" data-action="leave-dialogue">Leave</button>
              </div>
            `:`
              <div class="dialogue-choices">
                ${e.dialogueOptions.map((s,t)=>`
                  <button class="btn dialogue-choice" data-dialogue="${t}">💬 ${s.text}</button>
                `).join("")}
                <button class="btn dialogue-choice" data-action="leave-dialogue" style="color:#888">👋 Leave</button>
              </div>
            `}
          </div>
          ${this.renderMenuOverlay()}
        </div>
      </div>
    `),this.dialogueResponse||e.dialogueOptions.forEach((s,t)=>{this.ui.bindClick(`[data-dialogue="${t}"]`,()=>this.selectDialogue(t))}),this.ui.bindClick('[data-action="back-to-choices"]',()=>{this.dialogueResponse=null,this.showDialogue()}),this.ui.bindClick('[data-action="leave-dialogue"]',()=>{this.state.currentNPC=void 0,this.state.scene="room",this.showRoom(),this.bindRoomActions()}),this.bindHUDMenus(),this.bindMenuClose()}selectDialogue(e){const a=this.state.currentNPC;if(!a)return;const s=a.dialogueOptions[e];if(s){if(this.dialogueResponse=s.response,s.effect){const t=this.state.player;switch(s.effect.type){case"giveItem":if(s.effect.itemId){const i=this.data.getItem(s.effect.itemId);if(i){const n=t.inventory.find(d=>d.id===i.id);n?n.quantity+=i.quantity:t.inventory.push(i)}}break;case"giveRune":if(s.effect.runeId){const i=this.data.getRune(s.effect.runeId);i&&!t.runes.find(n=>n.id===i.id)&&(t.runes.push(i),this.dialogueResponse+=` (Received rune: ${i.symbol} ${i.name})`)}break;case"heal":const o=s.effect.healAmount||20;t.combatStats.currentHp=Math.min(t.combatStats.maxHp,t.combatStats.currentHp+o);break}l(t)}a.dialogueOptions.splice(e,1,{...s,text:s.text+" (done)",effect:void 0,response:"I've already helped you with that."}),this.showDialogue()}}showForge(){this.state.scene="forge",this.state.menuOpen=null;const e=this.state.player,a=this.forgeRune1&&this.forgeRune2?this.data.findRecipe(this.forgeRune1,this.forgeRune2):null,s=a?this.data.getSpell(a.resultSpellId):null,t=s?e.spells.some(n=>n.id===s.id):!1,o=this.forgeRune1?this.data.getRune(this.forgeRune1):null,i=this.forgeRune2?this.data.getRune(this.forgeRune2):null;this.ui.render(`
      <div class="game-container" style="background:linear-gradient(135deg, #180808 0%, #2d1a0a 50%, #180808 100%)">
        ${this.renderHUD()}
        <div class="main-area">
          <div class="forge-panel" style="animation:fadeIn 0.3s ease">
            <div class="forge-title">🔨 Rune Forge</div>
            <p style="text-align:center;color:#aaa;margin-bottom:16px">Select two runes to combine and forge a spell.</p>

            <div class="rune-grid">
              ${e.runes.map(n=>`
                  <div class="rune-slot ${this.forgeRune1===n.id||this.forgeRune2===n.id?"selected":""}" data-rune="${n.id}" title="${n.description}">
                    <span class="rune-symbol">${n.symbol}</span>
                    <span class="rune-name">${n.name}</span>
                  </div>
                `).join("")}
              ${e.runes.length===0?'<p style="color:#666">No runes collected yet. Explore the dungeon!</p>':""}
            </div>

            <div class="forge-selection">
              <div class="forge-slot ${o?"filled":""}">
                ${o?o.symbol:"?"}
              </div>
              <div class="forge-plus">+</div>
              <div class="forge-slot ${i?"filled":""}">
                ${i?i.symbol:"?"}
              </div>
              <div class="forge-arrow">=</div>
              <div class="forge-result">
                ${s?`<div class="forge-result-name">${m(s.element)} ${s.name}</div>
                     <div class="forge-result-desc">${s.description}</div>
                     <div class="forge-result-desc" style="color:#48f">${s.manaCost} MP | ${s.damage>0?s.damage+" dmg":s.description}</div>
                     ${t?'<div style="color:#888;font-size:0.75rem">(Already known)</div>':""}`:this.forgeRune1&&this.forgeRune2?'<div style="color:#844">No valid combination</div>':'<div style="color:#666">Select two runes</div>'}
              </div>
            </div>

            <div style="display:flex;gap:8px;justify-content:center;margin-top:16px">
              ${s&&!t?'<button class="btn btn-primary" data-action="craft">✨ Forge Spell</button>':""}
              <button class="btn btn-small" data-action="clear-forge">Clear</button>
              <button class="btn" data-action="leave-forge">Leave Forge</button>
            </div>

            ${e.spells.length>0?`
              <div style="margin-top:20px;padding-top:16px;border-top:1px solid #333">
                <div style="font-size:0.85rem;color:#888;margin-bottom:8px">Known Spells:</div>
                ${e.spells.map(n=>`
                  <div class="spell-row">
                    <span class="spell-icon">${m(n.element)}</span>
                    <div class="spell-info">
                      <div class="spell-name">${n.name}</div>
                      <div class="spell-desc">${n.description}</div>
                    </div>
                    <span class="spell-cost">${n.manaCost} MP</span>
                  </div>
                `).join("")}
              </div>
            `:""}
          </div>
          ${this.renderMenuOverlay()}
        </div>
      </div>
    `),e.runes.forEach(n=>{this.ui.bindClick(`[data-rune="${n.id}"]`,()=>this.selectForgeRune(n.id))}),this.ui.bindClick('[data-action="craft"]',()=>this.craftSpell()),this.ui.bindClick('[data-action="clear-forge"]',()=>{this.forgeRune1=null,this.forgeRune2=null,this.forgeResult=null,this.showForge()}),this.ui.bindClick('[data-action="leave-forge"]',()=>{this.forgeRune1=null,this.forgeRune2=null,this.forgeResult=null,this.state.scene="room",this.showRoom(),this.bindRoomActions()}),this.bindHUDMenus(),this.bindMenuClose()}selectForgeRune(e){this.forgeRune1===e?this.forgeRune1=null:this.forgeRune2===e?this.forgeRune2=null:this.forgeRune1?this.forgeRune2?(this.forgeRune1=this.forgeRune2,this.forgeRune2=e):this.forgeRune2=e:this.forgeRune1=e,this.showForge()}craftSpell(){if(!this.forgeRune1||!this.forgeRune2)return;const e=this.data.findRecipe(this.forgeRune1,this.forgeRune2);if(!e)return;const a=this.data.getSpell(e.resultSpellId);if(!a)return;const s=this.state.player;s.spells.some(t=>t.id===a.id)||(s.spells.push({...a}),l(s),this.forgeRune1=null,this.forgeRune2=null,this.forgeResult=null,this.showForge())}useItem(e){const a=this.state.player,s=a.inventory[e];if(!s||!s.effect)return;const t=s.effect.stat;t==="currentHp"?a.combatStats.currentHp=Math.min(a.combatStats.maxHp,a.combatStats.currentHp+s.effect.value):t==="currentMana"&&(a.combatStats.currentMana=Math.min(a.combatStats.maxMana,a.combatStats.currentMana+s.effect.value)),s.quantity--,s.quantity<=0&&a.inventory.splice(e,1),l(a),this.rerenderScene()}}const A=new D;A.start();
