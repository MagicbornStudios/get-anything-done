import { ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Identified } from "@/components/devid/Identified";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";

export default function StandardsTestingLayersSection() {
  return (
    <SiteSection>
      <Identified as="StandardsTestingLayersSection">
      <SiteSectionHeading
        icon={ClipboardCheck}
        kicker="Three testing layers (Anthropic guide)"
        kickerRowClassName="mb-6 gap-3"
      />
      <SiteProse size="sm" className="mb-6">
        From the Anthropic skills guide. Complementary to the agentskills.io with_skill vs
        without_skill methodology — this taxonomy distinguishes what you&apos;re testing.
      </SiteProse>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <Badge variant="outline" className="mb-1 w-fit text-[10px]">
              layer 1
            </Badge>
            <CardTitle className="text-base">Triggering tests</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            Does the skill load when it should? Test with obvious prompts, paraphrased prompts, and
            negative (unrelated) prompts. The skill should trigger on the first two and NOT trigger on
            the third.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <Badge variant="outline" className="mb-1 w-fit text-[10px]">
              layer 2
            </Badge>
            <CardTitle className="text-base">Functional tests</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            Does the skill produce correct outputs? Valid outputs, API calls succeed, error handling
            works, edge cases covered. This is where the agentskills.io assertion-based grading fits.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <Badge variant="outline" className="mb-1 w-fit text-[10px]">
              layer 3
            </Badge>
            <CardTitle className="text-base">Performance comparison</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            Does the skill actually improve results vs baseline? The with_skill vs without_skill
            pattern. Improvements in task completion rate, reduction in back-and-forth messages, fewer
            failed API calls, lower token usage.
          </CardContent>
        </Card>
      </div>
      </Identified>
    </SiteSection>
  );
}
