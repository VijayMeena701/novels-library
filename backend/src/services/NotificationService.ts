import { notificationQueue, type NotificationJobData } from './notificationQueue.js';
import { EmailService } from './email.js';

export class NotificationService {
  static async enqueueJob(data: NotificationJobData): Promise<string | undefined> {
    if (notificationQueue) {
      const job = await notificationQueue.add(data.type, data);
      return job.id;
    }

    if (data.type === 'jobFailure') {
      await EmailService.sendJobFailureAlert(
        data.jobId || 'unknown',
        data.bookTitle || '',
        data.jobType || '',
        data.errorMessage || '',
        data.stackTrace,
      );
    } else if (data.type === 'email') {
      await EmailService.sendEmail({
        to: data.to || '',
        subject: data.subject || '',
        text: data.text,
        html: data.html,
      });
    }
    return undefined;
  }

  static async sendEmail(args: { to: string; subject: string; text?: string; html?: string }): Promise<boolean> {
    if (notificationQueue) {
      await notificationQueue.add('email', { type: 'email', ...args });
      return true;
    }
    return EmailService.sendEmail(args);
  }

  static async sendJobFailureAlert(
    jobId: string,
    bookTitle: string,
    jobType: string,
    errorMessage: string,
    stackTrace?: string,
  ): Promise<boolean> {
    if (notificationQueue) {
      await notificationQueue.add('jobFailure', {
        type: 'jobFailure',
        jobId,
        bookTitle,
        jobType,
        errorMessage,
        stackTrace,
      });
      return true;
    }
    return EmailService.sendJobFailureAlert(jobId, bookTitle, jobType, errorMessage, stackTrace);
  }
}
