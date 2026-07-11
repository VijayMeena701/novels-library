"use client";

import React, { useEffect, useState } from "react";
import { api } from "../../utils/api";
import { Can } from "../Can";

interface Group {
  _id: string;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  resource?: { _id: string; key: string; name: string };
  capabilities: { _id: string; resource: { key: string; name: string }; action: { key: string; name: string } }[];
}

export default function AdminGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const data = await api.listAdminGroups();
      setGroups(data.groups);
    } catch (err) {
      console.error("Failed to load groups:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const deleteGroup = async (id: string) => {
    if (!confirm("Delete this access group?")) return;
    try {
      await api.deleteAdminGroup(id);
      await fetchGroups();
    } catch (err) {
      console.error("Failed to delete group:", err);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Access Groups</h2>
        <Can action="manage" subject="groups">
          <button className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground" onClick={() => alert("Create group UI not implemented yet")}>
            + Group
          </button>
        </Can>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading groups...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left">Key</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Resource</th>
                <th className="px-4 py-2 text-left">Capabilities</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group._id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">{group.key}</td>
                  <td className="px-4 py-2">
                    <div className="font-semibold">{group.name}</div>
                    <div className="text-xs text-muted-foreground">{group.description}</div>
                  </td>
                  <td className="px-4 py-2 text-xs">{group.resource ? group.resource.name : "—"}</td>
                  <td className="px-4 py-2 text-xs">{group.capabilities.map((c) => `${c.resource.key}:${c.action.key}`).join(", ") || "None"}</td>
                  <td className="px-4 py-2">
                    <Can action="manage" subject="groups">
                      {!group.isSystem && (
                        <button onClick={() => deleteGroup(group._id)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                          Delete
                        </button>
                      )}
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
