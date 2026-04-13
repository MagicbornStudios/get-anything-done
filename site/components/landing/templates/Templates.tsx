import { Identified } from "@/components/devid/Identified";
import { TemplatesEvalSection } from "@/components/landing/templates/TemplatesEvalSection";
import { TemplatesGadPack } from "@/components/landing/templates/TemplatesGadPack";
import { TemplatesIntro } from "@/components/landing/templates/TemplatesIntro";
import { SiteSection } from "@/components/site";

export default function Templates() {
  return (
    <SiteSection id="templates" className="border-t border-border/60">
      <Identified as="TemplatesIntro">
        <TemplatesIntro />
      </Identified>
      <Identified as="TemplatesGadPack">
        <TemplatesGadPack />
      </Identified>
      <Identified as="TemplatesEvalSection">
        <TemplatesEvalSection />
      </Identified>
    </SiteSection>
  );
}
