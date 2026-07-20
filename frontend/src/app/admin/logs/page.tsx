"use client";

import { useEffect, useState } from "react";
import { api, type AdminAuditLog } from "../../../utils/api";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Badge } from "../../../components/ui/badge";
import { Spinner } from "../../../components/ui/spinner";
import { Search, RefreshCw } from "lucide-react";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(50);
  const [filter, setFilter] = useState("");

  const fetchLogs = async (currentPage = page) => {
    setLoading(true);
    try {
      const data = await api.listAdminAuditLogs({ page: currentPage, limit });
      setLogs(data.logs);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchLogs(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const filteredLogs = filter.trim()
    ? logs.filter(
        (log) =>
          log.action.toLowerCase().includes(filter.toLowerCase()) ||
          log.path.toLowerCase().includes(filter.toLowerCase()) ||
          (log.email && log.email.toLowerCase().includes(filter.toLowerCase())) ||
          log.outcome.toLowerCase().includes(filter.toLowerCase())
      )
    : logs;

  const getOutcomeVariant = (outcome: string) => {
    switch (outcome) {
      case "allowed":
        return "completed";
      case "denied":
        return "dropped";
      default:
        return "default";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">Recent permission checks and admin actions.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => fetchLogs(page)} disabled={loading}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-copy" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by action, path, email, or outcome..."
          className="pl-9"
        />
      </div>

      {loading && logs.length === 0 ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Time</th>
                  <th className="px-4 py-3 text-left font-semibold">Action</th>
                  <th className="px-4 py-3 text-left font-semibold">Method</th>
                  <th className="px-4 py-3 text-left font-semibold">Path</th>
                  <th className="px-4 py-3 text-left font-semibold">Outcome</th>
                  <th className="px-4 py-3 text-left font-semibold">User</th>
                  <th className="px-4 py-3 text-left font-semibold">IP</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log._id} className="border-t border-border">
                    <td className="px-4 py-3 text-xs whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs font-mono">{log.action}</td>
                    <td className="px-4 py-3 text-xs">{log.method}</td>
                    <td className="px-4 py-3 text-xs">{log.path}</td>
                    <td className="px-4 py-3 text-xs">
                      <Badge variant={getOutcomeVariant(log.outcome)}>{log.outcome}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs">{log.email || log.userId || "—"}</td>
                    <td className="px-4 py-3 text-xs">{log.ip || "—"}</td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No audit logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading}>
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading}>
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
