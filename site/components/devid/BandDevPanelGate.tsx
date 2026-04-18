"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from "react";

/** ~200ms grace so the panel doesn't flicker when the pointer traverses its chrome. */
const BAND_PANEL_HOVER_LEAVE_GRACE_MS = 200;

/**
 * Hover/focus-gated mount shell for `BandDevPanel` (used by `SiteSection` and
 * `MarketingShell`).
 *
 * Default landing-page state is zero panels mounted — no keydown listeners, no chord
 * subscribers, no `DevPanelDepthPager` instances. A panel is mounted only while the
 * pointer is over the band (with a short leave grace so traversing the panel chrome
 * doesn't flicker), while a keyboard user has focus-within, or while the user has
 * "locked" it by clicking inside the panel wrapper. Lock releases on outside click or
 * Escape. When `active` is false we skip all listeners.
 */
export function BandDevPanelGate({
  active,
  children,
  renderPanel,
  className = "group/site-band relative",
}: {
  active: boolean;
  children: ReactNode;
  renderPanel: () => ReactNode;
  className?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [locked, setLocked] = useState(false);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimerRef.current !== null) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearLeaveTimer(), [clearLeaveTimer]);

  useEffect(() => {
    if (!active) {
      clearLeaveTimer();
      setHovered(false);
      setFocused(false);
      setLocked(false);
    }
  }, [active, clearLeaveTimer]);

  useEffect(() => {
    if (!locked) return;
    const onPointerDown = (e: PointerEvent) => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      if (e.target instanceof Node && wrapper.contains(e.target)) return;
      setLocked(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLocked(false);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [locked]);

  const handlePointerEnter = useCallback(() => {
    if (!active) return;
    clearLeaveTimer();
    setHovered(true);
  }, [active, clearLeaveTimer]);

  const handlePointerLeave = useCallback(() => {
    if (!active) return;
    clearLeaveTimer();
    leaveTimerRef.current = setTimeout(() => {
      setHovered(false);
      leaveTimerRef.current = null;
    }, BAND_PANEL_HOVER_LEAVE_GRACE_MS);
  }, [active, clearLeaveTimer]);

  const handleFocusIn = useCallback(() => {
    if (!active) return;
    setFocused(true);
  }, [active]);

  const handleFocusOut = useCallback(
    (e: FocusEvent<HTMLDivElement>) => {
      if (!active) return;
      const next = e.relatedTarget as Node | null;
      const wrapper = wrapperRef.current;
      if (wrapper && next && wrapper.contains(next)) return;
      setFocused(false);
    },
    [active],
  );

  const handlePanelPointerDown = useCallback(() => {
    if (!active) return;
    setLocked(true);
  }, [active]);

  if (!active) {
    return <div className={className}>{children}</div>;
  }

  const mountPanel = hovered || focused || locked;

  return (
    <div
      ref={wrapperRef}
      className={className}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onFocus={handleFocusIn}
      onBlur={handleFocusOut}
    >
      {children}
      {mountPanel ? (
        <div onPointerDownCapture={handlePanelPointerDown} data-devid-band-panel-wrapper="">
          {renderPanel()}
        </div>
      ) : null}
    </div>
  );
}
