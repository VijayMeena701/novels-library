"use client";

import React, { useEffect, useState } from "react";
import { api } from "../../utils/api";
import { Can } from "../Can";

interface UserRow {
  _id: string;
  username: string;
  email: string;
  roles: { _id: string; key: string; name: string }[];
  isDisabled: boolean;
  isLocked: boolean;
  isVerified: boolean;
  isDeleted: boolean;
}

interface Role {
  _id: string;
  key: string;
  name: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [userData, roleData] = await Promise.all([api.listAdminUsers({ search, limit: 100 }), api.listAdminRoles()]);
      setUsers(userData.users);
      setRoles(roleData.roles);
    } catch (err) {
      console.error("Failed to load admin users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search]);

  const updateUser = async (id: string, payload: any) => {
    setSaving(id);
    try {
      await api.updateAdminUser(id, payload);
      await fetchUsers();
    } catch (err) {
      console.error("Failed to update user:", err);
    } finally {
      setSaving(null);
    }
  };

  const toggleRole = (user: UserRow, roleId: string) => {
    const current = new Set(user.roles.map((r) => r._id));
    if (current.has(roleId)) current.delete(roleId);
    else current.add(roleId);
    updateUser(user._id, { roleIds: Array.from(current) });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <button onClick={() => fetchUsers()} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading users...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left">User</th>
                <th className="px-4 py-2 text-left">Roles</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <div className="font-semibold">{user.username}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {roles.map((role) => (
                        <Can key={role._id} action="manage" subject="users">
                          <label className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
                            <input
                              type="checkbox"
                              checked={user.roles.some((r) => r._id === role._id)}
                              onChange={() => toggleRole(user, role._id)}
                              disabled={saving === user._id}
                              className="h-3 w-3"
                            />
                            {role.name}
                          </label>
                        </Can>
                      ))}
                      <Can action="access" subject="admin">
                        <span className="text-xs text-muted-foreground">
                          {user.roles.map((r) => r.name).join(", ") || "None"}
                        </span>
                      </Can>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2 text-xs">
                      {user.isDisabled && <span className="rounded bg-red-100 px-2 py-1 text-red-700">Disabled</span>}
                      {user.isLocked && <span className="rounded bg-amber-100 px-2 py-1 text-amber-700">Locked</span>}
                      {user.isVerified && <span className="rounded bg-green-100 px-2 py-1 text-green-700">Verified</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <Can action="manage" subject="users">
                        <button
                          onClick={() => updateUser(user._id, { isDisabled: !user.isDisabled })}
                          disabled={saving === user._id}
                          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                        >
                          {user.isDisabled ? "Enable" : "Disable"}
                        </button>
                        <button
                          onClick={() => updateUser(user._id, { isLocked: !user.isLocked })}
                          disabled={saving === user._id}
                          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                        >
                          {user.isLocked ? "Unlock" : "Lock"}
                        </button>
                        <button
                          onClick={() => updateUser(user._id, { isVerified: !user.isVerified })}
                          disabled={saving === user._id}
                          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                        >
                          {user.isVerified ? "Unverify" : "Verify"}
                        </button>
                        <button
                          onClick={() => api.deleteAdminUser(user._id).then(fetchUsers)}
                          disabled={saving === user._id}
                          className="rounded-md border border-destructive px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                        >
                          Delete
                        </button>
                      </Can>
                    </div>
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
