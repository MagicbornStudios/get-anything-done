"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      position="bottom-right"
      closeButton={false}
      toastOptions={{
        className:
          "border border-border/70 bg-background/95 text-foreground shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/90",
      }}
    />
  );
}
