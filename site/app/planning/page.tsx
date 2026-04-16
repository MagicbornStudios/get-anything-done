import { redirect } from "next/navigation";

export const metadata = {
  title: "Planning Dashboard - GAD",
  description:
    "Cross-project planning hub linking to per-project Planning, Evolution, and System tabs.",
};

export default function PlanningDashboardPage() {
  redirect("/projects/get-anything-done?tab=planning");
}
