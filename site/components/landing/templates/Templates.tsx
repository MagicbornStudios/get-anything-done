import { TemplatesEvalSection } from "@/components/landing/templates/TemplatesEvalSection";
import { TemplatesGadPack } from "@/components/landing/templates/TemplatesGadPack";
import { TemplatesIntro } from "@/components/landing/templates/TemplatesIntro";

export default function Templates() {
  return (
    <section id="templates" className="border-t border-border/60">
      <div className="section-shell">
        <TemplatesIntro />
        <TemplatesGadPack />
        <TemplatesEvalSection />
      </div>
    </section>
  );
}
