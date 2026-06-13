import { FastifyRequest } from 'fastify';
import { User } from '../models/User.js';

function getAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function isAdminRequest(request: FastifyRequest): Promise<boolean> {
  const tokenUser = request.user as any;
  if (tokenUser?.role === 'admin') {
    return true;
  }

  const userId = tokenUser?.id;
  if (!userId) {
    return false;
  }

  const user = await User.findById(userId).select('email role');
  if (!user) {
    return false;
  }

  return user.role === 'admin' || getAdminEmails().has(user.email.toLowerCase());
}
