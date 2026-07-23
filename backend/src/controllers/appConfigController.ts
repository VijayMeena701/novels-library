import { FastifyRequest, FastifyReply } from 'fastify';
import { AppConfig } from '../models/AppConfig';

export async function getAppConfigByNameHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { name } = request.params as { name: string };
    const config = await AppConfig.findOne({ name }).lean();

    if (!config) {
      return reply.status(404).send({ error: 'Configuration not found.' });
    }

    return reply.send(config);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching configuration.' });
  }
}

export async function listAppConfigsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const configs = await AppConfig.find().sort({ name: 1 }).lean();
    return reply.send({ configs });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing configurations.' });
  }
}

export async function updateAppConfigHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { name } = request.params as { name: string };
    const body = request.body as { value?: unknown; description?: string };
    const { value, description } = body || {};

    if (value === undefined && description === undefined) {
      return reply.status(400).send({ error: 'No fields provided to update.' });
    }

    const update: { value?: unknown; description?: string } = {};
    if (value !== undefined) update.value = value;
    if (description !== undefined) update.description = description;

    const config = await AppConfig.findOneAndUpdate(
      { name },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();

    return reply.send(config);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error updating configuration.' });
  }
}
