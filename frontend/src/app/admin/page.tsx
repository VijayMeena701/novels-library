"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../utils/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Spinner } from "../../components/ui/spinner";
import { Users, Shield, Key, Folder, ScrollText, Layers } from "lucide-react";

interface Stats {
  users: number;
  roles: number;
  groups: number;
  capabilities: number;
  resources: number;
  auditLogs: number;
}

const cards = [
  { label: "Users", key: "users" as const, href: "/admin/users", icon: Users, color: "text-blue-600" },
  { label: "Roles", key: "roles" as const, href: "/admin/roles", icon: Shield, color: "text-purple-600" },
  { label: "Permission Groups", key: "groups" as const, href: "/admin/groups", icon: Key, color: "text-amber-600" },
  { label: "Capabilities", key: "capabilities" as const, href: "/admin/groups", icon: Layers, color: "text-slate-600" },
  { label: "Resources", key: "resources" as const, href: "/admin/resources", icon: Folder, color: "text-green-600" },
  { label: "Audit Logs", key: "auditLogs" as const, href: "/admin/logs", icon: ScrollText, color: "text-rose-600" },
];

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getAdminStats()
      .then((data) => setStats(data))
      .catch((err) => console.error("Failed to load admin stats:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Console</h1>
        <p className="text-sm text-muted-foreground">Manage users, roles, permission groups, resources, and audit logs.</p>
      </div>

      {loading || !stats ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            const value = stats[card.key];
            return (
              <Link key={card.label} href={card.href}>
                <Card className="transition hover:border-primary hover:shadow-md">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                    <Icon className={`size-5 ${card.color}`} />
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-card-foreground">{value}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
