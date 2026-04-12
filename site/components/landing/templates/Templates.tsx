import { TemplatesEvalSection } from "@/components/landing/templates/TemplatesEvalSection";
import { TemplatesGadPack } from "@/components/landing/templates/TemplatesGadPack";
import { TemplatesIntro } from "@/components/landing/templates/TemplatesIntro";
import { SiteSection } from "@/components/site";

export default function Templates() {
  return (
    <SiteSection id="templates" className="border-t border-border/60">
      <TemplatesIntro />
      <TemplatesGadPack />
      <TemplatesEvalSection />
    </SiteSection>
  );
}
