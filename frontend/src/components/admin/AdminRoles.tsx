"use client";
import { useEffect, useState } from 'react';
import { api } from "../../utils/api";
import { Can } from "../Can";

interface Role {
  _id: string;
  key: string;
  name: string;
  description: string;
  isSuperuser: boolean;
  isSystem: boolean;
  groups: { _id: string; name: string }[];
}

export default function AdminRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const data = await api.listAdminRoles();
      setRoles(data.roles);
    } catch (err) {
      console.error("Failed to load roles:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadRoles() {
      setLoading(true);
      try {
        const data = await api.listAdminRoles();
        if (!cancelled) setRoles(data.roles);
      } catch (err) {
        if (!cancelled) console.error("Failed to load roles:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadRoles();
    return () => {
      cancelled = true;
    };
  }, []);

  const deleteRole = async (id: string) => {
    if (!confirm("Delete this role?")) return;
    try {
      await api.deleteAdminRole(id);
      await fetchRoles();
    } catch (err) {
      console.error("Failed to delete role:", err);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Roles</h2>
        <Can action="manage" subject="roles">
          <button className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground" onClick={() => alert("Create role UI not implemented yet")}>
            + Role
          </button>
        </Can>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading roles...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left">Key</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Groups</th>
                <th className="px-4 py-2 text-left">Flags</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role._id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">{role.key}</td>
                  <td className="px-4 py-2">
                    <div className="font-semibold">{role.name}</div>
                    <div className="text-xs text-muted-foreground">{role.description}</div>
                  </td>
                  <td className="px-4 py-2 text-xs">{role.groups.map((g) => g.name).join(", ") || "None"}</td>
                  <td className="px-4 py-2 text-xs">
                    {role.isSuperuser && <span className="rounded bg-purple-100 px-2 py-1 text-purple-700">Super</span>}
                    {role.isSystem && <span className="rounded bg-blue-100 px-2 py-1 text-blue-700">System</span>}
                  </td>
                  <td className="px-4 py-2">
                    <Can action="manage" subject="roles">
                      {!role.isSystem && (
                        <button onClick={() => deleteRole(role._id)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
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
