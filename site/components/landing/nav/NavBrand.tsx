import Link from "next/link";

export function NavBrand() {
  return (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-2 font-semibold tracking-tight"
    >
      <span className="inline-block size-2 rounded-full bg-accent shadow-[0_0_12px_2px] shadow-accent/60" />
      <span>get-anything-done</span>
    </Link>
  );
}
