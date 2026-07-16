import { FastifyInstance } from 'fastify';
import {
  getPublicationStatusHandler,
  upsertPublicationStatusHandler,
} from '@/controllers/taxonomyController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedPublicationStatusDetailRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireCapability(CAPABILITY.PUBLICATION_STATUSES_READ) }, getPublicationStatusHandler);
  fastify.put('/', { preHandler: requireCapability(CAPABILITY.PUBLICATION_STATUSES_MANAGE) }, upsertPublicationStatusHandler);
}
