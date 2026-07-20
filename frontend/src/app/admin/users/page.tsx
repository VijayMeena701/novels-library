"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { CAPABILITY } from "../../../utils/permissions";
import { api, type AdminUser, type AdminRole, type AdminUserCreatePayload } from "../../../utils/api";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Modal } from "../../../components/ui/modal";
import { Spinner } from "../../../components/ui/spinner";
import { Badge } from "../../../components/ui/badge";
import { Search, Plus, RefreshCw } from "lucide-react";

export default function AdminUsersPage() {
  const { hasCapability } = useAuth();
  const canManage = hasCapability(CAPABILITY.ADMIN_MANAGE);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [createForm, setCreateForm] = useState<AdminUserCreatePayload & { confirmPassword: string }>({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    roleIds: [],
  });

  const fetchData = async (currentPage = page) => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        api.listAdminUsers({ search, page: currentPage, limit }),
        api.listAdminRoles(),
      ]);
      setUsers(usersRes.users);
      setTotalPages(usersRes.totalPages);
      setRoles(rolesRes.roles);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleToggleRole = async (user: AdminUser, roleId: string) => {
    if (!canManage) return;
    const current = new Set(user.roles.map((r) => r._id));
    if (current.has(roleId)) current.delete(roleId);
    else current.add(roleId);
    setWorking(user._id);
    try {
      await api.updateAdminUser(user._id, { roleIds: Array.from(current) });
      await fetchData(page);
    } catch (err) {
      console.error("Failed to update user roles:", err);
    } finally {
      setWorking(null);
    }
  };

  const handleToggleStatus = async (user: AdminUser, field: "isDisabled" | "isLocked" | "isVerified") => {
    if (!canManage) return;
    setWorking(user._id);
    try {
      await api.updateAdminUser(user._id, { [field]: !user[field] });
      await fetchData(page);
    } catch (err) {
      console.error("Failed to update user status:", err);
    } finally {
      setWorking(null);
    }
  };

  const handleDelete = async (user: AdminUser) => {
    if (!canManage) return;
    if (!confirm(`Delete user ${user.username}?`)) return;
    setWorking(user._id);
    try {
      await api.deleteAdminUser(user._id);
      await fetchData(page);
    } catch (err) {
      console.error("Failed to delete user:", err);
    } finally {
      setWorking(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createForm.password !== createForm.confirmPassword) {
      alert("Passwords do not match.");
      return;
    }
    if (!createForm.username || !createForm.email || !createForm.password) {
      alert("Username, email, and password are required.");
      return;
    }
    setWorking("create");
    try {
      const payload: AdminUserCreatePayload = {
        username: createForm.username,
        email: createForm.email,
        password: createForm.password,
        roleIds: createForm.roleIds,
      };
      await api.createAdminUser(payload);
      setShowCreate(false);
      setCreateForm({ username: "", email: "", password: "", confirmPassword: "", roleIds: [] });
      await fetchData(1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create user.");
    } finally {
      setWorking(null);
    }
  };

  const roleOptions = useMemo(
    () =>
      roles.map((r) => ({ key: r._id, label: r.name })),
    [roles]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground">Create and manage user accounts and roles.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => fetchData(page)} disabled={loading}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          {canManage && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="size-4" />
              Create User
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-copy" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="pl-9"
          />
        </div>
      </div>

      {loading && users.length === 0 ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">User</th>
                <th className="px-4 py-3 text-left font-semibold">Roles</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{user.username}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {roles.map((role) => {
                        const hasRole = user.roles.some((r) => r._id === role._id);
                        return canManage ? (
                          <label
                            key={role._id}
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${
                              hasRole
                                ? "border-primary bg-primary-soft text-foreground"
                                : "border-border text-copy hover:bg-surface-muted"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="size-3 accent-primary"
                              checked={hasRole}
                              onChange={() => handleToggleRole(user, role._id)}
                              disabled={working === user._id}
                            />
                            {role.name}
                          </label>
                        ) : (
                          hasRole && (
                            <Badge key={role._id} variant="outline">
                              {role.name}
                            </Badge>
                          )
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.isVerified && <Badge variant="completed">Verified</Badge>}
                      {user.isDisabled && <Badge variant="dropped">Disabled</Badge>}
                      {user.isLocked && <Badge variant="hold">Locked</Badge>}
                      {!user.isVerified && !user.isDisabled && !user.isLocked && <span className="text-xs text-muted-copy">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {canManage && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleToggleStatus(user, "isVerified")}
                          disabled={working === user._id}
                        >
                          {user.isVerified ? "Unverify" : "Verify"}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleToggleStatus(user, "isDisabled")}
                          disabled={working === user._id}
                        >
                          {user.isDisabled ? "Enable" : "Disable"}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleToggleStatus(user, "isLocked")}
                          disabled={working === user._id}
                        >
                          {user.isLocked ? "Unlock" : "Lock"}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(user)}
                          disabled={working === user._id}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
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
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create User" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Username</label>
            <Input value={createForm.username} onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Email</label>
            <Input type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Password</label>
            <Input type="password" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Confirm Password</label>
            <Input type="password" value={createForm.confirmPassword} onChange={(e) => setCreateForm((f) => ({ ...f, confirmPassword: e.target.value }))} required />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Roles</label>
            <div className="max-h-40 overflow-y-auto rounded-md border border-border p-2">
              {roleOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No roles found.</p>
              ) : (
                roleOptions.map((role) => {
                  const selected = createForm.roleIds?.includes(role.key) ?? false;
                  return (
                    <label key={role.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-muted">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={selected}
                        onChange={() =>
                          setCreateForm((f) => ({
                            ...f,
                            roleIds: selected
                              ? (f.roleIds || []).filter((id) => id !== role.key)
                              : [...(f.roleIds || []), role.key],
                          }))
                        }
                      />
                      {role.label}
                    </label>
                  );
                })
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={working === "create"}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
