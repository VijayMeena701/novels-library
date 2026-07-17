import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import {
  CAPABILITY,
  getUserCapabilities,
  getUserRoles,
  hasCapability,
  requireCapability,
  isAdminCapability,
  canManageTarget,
} from '@/services/rbac.js';
import { initEnforcer, syncPolicies } from '@/services/casbin.js';
import { User } from '@/models/User.js';
import { Role } from '@/models/Role.js';
import { AccessGroup } from '@/models/AccessGroup.js';
import { Capability } from '@/models/Capability.js';
import { Resource } from '@/models/Resource.js';
import { Action } from '@/models/Action.js';

async function ensureRoleWithCapability(roleKey: string, capString: string, isSuperuser = false) {
  const [resourceKey, actionKey] = capString.split(':');
  const resource =
    (await Resource.findOne({ key: resourceKey })) ||
    (await Resource.create({ key: resourceKey, name: resourceKey }));
  const action =
    (await Action.findOne({ key: actionKey })) ||
    (await Action.create({ key: actionKey, name: actionKey }));
  let capability = await Capability.findOne({ resource: resource._id, action: action._id });
  if (!capability) {
    capability = await Capability.create({ resource: resource._id, action: action._id });
  }
  let group = await AccessGroup.findOne({ key: `${roleKey}-group` });
  if (!group) {
    group = await AccessGroup.create({
      key: `${roleKey}-group`,
      name: `${roleKey} group`,
      capabilities: [capability._id],
    });
  } else if (!group.capabilities.some((c: any) => c.toString() === capability!._id.toString())) {
    group.capabilities.push(capability._id);
    await group.save();
  }
  let role = await Role.findOne({ key: roleKey });
  if (!role) {
    role = await Role.create({
      key: roleKey,
      name: roleKey,
      groups: [group._id],
      isSuperuser,
    });
  } else if (!role.groups.some((g: any) => g.toString() === group._id.toString())) {
    role.groups.push(group._id);
    await role.save();
  }
  return role;
}

function mockRequest(user?: any, params?: Record<string, string>) {
  return {
    headers: {},
    method: 'GET',
    url: '/test',
    routeOptions: { url: '/test' },
    params: params || {},
    user,
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    log: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
  } as any;
}

function mockReply() {
  return {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(body?: any) {
      this.body = body;
      return this;
    },
  } as any;
}

async function populatedUser(userId: string) {
  return User.findById(userId).populate({
    path: 'roles',
    populate: {
      path: 'groups',
      populate: {
        path: 'capabilities',
        populate: ['resource', 'action'],
      },
    },
  });
}

