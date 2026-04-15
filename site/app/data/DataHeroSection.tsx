"use client";

import { useMemo, useState } from "react";
import { Database, Play, RefreshCw } from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import { SiteSection } from "@/components/site";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DataSource } from "./data-shared";
import DataQueryEditor from "./DataQueryEditor";
import { DEFAULT_QUERY, executeDbQuery, type QueryField } from "./query";

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

function buildCollections(sources: DataSource[]): DbCollection[] {
  const grouped = new Map<string, DataSource[]>();
  for (const source of sources) {
    const key = toCollectionKey(source.surface);
    const current = grouped.get(key) ?? [];
    current.push(source);
    grouped.set(key, current);
  }

  const bySurface = [...grouped.entries()].map(([key, rows]) => ({
    key,
    label: rows[0]?.surface ?? key,
    description: "Surface-derived collection",
    rows,
  }));

  return [
    {
      key: "active",
      label: "active",
      description: "All local records in the current data catalog",
      rows: sources,
    },
    ...bySurface.sort((a, b) => a.label.localeCompare(b.label)),
  ];
}

export default function DataHeroSection({ sources }: { sources: DataSource[] }) {
  const collections = useMemo(() => buildCollections(sources), [sources]);
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

  const activeCollection = collections.find((collection) => collection.key === activeCollectionKey) ?? collections[0];
  const { rows, errors, plan, appliedCollection } = useMemo(
    () => executeDbQuery(activeCollection?.rows ?? [], queryText, collectionsByKey),
    [activeCollection, queryText, collectionsByKey],
  );
  const runQuery = () => {
    setQueryText(queryDraft);
    const parsedFrom = queryDraft
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.toUpperCase().startsWith("FROM "));
    const nextCollection = parsedFrom?.slice(5).trim().toLowerCase();
    if (nextCollection && collectionsByKey[nextCollection]) {
      setActiveCollectionKey(nextCollection);
    }
  };

  const tableColumns = plan.select;

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
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Database size={14} />
                  Collections
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {collections.map((collection) => {
                  const active = collection.key === activeCollectionKey;
                  return (
                    <button
                      key={collection.key}
                      type="button"
                      onClick={() => setActiveCollectionKey(collection.key)}
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
                })}
              </CardContent>
            </Card>
          </Identified>

          <div className="space-y-2">
            <Identified as="DataDbQueryPanel">
              <Card>
                <CardHeader className="pb-1.5">
                  <CardTitle className="text-sm">Query</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  <DataQueryEditor
                    className="min-h-[52vh]"
                    value={queryDraft}
                    onChange={setQueryDraft}
                    onRun={runQuery}
                  />
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
                  <p className="text-xs text-muted-foreground">
                    DSL: <code>FROM</code>, <code>WHERE</code> (AND), <code>SORT</code>, <code>LIMIT</code>,{" "}
                    <code>SELECT</code>. Example condition: <code>trust:deterministic</code> or{" "}
                    <code>sourceLength&gt;40</code>.
                  </p>
                </CardContent>
              </Card>
            </Identified>

            <Identified as="DataDbResultsPanel">
              <Card>
                <CardHeader className="pb-1.5">
                  <CardTitle className="text-sm">Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="secondary">
                      {rows.length} row{rows.length === 1 ? "" : "s"}
                    </Badge>
                    {errors.length > 0 ? <Badge variant="danger">{errors.length} parse issue(s)</Badge> : null}
                  </div>
                  {errors.length > 0 ? (
                    <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 p-3 text-xs text-rose-200">
                      {errors.map((error) => (
                        <p key={error}>{error}</p>
                      ))}
                    </div>
                  ) : null}
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
                        {rows.map((row) => (
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
                </CardContent>
              </Card>
            </Identified>
          </div>
        </Identified>
      </Identified>
    </SiteSection>
  );
}
