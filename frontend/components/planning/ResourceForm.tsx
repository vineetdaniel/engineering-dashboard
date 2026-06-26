"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import type { ResourceInput, ResourceRole } from "@/lib/actions/resources";

const ROLES: ResourceRole[] = ["developer", "qa", "devops", "designer", "pm"];

interface ResourceFormProps {
  onSubmit: (input: ResourceInput) => void;
  error?: string;
}

export function ResourceForm({ onSubmit, error }: ResourceFormProps) {
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [role, setRole] = useState<ResourceRole>("developer");
  const [hours, setHours] = useState(80);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, team, role, default_hours_per_sprint: hours });
    setName("");
    setTeam("");
    setRole("developer");
    setHours(80);
  };

  return (
    <Card className="p-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="res-name">Name</Label>
            <Input
              id="res-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alice Johnson"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-team">Team</Label>
            <Input
              id="res-team"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              placeholder="e.g. Backend"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-role">Role</Label>
            <select
              id="res-role"
              value={role}
              onChange={(e) => setRole(e.target.value as ResourceRole)}
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-hours">Default hours/sprint</Label>
            <Input
              id="res-hours"
              type="number"
              min={0}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              required
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full">Add resource</Button>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </Card>
  );
}
