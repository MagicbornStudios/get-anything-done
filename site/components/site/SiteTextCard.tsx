import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type SiteTextCardProps = {
  title: string;
  children: ReactNode;
};

export function SiteTextCard({ title, children }: SiteTextCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-sm leading-6 text-muted-foreground">{children}</div>
      </CardContent>
    </Card>
  );
}
