import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DetailShellBackLink({
  backHref,
  backLabel,
}: {
  backHref: string;
  backLabel: string;
}) {
  return (
    <Button
      variant="ghost"
      className="mb-6 h-auto gap-2 px-0 text-sm font-normal text-muted-foreground hover:text-foreground"
      asChild
    >
      <Link href={backHref}>
        <ArrowLeft size={14} aria-hidden />
        {backLabel}
      </Link>
    </Button>
  );
}
