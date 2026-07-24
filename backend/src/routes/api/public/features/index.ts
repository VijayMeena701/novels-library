import { FastifyInstance } from 'fastify';
import { getFeatureFlagsHandler } from '@/controllers/featuresController';

export async function publicFeaturesRoutes(fastify: FastifyInstance) {
  fastify.get('/', getFeatureFlagsHandler);
}
