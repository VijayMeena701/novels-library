"use client";

import React, { useEffect, useState } from "react";
import { api } from "../../utils/api";
import { Can } from "../Can";
import AdminAuditLogs from "@/components/admin/AdminAuditLogs";
import AdminGroups from "@/components/admin/AdminGroups";
import AdminResources from "@/components/admin/AdminResources";
import AdminRoles from "@/components/admin/AdminRoles";
import AdminUsers from "@/components/admin/AdminUsers";

type Tab = "overview" | "users" | "roles" | "groups" | "resources" | "audit";

interface Stats {
  users: number;
  roles: number;
  groups: number;
  capabilities: number;
  resources: number;
  auditLogs: number;
}

const tabLabels: { [key in Tab]: string } = {
  overview: "Overview",
  users: "Users",
  roles: "Roles",
  groups: "Groups",
  resources: "Resources",
  audit: "Audit Logs",
};

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getAdminStats()
      .then((data) => setStats(data))
      .catch((err) => console.error("Failed to load admin stats", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Admin Console</h1>
        <p className="text-sm text-muted-foreground">Manage users, roles, permissions, and audit logs.</p>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2 border-b border-border pb-2">
        {Object.entries(tabLabels).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as Tab)}
            className={`rounded-t-md px-4 py-2 text-sm font-semibold ${
              tab === key ? "bg-primary text-primary-foreground" : "bg-transparent text-foreground hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading && <p className="text-sm text-muted-foreground">Loading stats...</p>}
          {stats &&
            (
              [
                ["Users", stats.users],
                ["Roles", stats.roles],
                ["Access Groups", stats.groups],
                ["Capabilities", stats.capabilities],
                ["Resources", stats.resources],
                ["Audit Logs", stats.auditLogs],
              ] as [string, number][]
            ).map(([label, value]) => (
              <div
                key={label}
                onClick={() => {
                  const map: Record<string, Tab> = {
                    Users: "users",
                    Roles: "roles",
                    "Access Groups": "groups",
                    Resources: "resources",
                    "Audit Logs": "audit",
                  };
                  if (map[label]) setTab(map[label]);
                }}
                className="cursor-pointer rounded-lg border border-border bg-card p-5 shadow-sm transition hover:shadow-md"
              >
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold text-card-foreground">{value}</p>
              </div>
            ))}
        </section>
      )}

      <Can action="access" subject="admin">
        {tab === "users" && <AdminUsers />}
        {tab === "roles" && <AdminRoles />}
        {tab === "groups" && <AdminGroups />}
        {tab === "resources" && <AdminResources />}
        {tab === "audit" && <AdminAuditLogs />}
      </Can>
    </div>
  );
}
