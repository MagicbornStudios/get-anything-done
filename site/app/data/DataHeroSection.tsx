"use client";

import { useEffect, useMemo, useState } from "react";
import { Database, Play, RefreshCw } from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import { SiteSection } from "@/components/site";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DataSource } from "./data-shared";
import DataJsonTreeView from "./DataJsonTreeView";
import DataQueryEditor from "./DataQueryEditor";
import { DEFAULT_QUERY, executeDbQuery, parseDbQuery, type QueryField } from "./query";

type DbCollection = {
  key: string;
  label: string;
  description: string;
  rows: DataSource[];
};

function toCollectionKey(surface: string): string {
  return surface.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function rowField(record: DataSource, field: QueryField): string {
  if (field === "id") return record.id;
  if (field === "surface") return record.surface;
  if (field === "number") return record.number;
  if (field === "source") return record.source;
  if (field === "formula") return record.formula ?? "";
  if (field === "trust") return record.trust;
  if (field === "page") return record.page;
  if (field === "notes") return record.notes ?? "";
  if (field === "sourceLength") return String(record.source.length);
  if (field === "formulaLength") return String(record.formula?.length ?? 0);
  return String(record.notes?.length ?? 0);
}

function pickPrimaryCollectionData(collection: string, value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const obj = value as Record<string, unknown>;
  const preferredByCollection: Record<string, string[]> = {
    glossary: ["terms"],
    "planning-bugs": ["bugs"],
    "open-questions": ["questions"],
    "feature-requests": ["requests", "features", "items"],
    rounds: ["rounds"],
    "eval-conditions": ["conditions"],
    "self-eval": ["runs", "records", "items"],
  };
  const preferred = preferredByCollection[collection] ?? [];
  for (const key of preferred) {
    if (Array.isArray(obj[key])) return obj[key];
  }
  const firstArrayEntry = Object.values(obj).find((entry) => Array.isArray(entry));
  if (firstArrayEntry) return firstArrayEntry;
  return value;
}

function toCollectionRows(collection: string, value: unknown): DataSource[] {
  const primary = pickPrimaryCollectionData(collection, value);
  if (Array.isArray(primary)) {
    return primary.map((item, index) => ({
      id:
        collection === "glossary" &&
        item &&
        typeof item === "object" &&
        typeof (item as { id?: unknown }).id === "string"
          ? (item as { id: string }).id
          : `${collection}-${index + 1}`,
      surface: collection,
      number:
        collection === "glossary" &&
        item &&
        typeof item === "object" &&
        typeof (item as { term?: unknown }).term === "string"
          ? (item as { term: string }).term
          : String(index + 1),
      source: JSON.stringify(item),
      formula: "payload array item",
      trust: "authored",
      page: "/data",
      notes: typeof item === "object" && item ? Object.keys(item as Record<string, unknown>).join(", ") : "",
    }));
  }
  if (primary && typeof primary === "object") {
    return Object.entries(primary as Record<string, unknown>).map(([key, item], index) => ({
      id: `${collection}-${index + 1}`,
      surface: collection,
      number: key,
      source: JSON.stringify(item),
      formula: "payload object entry",
      trust: "authored",
      page: "/data",
      notes: key,
    }));
  }
  return [
    {
      id: `${collection}-1`,
      surface: collection,
      number: "value",
      source: JSON.stringify(value),
      formula: "payload scalar value",
      trust: "authored",
      page: "/data",
      notes: "",
    },
  ];
}

function buildCollections(sources: DataSource[], payload: unknown): DbCollection[] {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const raw = (p.raw && typeof p.raw === "object" ? p.raw : {}) as Record<string, unknown>;
  const repoData = (raw.repo_data_files && typeof raw.repo_data_files === "object"
    ? raw.repo_data_files
    : {}) as Record<string, unknown>;
  const siteData = (raw.site_data_files && typeof raw.site_data_files === "object"
    ? raw.site_data_files
    : {}) as Record<string, unknown>;

  const collections: DbCollection[] = [];
  if (p._schema !== undefined) {
    collections.push({
      key: "schema",
      label: "schema",
      description: "DB payload schema/metadata",
      rows: toCollectionRows("schema", p._schema),
    });
  }

  const repoCollectionMap: Array<{ key: string; label: string; sourceKey: string; description: string }> = [
    { key: "glossary", label: "glossary", sourceKey: "glossary.json", description: "Repo data: glossary entries" },
    { key: "planning-bugs", label: "planning bugs", sourceKey: "bugs.json", description: "Repo data: planning bugs" },
    {
      key: "open-questions",
      label: "open questions",
      sourceKey: "open-questions.json",
      description: "Repo data: open questions",
    },
    {
      key: "feature-requests",
      label: "feature requests",
      sourceKey: "feature-requests.json",
      description: "Repo data: feature requests",
    },
  ];
  for (const entry of repoCollectionMap) {
    if (repoData[entry.sourceKey] === undefined) continue;
    collections.push({
      key: entry.key,
      label: entry.label,
      description: entry.description,
      rows: toCollectionRows(entry.key, repoData[entry.sourceKey]),
    });
  }

  const siteCollectionMap: Array<{ key: string; label: string; sourceKey: string; description: string }> = [
    { key: "rounds", label: "rounds", sourceKey: "rounds.json", description: "Site data: eval rounds" },
    {
      key: "eval-conditions",
      label: "eval conditions",
      sourceKey: "eval-conditions.json",
      description: "Site data: eval conditions",
    },
    {
      key: "self-eval",
      label: "self eval",
      sourceKey: "self-eval.json",
      description: "Site data: self evaluation outputs",
    },
  ];
  for (const entry of siteCollectionMap) {
    if (siteData[entry.sourceKey] === undefined) continue;
    collections.push({
      key: entry.key,
      label: entry.label,
      description: entry.description,
      rows: toCollectionRows(entry.key, siteData[entry.sourceKey]),
    });
  }

  collections.push({
    key: "active",
    label: "active records",
    description: "Canonical DataSource rows used by the DB viewer",
    rows: sources,
  });

  return collections;
}

function buildCollectionQuery(collectionKey: string): string {
  return `{
  "collection": "${collectionKey}",
  "filter": {},
  "sort": { "number": 1 },
  "limit": 100,
  "projection": ["id", "number", "trust", "surface", "page"]
}`;
}

export default function DataHeroSection({ sources, dbPayload, dbSourcePath }: { sources: DataSource[]; dbPayload: unknown; dbSourcePath: string }) {
  const collections = useMemo(() => buildCollections(sources, dbPayload), [sources, dbPayload]);
  const isLocalJsonSource = useMemo(() => !dbSourcePath.startsWith("mongo:"), [dbSourcePath]);
  const queryEditorCollections = useMemo(() => collections.map((collection) => collection.key), [collections]);
  const collectionsByKey = useMemo(
    () =>
      collections.reduce<Record<string, DataSource[]>>((acc, collection) => {
        acc[collection.key.toLowerCase()] = collection.rows;
        return acc;
      }, {}),
    [collections],
  );
  const [activeCollectionKey, setActiveCollectionKey] = useState("active");
  const [queryDraft, setQueryDraft] = useState(DEFAULT_QUERY);
  const [queryText, setQueryText] = useState(DEFAULT_QUERY);
  const [dbPanelTab, setDbPanelTab] = useState<"results" | "query">("results");
  const [leftPanelTab, setLeftPanelTab] = useState<"collections" | "json">("collections");
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState<string>("");
  const quickPrompts = useMemo(
    () => [
      {
        label: "Create",
        text: 'For collection \"active\", draft a Mongo-style insert operation example for a new record with fields: id, surface, number, source, formula, trust, page, notes.',
      },
      {
        label: "Read",
        text: 'Build a Mongo-like read query for collection \"active\" filtering trust=\"deterministic\" and sourceLength > 40, projecting id, number, trust, surface, page, sorted sourceLength desc, limit 20.',
      },
      {
        label: "Update",
        text: 'Provide a Mongo-style update example for collection \"active\" that finds by id and updates notes and trust fields, returning the updated document.',
      },
      {
        label: "Delete",
        text: 'Provide a Mongo-style delete example for collection \"active\" that removes documents by id (single) and by trust value (many), with safe confirmation guidance.',
      },
    ],
    [],
  );

  const activeCollection = collections.find((collection) => collection.key === activeCollectionKey) ?? collections[0];
  const { rows, errors, plan, appliedCollection } = useMemo(
    () => executeDbQuery(activeCollection?.rows ?? [], queryText, collectionsByKey),
    [activeCollection, queryText, collectionsByKey],
  );
  const runQuery = () => {
    setQueryText(queryDraft);
    const nextCollection = parseDbQuery(queryDraft).plan.from.trim().toLowerCase();
    if (nextCollection && collectionsByKey[nextCollection]) {
      setActiveCollectionKey(nextCollection);
    }
  };

  const selectCollection = (collectionKey: string) => {
    setActiveCollectionKey(collectionKey);
    const nextQuery = buildCollectionQuery(collectionKey);
    setQueryDraft(nextQuery);
    setQueryText(nextQuery);
    setDbPanelTab("results");
  };

  const syncToMongo = async () => {
    setSyncState("syncing");
    setSyncMessage("");
    try {
      const res = await fetch("/api/dev/db-sync", { method: "POST" });
      const json = (await res.json()) as { ok?: boolean; error?: string; target?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "sync failed");
      }
      setSyncState("done");
      setSyncMessage(`Synced -> ${json.target ?? "mongo"}`);
    } catch (err) {
      setSyncState("error");
      setSyncMessage((err as Error).message);
    }
  };

  const tableColumns = plan.select;
  const [resultsSearch, setResultsSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<QueryField>(tableColumns[0] ?? "id");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [trustFilter, setTrustFilter] = useState<"all" | DataSource["trust"]>("all");
  const [hasNotesOnly, setHasNotesOnly] = useState(false);

  useEffect(() => {
    if (tableColumns.length === 0) return;
    if (!tableColumns.includes(sortColumn)) {
      setSortColumn(tableColumns[0]);
    }
  }, [tableColumns, sortColumn]);

  const trustOptions = useMemo(() => {
    return [...new Set(rows.map((row) => row.trust))].sort();
  }, [rows]);

  const rowsForSuggestions = useMemo(() => {
    return rows.filter((row) => {
      if (trustFilter !== "all" && row.trust !== trustFilter) return false;
      if (hasNotesOnly && !(row.notes && row.notes.trim().length > 0)) return false;
      return true;
    });
  }, [rows, trustFilter, hasNotesOnly]);

  const searchSuggestion = useMemo(() => {
    const inputWithoutTrailingSpace = resultsSearch.replace(/\s+$/, "");
    if (!inputWithoutTrailingSpace) return "";
    const lastSpaceIndex = inputWithoutTrailingSpace.lastIndexOf(" ");
    const activeTerm =
      lastSpaceIndex >= 0 ? inputWithoutTrailingSpace.slice(lastSpaceIndex + 1) : inputWithoutTrailingSpace;
    if (!activeTerm) return "";
    const needle = activeTerm.toLowerCase();
    const candidates = new Set<string>();
    for (const row of rowsForSuggestions) {
      for (const column of tableColumns) {
        const raw = rowField(row, column).trim();
        if (!raw) continue;
        candidates.add(raw);
        for (const token of raw.split(/\s+/)) {
          if (token.length >= 3) candidates.add(token);
        }
      }
    }
    const best = [...candidates]
      .filter((candidate) => candidate.toLowerCase().startsWith(needle) && candidate.length > activeTerm.length)
      .sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
    return best ? best.slice(activeTerm.length) : "";
  }, [resultsSearch, rowsForSuggestions, tableColumns]);

  const visibleRows = useMemo(() => {
    const search = resultsSearch.trim().toLowerCase();
    let nextRows = rows.filter((row) => {
      if (trustFilter !== "all" && row.trust !== trustFilter) return false;
      if (hasNotesOnly && !(row.notes && row.notes.trim().length > 0)) return false;
      if (!search) return true;
      return tableColumns.some((column) => rowField(row, column).toLowerCase().includes(search));
    });

    nextRows = [...nextRows].sort((a, b) => {
      const left = rowField(a, sortColumn);
      const right = rowField(b, sortColumn);
      const leftNum = Number(left);
      const rightNum = Number(right);
      let cmp = 0;
      if (Number.isFinite(leftNum) && Number.isFinite(rightNum)) {
        cmp = leftNum - rightNum;
      } else {
        cmp = left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return nextRows;
  }, [rows, resultsSearch, tableColumns, sortColumn, sortDirection, trustFilter, hasNotesOnly]);

  return (
    <SiteSection
      cid="data-hero-section-site-section"
      sectionShell={false}
      shellClassName="w-full max-w-none px-0 py-2 md:py-3"
    >
      <Identified as="DataHeroSection" className="w-full">
        <Identified as="DataHeroHeading" register={false}>
          <div className="mb-2 flex w-full items-center justify-between gap-3 border-b border-border/60 pb-2">
            <h1 className="text-base font-semibold tracking-tight md:text-lg">DB Viewer</h1>
            <Badge variant="outline" className="font-mono text-[11px]">
              local json
            </Badge>
          </div>
        </Identified>

        <Identified
          as="DataDbViewerApp"
          className="grid w-full items-start gap-2 lg:grid-cols-[360px_minmax(0,1fr)]"
        >
          <Identified as="DataDbCollectionsPanel">
            <Card className="h-full">
              <CardHeader className="pb-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Database size={14} />
                      DB Viewer
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {dbSourcePath}
                      </Badge>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={syncToMongo} disabled={syncState === "syncing"}>
                        {syncState === "syncing" ? "Syncing..." : "Sync Mongo"}
                      </Button>
                    </div>
                  </div>
                  {syncMessage ? (
                    <p className={`text-[10px] ${syncState === "error" ? "text-rose-300" : "text-emerald-300"}`}>{syncMessage}</p>
                  ) : null}
                  <div className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/20 p-1">
                    <button
                      type="button"
                      className={`rounded px-2 py-1 text-[11px] ${leftPanelTab === "collections" ? "bg-background font-medium" : "text-muted-foreground"}`}
                      onClick={() => setLeftPanelTab("collections")}
                    >
                      Collections
                    </button>
                    <button
                      type="button"
                      className={`rounded px-2 py-1 text-[11px] ${leftPanelTab === "json" ? "bg-background font-medium" : "text-muted-foreground"} ${isLocalJsonSource ? "" : "cursor-not-allowed opacity-50"}`}
                      onClick={() => {
                        if (isLocalJsonSource) setLeftPanelTab("json");
                      }}
                      disabled={!isLocalJsonSource}
                      title={isLocalJsonSource ? "View raw local JSON payload" : "Raw JSON viewer is local-only"}
                    >
                      Raw JSON
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {leftPanelTab === "collections"
                  ? collections.map((collection) => {
                      const active = collection.key === activeCollectionKey;
                      return (
                        <button
                          key={collection.key}
                          type="button"
                          onClick={() => selectCollection(collection.key)}
                          className={`w-full rounded-md border px-2.5 py-2 text-left transition ${
                            active
                              ? "border-accent bg-accent/10"
                              : "border-border/70 bg-background/30 hover:border-accent/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs">{collection.label}</span>
                            <Badge variant={active ? "default" : "outline"}>{collection.rows.length}</Badge>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">{collection.description}</p>
                        </button>
                      );
                    })
                  : isLocalJsonSource ? (
                    <DataJsonTreeView data={dbPayload} />
                  ) : (
                    <div className="rounded-md border border-border/70 bg-background/40 p-2 text-[11px] text-muted-foreground">
                      Raw JSON viewer is local-only. Current source: <code>{dbSourcePath}</code>.
                    </div>
                  )}
              </CardContent>
            </Card>
          </Identified>

          <div>
            <Card>
              <CardHeader className="pb-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/20 p-1">
                    <button
                      type="button"
                      className={`rounded px-2 py-1 text-[11px] ${dbPanelTab === "results" ? "bg-background font-medium" : "text-muted-foreground"}`}
                      onClick={() => setDbPanelTab("results")}
                    >
                      Results
                    </button>
                    <button
                      type="button"
                      className={`rounded px-2 py-1 text-[11px] ${dbPanelTab === "query" ? "bg-background font-medium" : "text-muted-foreground"}`}
                      onClick={() => setDbPanelTab("query")}
                    >
                      Query
                    </button>
                  </div>
                  {dbPanelTab === "results" ? (
                    <Badge variant="secondary" className="text-[11px]">
                      {visibleRows.length}/{rows.length} row{visibleRows.length === 1 ? "" : "s"}
                    </Badge>
                  ) : null}
                </div>
                {dbPanelTab === "results" && errors.length > 0 ? (
                  <div className="mt-1">
                    <Badge variant="danger" className="text-[11px]">
                      {errors.length} parse issue(s)
                    </Badge>
                  </div>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-2.5">
                <Identified as="DataDbResultsPanel" className={dbPanelTab === "results" ? "" : "hidden"}>
                  {errors.length > 0 ? (
                    <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 p-2.5 text-xs text-rose-200">
                      {errors.map((error) => (
                        <p key={error}>{error}</p>
                      ))}
                    </div>
                  ) : null}
                  <Identified as="DataDbResultsControls" className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                    <div className="relative">
                      <input
                        value={resultsSearch}
                        onChange={(event) => setResultsSearch(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Tab" && searchSuggestion) {
                            event.preventDefault();
                            setResultsSearch((prev) => `${prev.replace(/\s+$/, "")}${searchSuggestion}`);
                          }
                        }}
                        placeholder="Search visible columns"
                        className="relative z-10 h-8 w-full rounded-md border border-border bg-background/70 px-2 text-xs outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      {resultsSearch && searchSuggestion ? (
                        <div className="pointer-events-none absolute inset-0 flex items-center px-2 text-xs">
                          <span className="invisible whitespace-pre">{resultsSearch}</span>
                          <span className="whitespace-pre text-muted-foreground/45">{searchSuggestion}</span>
                        </div>
                      ) : null}
                    </div>
                    <select
                      value={sortColumn}
                      onChange={(event) => setSortColumn(event.target.value as QueryField)}
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                    >
                      {tableColumns.map((column) => (
                        <option key={column} value={column}>
                          sort: {column}
                        </option>
                      ))}
                    </select>
                    <select
                      value={sortDirection}
                      onChange={(event) => setSortDirection(event.target.value as "asc" | "desc")}
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                    >
                      <option value="asc">asc</option>
                      <option value="desc">desc</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <select
                        value={trustFilter}
                        onChange={(event) => setTrustFilter(event.target.value as "all" | DataSource["trust"])}
                        className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                      >
                        <option value="all">trust: all</option>
                        {trustOptions.map((trust) => (
                          <option key={trust} value={trust}>
                            trust: {trust}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={hasNotesOnly}
                          onChange={(event) => setHasNotesOnly(event.target.checked)}
                          className="size-3.5 rounded border-border"
                        />
                        notes
                      </label>
                    </div>
                  </Identified>
                  <Identified as="DataDbRecordTable" className="overflow-x-auto">
                    <table className="w-full min-w-[760px] border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-border/80 text-left">
                          {tableColumns.map((column) => (
                            <th key={column} className="px-2 py-2 font-mono uppercase text-muted-foreground">
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows.map((row) => (
                          <tr key={row.id} className="border-b border-border/40 align-top">
                            {tableColumns.map((column) => (
                              <td key={`${row.id}-${column}`} className="px-2 py-2">
                                <code className="whitespace-pre-wrap break-words text-foreground/90">
                                  {rowField(row, column)}
                                </code>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Identified>
                </Identified>

                <Identified as="DataDbQueryPanel" className={dbPanelTab === "query" ? "" : "hidden"}>
                  <Identified as="DataDbQueryPanelHeader">
                    <div className="flex items-center justify-start gap-2">
                      <CardTitle className="text-sm">Query</CardTitle>
                      <div className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/20 p-1">
                        <span className="px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">CRUD</span>
                        <div className="flex items-center gap-1">
                          {quickPrompts.map((prompt) => (
                            <Button
                              key={prompt.label}
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => navigator.clipboard?.writeText(prompt.text).catch(() => {})}
                              title={prompt.text}
                            >
                              {prompt.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Identified>
                  <Identified as="DataDbQueryEditor">
                    <DataQueryEditor
                      className="min-h-[52vh]"
                      value={queryDraft}
                      onChange={setQueryDraft}
                      onRun={runQuery}
                      collections={queryEditorCollections}
                    />
                  </Identified>
                  <Identified as="DataDbQueryActions">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" onClick={runQuery}>
                        <Play size={13} className="mr-1" />
                        Run
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setQueryDraft(DEFAULT_QUERY);
                          setQueryText(DEFAULT_QUERY);
                          setActiveCollectionKey("active");
                        }}
                      >
                        <RefreshCw size={13} className="mr-1" />
                        Reset
                      </Button>
                      <Badge variant="outline">FROM {appliedCollection}</Badge>
                      <Badge variant="outline">LIMIT {plan.limit}</Badge>
                      <Badge variant="outline">
                        SORT {plan.sortField} {plan.sortDirection}
                      </Badge>
                    </div>
                  </Identified>
                  <Identified as="DataDbQueryDslHelp" tag="p" className="text-xs text-muted-foreground">
                    Query help is tuned for Mongo-like JSON assist. Suggestions appear only when context is clear.
                  </Identified>
                </Identified>
              </CardContent>
            </Card>
          </div>
        </Identified>
      </Identified>
    </SiteSection>
  );
}


