export function runtimeLabel(runtime: Record<string, unknown> | null | undefined) {
  if (!runtime) return "—";
  const id = typeof runtime.id === "string" && runtime.id ? runtime.id : "unknown";
  const model = typeof runtime.model === "string" && runtime.model ? runtime.model : null;
  return model ? `${id} · ${model}` : id;
}
