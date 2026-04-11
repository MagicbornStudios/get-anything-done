import { redirect } from "next/navigation";

export default function TasksPage() {
  redirect("/planning?tab=tasks");
}
