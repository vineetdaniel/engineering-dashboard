"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface InlineEditProps {
  value: string | number;
  onSave: (value: string) => void;
  type?: "text" | "number";
  className?: string;
  placeholder?: string;
  readOnly?: boolean;
}

export function InlineEdit({
  value,
  onSave,
  type = "text",
  className,
  placeholder,
  readOnly,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(String(value));
  }, [value, editing]);

  useEffect(() => {
    if (editing && ref.current) ref.current.focus();
  }, [editing]);

  const commit = () => {
    if (draft !== String(value)) onSave(draft);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(String(value));
    setEditing(false);
  };

  if (readOnly) {
    return (
      <span className={cn("text-foreground", className)}>
        {value !== "" && value != null ? value : placeholder || "—"}
      </span>
    );
  }

  if (editing) {
    return (
      <Input
        ref={ref}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        className={cn("h-8 px-2 py-1 text-sm", className)}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn(
        "text-left hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 transition",
        className
      )}
    >
      {value !== "" && value != null ? value : placeholder || "—"}
    </button>
  );
}
