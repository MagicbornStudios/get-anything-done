import { redirect } from "next/navigation";

export default function DecisionsPage() {
  redirect("/planning?tab=decisions");
}
