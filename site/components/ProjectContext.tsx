"use client";

// Task 44-30 (decision gad-188 / 44-28.A1): client-side current-project
// context. The active project id is driven by the `?projectid=` search
// param so it shares naturally with deep links and SSR. Pages that need
// server-side scoping read `searchParams.projectid` directly — this
// context is the client-side twin used by the nav picker and any other
// interactive consumer.

import { createContext, useContext, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  REGISTERED_PROJECTS,
  DEFAULT_PROJECT_ID,
} from "@/lib/project-config";

export const ProjectContext = createContext<string>(DEFAULT_PROJECT_ID);

function ProjectProviderInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const paramId = searchParams.get("projectid");
  const valid =
    paramId && REGISTERED_PROJECTS.some((p) => p.id === paramId);
  const currentId = valid ? (paramId as string) : DEFAULT_PROJECT_ID;
  return (
    <ProjectContext.Provider value={currentId}>
      {children}
    </ProjectContext.Provider>
  );
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  // useSearchParams() requires a Suspense boundary per Next.js app-router
  // rules; wrap here so consumers don't have to.
  return (
    <Suspense
      fallback={
        <ProjectContext.Provider value={DEFAULT_PROJECT_ID}>
          {children}
        </ProjectContext.Provider>
      }
    >
      <ProjectProviderInner>{children}</ProjectProviderInner>
    </Suspense>
  );
}

export function useCurrentProject(): string {
  return useContext(ProjectContext);
}
