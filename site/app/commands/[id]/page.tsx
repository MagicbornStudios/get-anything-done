import Link from "next/link";
import { notFound } from "next/navigation";
import DetailShell from "@/components/detail/DetailShell";
import { AGENTS, COMMANDS } from "@/lib/catalog.generated";

export const dynamicParams = false;

export function generateStaticParams() {
  return COMMANDS.map((c) => ({ id: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cmd = COMMANDS.find((c) => c.id === id);
  if (!cmd) return { title: "Command not found" };
  return {
    title: `${cmd.name} — GAD command`,
    description: cmd.description,
  };
}

export default async function CommandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cmd = COMMANDS.find((c) => c.id === id);
  if (!cmd) notFound();

  const spawnedAgent = cmd.agent ? AGENTS.find((a) => a.name === cmd.agent) : null;

  const meta = [
    {
      label: "Usage",
      value: cmd.argumentHint ? (
        <code className="font-mono text-xs">{cmd.name} {cmd.argumentHint}</code>
      ) : (
        <code className="font-mono text-xs">{cmd.name}</code>
      ),
    },
    {
      label: "Spawns",
      value: spawnedAgent ? (
        <Link href={`/agents/${spawnedAgent.id}`} className="font-mono text-xs text-accent hover:underline">
          {spawnedAgent.name}
        </Link>
      ) : (
        "inline (no dedicated subagent)"
      ),
    },
  ];

  const sidebar = (
    <>
      {spawnedAgent && (
        <div className="rounded-2xl border border-border/70 bg-card/40 p-5">
          <p className="text-xs uppercase tracking-wider text-accent">Spawned subagent</p>
          <Link
            href={`/agents/${spawnedAgent.id}`}
            className="mt-2 block font-mono text-sm text-foreground hover:text-accent"
          >
            {spawnedAgent.name}
          </Link>
          <p className="mt-2 text-xs text-muted-foreground line-clamp-4">
            {spawnedAgent.description}
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
      kind="command"
      backHref="/#catalog"
      backLabel="Back to catalog"
      name={cmd.name}
      subtitle={cmd.id}
      description={cmd.description}
      meta={meta}
      sourcePath={cmd.file}
      bodyHtml={cmd.bodyHtml}
      sidebar={sidebar}
    />
  );
}
