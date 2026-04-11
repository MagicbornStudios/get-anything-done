import { redirect } from "next/navigation";

export default function BugsPage() {
  redirect("/planning?tab=bugs");
}
