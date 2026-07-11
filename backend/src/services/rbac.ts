import { FastifyRequest, FastifyReply } from 'fastify';
import { Role, IRole } from '../models/Role.js';
import { Capability, ICapability } from '../models/Capability.js';
import { AuditLog } from '../models/AuditLog.js';

export const CAPABILITY = {
  AUTH_SELF: 'auth.self',

  PUBLIC_CATALOG_READ: 'public.catalog.read',
  PUBLIC_READ: 'public.read',

  SETTINGS_READ: 'settings.read',
  SETTINGS_UPDATE: 'settings.update',

  LIBRARY_READ: 'library.read',
  LIBRARY_ADD: 'library.add',
  LIBRARY_UPDATE: 'library.update',
  LIBRARY_DELETE: 'library.delete',

  CATALOG_MANAGE: 'catalog.manage',
  CATALOG_DELETE: 'catalog.delete',
  COVER_SYNC: 'cover.sync',

  CHAPTER_READ: 'chapter.read',
  CHAPTER_READ_RAW: 'chapter.read_raw',
  CHAPTER_TRANSLATE: 'chapter.translate',
  CHAPTER_VISIT: 'chapter.visit',

  SESSION_READ: 'session.read',
  SESSION_MANAGE: 'session.manage',

  PRONUNCIATION_READ: 'pronunciation.read',
  PRONUNCIATION_MANAGE: 'pronunciation.manage',

  AUTHOR_READ: 'author.read',
  AUTHOR_MANAGE: 'author.manage',

  GENRE_READ: 'genre.read',
  GENRE_MANAGE: 'genre.manage',

  PUBLICATION_STATUS_READ: 'publication_status.read',
  PUBLICATION_STATUS_MANAGE: 'publication_status.manage',

  JOB_READ: 'job.read',
  JOB_RETRY: 'job.retry',
  JOB_MANUAL_INTERVENTION: 'job.manual_intervention',
  JOB_IMPORT: 'job.import',
  JOB_SCRAPE: 'job.scrape',

  RBAC_MANAGE: 'rbac.manage',
} as const;

