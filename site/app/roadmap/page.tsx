import { redirect } from "next/navigation";

export default function RoadmapPage() {
  redirect("/planning?tab=roadmap");
}
