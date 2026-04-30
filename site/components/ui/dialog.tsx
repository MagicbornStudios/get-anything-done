"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useDevIdBandCid } from "gad-visual-context";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    showClose?: boolean;
    /** When true, hides the built-in close button (alias of `showClose={false}`) */
    hideClose?: boolean;
    /** Merged into the portal overlay (backdrop) — e.g. z-index or opacity overrides */
    overlayClassName?: string;
    /**
     * Associate this dialog with a `SiteSection` band for the visual context DevPanel.
     * Defaults to the nearest `DevIdBandProvider` (section shell). Pass `null` to opt out.
     */
    devIdBandCid?: string | null;
  }
>(({ className, children, showClose = true, hideClose, overlayClassName, devIdBandCid: devIdBandCidProp, ...props }, ref) => {
  const effectiveShowClose = hideClose ? false : showClose;
  const bandFromContext = useDevIdBandCid();
  const resolvedDevIdBand =
    devIdBandCidProp !== undefined ? devIdBandCidProp : bandFromContext;
  return (
  <DialogPortal>
    <DialogOverlay className={overlayClassName} />
    <DialogPrimitive.Content
      ref={ref}
      data-devid-band={resolvedDevIdBand ?? undefined}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 grid w-[min(96vw,56rem)] max-h-[min(92vh,900px)] translate-x-[-50%] translate-y-[-50%] gap-0 overflow-hidden rounded-xl border border-border/80 bg-card p-0 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className,
      )}
      {...props}
    >
      {children}
      {effectiveShowClose ? (
        <DialogPrimitive.Close className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-muted-foreground opacity-80 ring-offset-background transition-opacity hover:opacity-100 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      ) : null}
    </DialogPrimitive.Content>
  </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1 border-b border-border/60 px-5 py-4 pr-12 text-left", className)} {...props} />
);

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export { Dialog, DialogPortal, DialogTrigger, DialogClose, DialogOverlay, DialogContent, DialogHeader, DialogTitle, DialogDescription };
