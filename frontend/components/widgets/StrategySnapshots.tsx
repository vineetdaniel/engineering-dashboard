"use client";

import { useEffect, useState } from "react";
import { History, Trash2, Calendar, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import {
  listStrategySnapshots,
  deleteStrategySnapshot,
  createStrategySnapshot,
  getStrategySnapshot,
  type StrategyGenerateOut,
  type StrategySnapshotSummary,
  type StrategySnapshotOut,
} from "@/lib/api";
import { StrategyHealthScore } from "./StrategyHealthScore";

interface StrategySnapshotsProps {
  currentResult?: StrategyGenerateOut | null;
}

function statusVariant(score: number | null) {
  if (score == null) return "secondary";
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  if (score >= 40) return "danger";
  return "danger";
}

export function StrategySnapshots({ currentResult }: StrategySnapshotsProps) {
  const [snapshots, setSnapshots] = useState<StrategySnapshotSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StrategySnapshotOut | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await listStrategySnapshots();
      setSnapshots(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load snapshots");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveCurrent() {
    if (!currentResult) return;
    setSaving(true);
    try {
      const title = `Manual save ${new Date().toLocaleString()}`;
      await createStrategySnapshot(title, currentResult);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save snapshot");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    try {
      await deleteStrategySnapshot(id);
      setSnapshots((prev) => prev.filter((s) => s.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete snapshot");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={18} className="text-primary" />
            <CardTitle>Strategy Snapshots</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </Button>
            {currentResult && (
              <Button size="sm" onClick={saveCurrent} disabled={saving}>
                {saving ? "Saving..." : "Save current"}
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          Every generated strategy is auto-saved by date. Click a snapshot to view its full output and action plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
            {error}
          </div>
        )}

        {snapshots.length === 0 && !loading && (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            No snapshots yet. Generate a strategy to auto-save one.
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {snapshots.map((s) => (
            <div
              key={s.id}
              className="group flex items-center justify-between rounded-xl border border-border bg-card/50 p-3 transition hover:bg-card"
            >
              <button
                className="flex flex-1 items-center gap-3 text-left"
                onClick={async () => {
                  const fallback: StrategyGenerateOut = {
                    narrative: "",
                    action_items: [],
                    health_score: { score: 0, label: "unknown", dimensions: {} },
                    goal_cards: [],
                    initiative_portfolio: [],
                    data_driven: true,
                    llm_enhanced: false,
                  };
                  const full: StrategySnapshotOut = {
                    id: s.id,
                    title: s.title,
                    snapshot: fallback,
                    health_score: s.health_score,
                    action_count: s.action_count,
                    created_at: s.created_at,
                  };
                  try {
                    const data = await getStrategySnapshot(s.id);
                    setSelected(data);
                  } catch {
                    setSelected(full);
                  }
                }}
              >
                <div className="rounded-lg bg-primary/10 p-2">
                  <Calendar size={16} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{s.title || `Snapshot #${s.id}`}</div>
                  <div className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</div>
                </div>
              </button>

              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(s.health_score)}>
                  {s.health_score != null ? s.health_score.toFixed(1) : "—"}
                </Badge>
                <Badge variant="outline">{s.action_count} actions</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground opacity-0 group-hover:opacity-100"
                  onClick={() => remove(s.id)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <History size={18} /> {selected.title || `Snapshot #${selected.id}`}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="text-xs text-muted-foreground">{new Date(selected.created_at).toLocaleString()}</div>
                <StrategyHealthScore healthScore={selected.snapshot.health_score} />
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-primary" />
                      <CardTitle className="text-base">CTO Strategy Narrative</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm">
                    {selected.snapshot.narrative.split("\n\n").map((para, idx) => (
                      <p key={idx} className="mb-2 last:mb-0">{para}</p>
                    ))}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {selected.snapshot.action_items.slice(0, 6).map((item) => (
                    <Card key={item.id}>
                      <CardContent className="p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={item.priority === "critical" ? "danger" : item.priority === "high" ? "warning" : "secondary"}>{item.priority}</Badge>
                          <Badge variant="outline">{item.section}</Badge>
                        </div>
                        <h4 className="mt-2 text-sm font-semibold">{item.title}</h4>
                        <p className="mt-1 text-xs text-muted-foreground">{item.rationale}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {selected.snapshot.action_items.length > 6 && (
                  <div className="text-center text-xs text-muted-foreground">
                    +{selected.snapshot.action_items.length - 6} more actions
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
