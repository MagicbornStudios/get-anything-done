import { PlanningAppRedirectStub } from "@/components/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string[] }>;
}) {
  const { id } = await params;
  const joined = Array.isArray(id) ? id.join("/") : String(id);
  return {
    title: `${joined} moved to planning-app — GAD`,
    description: `Project detail views moved to the local planning-app (gad planning serve). Visit ${process.env.NEXT_PUBLIC_PLATFORM_URL ?? 'http://localhost:3002'}/projects/${joined} after starting the server.`,
  };
}

export default async function ProjectDeprecatedPage({
  params,
}: {
  params: Promise<{ id: string[] }>;
}) {
  const { id } = await params;
  const joined = Array.isArray(id) ? id.join("/") : String(id);

  return (
    <PlanningAppRedirectStub
      cid={`project-deprecated-stub-${joined.replace(/\//g, "-")}`}
      surface={`Project detail (${joined})`}
      targetPath={`/my-projects?projectid=${encodeURIComponent(joined)}`}
      summary="Per-project detail views — state, open tasks, recent decisions, subagent-run history, BYOK status — now render in the planning-app project drawer. Public browsing lives on at /project-market; operator views require a local monorepo checkout and `gad planning serve`."
    />
  );
}
