"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { type ReactNode, useCallback } from "react";
import { cn } from "@/lib/utils";
import { VOCAB } from "@/lib/vocabulary";
import { ProjectDetailTabContent } from "./ProjectDetailTabContent";

const TABS = [
  { key: "overview", label: VOCAB.tabs.overview },
  { key: "planning", label: VOCAB.tabs.planning },
  { key: "evolution", label: VOCAB.tabs.evolution },
  { key: "system", label: VOCAB.tabs.system },
] as const;

export type DetailTab = (typeof TABS)[number]["key"];

export function ProjectDetailTabs({
  overviewContent,
  projectId,
}: {
  overviewContent: ReactNode;
  projectId: string;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const raw = searchParams.get("tab");
  const activeTab: DetailTab =
    TABS.some((t) => t.key === raw) ? (raw as DetailTab) : "overview";

  const setTab = useCallback(
    (tab: DetailTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "overview") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  return (
    <>
      <div className="border-b border-border/40 bg-background/80">
        <div className="mx-auto flex max-w-5xl gap-0 px-4">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              data-cid={`project-detail-tab-${tab.key}-site-section`}
              onClick={() => setTab(tab.key)}
              className={cn(
                "px-3 py-2 text-xs font-medium transition-colors",
                activeTab === tab.key
                  ? "border-b-2 border-accent text-accent"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <ProjectDetailTabContent
        activeTab={activeTab}
        overviewContent={overviewContent}
        projectId={projectId}
      />
    </>
  );
}
