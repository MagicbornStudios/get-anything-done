import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function DetailShellBackLink({
  backHref,
  backLabel,
}: {
  backHref: string;
  backLabel: string;
}) {
  return (
    <Link
      href={backHref}
      className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft size={14} aria-hidden />
      {backLabel}
    </Link>
  );
}
