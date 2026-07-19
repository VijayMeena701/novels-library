import { FastifyInstance } from 'fastify';
import { listPublicationStatusesHandler } from '@/controllers/taxonomyController';
import { CAPABILITY, requireCapability } from '@/services/rbac';
import { publicPublicationStatusDetailRoutes } from './detail';

export async function publicPublicationStatusRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: requireCapability(CAPABILITY.PUBLICATION_STATUSES_READ, { allowAnonymous: true }) },
    listPublicationStatusesHandler,
  );

  fastify.register(publicPublicationStatusDetailRoutes, { prefix: '/:keyOrId' });
}
