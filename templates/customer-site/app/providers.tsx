"use client";

import { useMemo, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  VisualContextProvider,
  DevIdProvider,
  type VCSRouterAdapterValue,
} from "gad-visual-context";

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const nextRouter = useRouter();
  const adapter = useMemo<VCSRouterAdapterValue>(
    () => ({
      pathname,
      router: {
        push: (href) => nextRouter.push(href),
        replace: (href) => nextRouter.replace(href),
        back: () => nextRouter.back(),
        forward: () => nextRouter.forward(),
        refresh: () => nextRouter.refresh(),
        prefetch: (href) => nextRouter.prefetch(href),
      },
    }),
    [pathname, nextRouter],
  );

  return (
    <VisualContextProvider router={adapter}>
      <DevIdProvider>
        {children}
      </DevIdProvider>
    </VisualContextProvider>
  );
}
