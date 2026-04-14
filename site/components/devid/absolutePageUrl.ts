"use client";

export function absolutePageUrl(pathname: string): string {
  if (typeof window === "undefined") return pathname || "/";
  const path = pathname.startsWith("/") ? pathname : `/${pathname || ""}`;
  return `${window.location.origin}${path}`;
}
