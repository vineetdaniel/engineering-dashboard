"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { uploadComplianceFile } from "@/lib/api";

interface ComplianceUploadPanelProps {
  className?: string;
  onUpload?: () => void;
}

interface UploadResult {
  source: string;
  metrics: number;
  events: number;
  errors: string[];
}

const ALLOWED_TYPES = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export function ComplianceUploadPanel({ className, onUpload }: ComplianceUploadPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isValidType = (f: File) =>
    ALLOWED_TYPES.includes(f.type) || f.name.toLowerCase().endsWith(".csv") || f.name.toLowerCase().endsWith(".xlsx");

  const handleFiles = useCallback((files: FileList | null) => {
    setResult(null);
    setError(null);
    if (!files || files.length === 0) return;
    const selected = files[0];
    if (!isValidType(selected)) {
      setError("Please upload a .csv or .xlsx file.");
      setFile(null);
      return;
    }
    setFile(selected);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = (await uploadComplianceFile(file)) as UploadResult;
      setResult(data);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onUpload?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function clearFile() {
    setFile(null);
    setError(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-indigo-500" />
              Compliance controls upload
            </CardTitle>
            <CardDescription>
              Upload a CSV or Excel sheet with PCI DSS / ISO 27001 controls to populate the dashboard.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 gap-2" asChild>
            <a href="/compliance/template" download>
              <Download size={14} /> Template
            </a>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition",
            dragOver ? "border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20" : "border-border bg-muted/30",
            file ? "border-solid" : "border-dashed"
          )}
        >
          <Input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Upload size={24} className="mb-2 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            {file ? file.name : "Drag and drop a file, or click to browse"}
          </p>
          <p className="text-xs text-muted-foreground">Supported: .csv, .xlsx</p>
          {file && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearFile();
              }}
              className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Required columns: <span className="font-medium text-foreground">framework, control_id, title, status</span>
          </p>
          <Button onClick={handleUpload} disabled={!file || loading} className="gap-2">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {loading ? "Uploading…" : "Upload controls"}
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {result && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950">
            <div className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                  Uploaded {result.metrics} controls and created {result.events} events.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300">
                    {result.metrics} metrics
                  </Badge>
                  <Badge variant="outline" className="border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300">
                    {result.events} events
                  </Badge>
                  {result.errors.length > 0 && (
                    <Badge variant="outline" className="border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-300">
                      {result.errors.length} skipped rows
                    </Badge>
                  )}
                </div>
                {result.errors.length > 0 && (
                  <ul className="max-h-32 overflow-auto rounded-md border border-emerald-200/50 bg-white/50 p-2 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-black/20 dark:text-emerald-100">
                    {result.errors.map((err, i) => (
                      <li key={i} className="py-0.5">{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
