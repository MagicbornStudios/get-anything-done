export type DataSource = {
  id: string;
  surface: string;
  number: string;
  source: string;
  formula?: string;
  trust: "deterministic" | "self-report" | "human" | "authored";
  page: string;
  notes?: string;
};

export type DbJsonPayload = {
  _schema?: {
    id?: string;
    generated_by?: string;
    generated_on?: string;
    source_path?: string;
  };
  records?: DataSource[];
  raw?: unknown;
  collections?: {
    active?: DataSource[];
  };
};

function toPayload(input: unknown): DbJsonPayload {
  if (!input || typeof input !== "object") return {};
  return input as DbJsonPayload;
}

export function buildDataSourcesFromPayload(input: unknown): DataSource[] {
  const payload = toPayload(input);
  if (Array.isArray(payload.records)) return payload.records;
  if (Array.isArray(payload.collections?.active)) return payload.collections.active;
  return [];
}

export function getDbViewerSourcePathFromPayload(input: unknown): string {
  const payload = toPayload(input);
  return payload._schema?.source_path ?? "site/data/db.json";
}

export const TRUST_TINT: Record<DataSource["trust"], "success" | "default" | "outline" | "danger"> = {
  deterministic: "success",
  "self-report": "danger",
  human: "default",
  authored: "outline",
};

export const TRUST_DESCRIPTION: Record<DataSource["trust"], string> = {
  deterministic:
    "Computed by code from raw inputs at prebuild. Same inputs always produce the same number. Highest trust.",
  "self-report": "The agent put this number into TRACE.json itself. Lowest trust.",
  human: "A human submitted this via the rubric review CLI. Trustable but not scalable.",
  authored: "Hand-curated content (glossary, decisions, requirements). Trust is editorial.",
};

export function groupBySurface(sources: DataSource[]) {
  const groups = new Map<string, DataSource[]>();
  for (const s of sources) {
    const arr = groups.get(s.surface) ?? [];
    arr.push(s);
    groups.set(s.surface, arr);
  }
  return [...groups.entries()];
}
