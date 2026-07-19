"use client";

import React, { useEffect, useState } from "react";
import { api } from "../../utils/api";
import { Can } from "../Can";

interface Action {
  _id: string;
  key: string;
  name: string;
}

interface Resource {
  _id: string;
  key: string;
  name: string;
  description: string;
  isEnabled: boolean;
  isSystem: boolean;
  category: string;
  actions: Action[];
}

export default function AdminResources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

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
    let cancelled = false;

    async function loadResources() {
      setLoading(true);
      try {
        const data = await api.listAdminResources();
        if (!cancelled) setResources(data.resources);
      } catch (err) {
        if (!cancelled) console.error("Failed to load resources:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadResources();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleEnabled = async (id: string, isEnabled: boolean) => {
    try {
      await api.enableAdminResource(id, isEnabled);
      await fetchResources();
    } catch (err) {
      console.error("Failed to toggle resource:", err);
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Resources</h2>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading resources...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {resources.map((resource) => (
            <div key={resource._id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{resource.name}</h3>
                <Can action="manage" subject="resources">
                  <button
                    onClick={() => toggleEnabled(resource._id, !resource.isEnabled)}
                    className={`rounded-md px-2 py-1 text-xs ${resource.isEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
                  >
                    {resource.isEnabled ? "Enabled" : "Disabled"}
                  </button>
                </Can>
              </div>
              <p className="text-xs text-muted-foreground">{resource.key}</p>
              <p className="mt-2 text-sm text-card-foreground">{resource.description}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {resource.actions.map((action) => (
                  <span key={action._id} className="rounded bg-muted px-2 py-1 text-xs">
                    {action.key}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
