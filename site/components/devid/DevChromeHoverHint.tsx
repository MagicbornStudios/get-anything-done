"use client";

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { useVcPanelHoverAnchorRef } from "./VcPanelHoverAnchorContext";

type Side = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

/** Horizontal dock of the Visual Context Panel (`ml-auto` = right, `ml-2` = left). */
export type VcPanelCorner = "left" | "right";

type TriggerProps = {
  onPointerEnter?: (e: PointerEvent) => void;
  onPointerLeave?: (e: PointerEvent) => void;
};

/**
 * Radix HoverCard for dev / visual-context chrome.
 * With `dockCorner` and `VcPanelHoverAnchorContext`, the card uses **fixed** placement from the
 * panel rect (not the trigger) so the gutter stays beside the `w-72` strip. Plain `dockCorner`
 * without context still uses the default trigger-relative HoverCard.
 */
export function DevChromeHoverHint({
  children,
  body,
  dockCorner,
  side: sideOverride,
  align: alignOverride,
  openDelay = 95,
  closeDelay = 70,
  contentClassName,
  /** When set on docked hints, portaled content gets this `data-vc-chrome-hint-content` value for chord-preview hit-testing. */
  chromeHintScopeId,
}: {
  children: ReactNode;
  body: ReactNode;
  dockCorner?: VcPanelCorner;
  side?: Side;
  align?: Align;
  openDelay?: number;
  closeDelay?: number;
  contentClassName?: string;
  chromeHintScopeId?: string;
}) {
  const panelAnchorRef = useVcPanelHoverAnchorRef();
  const side: Side =
    sideOverride ??
    (dockCorner === "right" ? "left" : dockCorner === "left" ? "right" : "top");
  const align: Align = alignOverride ?? (dockCorner ? "start" : "center");
  const sideOffset = dockCorner ? 4 : 6;
  const avoidCollisions = !dockCorner;
  const usePanelAnchor = Boolean(dockCorner && panelAnchorRef);

  if (usePanelAnchor && panelAnchorRef && dockCorner) {
    return (
      <VcPanelDockedHoverHint
        panelRef={panelAnchorRef}
        dockCorner={dockCorner}
        align={align}
        sideOffset={sideOffset}
        openDelay={openDelay}
        closeDelay={closeDelay}
        contentClassName={contentClassName}
        chromeHintScopeId={chromeHintScopeId}
        trigger={children}
        body={body}
      />
    );
  }

  return (
    <HoverCard openDelay={openDelay} closeDelay={closeDelay}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        avoidCollisions={avoidCollisions}
        className={cn(
          "z-[230] w-max max-w-[min(20rem,90vw)] border-border/70 p-2.5 text-[10px] leading-snug text-popover-foreground shadow-md",
          dockCorner && "max-w-[13rem]",
          contentClassName,
        )}
      >
        {body}
      </HoverCardContent>
    </HoverCard>
  );
}

function VcPanelDockedHoverHint({
  panelRef,
  dockCorner,
  align,
  sideOffset,
  openDelay,
  closeDelay,
  contentClassName,
  chromeHintScopeId,
  trigger,
  body,
}: {
  panelRef: React.RefObject<HTMLElement | null>;
  dockCorner: VcPanelCorner;
  align: Align;
  sideOffset: number;
  openDelay: number;
  closeDelay: number;
  contentClassName?: string;
  chromeHintScopeId?: string;
  trigger: ReactNode;
  body: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const openTimerRef = useRef(0);
  const closeTimerRef = useRef(0);
  const pointerInContentRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = 0;
    }
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = 0;
    }
  }, []);

  const onTriggerPointerEnter = useCallback(() => {
    clearTimers();
    openTimerRef.current = window.setTimeout(() => setOpen(true), openDelay);
  }, [clearTimers, openDelay]);

  const onTriggerPointerLeave = useCallback(() => {
    if (openTimerRef.current) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = 0;
    }
    closeTimerRef.current = window.setTimeout(() => {
      if (!pointerInContentRef.current) setOpen(false);
    }, closeDelay);
  }, [closeDelay]);

  const onContentPointerEnter = useCallback(() => {
    pointerInContentRef.current = true;
    clearTimers();
  }, [clearTimers]);

  const onContentPointerLeave = useCallback(() => {
    pointerInContentRef.current = false;
    clearTimers();
    closeTimerRef.current = window.setTimeout(() => {
      if (!pointerInContentRef.current) setOpen(false);
    }, closeDelay);
  }, [clearTimers, closeDelay]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const node = contentRef.current;
    if (!panel || !node) return;

    const place = () => {
      const pr = panel.getBoundingClientRect();
      const cr = node.getBoundingClientRect();
      const gap = sideOffset;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pad = 8;
      let left =
        dockCorner === "right" ? pr.left - gap - cr.width : pr.right + gap;
      let top = pr.top;
      if (align === "center") {
        top = pr.top + (pr.height - cr.height) / 2;
      } else if (align === "end") {
        top = pr.bottom - cr.height;
      }
      left = Math.min(Math.max(left, pad), vw - cr.width - pad);
      top = Math.min(Math.max(top, pad), vh - cr.height - pad);
      node.style.position = "fixed";
      node.style.left = `${Math.round(left)}px`;
      node.style.top = `${Math.round(top)}px`;
      node.style.zIndex = "230";
    };

    place();
    const ro = new ResizeObserver(place);
    ro.observe(panel);
    ro.observe(node);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, panelRef, dockCorner, sideOffset, align]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        pointerInContentRef.current = false;
        setOpen(false);
        clearTimers();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, clearTimers]);

  const triggerNode = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<TriggerProps>, {
        onPointerEnter: (e: PointerEvent) => {
          (trigger as ReactElement<TriggerProps>).props.onPointerEnter?.(e);
          onTriggerPointerEnter();
        },
        onPointerLeave: (e: PointerEvent) => {
          (trigger as ReactElement<TriggerProps>).props.onPointerLeave?.(e);
          onTriggerPointerLeave();
        },
      })
    : (
        <span
          className="inline-flex"
          onPointerEnter={onTriggerPointerEnter}
          onPointerLeave={onTriggerPointerLeave}
        >
          {trigger}
        </span>
      );

  return (
    <>
      {triggerNode}
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={contentRef}
              role="tooltip"
              onPointerEnter={onContentPointerEnter}
              onPointerLeave={onContentPointerLeave}
              {...(chromeHintScopeId
                ? { "data-vc-chrome-hint-content": chromeHintScopeId }
                : {})}
              className={cn(
                "z-[230] w-max max-w-[min(20rem,90vw)] rounded-md border border-border/70 bg-popover p-2.5 text-[10px] leading-snug text-popover-foreground shadow-md outline-none",
                dockCorner === "right" || dockCorner === "left" ? "max-w-[13rem]" : "",
                contentClassName,
              )}
            >
              {body}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
