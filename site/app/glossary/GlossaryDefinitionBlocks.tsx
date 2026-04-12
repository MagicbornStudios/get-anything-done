import type { ReactNode } from "react";
import { glossaryMarkdownInline } from "./glossary-markdown-inline";

/** Split full definition on double newlines into paragraphs with inline markdown. */
export function GlossaryDefinitionBlocks({ text }: { text: string }): ReactNode {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((p, i) => (
    <p key={i} className="mt-3 text-sm leading-7 text-muted-foreground first:mt-0">
      {glossaryMarkdownInline(p)}
    </p>
  ));
}
