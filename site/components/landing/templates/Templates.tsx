import { Identified } from "gad-visual-context";
import { TemplatesEvalSection } from "@/components/landing/templates/TemplatesEvalSection";
import { TemplatesGadPack } from "@/components/landing/templates/TemplatesGadPack";
import { TemplatesIntro } from "@/components/landing/templates/TemplatesIntro";
import { SiteSection } from "@/components/site";

export default function Templates() {
  return (
    <SiteSection id="templates" cid="templates-site-section" className="border-t border-border/60">
      <Identified as="DownloadsTemplates">
      <Identified as="TemplatesIntro">
        <TemplatesIntro />
      </Identified>
      <Identified as="TemplatesGadPack">
        <TemplatesGadPack />
      </Identified>
      <Identified as="TemplatesEvalSection">
        <TemplatesEvalSection />
      </Identified>
      </Identified>
    </SiteSection>
  );
}

