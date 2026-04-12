import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SecurityInfoCard({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">{body}</CardContent>
    </Card>
  );
}
