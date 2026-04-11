import Link from "next/link";
import type { CatalogCommand } from "@/lib/catalog.generated";
import { Card, CardContent } from "@/components/ui/card";

export default function SkillDetailRelatedCommandsCard({
  commands,
}: {
  commands: CatalogCommand[];
}) {
  return (
    <Card className="border-border/70 bg-card/40 shadow-none">
      <CardContent className="space-y-3 p-5">
        <p className="text-xs uppercase tracking-wider text-accent">Related commands</p>
        <ul className="space-y-2 text-sm">
          {commands.map((c) => (
            <li key={c.id}>
              <Link href={`/commands/${c.id}`} className="font-mono text-xs text-accent hover:underline">
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
