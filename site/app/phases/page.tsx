import { redirect } from "next/navigation";

export default function PhasesPage() {
  redirect("/planning?tab=phases");
}
