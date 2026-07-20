"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { CAPABILITY } from "../../../utils/permissions";
import { api, type AdminRole, type AdminGroup, type AdminRolePayload } from "../../../utils/api";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/input";
import { Modal } from "../../../components/ui/modal";
import { Spinner } from "../../../components/ui/spinner";
import { Badge } from "../../../components/ui/badge";
import { CheckboxGroup } from "../../../components/ui/checkbox-group";
import { Plus, RefreshCw, Pencil, Trash2 } from "lucide-react";

export default function AdminRolesPage() {
  const { hasCapability } = useAuth();
  const canManage = hasCapability(CAPABILITY.ADMIN_MANAGE);

  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AdminRole | null>(null);

  const [form, setForm] = useState<AdminRolePayload & { key: string }>({
    key: "",
    name: "",
    description: "",
    isSuperuser: false,
    groupIds: [],
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, groupsRes] = await Promise.all([api.listAdminRoles(), api.listAdminGroups()]);
      setRoles(rolesRes.roles);
      setGroups(groupsRes.groups);
    } catch (err) {
      console.error("Failed to load roles:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, []);

  const groupOptions = useMemo(
    () => groups.map((g) => ({ key: g._id, label: `${g.name} (${g.key})` })),
    [groups]
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ key: "", name: "", description: "", isSuperuser: false, groupIds: [] });
    setShowModal(true);
  };

  const openEdit = (role: AdminRole) => {
    setEditing(role);
    setForm({
      key: role.key,
      name: role.name,
      description: role.description,
      isSuperuser: role.isSuperuser,
      groupIds: role.groups.map((g) => g._id),
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    if (!form.key || !form.name) {
      alert("Key and name are required.");
      return;
    }
    setWorking(true);
    try {
      if (editing) {
        await api.updateAdminRole(editing._id, {
          name: form.name,
          description: form.description,
          isSuperuser: form.isSuperuser,
          groupIds: form.groupIds,
        });
      } else {
        await api.createAdminRole({
          key: form.key,
          name: form.name,
          description: form.description,
          isSuperuser: form.isSuperuser,
          groupIds: form.groupIds,
        });
      }
      setShowModal(false);
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save role.");
    } finally {
      setWorking(false);
    }
  };

  const handleDelete = async (role: AdminRole) => {
    if (!canManage) return;
    if (!confirm(`Delete role "${role.name}"?`)) return;
    setWorking(true);
    try {
      await api.deleteAdminRole(role._id);
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete role.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Roles</h1>
          <p className="text-sm text-muted-foreground">Roles bundle permission groups together.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          {canManage && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              Create Role
            </Button>
          )}
        </div>
      </div>

      {loading && roles.length === 0 ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Role</th>
                <th className="px-4 py-3 text-left font-semibold">Groups</th>
                <th className="px-4 py-3 text-left font-semibold">Flags</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role._id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{role.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{role.key}</div>
                    <div className="text-xs text-copy">{role.description}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {role.groups.length === 0 && <span className="text-xs text-muted-copy">—</span>}
                      {role.groups.map((g) => (
                        <Badge key={g._id} variant="outline">
                          {g.name}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {role.isSuperuser && <Badge variant="completed">Super</Badge>}
                      {role.isSystem && <Badge variant="processing">System</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {canManage && (
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openEdit(role)}>
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                        {!role.isSystem && (
                          <Button size="sm" variant="danger" onClick={() => handleDelete(role)}>
                            <Trash2 className="size-3.5" />
                            Delete
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Role" : "Create Role"} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Key</label>
            <Input
              value={form.key}
              disabled={!!editing}
              onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
              placeholder="e.g. moderator"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Name</label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Description</label>
            <Textarea value={form.description || ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="isSuperuser"
              type="checkbox"
              className="size-4 accent-primary"
              checked={form.isSuperuser}
              onChange={(e) => setForm((f) => ({ ...f, isSuperuser: e.target.checked }))}
            />
            <label htmlFor="isSuperuser" className="text-sm font-medium text-foreground">
              Superuser
            </label>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Access Groups</label>
            <CheckboxGroup
              items={groupOptions}
              selectedKeys={form.groupIds || []}
              onToggle={(key) =>
                setForm((f) => {
                  const current = new Set(f.groupIds || []);
                  if (current.has(key)) current.delete(key);
                  else current.add(key);
                  return { ...f, groupIds: Array.from(current) };
                })
              }
              maxHeight="200px"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)} disabled={working}>
              Cancel
            </Button>
            <Button type="submit" disabled={working}>
              {working ? "Saving..." : editing ? "Save Changes" : "Create Role"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
