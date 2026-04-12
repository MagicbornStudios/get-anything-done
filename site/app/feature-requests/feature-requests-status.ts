import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

export const FEATURE_REQUEST_STATUS_CONFIG: Record<
  string,
  { variant: "default" | "success" | "outline" | "danger"; icon: typeof Clock }
> = {
  submitted: { variant: "default", icon: Clock },
  acknowledged: { variant: "outline", icon: Clock },
  "in-progress": { variant: "outline", icon: Clock },
  resolved: { variant: "success", icon: CheckCircle2 },
  "wont-fix": { variant: "danger", icon: AlertTriangle },
};
