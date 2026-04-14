"use client";

import { useEffect } from "react";

const ACTIVE = "data-scrollbar-active";
const HIDE_MS = 900;

function scrollTarget(e: Event): HTMLElement | null {
  const t = e.target;
  if (t === document || t === document.documentElement) return document.documentElement;
  if (t === document.body) return document.documentElement;
  return t instanceof HTMLElement ? t : null;
}

function isScrollable(el: HTMLElement): boolean {
  if (el === document.documentElement) {
    return (
      document.documentElement.scrollHeight > window.innerHeight + 1 ||
      document.documentElement.scrollWidth > window.innerWidth + 1
    );
  }
  const { overflowY, overflowX } = getComputedStyle(el);
  const oy = overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
  const ox = overflowX === "auto" || overflowX === "scroll" || overflowX === "overlay";
  if (oy && el.scrollHeight > el.clientHeight + 1) return true;
  if (ox && el.scrollWidth > el.clientWidth + 1) return true;
  return false;
}

/**
 * Marks the element that is actually scrolling so CSS can show a thumb while
 * scrolling, then fade it out (see `globals.css`).
 */
export function GlobalScrollbarBehavior() {
  useEffect(() => {
    const timers = new WeakMap<HTMLElement, number>();

    const onScroll = (e: Event) => {
      const el = scrollTarget(e);
      if (!el || !isScrollable(el)) return;
      el.setAttribute(ACTIVE, "");
      const prev = timers.get(el);
      if (prev != null) window.clearTimeout(prev);
      const id = window.setTimeout(() => {
        el.removeAttribute(ACTIVE);
        timers.delete(el);
      }, HIDE_MS);
      timers.set(el, id);
    };

    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      document.documentElement.removeAttribute(ACTIVE);
      document.querySelectorAll(`[${ACTIVE}]`).forEach((n) => {
        if (n instanceof HTMLElement) n.removeAttribute(ACTIVE);
      });
    };
  }, []);

  return null;
}
