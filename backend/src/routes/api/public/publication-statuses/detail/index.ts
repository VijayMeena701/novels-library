import { FastifyInstance } from 'fastify';
import { getPublicationStatusHandler } from '@/controllers/taxonomyController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function publicPublicationStatusDetailRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: requireCapability(CAPABILITY.PUBLICATION_STATUSES_READ, { allowAnonymous: true }) },
    getPublicationStatusHandler,
  );
}
