import { FastifyRequest, FastifyReply } from 'fastify';
import { User } from '@/models/User';

export async function authenticateHook(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const userId = (request.user as any)?.id;
    if (userId) {
      const user = await User.findById(userId)
        .select('isDisabled isDeleted isLocked email')
        .populate('roles', 'isSuperuser key');
      if (!user || user.isDeleted || user.isDisabled || user.isLocked) {
        return reply.status(401).send({ error: 'Account is inactive or locked.' });
      }
      const isSuperuser = (user.roles || []).some((r: any) => r.isSuperuser);
      (request as any).user = {
        id: String(user._id),
        email: user.email,
        isSuperuser,
        role: (user.roles || []).map((r: any) => r.key).join(','),
      };
    }
  } catch (err) {
    request.log.error(err);
    return reply.status(401).send({ error: 'Unauthorized. Invalid or missing token.' });
  }
}
