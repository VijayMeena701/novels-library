import { FastifyRequest } from 'fastify';
import { User } from '../models/User.js';

function getAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function isAdminRequest(request: FastifyRequest): Promise<boolean> {
  const tokenUser = request.user as any;
  if (tokenUser?.isSuperuser || tokenUser?.role?.includes('admin')) {
    return true;
  }

  const userId = tokenUser?.id;
  if (!userId) {
    return false;
  }

  const user = await User.findById(userId).select('email roles').populate('roles', 'key isSuperuser');
  if (!user) {
    return false;
  }

  const isAdmin = (user.roles || []).some((r: any) => r.isSuperuser || r.key === 'admin');
  return isAdmin || getAdminEmails().has(user.email.toLowerCase());
}
