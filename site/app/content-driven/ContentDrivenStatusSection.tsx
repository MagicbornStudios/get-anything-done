import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import { Ref } from "@/components/refs/Ref";

export function ContentDrivenStatusSection() {
  return (
    <SiteSection tone="muted">
      <SiteSectionHeading kicker="Current status" className="mb-6" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Dependencies</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            <ul className="space-y-2">
              <li>
                <strong className="text-foreground">Content extraction CLI:</strong> a new subcommand (
                <code className="rounded bg-background/60 px-1 py-0.5 text-xs">gad eval extract-content</code>) that walks
                a preserved eval run and emits a portable content pack JSON.
              </li>
              <li>
                <strong className="text-foreground">New eval flavor:</strong>{" "}
                <code className="rounded bg-background/60 px-1 py-0.5 text-xs">escape-the-dungeon-inherited-content</code>{" "}
                with a gad.json <code className="rounded bg-background/60 px-1 py-0.5 text-xs">content_pack</code> field
                pointing at the source pack.
              </li>
              <li>
                <strong className="text-foreground">Rubric construction:</strong> dimensions for derivative coherence,
                integration, and scope expansion — explicitly distinct from the freedom/CSH rubric.
              </li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Round planning</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            Content-driven runs will enter the rounds framework as a new track. They do <strong>not</strong> require
            their own requirements version — they inherit greenfield v5 requirements plus the content pack as an input.
            Per the rounds framework (<Ref id="gad-72" />), a new hypothesis can start a new round against any existing
            requirements version. Round 6 is the current placeholder for the first content-driven run.
          </CardContent>
        </Card>
      </div>
    </SiteSection>
  );
}
