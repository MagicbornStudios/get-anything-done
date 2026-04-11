import Link from "next/link";
import type { CatalogCommand } from "@/lib/catalog.generated";

export default function SkillDetailRelatedCommandsCard({
  commands,
}: {
  commands: CatalogCommand[];
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/40 p-5">
      <p className="text-xs uppercase tracking-wider text-accent">Related commands</p>
      <ul className="mt-3 space-y-2 text-sm">
        {commands.map((c) => (
          <li key={c.id}>
            <Link
              href={`/commands/${c.id}`}
              className="font-mono text-xs text-accent hover:underline"
            >
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
