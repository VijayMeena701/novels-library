"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { CAPABILITY } from "../../../utils/permissions";
import { api, type AdminResource } from "../../../utils/api";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Switch } from "../../../components/ui/switch";
import { Spinner } from "../../../components/ui/spinner";
import { Badge } from "../../../components/ui/badge";
import { RefreshCw } from "lucide-react";

export default function AdminResourcesPage() {
  const { hasCapability } = useAuth();
  const canManage = hasCapability(CAPABILITY.ADMIN_MANAGE);

  const [resources, setResources] = useState<AdminResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchResources = async () => {
    setLoading(true);
    try {
      const data = await api.listAdminResources();
      setResources(data.resources);
    } catch (err) {
      console.error("Failed to load resources:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchResources();
  }, []);

  const handleToggle = async (resource: AdminResource) => {
    if (!canManage) return;
    setToggling(resource._id);
    try {
      await api.enableAdminResource(resource._id, !resource.isEnabled);
      await fetchResources();
    } catch (err) {
      console.error("Failed to toggle resource:", err);
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Resources</h1>
          <p className="text-sm text-muted-foreground">Enable or disable resources and view their available actions.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchResources} disabled={loading}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {resources.map((resource) => (
            <Card key={resource._id} className={resource.isEnabled ? "" : "opacity-70"}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-base">{resource.name}</CardTitle>
                  <p className="font-mono text-xs text-muted-foreground">{resource.key}</p>
                </div>
                <Switch
                  checked={resource.isEnabled}
                  onCheckedChange={() => handleToggle(resource)}
                  disabled={!canManage || toggling === resource._id}
                  aria-label={`Toggle ${resource.name}`}
                />
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-copy">{resource.description || "No description."}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={resource.isEnabled ? "completed" : "default"}>
                    {resource.isEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                  <Badge variant="outline">{resource.category}</Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-1">
                  {resource.actions.length === 0 && <span className="text-xs text-muted-copy">No actions defined.</span>}
                  {resource.actions.map((action) => (
                    <span key={action._id} className="rounded-md bg-surface px-2 py-1 text-xs font-medium text-copy">
                      {action.key}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
