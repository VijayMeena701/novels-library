import { FastifyRequest, FastifyReply } from 'fastify';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { AccessGroup } from '../models/AccessGroup';
import { Capability } from '../models/Capability';
import { Resource } from '../models/Resource';
import { AuditLog } from '../models/AuditLog';
import { canManageTarget } from '../services/rbac';
import { syncPolicies } from '../services/casbin';

export async function getAdminStatsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const [users, roles, groups, capabilities, resources, auditLogs] = await Promise.all([
      User.countDocuments({ isDeleted: false }),
      Role.countDocuments(),
      AccessGroup.countDocuments(),
      Capability.countDocuments(),
      Resource.countDocuments(),
      AuditLog.countDocuments(),
    ]);
    return reply.send({ users, roles, groups, capabilities, resources, auditLogs });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching admin stats.' });
  }
}

export async function listUsersHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const query = request.query as any;
    const limit = Math.min(parseInt(query.limit || '50', 10), 200);
    const page = parseInt(query.page || '1', 10);
    const skip = (page - 1) * limit;
    const filter: any = {};
    if (query.search) {
      const term = query.search.trim();
      filter.$or = [{ username: { $regex: term, $options: 'i' } }, { email: { $regex: term, $options: 'i' } }];
    }
    if (query.isDisabled !== undefined) filter.isDisabled = query.isDisabled === 'true';
    if (query.isLocked !== undefined) filter.isLocked = query.isLocked === 'true';
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-passwordHash')
        .populate('roles', 'key name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);
    return reply.send({ users, total, page, limit, totalPages: Math.ceil(total / limit) || 1 });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing users.' });
  }
}

export async function getUserByIdHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as any;
    const user = await User.findById(id).select('-passwordHash').populate('roles', 'key name').lean();
    if (!user) return reply.status(404).send({ error: 'User not found.' });
    return reply.send({ user });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching user.' });
  }
}

export async function updateUserHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const actor = (request as any).user as any;
    const { id } = request.params as any;
    const body = request.body as any;
    const user = await User.findById(id).populate('roles');
    if (!user) return reply.status(404).send({ error: 'User not found.' });

    if (actor?.id !== id && !(await canManageTarget(actor, user))) {
      return reply.status(403).send({ error: 'Forbidden. Cannot manage this user.' });
    }

    const update: any = {};
    if (typeof body.username === 'string' && body.username.trim()) update.username = body.username.trim();
    if (typeof body.avatarUrl === 'string') update.avatarUrl = body.avatarUrl.trim();
    if (typeof body.isDisabled === 'boolean') update.isDisabled = body.isDisabled;
    if (typeof body.isLocked === 'boolean') update.isLocked = body.isLocked;
    if (typeof body.isVerified === 'boolean') update.isVerified = body.isVerified;
    if (Array.isArray(body.roleIds)) {
      const roleIds = body.roleIds.map((r: string) => new mongoose.Types.ObjectId(r));
      update.roles = roleIds;
    }

    const updated = await User.findByIdAndUpdate(id, { $set: update }, { new: true })
      .select('-passwordHash')
      .populate('roles', 'key name')
      .lean();

    // Re-sync policies when user status or roles change
    if (Object.keys(update).some((k) => ['isDisabled', 'isLocked', 'isDeleted', 'isVerified', 'roles'].includes(k))) {
      await syncPolicies();
    }

    return reply.send({ user: updated });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error updating user.' });
  }
}

export async function deleteUserHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const actor = (request as any).user as any;
    const { id } = request.params as any;
    if (actor?.id === id) {
      return reply.status(403).send({ error: 'Forbidden. Cannot delete yourself.' });
    }
    const user = await User.findById(id).populate('roles');
    if (!user) return reply.status(404).send({ error: 'User not found.' });
    if (!(await canManageTarget(actor, user))) {
      return reply.status(403).send({ error: 'Forbidden. Cannot manage this user.' });
    }
    user.isDeleted = true;
    user.isDisabled = true;
    await user.save();
    await syncPolicies();
    return reply.send({ success: true, message: 'User deleted.' });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error deleting user.' });
  }
}

export async function listRolesHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const roles = await Role.find().populate('groups', 'key name').sort({ key: 1 }).lean();
    return reply.send({ roles });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing roles.' });
  }
}

export async function createRoleHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const body = request.body as any;
    if (!body.key || !body.name) {
      return reply.status(400).send({ error: 'key and name are required.' });
    }
    const role = await Role.create({
      key: body.key,
      name: body.name,
      description: body.description || '',
      groups: (body.groupIds || []).map((id: string) => new mongoose.Types.ObjectId(id)),
      isSuperuser: body.isSuperuser === true,
      isSystem: false,
      isDefault: false,
    });
    const created = await Role.findById(role._id).populate('groups', 'key name').lean();
    await syncPolicies();
    return reply.status(201).send({ role: created });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error creating role.' });
  }
}

