import { FastifyInstance } from 'fastify';
import {
  listPublicationStatusesHandler,
  upsertPublicationStatusHandler,
  getPublicationStatusHandler,
} from '@/controllers/taxonomyController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedPublicationStatusRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: requireCapability(CAPABILITY.PUBLICATION_STATUSES_READ) },
    listPublicationStatusesHandler,
  );
  fastify.post(
    '/',
    { preHandler: requireCapability(CAPABILITY.PUBLICATION_STATUSES_MANAGE) },
    upsertPublicationStatusHandler,
  );
  fastify.get(
    '/:keyOrId',
    { preHandler: requireCapability(CAPABILITY.PUBLICATION_STATUSES_READ) },
    getPublicationStatusHandler,
  );
  fastify.put(
    '/:id',
    { preHandler: requireCapability(CAPABILITY.PUBLICATION_STATUSES_MANAGE) },
    upsertPublicationStatusHandler,
  );
}
