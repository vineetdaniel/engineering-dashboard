"use client";

import { useState, useEffect } from "react";
import { SectionHeader } from "./SectionHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Widget } from "@/components/widgets/Widget";
import { WidgetHeader } from "@/components/widgets/WidgetHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ConnectorManager } from "@/components/ConnectorManager";
import { ConnectorConfigPanel } from "@/components/ConnectorConfigPanel";
import { Save, Bell, User, Plug, SlidersHorizontal } from "lucide-react";

const THRESHOLD_KEY = "cto-dash-thresholds";

const defaultThresholds = {
  paymentSuccessMin: 99.9,
  fraudRateMax: 0.3,
  chargebackRateMax: 0.1,
  settlementFailureMax: 0.1,
  costPerTransactionMax: 0.005,
  mttrMaxMinutes: 60,
  ciPassRateMin: 95,
  reviewTimeMaxHours: 6,
  changeFailureMaxPct: 5,
  deployFrequencyMin: 5,
  ledgerImbalanceMax: 1000,
  reconciliationLagMaxMinutes: 30,
};

export function SettingsSection({
  health,
  onSync,
  syncLoading,
  lastUpdated,
  lastSyncResult,
}: {
  health: any;
  onSync: (source: string) => void;
  syncLoading: string | null;
  lastUpdated?: Date | null;
  lastSyncResult?: { source: string; metrics: number; events: number } | null;
}) {
  const [thresholds, setThresholds] = useState(defaultThresholds);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(THRESHOLD_KEY);
      if (raw) setThresholds({ ...defaultThresholds, ...JSON.parse(raw) });
    } catch {
      // ignore malformed localStorage
    }
  }, []);

  function updateThreshold(key: keyof typeof defaultThresholds, value: string) {
    const num = parseFloat(value);
    setThresholds((prev) => ({ ...prev, [key]: Number.isNaN(num) ? prev[key] : num }));
    setSaved(false);
  }

  function saveThresholds() {
    localStorage.setItem(THRESHOLD_KEY, JSON.stringify(thresholds));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Settings"
        description="Configure integrations, alerts, and preferences"
        lastUpdated={lastUpdated}
      />

      <Tabs defaultValue="connectors" className="w-full">
        <TabsList className="mb-2 flex-wrap">
          <TabsTrigger value="connectors" className="gap-2">
            <Plug size={14} /> Connectors
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell size={14} /> Notifications
          </TabsTrigger>
          <TabsTrigger value="thresholds" className="gap-2">
            <SlidersHorizontal size={14} /> Thresholds
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-2">
            <User size={14} /> Profile
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connectors" className="space-y-4">
          <ConnectorConfigPanel onSync={onSync} syncLoading={syncLoading} lastSyncResult={lastSyncResult} />
          <ConnectorManager health={health} onSync={onSync} syncLoading={syncLoading} />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Widget>
            <WidgetHeader title="Alert Channels" subtitle="Where to send critical notifications" />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-alerts">Email alerts</Label>
                  <p className="text-xs text-muted-foreground">Send daily summary and critical alerts to your inbox</p>
                </div>
                <Switch id="email-alerts" defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="slack-alerts">Slack alerts</Label>
                  <p className="text-xs text-muted-foreground">Post P0/P1 incidents and critical CVEs to Slack</p>
                </div>
                <Switch id="slack-alerts" />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="slo-alerts">SLO breach alerts</Label>
                  <p className="text-xs text-muted-foreground">Notify when any critical service drops below its SLO</p>
                </div>
                <Switch id="slo-alerts" defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="cve-alerts">Critical CVE alerts</Label>
                  <p className="text-xs text-muted-foreground">Notify on new critical or SLA-breached CVEs</p>
                </div>
                <Switch id="cve-alerts" defaultChecked />
              </div>
            </div>
          </Widget>

          <Widget>
            <WidgetHeader title="Webhook URL" subtitle="Slack-compatible webhook for alerts" />
            <div className="space-y-2">
              <Label htmlFor="webhook-url">URL</Label>
              <Input id="webhook-url" placeholder="https://hooks.slack.com/services/..." />
            </div>
          </Widget>
        </TabsContent>

        <TabsContent value="thresholds" className="space-y-4">
          <Widget>
            <WidgetHeader
              title="Alert Thresholds"
              subtitle="Numeric limits used to highlight at-risk metrics across the dashboard"
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { key: "paymentSuccessMin", label: "Payment success min (%)", step: 0.01 },
                { key: "fraudRateMax", label: "Fraud rate max (%)", step: 0.01 },
                { key: "chargebackRateMax", label: "Chargeback rate max (%)", step: 0.01 },
                { key: "settlementFailureMax", label: "Settlement failure max (%)", step: 0.01 },
                { key: "costPerTransactionMax", label: "Cost / txn max ($)", step: 0.001 },
                { key: "mttrMaxMinutes", label: "MTTR max (minutes)", step: 1 },
                { key: "ciPassRateMin", label: "CI pass rate min (%)", step: 0.1 },
                { key: "reviewTimeMaxHours", label: "Review time max (hours)", step: 0.1 },
                { key: "changeFailureMaxPct", label: "Change failure max (%)", step: 0.1 },
                { key: "deployFrequencyMin", label: "Deploy frequency min / day", step: 0.1 },
                { key: "ledgerImbalanceMax", label: "Ledger imbalance max ($)", step: 100 },
                { key: "reconciliationLagMaxMinutes", label: "Reconciliation lag max (min)", step: 1 },
              ].map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input
                    id={field.key}
                    type="number"
                    step={field.step}
                    value={thresholds[field.key as keyof typeof thresholds]}
                    onChange={(e) => updateThreshold(field.key as keyof typeof thresholds, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button className="gap-2" onClick={saveThresholds}>
                <Save size={14} /> Save thresholds
              </Button>
              {saved && (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Saved to localStorage
                </span>
              )}
            </div>
          </Widget>
        </TabsContent>

        <TabsContent value="profile" className="space-y-4">
          <Widget>
            <WidgetHeader title="Profile" subtitle="Your dashboard preferences" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" defaultValue="Vineet Daniel" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" defaultValue="vineetdaniel@gmail.com" />
              </div>
            </div>
            <Button className="mt-4 gap-2">
              <Save size={14} /> Save
            </Button>
          </Widget>
        </TabsContent>
      </Tabs>
    </div>
  );
}
