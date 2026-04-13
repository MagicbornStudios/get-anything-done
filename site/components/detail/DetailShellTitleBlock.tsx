import { Identified } from "@/components/devid/Identified";

export default function DetailShellTitleBlock({
  name,
  subtitle,
  description,
}: {
  name: string;
  subtitle?: string;
  description?: string;
}) {
  return (
    <Identified as="DetailShellTitleBlock" className="contents">
      <h1 className="mt-5 font-mono text-3xl font-semibold tracking-tight text-accent md:text-4xl">
        {name}
      </h1>
      {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
      {description && (
        <p className="mt-5 max-w-3xl text-lg leading-8 text-foreground">{description}</p>
      )}
    </Identified>
  );
}
