"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  KeyRound,
  RefreshCw,
  Save,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  getConnectorConfigs,
  getConnectorGuide,
  saveConnectorConfig,
  syncSource,
} from "@/lib/api";

interface ConnectorField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  help?: string;
  secret?: boolean;
}

interface ConnectorGuide {
  name: string;
  label: string;
  description: string;
  docs_url?: string;
  fields: ConnectorField[];
  steps: { label: string; description: string }[];
}

interface ConnectorSummary {
  name: string;
  configured: boolean;
  config: Record<string, string>;
  required: string[];
}

interface ConnectorConfigPanelProps {
  className?: string;
  onSync?: (source: string) => void;
  syncLoading?: string | null;
  lastSyncResult?: { source: string; metrics: number; events: number } | null;
}

const labels: Record<string, string> = {
  aws_cost: "AWS Cost",
  github: "GitHub",
  jenkins: "Jenkins",
  jira: "Jira",
  mixpanel: "Mixpanel",
  observability: "Observability",
  AWS_MONTHLY_BUDGET: "Monthly budget override",
  AWS_COST_DELTA_THRESHOLD_PCT: "Cost increase alert threshold (%)",
  AWS_COST_CRITICAL_RISK_THRESHOLD_PCT: "Critical cost risk threshold (%)",
  AWS_COST_TOP_DRIVERS_COUNT: "Top cost drivers to display",
};

function isMasked(value: string | undefined) {
  return typeof value === "string" && value.startsWith("•");
}