export async function updateRoleHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const actor = (request as any).user as any;
    const { id } = request.params as any;
    const body = request.body as any;
    const role = await Role.findById(id).populate('groups');
    if (!role) return reply.status(404).send({ error: 'Role not found.' });
    if (role.isSuperuser && !actor?.isSuperuser) {
      return reply.status(403).send({ error: 'Forbidden. Only a superadmin can modify a superadmin role.' });
    }
    const update: any = {};
    if (typeof body.name === 'string') update.name = body.name;
    if (typeof body.description === 'string') update.description = body.description;
    if (Array.isArray(body.groupIds)) update.groups = body.groupIds.map((r: string) => new mongoose.Types.ObjectId(r));
    if (typeof body.isSuperuser === 'boolean') update.isSuperuser = body.isSuperuser;
    const updated = await Role.findByIdAndUpdate(id, { $set: update }, { new: true })
      .populate('groups', 'key name')
      .lean();
    await syncPolicies();
    return reply.send({ role: updated });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error updating role.' });
  }
}

export async function deleteRoleHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const actor = (request as any).user as any;
    const { id } = request.params as any;
    const role = await Role.findById(id);
    if (!role) return reply.status(404).send({ error: 'Role not found.' });
    if (role.isSystem) {
      return reply.status(403).send({ error: 'Forbidden. Cannot delete a system role.' });
    }
    if (role.isSuperuser && !actor?.isSuperuser) {
      return reply.status(403).send({ error: 'Forbidden. Only a superadmin can delete a superadmin role.' });
    }
    const usersWithRole = await User.countDocuments({ roles: role._id });
    if (usersWithRole > 0) {
      return reply.status(400).send({ error: 'Cannot delete role assigned to users.' });
    }
    await Role.findByIdAndDelete(id);
    await syncPolicies();
    return reply.send({ success: true, message: 'Role deleted.' });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error deleting role.' });
  }
}

export async function listGroupsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const groups = await AccessGroup.find()
      .populate({
        path: 'capabilities',
        populate: [
          { path: 'resource', select: 'key name' },
          { path: 'action', select: 'key name' },
        ],
      })
      .populate('resource', 'key name')
      .sort({ key: 1 })
      .lean();
    return reply.send({ groups });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing access groups.' });
  }
}

export async function createGroupHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const body = request.body as any;
    if (!body.key || !body.name) {
      return reply.status(400).send({ error: 'key and name are required.' });
    }
    const group = await AccessGroup.create({
      key: body.key,
      name: body.name,
      description: body.description || '',
      resource: body.resourceId ? new mongoose.Types.ObjectId(body.resourceId) : undefined,
      capabilities: (body.capabilityIds || []).map((id: string) => new mongoose.Types.ObjectId(id)),
      isSystem: false,
    });
    const created = await AccessGroup.findById(group._id)
      .populate({
        path: 'capabilities',
        populate: [
          { path: 'resource', select: 'key name' },
          { path: 'action', select: 'key name' },
        ],
      })
      .populate('resource', 'key name')
      .lean();
    await syncPolicies();
    return reply.status(201).send({ group: created });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error creating access group.' });
  }
}

export async function updateGroupHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as any;
    const body = request.body as any;
    const group = await AccessGroup.findById(id);
    if (!group) return reply.status(404).send({ error: 'Access group not found.' });
    const update: any = {};
    if (typeof body.name === 'string') update.name = body.name;
    if (typeof body.description === 'string') update.description = body.description;
    if (body.resourceId) update.resource = new mongoose.Types.ObjectId(body.resourceId);
    if (Array.isArray(body.capabilityIds))
      update.capabilities = body.capabilityIds.map((r: string) => new mongoose.Types.ObjectId(r));
    const updated = await AccessGroup.findByIdAndUpdate(id, { $set: update }, { new: true })
      .populate({
        path: 'capabilities',
        populate: [
          { path: 'resource', select: 'key name' },
          { path: 'action', select: 'key name' },
        ],
      })
      .populate('resource', 'key name')
      .lean();
    await syncPolicies();
    return reply.send({ group: updated });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error updating access group.' });
  }
}

export async function deleteGroupHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as any;
    const group = await AccessGroup.findById(id);
    if (!group) return reply.status(404).send({ error: 'Access group not found.' });
    if (group.isSystem) {
      return reply.status(403).send({ error: 'Forbidden. Cannot delete a system group.' });
    }
    const rolesUsingGroup = await Role.countDocuments({ groups: group._id });
    if (rolesUsingGroup > 0) {
      return reply.status(400).send({ error: 'Cannot delete group assigned to roles.' });
    }
    await AccessGroup.findByIdAndDelete(id);
    await syncPolicies();
    return reply.send({ success: true, message: 'Access group deleted.' });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error deleting access group.' });
  }
}

export async function listResourcesHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const resources = await Resource.find().populate('actions', 'key name').sort({ key: 1 }).lean();
    return reply.send({ resources });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing resources.' });
  }
}

export async function enableResourceHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as any;
    const body = request.body as any;
    const resource = await Resource.findById(id);
    if (!resource) return reply.status(404).send({ error: 'Resource not found.' });
    resource.isEnabled = body.isEnabled === true;
    await resource.save();
    await syncPolicies();
    return reply.send({ resource });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error enabling resource.' });
  }
}

export async function listAuditLogsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const query = request.query as any;
    const limit = Math.min(parseInt(query.limit || '50', 10), 200);
    const page = parseInt(query.page || '1', 10);
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      AuditLog.find().sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(),
    ]);
    return reply.send({ logs, total, page, limit, totalPages: Math.ceil(total / limit) || 1 });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing audit logs.' });
  }
}
