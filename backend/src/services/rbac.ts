import { FastifyRequest, FastifyReply } from 'fastify';
import { AuditLog } from '../models/AuditLog.js';
import { User } from '../models/User.js';
import { Resource } from '../models/Resource.js';
import { Role } from '../models/Role.js';
import { getEnforcer, initEnforcer, syncPolicies } from './casbin.js';

export const CAPABILITY = {
  // Profile & settings
  PROFILE_READ: 'profile:read',
  PROFILE_UPDATE: 'profile:update',
  SETTINGS_READ: 'settings:read',
  SETTINGS_UPDATE: 'settings:update',

  // Catalog
  BOOKS_LIST: 'books:list',
  BOOKS_READ: 'books:read',
  BOOKS_CREATE: 'books:create',
  BOOKS_UPDATE: 'books:update',
  BOOKS_DELETE: 'books:delete',
  BOOKS_MANAGE: 'books:manage',

  // Library
  LIBRARY_READ: 'library:read',
  LIBRARY_ADD: 'library:add',
  LIBRARY_UPDATE: 'library:update',
  LIBRARY_DELETE: 'library:delete',
  LIBRARY_MANAGE: 'library:manage',

  // Chapters
  CHAPTERS_LIST: 'chapters:list',
  CHAPTERS_READ: 'chapters:read',
  CHAPTERS_READ_RAW: 'chapters:read_raw',
  CHAPTERS_TRANSLATE: 'chapters:translate',
  CHAPTERS_VISIT: 'chapters:visit',
  CHAPTERS_MANAGE: 'chapters:manage',

  // Taxonomy
  AUTHORS_LIST: 'authors:list',
  AUTHORS_READ: 'authors:read',
  AUTHORS_CREATE: 'authors:create',
  AUTHORS_UPDATE: 'authors:update',
  AUTHORS_DELETE: 'authors:delete',
  AUTHORS_MANAGE: 'authors:manage',

  GENRES_LIST: 'genres:list',
  GENRES_READ: 'genres:read',
  GENRES_CREATE: 'genres:create',
  GENRES_UPDATE: 'genres:update',
  GENRES_DELETE: 'genres:delete',
  GENRES_MANAGE: 'genres:manage',

  PUBLICATION_STATUSES_LIST: 'publication_statuses:list',
  PUBLICATION_STATUSES_READ: 'publication_statuses:read',
  PUBLICATION_STATUSES_CREATE: 'publication_statuses:create',
  PUBLICATION_STATUSES_UPDATE: 'publication_statuses:update',
  PUBLICATION_STATUSES_DELETE: 'publication_statuses:delete',
  PUBLICATION_STATUSES_MANAGE: 'publication_statuses:manage',

  // Jobs
  JOBS_LIST: 'jobs:list',
  JOBS_RETRY: 'jobs:retry',
  JOBS_MANUAL_INTERVENTION: 'jobs:manual_intervention',
  JOBS_IMPORT: 'jobs:import',
  JOBS_SCRAPE: 'jobs:scrape',
  JOBS_MANAGE: 'jobs:manage',

  // TTS
  PRONUNCIATION_READ: 'pronunciation:read',
  PRONUNCIATION_MANAGE: 'pronunciation:manage',

  // Sessions
  SESSIONS_READ: 'sessions:read',
  SESSIONS_MANAGE: 'sessions:manage',

  // Cover & translation
  COVER_SYNC: 'cover:sync',
  COVER_MANAGE: 'cover:manage',
  TRANSLATION_EXECUTE: 'translation:execute',
  TRANSLATION_MANAGE: 'translation:manage',

  // Admin console
  ADMIN_ACCESS: 'admin:access',
  ADMIN_MANAGE: 'admin:manage',

  // Administration
  USERS_LIST: 'users:list',
  USERS_READ: 'users:read',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  USERS_MANAGE: 'users:manage',

  ROLES_LIST: 'roles:list',
  ROLES_READ: 'roles:read',
  ROLES_CREATE: 'roles:create',
  ROLES_UPDATE: 'roles:update',
  ROLES_DELETE: 'roles:delete',
  ROLES_MANAGE: 'roles:manage',

  GROUPS_LIST: 'groups:list',
  GROUPS_READ: 'groups:read',
  GROUPS_CREATE: 'groups:create',
  GROUPS_UPDATE: 'groups:update',
  GROUPS_DELETE: 'groups:delete',
  GROUPS_MANAGE: 'groups:manage',

  RESOURCES_LIST: 'resources:list',
  RESOURCES_READ: 'resources:read',
  RESOURCES_ENABLE: 'resources:enable',
  RESOURCES_MANAGE: 'resources:manage',

  AUDIT_LOGS_READ: 'audit_logs:read',
  ACCESS_LOGS_READ: 'access_logs:read',

  SERVICE_READ: 'service:read',
  SERVICE_EXECUTE: 'service:execute',
  SERVICE_MANAGE: 'service:manage',
} as const;

