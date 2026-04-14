// Stub router. Phase 03 will expand this into a scene dispatcher driven by game state.
export function mount(root: HTMLElement): void {
  root.innerHTML = `
    <div class="title-screen">
      <iconify-icon class="sigil" icon="game-icons:dungeon-gate"></iconify-icon>
      <h1>ESCAPE THE DUNGEON</h1>
      <p class="subtitle">A roguelike of runes, pressure, and ingenuity.</p>
      <p class="footer">v10 — scaffold booted</p>
    </div>
  `;
}