export const CAPABILITY_DEFINITIONS: Array<Pick<ICapability, 'key' | 'name' | 'description' | 'category'>> = [
  { key: CAPABILITY.AUTH_SELF, name: 'View own profile', description: 'Allows reading the authenticated user profile.', category: 'auth' },
  { key: CAPABILITY.PUBLIC_READ, name: 'Public read', description: 'Allows anonymous/public browsing of the catalog.', category: 'public' },
  { key: CAPABILITY.PUBLIC_CATALOG_READ, name: 'Public catalog read', description: 'Allows reading public catalog novels and chapters.', category: 'public' },
  { key: CAPABILITY.SETTINGS_READ, name: 'Read settings', description: 'Allows reading user settings.', category: 'user' },
  { key: CAPABILITY.SETTINGS_UPDATE, name: 'Update settings', description: 'Allows updating user settings.', category: 'user' },
  { key: CAPABILITY.LIBRARY_READ, name: 'Read library', description: 'Allows reading personal library entries.', category: 'library' },
  { key: CAPABILITY.LIBRARY_ADD, name: 'Add to library', description: 'Allows adding a catalog novel to the personal library.', category: 'library' },
  { key: CAPABILITY.LIBRARY_UPDATE, name: 'Update library', description: 'Allows updating personal reading data.', category: 'library' },
  { key: CAPABILITY.LIBRARY_DELETE, name: 'Remove from library', description: 'Allows removing a novel from the personal library.', category: 'library' },
  { key: CAPABILITY.CATALOG_MANAGE, name: 'Manage catalog', description: 'Allows creating, updating, and importing catalog novels and metadata.', category: 'catalog' },
  { key: CAPABILITY.CATALOG_DELETE, name: 'Delete catalog', description: 'Allows deleting catalog novels and related data.', category: 'catalog' },
  { key: CAPABILITY.COVER_SYNC, name: 'Sync cover', description: 'Allows syncing and caching cover images.', category: 'catalog' },
  { key: CAPABILITY.CHAPTER_READ, name: 'Read chapters', description: 'Allows reading archived chapters in the personal library.', category: 'chapters' },
  { key: CAPABILITY.CHAPTER_READ_RAW, name: 'Read raw chapters', description: 'Allows reading archived raw chapters in the personal library.', category: 'chapters' },
  { key: CAPABILITY.CHAPTER_TRANSLATE, name: 'Translate chapter', description: 'Allows translating raw chapters into translated chapters.', category: 'chapters' },
  { key: CAPABILITY.CHAPTER_VISIT, name: 'Record chapter visit', description: 'Allows recording chapter open/visit events.', category: 'chapters' },
  { key: CAPABILITY.SESSION_READ, name: 'Read re-read sessions', description: 'Allows reading re-reading sessions.', category: 'sessions' },
  { key: CAPABILITY.SESSION_MANAGE, name: 'Manage re-read sessions', description: 'Allows creating and updating re-reading sessions.', category: 'sessions' },
  { key: CAPABILITY.PRONUNCIATION_READ, name: 'Read pronunciation rules', description: 'Allows reading TTS pronunciation rules.', category: 'tts' },
  { key: CAPABILITY.PRONUNCIATION_MANAGE, name: 'Manage pronunciation rules', description: 'Allows creating, updating, and deleting TTS pronunciation rules.', category: 'tts' },
  { key: CAPABILITY.AUTHOR_READ, name: 'Read authors', description: 'Allows reading author records.', category: 'taxonomy' },
  { key: CAPABILITY.AUTHOR_MANAGE, name: 'Manage authors', description: 'Allows creating and updating author records.', category: 'taxonomy' },
  { key: CAPABILITY.GENRE_READ, name: 'Read genres', description: 'Allows reading genre records.', category: 'taxonomy' },
  { key: CAPABILITY.GENRE_MANAGE, name: 'Manage genres', description: 'Allows creating and updating genre records.', category: 'taxonomy' },
  { key: CAPABILITY.PUBLICATION_STATUS_READ, name: 'Read publication statuses', description: 'Allows reading publication status records.', category: 'taxonomy' },
  { key: CAPABILITY.PUBLICATION_STATUS_MANAGE, name: 'Manage publication statuses', description: 'Allows creating and updating publication status records.', category: 'taxonomy' },
  { key: CAPABILITY.JOB_READ, name: 'Read jobs', description: 'Allows reading background jobs and scraper status.', category: 'jobs' },
  { key: CAPABILITY.JOB_RETRY, name: 'Retry jobs', description: 'Allows retrying failed jobs.', category: 'jobs' },
  { key: CAPABILITY.JOB_MANUAL_INTERVENTION, name: 'Manual job intervention', description: 'Allows opening a manual browser for a job.', category: 'jobs' },
  { key: CAPABILITY.JOB_IMPORT, name: 'Import job HTML', description: 'Allows importing chapter and index HTML for jobs.', category: 'jobs' },
  { key: CAPABILITY.JOB_SCRAPE, name: 'Scrape now', description: 'Allows running/triggering scraper jobs.', category: 'jobs' },
  { key: CAPABILITY.RBAC_MANAGE, name: 'Manage RBAC', description: 'Allows managing roles and capabilities (super admin).', category: 'rbac' },
];

export const SYSTEM_ROLES: Record<string, Partial<IRole>> = {
  anonymous: {
    key: 'anonymous',
    name: 'Anonymous',
    description: 'Unauthenticated public visitors.',
    isSystem: true,
  },
  user: {
    key: 'user',
    name: 'User',
    description: 'Standard authenticated user.',
    isSystem: true,
  },
  admin: {
    key: 'admin',
    name: 'Administrator',
    description: 'Full system access.',
    isSystem: true,
    isSuperuser: true,
  },
};

async function getRole(roleKey: string): Promise<IRole | null> {
  return Role.findOne({ key: roleKey });
}

export async function getRoleCapabilities(roleKey: string): Promise<string[]> {
  const role = await getRole(roleKey);
  return role?.capabilities || [];
}

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

export async function hasCapability(request: FastifyRequest, capability: string): Promise<boolean> {
  const roleKey = (request.user as any)?.role || 'anonymous';
  const role = (await getRole(roleKey)) || (await getRole('anonymous'));
  if (!role) return false;
  const capabilities = new Set(role.capabilities || []);
  return role.isSuperuser || capabilities.has(capability) || capabilities.has(CAPABILITY.RBAC_MANAGE);
}

