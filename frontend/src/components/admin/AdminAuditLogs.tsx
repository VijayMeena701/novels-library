"use client";

import React, { useEffect, useState } from "react";
import { api } from "../../utils/api";

interface AuditLog {
  _id: string;
  action: string;
  method: string;
  path: string;
  outcome: string;
  userId?: string;
  email?: string;
  ip?: string;
  timestamp: string;
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function loadLogs() {
      setLoading(true);
      try {
        const data = await api.listAdminAuditLogs({ page, limit: 50 });
        if (!cancelled) {
          setLogs(data.logs);
          setTotalPages(data.totalPages);
        }
      } catch (err) {
        if (!cancelled) console.error("Failed to load audit logs:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadLogs();
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Audit Logs</h2>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading audit logs...</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left">Time</th>
                  <th className="px-4 py-2 text-left">Action</th>
                  <th className="px-4 py-2 text-left">Method</th>
                  <th className="px-4 py-2 text-left">Path</th>
                  <th className="px-4 py-2 text-left">Outcome</th>
                  <th className="px-4 py-2 text-left">User</th>
                  <th className="px-4 py-2 text-left">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id} className="border-t border-border">
                    <td className="px-4 py-2 text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-2 text-xs">{log.action}</td>
                    <td className="px-4 py-2 text-xs">{log.method}</td>
                    <td className="px-4 py-2 text-xs">{log.path}</td>
                    <td className="px-4 py-2 text-xs">
                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          log.outcome === "allowed"
                            ? "bg-green-100 text-green-700"
                            : log.outcome === "denied"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {log.outcome}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">{log.email || log.userId || "—"}</td>
                    <td className="px-4 py-2 text-xs">{log.ip || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-border px-3 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-md border border-border px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