describe('rbac service', () => {
  beforeEach(async () => {
    await initEnforcer();
    await syncPolicies();
  });

  describe('getUserCapabilities', () => {
    it('returns empty for a missing user', async () => {
      const result = await getUserCapabilities(new mongoose.Types.ObjectId().toString());
      expect(result).toEqual({ capabilities: [], isSuperuser: false });
    });

    it('returns empty for disabled or deleted users', async () => {
      const disabled = await User.create({
        username: 'disabled',
        email: 'disabled@example.com',
        passwordHash: 'x',
        isDisabled: true,
      });
      expect(await getUserCapabilities(String(disabled._id))).toEqual({
        capabilities: [],
        isSuperuser: false,
      });

      const deleted = await User.create({
        username: 'deleted',
        email: 'deleted@example.com',
        passwordHash: 'x',
        isDeleted: true,
      });
      expect(await getUserCapabilities(String(deleted._id))).toEqual({
        capabilities: [],
        isSuperuser: false,
      });
    });

    it('collects capabilities from a user role groups', async () => {
      const role = await ensureRoleWithCapability('test-reader', 'books:read');
      const user = await User.create({
        username: 'reader',
        email: 'reader@example.com',
        passwordHash: 'x',
        roles: [role._id],
      });
      const result = await getUserCapabilities(String(user._id));
      expect(result.capabilities).toContain('books:read');
      expect(result.isSuperuser).toBe(false);
    });

    it('marks superuser roles', async () => {
      const role = await ensureRoleWithCapability('super-test', 'books:read', true);
      const user = await User.create({
        username: 'super',
        email: 'super@example.com',
        passwordHash: 'x',
        roles: [role._id],
      });
      const result = await getUserCapabilities(String(user._id));
      expect(result.isSuperuser).toBe(true);
    });
  });

  describe('getUserRoles', () => {
    it('returns role keys and superuser state', async () => {
      const role = await ensureRoleWithCapability('role-key-test', 'books:read');
      const user = await User.create({
        username: 'rk',
        email: 'rk@example.com',
        passwordHash: 'x',
        roles: [role._id],
      });
      const result = await getUserRoles(String(user._id));
      expect(result.roles).toContain('role-key-test');
      expect(result.isSuperuser).toBe(false);
    });
  });

  describe('hasCapability', () => {
    it('allows anonymous public read actions', async () => {
      const req = mockRequest();
      expect(await hasCapability(req, CAPABILITY.BOOKS_READ)).toBe(true);
      expect(await hasCapability(req, CAPABILITY.CHAPTERS_READ)).toBe(true);
    });

    it('denies anonymous manage actions', async () => {
      const req = mockRequest();
      expect(await hasCapability(req, CAPABILITY.BOOKS_CREATE)).toBe(false);
      expect(await hasCapability(req, CAPABILITY.GENRES_MANAGE)).toBe(false);
    });

    it('honors user capabilities', async () => {
      const role = await ensureRoleWithCapability('cap-user', 'books:create');
      const user = await User.create({
        username: 'capuser',
        email: 'capuser@example.com',
        passwordHash: 'x',
        roles: [role._id],
      });
      await syncPolicies();
      const req = mockRequest({ id: String(user._id), email: user.email, isSuperuser: false });
      expect(await hasCapability(req, CAPABILITY.BOOKS_CREATE)).toBe(true);
      expect(await hasCapability(req, CAPABILITY.BOOKS_DELETE)).toBe(false);
    });

    it('treats superusers as all-powerful', async () => {
      const req = mockRequest({ id: 'any', email: 'super@test.com', isSuperuser: true });
      expect(await hasCapability(req, CAPABILITY.BOOKS_DELETE)).toBe(true);
      expect(await hasCapability(req, CAPABILITY.ADMIN_MANAGE)).toBe(true);
    });

    it('returns false for malformed capabilities', async () => {
      const req = mockRequest({ id: 'any' });
      expect(await hasCapability(req, 'not-a-capability')).toBe(false);
    });
  });

  describe('requireCapability', () => {
    it('allows anonymous when the capability is allowed', async () => {
      const handler = requireCapability(CAPABILITY.BOOKS_READ, { allowAnonymous: true });
      const reply = mockReply();
      await handler(mockRequest(), reply);
      expect(reply.statusCode).toBe(200);
    });

    it('denies anonymous when authentication is required', async () => {
      const handler = requireCapability(CAPABILITY.BOOKS_CREATE);
      const reply = mockReply();
      await handler(mockRequest(), reply);
      expect(reply.statusCode).toBe(401);
    });

    it('denies anonymous without the required capability even when anonymous is allowed', async () => {
      const handler = requireCapability(CAPABILITY.BOOKS_CREATE, { allowAnonymous: true });
      const reply = mockReply();
      await handler(mockRequest(), reply);
      expect(reply.statusCode).toBe(403);
    });

    it('allows authenticated users with the capability', async () => {
      const role = await ensureRoleWithCapability('req-user', 'books:update');
      const user = await User.create({
        username: 'requser',
        email: 'requser@example.com',
        passwordHash: 'x',
        roles: [role._id],
      });
      await syncPolicies();
      const handler = requireCapability(CAPABILITY.BOOKS_UPDATE);
      const reply = mockReply();
      await handler(mockRequest({ id: String(user._id), email: user.email, isSuperuser: false }), reply);
      expect(reply.statusCode).toBe(200);
    });

    it('denies authenticated users without the capability', async () => {
      const role = await ensureRoleWithCapability('req-denied-user', 'books:read');
      const user = await User.create({
        username: 'reqdenied',
        email: 'reqdenied@example.com',
        passwordHash: 'x',
        roles: [role._id],
      });
      await syncPolicies();
      const handler = requireCapability(CAPABILITY.BOOKS_DELETE);
      const reply = mockReply();
      await handler(mockRequest({ id: String(user._id), email: user.email, isSuperuser: false }), reply);
      expect(reply.statusCode).toBe(403);
    });

    it('allows superusers without explicit capability', async () => {
      const handler = requireCapability(CAPABILITY.BOOKS_DELETE);
      const reply = mockReply();
      await handler(mockRequest({ id: 'any', email: 'super@example.com', isSuperuser: true }), reply);
      expect(reply.statusCode).toBe(200);
    });

    it('returns 500 for an invalid capability format', async () => {
      const handler = requireCapability('invalid-capability');
      const reply = mockReply();
      await handler(mockRequest({ id: 'any' }), reply);
      expect(reply.statusCode).toBe(500);
    });
  });

  describe('isAdminCapability', () => {
    it('identifies admin-only resources', () => {
      expect(isAdminCapability(CAPABILITY.ADMIN_ACCESS)).toBe(true);
      expect(isAdminCapability(CAPABILITY.USERS_READ)).toBe(true);
      expect(isAdminCapability(CAPABILITY.ROLES_UPDATE)).toBe(true);
      expect(isAdminCapability(CAPABILITY.GROUPS_DELETE)).toBe(true);
      expect(isAdminCapability(CAPABILITY.BOOKS_READ)).toBe(false);
      expect(isAdminCapability(CAPABILITY.CHAPTERS_READ)).toBe(false);
    });
  });

  describe('canManageTarget', () => {
    it('rejects missing targets', async () => {
      expect(await canManageTarget({ isSuperuser: true }, null)).toBe(false);
    });

    it('allows superusers to manage regular users', async () => {
      const actor = { isSuperuser: true };
      const role = await ensureRoleWithCapability('regular-role', 'books:read');
      const user = await User.create({
        username: 'regularuser',
        email: 'regularuser@example.com',
        passwordHash: 'x',
        roles: [role._id],
      });
      const target = await populatedUser(String(user._id));
      expect(await canManageTarget(actor, target)).toBe(true);
    });

    it('prevents non-superusers from managing admin targets', async () => {
      const actor = { isSuperuser: false };
      const adminRole = await ensureRoleWithCapability('admin-role', 'admin:access');
      const user = await User.create({
        username: 'adminuser',
        email: 'adminuser@example.com',
        passwordHash: 'x',
        roles: [adminRole._id],
      });
      const target = await populatedUser(String(user._id));
      expect(await canManageTarget(actor, target)).toBe(false);
    });

    it('allows superusers to manage superuser targets', async () => {
      const actor = { isSuperuser: true };
      const superRole = await ensureRoleWithCapability('super-target-role', 'books:read', true);
      const user = await User.create({
        username: 'super-target',
        email: 'super-target@example.com',
        passwordHash: 'x',
        roles: [superRole._id],
      });
      const target = await populatedUser(String(user._id));
      expect(await canManageTarget(actor, target)).toBe(true);
    });
  });
});
