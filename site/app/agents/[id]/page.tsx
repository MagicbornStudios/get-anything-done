import Link from "next/link";
import { notFound } from "next/navigation";
import DetailShell from "@/components/detail/DetailShell";
import { AGENTS, COMMANDS } from "@/lib/catalog.generated";

export const dynamicParams = false;

export function generateStaticParams() {
  return AGENTS.map((a) => ({ id: a.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = AGENTS.find((a) => a.id === id);
  if (!agent) return { title: "Agent not found" };
  return {
    title: `${agent.name} — GAD subagent`,
    description: agent.description,
  };
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = AGENTS.find((a) => a.id === id);
  if (!agent) notFound();

  const spawnedBy = COMMANDS.filter((c) => c.agent === agent.name);

  const meta = [
    { label: "Tools", value: agent.tools ? <code className="font-mono text-xs">{agent.tools}</code> : "—" },
    { label: "Color", value: agent.color ?? "—" },
    { label: "Spawned by", value: `${spawnedBy.length} command${spawnedBy.length === 1 ? "" : "s"}` },
  ];

  const sidebar = (
    <>
      {spawnedBy.length > 0 ? (
        <div className="rounded-2xl border border-border/70 bg-card/40 p-5">
          <p className="text-xs uppercase tracking-wider text-accent">Spawned by commands</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Slash commands that invoke this subagent via the `agent:` frontmatter field.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {spawnedBy.map((c) => (
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
      ) : (
        <div className="rounded-2xl border border-border/70 bg-card/30 p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Ad-hoc subagent
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            No slash command currently lists this agent in its frontmatter. It&apos;s available for
            explicit spawning but not wired to an orchestrator.
          </p>
        </div>
      )}

      <Link
        href="/#catalog"
        className="block rounded-2xl border border-border/70 bg-card/30 p-5 text-center text-xs font-semibold text-muted-foreground transition-colors hover:border-accent hover:text-accent"
      >
        ← Back to catalog
      </Link>
    </>
  );

  return (
    <DetailShell
      kind="subagent"
      backHref="/#catalog"
      backLabel="Back to catalog"
      name={agent.name}
      subtitle={agent.id}
      description={agent.description}
      meta={meta}
      sourcePath={agent.file}
      bodyHtml={agent.bodyHtml}
      sidebar={sidebar}
    />
  );
}
