import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import { CONTRIBUTE_REPO_URL } from "./contribute-constants";

export function ContributeLinksSection() {
  return (
    <SiteSection>
      <SiteSectionHeading kicker="Useful starting points" />
      <div className="mt-4 space-y-3 text-sm leading-6">
        <p>
          <Button variant="link" className="h-auto gap-1 p-0 text-sm font-normal text-accent" asChild>
            <a href={CONTRIBUTE_REPO_URL} target="_blank" rel="noopener noreferrer">
              Repository on GitHub
              <ExternalLink size={11} aria-hidden />
            </a>
          </Button>
        </p>
        <p>
          <Link href="/decisions" className="text-accent underline decoration-dotted">
            Decisions
          </Link>{" "}
          &mdash; every committed decision the project has made.
        </p>
        <p>
          <Link href="/questions" className="text-accent underline decoration-dotted">
            Open questions
          </Link>{" "}
          &mdash; what we&apos;re still working out. A great place to propose answers.
        </p>
        <p>
          <Link href="/requirements" className="text-accent underline decoration-dotted">
            Requirements
          </Link>{" "}
          &mdash; what each eval is being measured against.
        </p>
        <p>
          <Link href="/glossary" className="text-accent underline decoration-dotted">
            Glossary
          </Link>{" "}
          &mdash; if a term is confusing, it&apos;s here.
        </p>
      </div>
    </SiteSection>
  );
}
