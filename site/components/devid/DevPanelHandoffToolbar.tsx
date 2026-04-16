"use client";

import type { MouseEventHandler } from "react";
import { Check, Images, Mic, MicOff, Trash2 } from "lucide-react";
import type { PromptVerbosity } from "./DevIdPromptTemplates";
import { DevChromeHoverHint, type VcPanelCorner } from "@/components/devid/DevChromeHoverHint";
import { DevPanelScreenshotButton } from "./DevPanelScreenshotButton";
import { Button } from "@/components/ui/button";

export const VC_HOVER_FRAMEWORK = (
  <p className="text-muted-foreground">Framework wordmark on this strip.</p>
);
const VC_HOVER_UPDATE = (
  <p>
    Mic + dictation: additions to the update handoff (locked prefix plus your speech). With Alt held (without
    Ctrl/Cmd), the button shows Mic + image icon and &quot;Upd&quot;: click runs the image file picker first (one or
    more paths into the update media list), then starts dictation; the copied prompt includes those paths with your
    transcript.
  </p>
);
const VC_HOVER_DELETE = (
  <p>
    Click: copy a delete handoff for the selected targets. Ctrl/Cmd+click: append instructions to remove matching
    image file(s) from the author&apos;s browser VC export folder when your environment can access them. Ctrl/Cmd
    +Shift+click: clear the saved export folder for this site (IndexedDB) so you can choose a new location.
  </p>
);

function vcVerbosityHoverBody(isFull: boolean) {
  return isFull ? (
    <p>Prompts include full context. Click to switch to compact templates.</p>
  ) : (
    <p>Prompts use compact templates. Click to include full context.</p>
  );
}

function vcPanelHintsToggleHoverBody() {
  return (
    <p>
      Hovercards and docked tips are on for the panel (Update, Delete, PNG, depth, framework mark, pin row). Click
      to turn them off for a quieter panel; Short/Full keep short native tooltips when tips are off, and Plain uses
      its browser tooltip to turn tips back on.
    </p>
  );
}

const ROW_CHROME = {
  section: {
    outlineBtn:
      "h-6 gap-1 px-2 text-[10px] font-semibold uppercase tracking-wide",
    icon: 12 as const,
  },
  band: {
    outlineBtn: "h-6 gap-1 px-1.5 text-[10px]",
    icon: 11 as const,
  },
} as const;

export type DevPanelHandoffChromeSize = keyof typeof ROW_CHROME;

const FOOTER_HINT_BTN = {
  section: "h-6 px-2 text-[9px] font-semibold uppercase tracking-wide",
  band: "h-6 px-1.5 text-[9px] font-semibold uppercase tracking-wide",
} as const;

/** Footer control: Radix hover tips for VC panel chrome (dock with position row). */
export function DevPanelVcHintsFooter(props: {
  dockCorner: VcPanelCorner;
  size: DevPanelHandoffChromeSize;
  vcPanelHoverHintsEnabled: boolean;
  onToggleVcPanelHoverHints: () => void;
}) {
  const { dockCorner, size, vcPanelHoverHintsEnabled, onToggleVcPanelHoverHints } = props;
  const btnClass = FOOTER_HINT_BTN[size];
  const hintsToggleTitle = vcPanelHoverHintsEnabled
    ? "Turn off hovercards for panel controls"
    : "Turn hover tips back on for panel controls";

  return (
    <div className="flex shrink-0 items-center">
      {vcPanelHoverHintsEnabled ? (
        <DevChromeHoverHint dockCorner={dockCorner} body={vcPanelHintsToggleHoverBody()}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleVcPanelHoverHints}
            title={hintsToggleTitle}
            className={btnClass}
          >
            Hints
          </Button>
        </DevChromeHoverHint>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onToggleVcPanelHoverHints}
          title={hintsToggleTitle}
          className={btnClass}
        >
          Plain
        </Button>
      )}
    </div>
  );
}

/** VC panel row: Update / Delete / PNG / Short-Full — shared section + band styling. */
export function DevPanelHandoffActionRow(props: {
  dockCorner: VcPanelCorner;
  size: DevPanelHandoffChromeSize;
  headerCopied: "update" | "delete" | "cid" | null;
  listening: boolean;
  updateMediaChordShow: boolean;
  deleteMediaChordShow: boolean;
  handoffDisabled: boolean;
  onUpdateClick: MouseEventHandler<HTMLButtonElement>;
  onDeleteClick: MouseEventHandler<HTMLButtonElement>;
  promptVerbosity: PromptVerbosity;
  onToggleVerbosity: () => void;
  firstAltLaneCid: string | null;
}) {
  const {
    dockCorner,
    size,
    headerCopied,
    listening,
    updateMediaChordShow,
    deleteMediaChordShow,
    handoffDisabled,
    onUpdateClick,
    onDeleteClick,
    promptVerbosity,
    onToggleVerbosity,
    firstAltLaneCid,
  } = props;
  const chrome = ROW_CHROME[size];
  const iz = chrome.icon;
  const verbosityTitle =
    promptVerbosity === "full" ? "Switch to compact prompt templates" : "Switch to full prompt templates";

  return (
    <div className="mt-1 flex items-center gap-1.5 text-[10px]">
      <DevChromeHoverHint dockCorner={dockCorner} body={VC_HOVER_UPDATE}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onUpdateClick}
          disabled={handoffDisabled}
          className={chrome.outlineBtn}
        >
          {headerCopied === "update" ? (
            <Check size={iz} aria-hidden />
          ) : listening ? (
            <>
              <MicOff size={iz} aria-hidden />
              {updateMediaChordShow ? <Images size={iz} className="opacity-90" aria-hidden /> : null}
            </>
          ) : (
            <>
              <Mic size={iz} aria-hidden />
              {updateMediaChordShow ? <Images size={iz} className="opacity-90" aria-hidden /> : null}
            </>
          )}
          {headerCopied === "update"
            ? "Update"
            : listening
              ? "Update"
              : updateMediaChordShow
                ? "Upd"
                : "Update"}
        </Button>
      </DevChromeHoverHint>
      <DevChromeHoverHint dockCorner={dockCorner} body={VC_HOVER_DELETE}>
        <Button type="button" variant="outline" size="sm" onClick={onDeleteClick} className={chrome.outlineBtn}>
          {headerCopied === "delete" ? (
            <Check size={iz} aria-hidden />
          ) : (
            <>
              <Trash2 size={iz} aria-hidden />
              {deleteMediaChordShow ? <Images size={iz} className="opacity-90" aria-hidden /> : null}
            </>
          )}
          Delete
        </Button>
      </DevChromeHoverHint>
      <DevPanelScreenshotButton dockCorner={dockCorner} firstAltLaneCid={firstAltLaneCid} size={size} />
      <DevChromeHoverHint dockCorner={dockCorner} body={vcVerbosityHoverBody(promptVerbosity === "full")}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onToggleVerbosity}
          title={verbosityTitle}
          className="h-6 px-1.5 text-[9px] font-semibold uppercase tracking-wide"
        >
          {promptVerbosity === "compact" ? "Short" : "Full"}
        </Button>
      </DevChromeHoverHint>
    </div>
  );
}
