import { FastifyRequest, FastifyReply } from 'fastify';
import mongoose from 'mongoose';
import { BackgroundJob } from '../models/BackgroundJob.js';
import { Novel } from '../models/Novel.js';
import { UserNovel } from '../models/UserNovel.js';
import { isAdminRequest } from '../services/permissions.js';

const VALID_JOB_TYPES = new Set(['scrape_metadata', 'scrape_chapters', 'scrape_raw_metadata', 'scrape_raw_chapters']);

export async function listJobsHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  try {
    const jobs = await BackgroundJob.find({ userId }).sort({ createdAt: -1 });
    return reply.send(jobs);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error listing background jobs.' });
  }
}

export async function getJobsForNovelHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { novelId } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(novelId)) {
    return reply.status(400).send({ error: 'Invalid novel ID.' });
  }

  try {
    const jobs = await BackgroundJob.find({ novelId, userId }).sort({ createdAt: -1 });
    return reply.send(jobs);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error fetching novel background jobs.' });
  }
}

export async function retryJobHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { jobId } = request.params as any;

  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    return reply.status(400).send({ error: 'Invalid job ID.' });
  }

  try {
    const job = await BackgroundJob.findOneAndUpdate(
      { _id: jobId, userId, status: 'failed' },
      { 
        status: 'pending',
        retryCount: 0,
        error: undefined,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!job) {
      return reply.status(404).send({ error: 'Job not found, not failed, or unauthorized.' });
    }

    return reply.send({ success: true, message: 'Job status reset to pending. The worker will pick it up shortly.', job });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error retrying job.' });
  }
}

export async function triggerScrapeHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as any).id;
  const { novelId } = request.params as any;
  const { type } = request.body as any;

  if (!mongoose.Types.ObjectId.isValid(novelId)) {
    return reply.status(400).send({ error: 'Invalid novel ID.' });
  }

  if (!VALID_JOB_TYPES.has(type)) {
    return reply.status(400).send({ error: 'Invalid scrape job type.' });
  }

  try {
    const novel = await Novel.findById(novelId);
    if (!novel) {
      return reply.status(404).send({ error: 'Novel not found.' });
    }
    const isAdmin = await isAdminRequest(request);
    const linkedToUser = await UserNovel.exists({ novelId, userId });
    const addedByUser = novel.addedByUserId?.toString() === userId || novel.userId?.toString() === userId;
    if (!isAdmin && !linkedToUser && !addedByUser) {
      return reply.status(404).send({ error: 'Novel not found.' });
    }
    if ((type === 'scrape_raw_metadata' || type === 'scrape_raw_chapters') && !isAdmin) {
      return reply.status(403).send({ error: 'Admin access is required to scrape raw source content.' });
    }
    if ((type === 'scrape_raw_metadata' || type === 'scrape_raw_chapters') && !novel.rawSourceUrl) {
      return reply.status(400).send({ error: 'Add a raw source URL before triggering raw scraping.' });
    }
    if (type === 'scrape_raw_chapters' && (!novel.rawChaptersList || novel.rawChaptersList.length === 0)) {
      return reply.status(400).send({ error: 'Run raw metadata scraping before archiving raw chapters.' });
    }

    // Check if there is already an active job (pending or processing) of this type
    const activeJob = await BackgroundJob.findOne({
      novelId,
      userId,
      type,
      status: { $in: ['pending', 'processing'] }
    });

    if (activeJob) {
      return reply.status(400).send({ error: `An active ${type} job is already running for this novel.` });
    }

    // Create new pending job
    const job = await BackgroundJob.create({
      novelId,
      userId,
      type,
      status: 'pending',
    });

    return reply.status(201).send({ success: true, message: 'Job successfully queued.', job });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Server error triggering job.' });
  }
}