export function requireCapability(
  capability: string,
  options: { allowAnonymous?: boolean; audit?: boolean } = {}
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  const { allowAnonymous = false, audit = true } = options;
  return async function rbacPreHandler(request: FastifyRequest, reply: FastifyReply) {
    const auditMeta: any = {
      action: capability,
      method: request.method,
      path: request.routerPath || request.url,
      resourceType: undefined,
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

    let roleKey: string;
    if (!(request.user as any)?.id) {
      if (!allowAnonymous) {
        return reply.status(401).send({ error: 'Unauthorized. Authentication is required.' });
      }
      roleKey = 'anonymous';
      auditMeta.userId = undefined;
      auditMeta.role = 'anonymous';
      auditMeta.email = undefined;
    } else {
      roleKey = (request.user as any).role || 'anonymous';
    }

    const role = await getRole(roleKey);
    if (!role) {
      auditMeta.outcome = 'denied';
      if (audit) {
        await writeAuditEntry({ ...auditMeta, outcome: 'denied', statusCode: 403 });
      }
      return reply.status(403).send({ error: 'Forbidden. Role configuration not found.' });
    }

    if (roleKey === 'anonymous' && allowAnonymous) {
      auditMeta.allowed = true;
      auditMeta.role = 'anonymous';
      auditMeta.outcome = 'allowed';
      return;
    }

    const capabilities = new Set(role.capabilities || []);
    if (role.isSuperuser || capabilities.has(capability) || capabilities.has(CAPABILITY.RBAC_MANAGE)) {
      (request.user as any) = {
        ...(request.user as any),
        role: role.key,
        capabilities: Array.from(capabilities),
      };
      auditMeta.allowed = true;
      auditMeta.role = role.key;
      auditMeta.outcome = 'allowed';
      return;
    }

    auditMeta.outcome = 'denied';
    if (audit) {
      await writeAuditEntry({ ...auditMeta, outcome: 'denied', statusCode: 403 });
    }
    return reply.status(403).send({ error: 'Forbidden. You do not have permission to perform this action.' });
  };
}

export async function ensureRolesAndCapabilities(): Promise<void> {
  for (const def of CAPABILITY_DEFINITIONS) {
    await Capability.findOneAndUpdate(
      { key: def.key },
      { $set: { name: def.name, description: def.description, category: def.category } },
      { upsert: true, new: true }
    );
  }

  const allCapabilityKeys = CAPABILITY_DEFINITIONS.map((c) => c.key);

  const userCapabilities = [
    CAPABILITY.AUTH_SELF,
    CAPABILITY.PUBLIC_CATALOG_READ,
    CAPABILITY.SETTINGS_READ,
    CAPABILITY.SETTINGS_UPDATE,
    CAPABILITY.LIBRARY_READ,
    CAPABILITY.LIBRARY_ADD,
    CAPABILITY.LIBRARY_UPDATE,
    CAPABILITY.LIBRARY_DELETE,
    CAPABILITY.CHAPTER_READ,
    CAPABILITY.CHAPTER_READ_RAW,
    CAPABILITY.CHAPTER_VISIT,
    CAPABILITY.SESSION_READ,
    CAPABILITY.SESSION_MANAGE,
    CAPABILITY.PRONUNCIATION_READ,
    CAPABILITY.PRONUNCIATION_MANAGE,
    CAPABILITY.AUTHOR_READ,
    CAPABILITY.GENRE_READ,
    CAPABILITY.PUBLICATION_STATUS_READ,
  ];

  const anonymousCapabilities = [CAPABILITY.PUBLIC_CATALOG_READ];

  const roleUpdates: Record<string, Partial<IRole>> = {
    anonymous: {
      ...SYSTEM_ROLES.anonymous,
      capabilities: anonymousCapabilities,
    },
    user: {
      ...SYSTEM_ROLES.user,
      capabilities: userCapabilities,
    },
    admin: {
      ...SYSTEM_ROLES.admin,
      capabilities: allCapabilityKeys,
    },
  };

  for (const [key, update] of Object.entries(roleUpdates)) {
    await Role.findOneAndUpdate(
      { key },
      { $set: update },
      { upsert: true, new: true }
    );
  }

  console.log('[RBAC] Default roles and capabilities ensured.');
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
