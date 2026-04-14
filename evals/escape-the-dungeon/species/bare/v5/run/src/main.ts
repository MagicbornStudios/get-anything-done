import "iconify-icon";
import "./styles.css";
import { createInitialState, loadState } from "./state";
import { renderApp, bindEvents, type App } from "./ui";

const rootEl = document.getElementById("app")!;

const saved = loadState();
const state = saved ?? createInitialState();
// if coming from a save, restore the room scene
if (saved) {
  state.scene = { kind: "room", roomId: state.player.currentRoomId };
}

const app: App = {
  state,
  root: rootEl,
  overlay: "none",
  render: () => renderApp(app),
};

bindEvents(app);
app.render();
