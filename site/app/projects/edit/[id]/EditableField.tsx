"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Inline-editable field. Click to edit, blur/enter to save.
 * Renders as a static dd in read mode, input/textarea in edit mode.
 */
export function EditableField({
  label,
  value,
  onSave,
  multiline,
  mono,
  placeholder,
}: {
  label: string;
  value: string | null;
  onSave: (newValue: string) => Promise<void> | void;
  multiline?: boolean;
  mono?: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // Sync external value changes
  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  const commit = useCallback(async () => {
    if (draft === (value ?? "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [draft, value, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !multiline) {
        e.preventDefault();
        commit();
      }
      if (e.key === "Escape") {
        setDraft(value ?? "");
        setEditing(false);
      }
    },
    [commit, multiline, value],
  );

  return (
    <div>
      <dt className="text-muted-foreground flex items-center gap-1">
        {label}
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[9px] text-accent/50 hover:text-accent ml-auto"
            title={`Edit ${label}`}
          >
            edit
          </button>
        )}
      </dt>
      {editing ? (
        multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            disabled={saving}
            placeholder={placeholder}
            rows={4}
            className={cn(
              "mt-1 w-full rounded border border-accent/30 bg-background px-1.5 py-1 text-[11px] leading-relaxed text-foreground focus:border-accent focus:outline-none resize-y",
              mono && "font-mono",
              saving && "opacity-50",
            )}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            disabled={saving}
            placeholder={placeholder}
            className={cn(
              "mt-0.5 w-full rounded border border-accent/30 bg-background px-1.5 py-0.5 text-xs text-foreground focus:border-accent focus:outline-none",
              mono && "font-mono",
              saving && "opacity-50",
            )}
          />
        )
      ) : (
        <dd
          className={cn(
            "cursor-pointer hover:text-accent/80 transition-colors",
            mono && "font-mono",
            !value && "text-muted-foreground/40 italic",
          )}
          onClick={() => setEditing(true)}
          title="Click to edit"
        >
          {value || placeholder || "—"}
        </dd>
      )}
    </div>
  );
}
