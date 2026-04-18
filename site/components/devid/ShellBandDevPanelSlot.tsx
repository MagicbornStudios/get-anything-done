"use client";

import type { ReactNode } from "react";
import { BandDevPanel } from "./BandDevPanel";
import { BandDevPanelGate } from "./BandDevPanelGate";
import { useDevId } from "./DevIdProvider";

/**
 * Client-side wrapper for `MarketingShell`'s nav/footer bands.
 *
 * Owns the `group/site-band relative` wrapper div (previously rendered directly in
 * `MarketingShell`) and mounts the `BandDevPanel` only on hover/focus/lock when dev IDs
 * are enabled and the band has not been dismissed. Matches the gating we apply inside
 * `SiteSection` so the landing page defaults to zero mounted panels.
 */
export function ShellBandDevPanelSlot({
  cid,
  label,
  edge,
  corner = "right",
  children,
}: {
  cid: string;
  label: string;
  edge: "top" | "bottom";
  corner?: "left" | "right";
  children: ReactNode;
}) {
  const { enabled, dismissedBandCids, toggleBandDismiss } = useDevId();
  const active = enabled && !dismissedBandCids.has(cid);

  return (
    <BandDevPanelGate
      active={active}
      renderPanel={() => (
        <BandDevPanel
          cid={cid}
          label={label}
          edge={edge}
          corner={corner}
          onDismiss={() => toggleBandDismiss(cid)}
        />
      )}
    >
      {children}
    </BandDevPanelGate>
  );
}
