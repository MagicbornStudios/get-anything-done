"use client";

import { Identified } from "@/components/devid/Identified";
import { ExternalLink, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type Props = {
  project: string;
  version: string;
  iframeSrc: string;
};

export function PlayableEmbed({ project, version, iframeSrc }: Props) {
  return (
    <Identified as="PlayableEmbed">
      <Card className="overflow-hidden rounded-2xl border-border/70 bg-background shadow-2xl shadow-black/40">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/60 bg-card/40 px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Gamepad2 size={14} className="text-accent" aria-hidden />
            playable: {project}/{version}
          </div>
          <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs font-medium text-muted-foreground hover:text-accent" asChild>
            <a href={iframeSrc} target="_blank" rel="noopener noreferrer">
              Open full screen
              <ExternalLink className="!size-2.5" aria-hidden />
            </a>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="aspect-[16/10] w-full">
            <iframe
              key={iframeSrc}
              src={iframeSrc}
              title={`${project} ${version}`}
              className="h-full w-full bg-[#1a1a2e]"
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-pointer-lock"
            />
          </div>
        </CardContent>
      </Card>
    </Identified>
  );
}
