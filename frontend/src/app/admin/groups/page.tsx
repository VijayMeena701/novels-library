"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { CAPABILITY } from "../../../utils/permissions";
import { api, type AdminGroup, type AdminCapability, type AdminResource, type AdminGroupPayload } from "../../../utils/api";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/input";
import { Modal } from "../../../components/ui/modal";
import { Spinner } from "../../../components/ui/spinner";
import { Badge } from "../../../components/ui/badge";
import { Plus, RefreshCw, Pencil, Trash2 } from "lucide-react";

export default function AdminGroupsPage() {
  const { hasCapability } = useAuth();
  const canManage = hasCapability(CAPABILITY.ADMIN_MANAGE);

  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [capabilities, setCapabilities] = useState<AdminCapability[]>([]);
  const [resources, setResources] = useState<AdminResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AdminGroup | null>(null);

  const [form, setForm] = useState<AdminGroupPayload & { key: string }>({
    key: "",
    name: "",
    description: "",
    resourceId: "",
    capabilityIds: [],
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [groupsRes, capsRes, resourcesRes] = await Promise.all([
        api.listAdminGroups(),
        api.listAdminCapabilities(),
        api.listAdminResources(),
      ]);
      setGroups(groupsRes.groups);
      setCapabilities(capsRes.capabilities);
      setResources(resourcesRes.resources);
    } catch (err) {
      console.error("Failed to load permission groups:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const capabilitiesByResource = useMemo(() => {
    const map = new Map<string, { resource: AdminCapability["resource"]; capabilities: AdminCapability[] }>();
    for (const cap of capabilities) {
      const key = cap.resource.key;
      if (!map.has(key)) {
        map.set(key, { resource: cap.resource, capabilities: [] });
      }
      map.get(key)!.capabilities.push(cap);
    }
    return Array.from(map.values()).sort((a, b) => a.resource.key.localeCompare(b.resource.key));
  }, [capabilities]);

  const resourceOptions = useMemo(
    () => [{ _id: "", key: "", name: "None" }, ...resources.map((r) => ({ _id: r._id, key: r.key, name: r.name }))],
    [resources]
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ key: "", name: "", description: "", resourceId: "", capabilityIds: [] });
    setShowModal(true);
  };

  const openEdit = (group: AdminGroup) => {
    setEditing(group);
    setForm({
      key: group.key,
      name: group.name,
      description: group.description,
      resourceId: group.resource?._id || "",
      capabilityIds: group.capabilities.map((c) => c._id),
    });
    setShowModal(true);
  };

  const toggleCapability = (id: string) => {
    setForm((f) => {
      const current = new Set(f.capabilityIds || []);
      if (current.has(id)) current.delete(id);
      else current.add(id);
      return { ...f, capabilityIds: Array.from(current) };
    });
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
      const payload: AdminGroupPayload = {
        name: form.name,
        description: form.description,
        resourceId: form.resourceId || undefined,
        capabilityIds: form.capabilityIds,
      };
      if (editing) {
        await api.updateAdminGroup(editing._id, payload);
      } else {
        await api.createAdminGroup({ ...payload, key: form.key });
      }
      setShowModal(false);
      await fetchData();
    } catch (err: any) {
      alert(err?.message || "Failed to save permission group.");
    } finally {
      setWorking(false);
    }
  };

  const handleDelete = async (group: AdminGroup) => {
    if (!canManage) return;
    if (!confirm(`Delete permission group "${group.name}"?`)) return;
    setWorking(true);
    try {
      await api.deleteAdminGroup(group._id);
      await fetchData();
    } catch (err: any) {
      alert(err?.message || "Failed to delete permission group.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Permission Groups</h1>
          <p className="text-sm text-muted-foreground">Permission groups bundle capabilities (resource:action) that roles can assign.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          {canManage && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              Create Group
            </Button>
          )}
        </div>
      </div>

      {loading && groups.length === 0 ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Group</th>
                <th className="px-4 py-3 text-left font-semibold">Resource</th>
                <th className="px-4 py-3 text-left font-semibold">Capabilities</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group._id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{group.name}</span>
                      {group.isSystem && <Badge variant="processing">System</Badge>}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">{group.key}</div>
                    <div className="text-xs text-copy">{group.description}</div>
                  </td>
                  <td className="px-4 py-3">
                    {group.resource ? <Badge variant="outline">{group.resource.name}</Badge> : <span className="text-xs text-muted-copy">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-md flex-wrap gap-1">
                      {group.capabilities.length === 0 && <span className="text-xs text-muted-copy">—</span>}
                      {group.capabilities.map((c) => (
                        <Badge key={c._id} variant="outline" className="font-mono text-[0.65rem]">
                          {c.resource.key}:{c.action.key}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {canManage && (
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openEdit(group)}>
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                        {!group.isSystem && (
                          <Button size="sm" variant="danger" onClick={() => handleDelete(group)}>
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

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Permission Group" : "Create Permission Group"} size="xl">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Key</label>
            <Input
              value={form.key}
              disabled={!!editing}
              onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
              placeholder="e.g. user:translation"
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
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Resource</label>
            <select
              value={form.resourceId}
              onChange={(e) => setForm((f) => ({ ...f, resourceId: e.target.value }))}
              className="min-h-[42px] w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none"
            >
              {resourceOptions.map((r) => (
                <option key={r._id || "none"} value={r._id}>
                  {r.name || "None"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Capabilities</label>
            <div className="max-h-72 space-y-3 overflow-y-auto rounded-md border border-border p-3">
              {capabilitiesByResource.length === 0 ? (
                <p className="text-sm text-muted-foreground">No capabilities found.</p>
              ) : (
                capabilitiesByResource.map(({ resource, capabilities: caps }) => (
                  <div key={resource.key}>
                    <h4 className="sticky top-0 bg-card pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      {resource.name} ({resource.key})
                    </h4>
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {caps.map((cap) => {
                        const selected = (form.capabilityIds || []).includes(cap._id);
                        return (
                          <label
                            key={cap._id}
                            className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition ${
                              selected ? "bg-primary-soft font-semibold text-foreground" : "text-copy hover:bg-surface-muted"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="size-4 accent-primary"
                              checked={selected}
                              onChange={() => toggleCapability(cap._id)}
                            />
                            {cap.action.name || cap.action.key} ({cap.action.key})
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)} disabled={working}>
              Cancel
            </Button>
            <Button type="submit" disabled={working}>
              {working ? "Saving..." : editing ? "Save Changes" : "Create Group"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
