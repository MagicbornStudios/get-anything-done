import Link from "next/link";
import { Button } from "@/components/ui/button";

export function NavBrand() {
  return (
    <Button
      variant="ghost"
      className="h-auto shrink-0 gap-2 px-0 font-semibold tracking-tight hover:bg-transparent"
      asChild
    >
      <Link href="/">
        <span className="inline-block size-2 rounded-full bg-accent shadow-[0_0_12px_2px] shadow-accent/60" />
        <span>get-anything-done</span>
      </Link>
    </Button>
  );
}
