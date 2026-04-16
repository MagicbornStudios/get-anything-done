"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { FilePenLine, FileX2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DevChromeHoverHint } from "@/components/devid/DevChromeHoverHint";
import { HandoffMarkdownEditor } from "@/components/devid/HandoffMarkdownEditor";
import { Identified } from "@/components/devid/Identified";
import { absolutePageUrl } from "@/components/devid/absolutePageUrl";
import {
  buildDeletePromptMerged,
  buildUpdateLockedPrefixMerged,
} from "@/components/devid/DevIdPromptTemplates";
import type { RegistryEntry } from "@/components/devid/SectionRegistry";
import { cn } from "@/lib/utils";

/** Demo target: Agent handoff cycle band on the home page (matches live `SiteSection` dev-id shape). */
const DEMO_HANDOFF_ENTRIES: RegistryEntry[] = [
  {
    cid: "agent-handoff-cycle-site-section",
    label: "agent-handoff-cycle-site-section",
    depth: 0,
    componentTag: "SiteSection",
    searchHint: 'cid="agent-handoff-cycle-site-section"',
  },
];

export function LandingHandoffTemplatesShowcase() {
  const pathname = usePathname() ?? "/";
  const pageUrl = useMemo(() => absolutePageUrl(pathname), [pathname]);
  const [tab, setTab] = useState<"update" | "delete">("update");

  const updateTemplate = useMemo(
    () => buildUpdateLockedPrefixMerged(pageUrl, DEMO_HANDOFF_ENTRIES, "full"),
    [pageUrl],
  );
  const deleteTemplate = useMemo(
    () => buildDeletePromptMerged(pageUrl, DEMO_HANDOFF_ENTRIES, "full"),
    [pageUrl],
  );

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as "update" | "delete")}
      className="flex min-h-0 flex-col"
    >
      <div className="shrink-0">
        <TabsList className="inline-flex h-6 w-fit gap-px rounded border border-border/40 bg-muted/30 p-px">
          <DevChromeHoverHint
            body={<p>Update handoff template (locked prefix — same shape as the Agent handoff modal Upd tab).</p>}
          >
            <TabsTrigger
              value="update"
              aria-label="Update handoff template preview"
              className="flex h-[1.375rem] items-center gap-0.5 rounded-sm px-1.5 py-0 text-[9px] font-semibold leading-none data-[state=active]:bg-background data-[state=active]:shadow-sm [&_svg]:shrink-0"
            >
              <FilePenLine className="size-2.5" strokeWidth={2} aria-hidden />
              <span aria-hidden>Upd</span>
            </TabsTrigger>
          </DevChromeHoverHint>
          <DevChromeHoverHint body={<p>Delete handoff template (same shape as the modal Del tab).</p>}>
            <TabsTrigger
              value="delete"
              aria-label="Delete handoff template preview"
              className="flex h-[1.375rem] items-center gap-0.5 rounded-sm px-1.5 py-0 text-[9px] font-semibold leading-none data-[state=active]:bg-background data-[state=active]:shadow-sm [&_svg]:shrink-0"
            >
              <FileX2 className="size-2.5" strokeWidth={2} aria-hidden />
              <span aria-hidden>Del</span>
            </TabsTrigger>
          </DevChromeHoverHint>
        </TabsList>
      </div>

      <Identified
        as="DevIdAgentPromptTabsBody"
        cid="devid-agent-prompt-tabs-body"
        register={false}
        depth={1}
        className={cn("mt-3 flex min-h-[min(28rem,55vh)] flex-col overflow-hidden rounded-2xl border border-border/70 bg-muted/15 shadow-inner shadow-black/20")}
      >
        <TabsContent value="update" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          <HandoffMarkdownEditor
            key={`landing-upd-${pageUrl}`}
            initialDoc={updateTemplate}
            onChange={() => {}}
            readOnly
            ariaLabel="Update handoff quick template (read-only preview)"
            className="min-h-[12rem] flex-1"
          />
        </TabsContent>
        <TabsContent value="delete" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          <HandoffMarkdownEditor
            key={`landing-del-${pageUrl}`}
            initialDoc={deleteTemplate}
            onChange={() => {}}
            readOnly
            ariaLabel="Delete handoff quick template (read-only preview)"
            className="min-h-[12rem] flex-1"
          />
        </TabsContent>
      </Identified>
    </Tabs>
  );
}
