import { FastifyRequest, FastifyReply } from 'fastify';
import mongoose from 'mongoose';
import { Notification } from '../models/Notification';

export async function getNotificationsHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { unreadOnly = 'false', page = '1', limit = '20' } = request.query as any;

  try {
    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, any> = { userId: new mongoose.Types.ObjectId(userId) };
    if (unreadOnly === 'true') {
      filter.read = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId: new mongoose.Types.ObjectId(userId), read: false }),
    ]);

    return reply.send({
      notifications,
      unreadCount,
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching notifications.' });
  }
}

export async function markNotificationReadHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { id } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reply.status(400).send({ error: 'Invalid notification ID.' });
  }

  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: new mongoose.Types.ObjectId(userId) },
      { read: true },
      { new: true },
    );
    if (!notification) {
      return reply.status(404).send({ error: 'Notification not found.' });
    }
    return reply.send({ notification });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error updating notification.' });
  }
}

export async function markAllNotificationsReadHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;

  try {
    await Notification.updateMany({ userId: new mongoose.Types.ObjectId(userId), read: false }, { read: true });
    return reply.send({ success: true });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error marking notifications as read.' });
  }
}