export function ConnectorConfigPanel({ className, onSync, syncLoading, lastSyncResult }: ConnectorConfigPanelProps) {
  const [configs, setConfigs] = useState<ConnectorSummary[]>([]);
  const [guides, setGuides] = useState<Record<string, ConnectorGuide>>({});
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    async function load() {
      try {
        const list: ConnectorSummary[] = await getConnectorConfigs();
        setConfigs(list);
        const initialValues: Record<string, Record<string, string>> = {};
        list.forEach((c) => {
          initialValues[c.name] = { ...c.config };
        });
        setValues(initialValues);

        const guideResults = await Promise.all(
          list.map((c) => getConnectorGuide(c.name).catch(() => null))
        );
        const guideMap: Record<string, ConnectorGuide> = {};
        guideResults.forEach((g) => {
          if (g) guideMap[g.name] = g;
        });
        setGuides(guideMap);
      } catch (err) {
        console.error("Failed to load connector configs", err);
      }
    }
    load();
  }, []);

  function updateValue(name: string, key: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: { ...prev[name], [key]: value } }));
    setSaved((prev) => ({ ...prev, [name]: false }));
  }

  async function handleSave(name: string) {
    setLoading((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: null }));
    try {
      const result = await saveConnectorConfig(name, values[name] || {});
      setConfigs((prev) =>
        prev.map((c) => (c.name === name ? { ...c, configured: result.configured, config: result.config } : c))
      );
      setValues((prev) => ({ ...prev, [name]: { ...result.config } }));
      setSaved((prev) => ({ ...prev, [name]: true }));
      setTimeout(() => setSaved((prev) => ({ ...prev, [name]: false })), 2000);
      if (!result.health?.ok) {
        setErrors((prev) => ({
          ...prev,
          [name]: result.health?.error || "Health check failed after saving.",
        }));
      }
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [name]: err instanceof Error ? err.message : "Failed to save connector config",
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [name]: false }));
    }
  }

  async function handleCopyEnv(name: string) {
    const guide = guides[name];
    if (!guide) return;
    const snippet = guide.fields
      .map((field) => {
        const value = values[name]?.[field.key];
        if (!value || isMasked(value)) return `# ${field.key}=`;
        return `${field.key}=${value}`;
      })
      .join("\n");
    try {
      await navigator.clipboard.writeText(`# ${labels[name] || name} connector\n${snippet}`);
      setCopied(name);
      setTimeout(() => setCopied((prev) => (prev === name ? null : prev)), 1500);
    } catch {
      // ignore
    }
  }

  const providerSpecificFields = useMemo(() => {
    const map: Record<string, (field: ConnectorField) => boolean> = {
      observability: (field) => {
        const provider = values.observability?.OBSERVABILITY_PROVIDER?.toLowerCase() || "datadog";
        const datadogKeys = [
          "OBSERVABILITY_PROVIDER",
          "DD_API_KEY",
          "DD_APP_KEY",
          "DD_SITE",
          "DD_SERVICES",
          "DD_ENVIRONMENT",
          "DD_UPTIME_QUERY",
          "DD_LATENCY_QUERY",
          "DD_P99_LATENCY_QUERY",
          "DD_ERROR_RATE_QUERY",
        ];
        const newrelicKeys = [
          "OBSERVABILITY_PROVIDER",
          "NR_API_KEY",
          "NR_ACCOUNT_ID",
          "NR_SERVICES",
          "NR_ENVIRONMENT",
        ];
        if (provider === "datadog") return datadogKeys.includes(field.key);
        if (provider === "newrelic") return newrelicKeys.includes(field.key);
        return field.key === "OBSERVABILITY_PROVIDER";
      },
    };
    return map;
  }, [values]);

  if (configs.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading connector configuration…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {configs.map((connector) => {
        const guide = guides[connector.name];
        const isExpanded = !!expanded[connector.name];
        const isLoading = !!loading[connector.name];
        const isSaved = !!saved[connector.name];
        const error = errors[connector.name] || null;
        const health = connector.configured ? (
          <Badge variant="outline" className="gap-1 border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300">
            <CheckCircle2 size={12} /> Configured
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-300">
            <KeyRound size={12} /> Missing keys
          </Badge>
        );

        return (
          <Card key={connector.name}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{labels[connector.name] || connector.name}</CardTitle>
                    {health}
                  </div>
                  <CardDescription>{guide?.description || "Configure this connector to populate dashboard data."}</CardDescription>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {guide?.docs_url && (
                    <Button variant="outline" size="sm" className="hidden gap-2 sm:flex" asChild>
                      <a href={guide.docs_url} target="_blank" rel="noreferrer">
                        <ExternalLink size={14} /> Docs
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [connector.name]: !prev[connector.name] }))
                    }
                  >
                    Setup guide
                    <ChevronDown size={14} className={cn("transition", isExpanded && "rotate-180")} />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {guide?.fields && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {guide.fields
                    .filter((field) => {
                      const fn = providerSpecificFields[connector.name];
                      return fn ? fn(field) : true;
                    })
                    .map((field) => {
                      const id = `${connector.name}-${field.key}`;
                      const isTextarea = field.type === "textarea";
                      return (
                        <div
                          key={field.key}
                          className={cn("space-y-1.5", isTextarea && "sm:col-span-2")}
                        >
                          <Label htmlFor={id}>
                            {field.label}
                            {field.required && <span className="ml-1 text-rose-500">*</span>}
                          </Label>
                          {isTextarea ? (
                            <textarea
                              id={id}
                              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              placeholder={field.placeholder}
                              value={values[connector.name]?.[field.key] || ""}
                              onChange={(e) => updateValue(connector.name, field.key, e.target.value)}
                            />
                          ) : (
                            <Input
                              id={id}
                              type={field.secret ? "password" : field.type === "select" ? "text" : field.type}
                              placeholder={field.placeholder}
                              value={values[connector.name]?.[field.key] || ""}
                              onChange={(e) => updateValue(connector.name, field.key, e.target.value)}
                              list={field.type === "select" ? `${id}-options` : undefined}
                            />
                          )}
                          {field.type === "select" && (
                            <datalist id={`${id}-options`}>
                              <option value="datadog" />
                              <option value="newrelic" />
                            </datalist>
                          )}
                          {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
                        </div>
                      );
                    })}
                </div>
              )}

              {isExpanded && guide && (
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <h4 className="mb-3 text-sm font-semibold">Setup guide</h4>
                  <ol className="space-y-3">
                    {guide.steps.map((step, idx) => (
                      <li key={idx} className="flex gap-3 text-sm">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                          {idx + 1}
                        </span>
                        <div className="space-y-0.5">
                          <p className="font-medium">{step.label}</p>
                          <p className="text-muted-foreground">{step.description}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                  {guide.docs_url && (
                    <a
                      href={guide.docs_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      Open official docs <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
                  <XCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  className="gap-2"
                  size="sm"
                  onClick={() => handleSave(connector.name)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  Save & test
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => handleCopyEnv(connector.name)}
                >
                  {copied === connector.name ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                  {copied === connector.name ? "Copied" : "Copy .env"}
                </Button>
                {onSync && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => onSync(connector.name)}
                    disabled={syncLoading === connector.name}
                  >
                    <RefreshCw size={14} className={cn(syncLoading === connector.name && "animate-spin")} />
                    Sync
                  </Button>
                )}
                {lastSyncResult?.source === connector.name && (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                    <CheckCircle2 size={12} />
                    Synced {lastSyncResult.metrics} metrics, {lastSyncResult.events} events
                  </span>
                )}
                {isSaved && (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Saved and health-checked
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
