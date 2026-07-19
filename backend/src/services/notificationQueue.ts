import { Queue, Worker } from 'bullmq';
import { redisClient, redisUrl } from '../config/redis';
import { EmailService } from './email';

export type NotificationJobType = 'email' | 'jobFailure';

export interface NotificationJobData {
  type: NotificationJobType;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  jobId?: string;
  bookTitle?: string;
  jobType?: string;
  errorMessage?: string;
  stackTrace?: string;
}

export const notificationQueue: Queue<NotificationJobData, any, string> | null = redisClient
  ? new Queue<NotificationJobData, any, string>('notifications', {
      connection: { url: redisUrl },
      defaultJobOptions: { removeOnComplete: 100, removeOnFail: 50 },
    })
  : null;
let notificationWorker: Worker<NotificationJobData, any, string> | null = null;

if (redisClient) {
  const connection = { url: redisUrl };

  notificationWorker = new Worker<NotificationJobData, any, string>(
    'notifications',
    async (job) => {
      const data = job.data;
      if (data.type === 'jobFailure') {
        return EmailService.sendJobFailureAlert(
          data.jobId || job.id || 'unknown',
          data.bookTitle || '',
          data.jobType || '',
          data.errorMessage || '',
          data.stackTrace,
        );
      }
      if (data.type === 'email') {
        return EmailService.sendEmail({
          to: data.to || '',
          subject: data.subject || '',
          text: data.text,
          html: data.html,
        });
      }
      console.warn('[NotificationWorker] Unknown notification type:', data.type);
      return false;
    },
    { connection },
  );

  notificationWorker.on('failed', (job, err) => {
    console.error(`[NotificationWorker] Job ${job?.id} failed:`, err);
  });
}

export async function stopNotificationWorker(): Promise<void> {
  if (notificationWorker) {
    await notificationWorker.close();
    notificationWorker = null;
  }
  if (notificationQueue) {
    await notificationQueue.close();
  }
}
