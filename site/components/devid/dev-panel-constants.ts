import type { RegistryEntry } from "./SectionRegistry";

/** Stable DOM / clipboard id for the section dev panel shell (not useId-suffixed). */
export const DEV_PANEL_STABLE_CID = "visual-context-panel";

export const DEV_PANEL_LABEL = "Visual Context Panel";

/** Self handoff target for the floating dev panel chrome (grep `stableCid="visual-context-panel"`). */
export const DEV_PANEL_SELF_ENTRY: RegistryEntry = {
  cid: DEV_PANEL_STABLE_CID,
  label: DEV_PANEL_LABEL,
  depth: 0,
  componentTag: "Identified",
  searchHint: `stableCid="${DEV_PANEL_STABLE_CID}"`,
};
