import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type SiteTextCardProps = {
  title: string;
  /**
   * Card body. Either pass JSX as `children` (preferred) or as the explicit
   * `body` prop — `body` exists so callers using the prop pattern from other
   * Site* primitives (SiteSectionHeading kicker/title, etc.) don't have to
   * choose a different idiom for body content.
   */
  children?: ReactNode;
  body?: ReactNode;
};

export function SiteTextCard({ title, children, body }: SiteTextCardProps) {
  const content = body ?? children;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-sm leading-6 text-muted-foreground">{content}</div>
      </CardContent>
    </Card>
  );
}