function getClientIp(request: FastifyRequest): string | undefined {
  const forwarded = (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim();
  return forwarded || request.ip || request.socket?.remoteAddress;
}

async function writeAuditEntry(payload: {
  userId?: string;
  role?: string;
  email?: string;
  action: string;
  method: string;
  path: string;
  resourceType?: string;
  resourceId?: string;
  statusCode?: number;
  outcome: 'allowed' | 'denied' | 'error';
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}) {
  try {
    await AuditLog.create({
      ...payload,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error('[AuditLog] Failed to write audit entry:', err);
  }
}

function parseCapability(capability: string): { resource: string; action: string } | null {
  const parts = capability.split(':');
  if (parts.length !== 2) return null;
  return { resource: parts[0], action: parts[1] };
}

export async function getUserCapabilities(userId: string): Promise<{ capabilities: string[]; isSuperuser: boolean }> {
  const user = await User.findById(userId).populate({
    path: 'roles',
    populate: {
      path: 'groups',
      populate: {
        path: 'capabilities',
        populate: ['resource', 'action'],
      },
    },
  });

  if (!user) {
    return { capabilities: [], isSuperuser: false };
  }

  if (user.isDeleted || user.isDisabled) {
    return { capabilities: [], isSuperuser: false };
  }

  let isSuperuser = false;
  const set = new Set<string>();
  const roles = (user.roles || []) as any[];
  for (const role of roles) {
    if (role.isSuperuser) {
      isSuperuser = true;
    }
    const groups = (role.groups || []) as any[];
    for (const group of groups) {
      const caps = (group.capabilities || []) as any[];
      for (const cap of caps) {
        const resourceKey = cap.resource?.key as string | undefined;
        const actionKey = cap.action?.key as string | undefined;
        if (resourceKey && actionKey) {
          set.add(`${resourceKey}:${actionKey}`);
        }
      }
    }
  }

  return { capabilities: Array.from(set), isSuperuser };
}

export async function getUserRoles(userId: string): Promise<{ roles: string[]; isSuperuser: boolean }> {
  const user = await User.findById(userId).populate('roles');
  if (!user) return { roles: [], isSuperuser: false };
  const roles = (user.roles || []) as any[];
  return {
    roles: roles.map((r) => r.key as string),
    isSuperuser: roles.some((r) => r.isSuperuser),
  };
}

export async function hasCapability(request: FastifyRequest, capability: string): Promise<boolean> {
  const parsed = parseCapability(capability);
  if (!parsed) return false;

  const user = (request as any).user as any;
  if (!user?.id) {
    const e = await initEnforcer();
    return await e.enforce('anonymous', parsed.resource, parsed.action);
  }

  if (user.isSuperuser) return true;

  const e = await initEnforcer();
  return await e.enforce(String(user.id), parsed.resource, parsed.action);
}

export function requireCapability(
  capability: string,
  options: { allowAnonymous?: boolean; audit?: boolean } = {},
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  const { allowAnonymous = false, audit = true } = options;
  return async function rbacPreHandler(request: FastifyRequest, reply: FastifyReply) {
    const parsed = parseCapability(capability);
    if (!parsed) {
      return reply.status(500).send({ error: 'Server error. Invalid capability format.' });
    }

    const auditMeta: any = {
      action: capability,
      method: request.method,
      path: request.routeOptions?.url || request.url,
      resourceType: parsed.resource,
      resourceId: undefined,
      userId: (request.user as any)?.id,
      role: (request.user as any)?.role,
      email: (request.user as any)?.email,
      ip: getClientIp(request),
      userAgent: request.headers['user-agent'],
      allowed: false,
    };

    if (request.params) {
      const values = Object.values(request.params as Record<string, string>);
      if (values.length) {
        auditMeta.resourceId = values.join('/');
      }
    }

    (request as any).auditMeta = auditMeta;

    const user = (request as any).user as any;

    let subject: string;
    if (!user?.id) {
      if (!allowAnonymous) {
        return reply.status(401).send({ error: 'Unauthorized. Authentication is required.' });
      }
      subject = 'anonymous';
      auditMeta.userId = undefined;
      auditMeta.role = 'anonymous';
      auditMeta.email = undefined;
    } else {
      subject = String(user.id);
      if (user.isSuperuser) {
        auditMeta.allowed = true;
        auditMeta.outcome = 'allowed';
        auditMeta.role = user.role;
        return;
      }
    }

    try {
      const e = await initEnforcer();
      const allowed = await e.enforce(subject, parsed.resource, parsed.action);
      if (allowed) {
        auditMeta.allowed = true;
        auditMeta.outcome = 'allowed';
        auditMeta.role = (request.user as any)?.role;
        return;
      }
    } catch (err) {
      console.error('[RBAC] Casbin enforcement error:', err);
      auditMeta.outcome = 'error';
      if (audit) {
        await writeAuditEntry({ ...auditMeta, statusCode: 500, outcome: 'error' });
      }
      return reply.status(500).send({ error: 'Server error checking permissions.' });
    }

    auditMeta.outcome = 'denied';
    if (audit) {
      await writeAuditEntry({ ...auditMeta, statusCode: 403, outcome: 'denied' });
    }
    return reply.status(403).send({ error: 'Forbidden. You do not have permission to perform this action.' });
  };
}

export function isAdminCapability(capability: string): boolean {
  const parsed = parseCapability(capability);
  if (!parsed) return false;
  return (
    parsed.resource === 'admin' ||
    parsed.resource === 'users' ||
    parsed.resource === 'roles' ||
    parsed.resource === 'groups'
  );
}

export async function canManageTarget(actor: any, target: any): Promise<boolean> {
  if (actor?.isSuperuser) return true;
  if (!target) return false;

  // If target is already a populated Role/User document
  let targetRoles: any[] = [];
  if (target.isSuperuser) return false;

  if (target.roles && Array.isArray(target.roles)) {
    // target is a User with roles
    targetRoles = target.roles as any[];
  } else {
    // target is a role id or Role document
    const role = target.groups
      ? target
      : await Role.findById(target).populate({
          path: 'groups',
          populate: {
            path: 'capabilities',
            populate: ['resource', 'action'],
          },
        });
    if (!role) return false;
    if (role.isSuperuser) return false;
    targetRoles = [role];
  }

  for (const role of targetRoles) {
    if (role.isSuperuser) return false;
    const groups = (role.groups || []) as any[];
    for (const group of groups) {
      const caps = (group.capabilities || []) as any[];
      for (const cap of caps) {
        const resourceKey = cap.resource?.key as string | undefined;
        const actionKey = cap.action?.key as string | undefined;
        if (resourceKey === 'admin' && (actionKey === 'access' || actionKey === 'manage')) {
          return false;
        }
      }
    }
  }
  return true;
}

export async function onResponseAuditLog(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const auditMeta = (request as any).auditMeta;
  if (!auditMeta || auditMeta.outcome !== 'allowed') return;

  await writeAuditEntry({
    ...auditMeta,
    statusCode: reply.statusCode,
    outcome: reply.statusCode >= 400 ? 'error' : 'allowed',
    timestamp: new Date(),
  });
}

export { syncPolicies };
