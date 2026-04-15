import type { DataSource } from "./data-shared";

export type QueryField =
  | "id"
  | "surface"
  | "number"
  | "source"
  | "formula"
  | "trust"
  | "page"
  | "notes"
  | "sourceLength"
  | "formulaLength"
  | "notesLength";

export type QueryOperator = ":" | "=" | "!=" | ">" | "<" | ">=" | "<=";

export type QueryClause = {
  field: QueryField;
  operator: QueryOperator;
  value: string;
};

export type DbQueryPlan = {
  from: string;
  where: QueryClause[];
  sortField: QueryField;
  sortDirection: "asc" | "desc";
  limit: number;
  select: QueryField[];
};

export type DbQueryCollections = Record<string, DataSource[]>;

export type DbQueryParseResult = {
  plan: DbQueryPlan;
  errors: string[];
};

export const QUERY_FIELDS: QueryField[] = [
  "id",
  "surface",
  "number",
  "source",
  "formula",
  "trust",
  "page",
  "notes",
  "sourceLength",
  "formulaLength",
  "notesLength",
];

export const DEFAULT_QUERY = `FROM active
WHERE trust:deterministic
SORT number asc
LIMIT 25
SELECT id,number,trust,surface,page`;

const NUMERIC_FIELDS = new Set<QueryField>(["sourceLength", "formulaLength", "notesLength"]);

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function fieldValue(source: DataSource, field: QueryField): string | number {
  if (field === "id") return source.id;
  if (field === "surface") return source.surface;
  if (field === "number") return source.number;
  if (field === "source") return source.source;
  if (field === "formula") return source.formula ?? "";
  if (field === "trust") return source.trust;
  if (field === "page") return source.page;
  if (field === "notes") return source.notes ?? "";
  if (field === "sourceLength") return source.source.length;
  if (field === "formulaLength") return source.formula?.length ?? 0;
  return source.notes?.length ?? 0;
}

function parseField(value: string): QueryField | null {
  return QUERY_FIELDS.find((candidate) => candidate.toLowerCase() === value.toLowerCase()) ?? null;
}

function parseWhereClause(fragment: string): QueryClause | null {
  const match = fragment.match(/^([a-zA-Z][\w-]*)(>=|<=|!=|=|:|>|<)(.+)$/);
  if (!match) return null;
  const [, rawField, operator, rawValue] = match;
  const field = parseField(rawField);
  if (!field) return null;
  return { field, operator: operator as QueryOperator, value: stripQuotes(rawValue) };
}

export function parseDbQuery(queryText: string): DbQueryParseResult {
  const plan: DbQueryPlan = {
    from: "active",
    where: [],
    sortField: "number",
    sortDirection: "asc",
    limit: 50,
    select: ["id", "number", "trust", "surface", "page"],
  };
  const errors: string[] = [];
  const lines = queryText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.startsWith("FROM ")) {
      plan.from = line.slice(5).trim() || "active";
      continue;
    }
    if (upper.startsWith("WHERE ")) {
      const wherePayload = line.slice(6).trim();
      const chunks = wherePayload.split(/\s+AND\s+/i).map((piece) => piece.trim()).filter(Boolean);
      plan.where = [];
      for (const chunk of chunks) {
        const clause = parseWhereClause(chunk);
        if (!clause) {
          errors.push(`Invalid WHERE clause: ${chunk}`);
          continue;
        }
        plan.where.push(clause);
      }
      continue;
    }
    if (upper.startsWith("SORT ")) {
      const [, rawField, rawDirection] = line.split(/\s+/);
      const field = parseField(rawField ?? "");
      if (!field) {
        errors.push(`Invalid SORT field: ${rawField ?? ""}`);
        continue;
      }
      plan.sortField = field;
      plan.sortDirection = (rawDirection ?? "asc").toLowerCase() === "desc" ? "desc" : "asc";
      continue;
    }
    if (upper.startsWith("LIMIT ")) {
      const value = Number(line.slice(6).trim());
      if (!Number.isFinite(value) || value <= 0) {
        errors.push("LIMIT must be a positive number.");
      } else {
        plan.limit = Math.floor(value);
      }
      continue;
    }
    if (upper.startsWith("SELECT ")) {
      const fields = line
        .slice(7)
        .split(",")
        .map((field) => parseField(field.trim()))
        .filter((field): field is QueryField => Boolean(field));
      if (fields.length === 0) {
        errors.push("SELECT requires at least one valid field.");
      } else {
        plan.select = fields;
      }
      continue;
    }
    errors.push(`Unknown statement: ${line}`);
  }

  return { plan, errors };
}

function matchesClause(source: DataSource, clause: QueryClause): boolean {
  const current = fieldValue(source, clause.field);
  if (clause.operator === ":") {
    return String(current).toLowerCase().includes(clause.value.toLowerCase());
  }
  if (clause.operator === "=") {
    return String(current).toLowerCase() === clause.value.toLowerCase();
  }
  if (clause.operator === "!=") {
    return String(current).toLowerCase() !== clause.value.toLowerCase();
  }
  if (!NUMERIC_FIELDS.has(clause.field)) {
    return false;
  }
  const left = Number(current);
  const right = Number(clause.value);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  if (clause.operator === ">") return left > right;
  if (clause.operator === "<") return left < right;
  if (clause.operator === ">=") return left >= right;
  return left <= right;
}

export function executeDbQuery(
  records: DataSource[],
  queryText: string,
  collections?: DbQueryCollections,
): { rows: DataSource[]; plan: DbQueryPlan; errors: string[]; appliedCollection: string } {
  const { plan, errors } = parseDbQuery(queryText);
  const fallbackCollection = "active";
  const requestedCollection = plan.from.trim().toLowerCase() || fallbackCollection;
  const resolvedRecords = collections?.[requestedCollection];
  let sourceRecords = records;
  let appliedCollection = requestedCollection;
  if (collections) {
    if (resolvedRecords) {
      sourceRecords = resolvedRecords;
    } else {
      errors.push(`Unknown FROM collection: ${plan.from}`);
      appliedCollection = fallbackCollection;
    }
  }

  const filtered = sourceRecords.filter((record) => plan.where.every((clause) => matchesClause(record, clause)));
  filtered.sort((left, right) => {
    const a = fieldValue(left, plan.sortField);
    const b = fieldValue(right, plan.sortField);
    const compare = String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
    return plan.sortDirection === "asc" ? compare : -compare;
  });
  return {
    rows: filtered.slice(0, plan.limit),
    plan,
    errors,
    appliedCollection,
  };
}
