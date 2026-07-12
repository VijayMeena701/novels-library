import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || '"Book Library Alert" <noreply@books.local>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

export class EmailService {
  private static transporter = (SMTP_HOST && SMTP_USER && SMTP_PASS)
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      })
    : null;

  /**
   * Sends an alert email to the admin or user when a background task fails
   */
  static async sendJobFailureAlert(
    jobId: string,
    bookTitle: string,
    jobType: string,
    errorMessage: string,
    stackTrace?: string
  ): Promise<boolean> {
    const subject = `[Alert] Book Scraper Job Failed: ${bookTitle}`;
    const textContent = `
Book Scraper Job Alert
----------------------
Job ID: ${jobId}
Book: ${bookTitle}
Task Type: ${jobType}
Error Message: ${errorMessage}

Timestamp: ${new Date().toISOString()}

Stack Trace:
${stackTrace || 'No stack trace available.'}

Please review the Scraper Logs in the dashboard to retry the job.
`;

    const htmlContent = `
      <div style="font-family: sans-serif; padding: 20px; color: #333; border: 1px solid #e0e0e0; border-radius: 8px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d32f2f; margin-top: 0;">Book Scraper Job Alert</h2>
        <hr style="border: 0; border-top: 1px solid #eee; margin-bottom: 20px;"/>
        <p>A background scraping job has failed. Details are listed below:</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="background-color: #f9f9f9;">
            <td style="padding: 8px; font-weight: bold; border: 1px solid #ddd; width: 120px;">Job ID</td>
            <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;">${jobId}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; border: 1px solid #ddd;">Book</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${bookTitle}</td>
          </tr>
          <tr style="background-color: #f9f9f9;">
            <td style="padding: 8px; font-weight: bold; border: 1px solid #ddd;">Task Type</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-transform: uppercase;">${jobType}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; border: 1px solid #ddd;">Error</td>
            <td style="padding: 8px; border: 1px solid #ddd; color: #d32f2f; font-weight: bold;">${errorMessage}</td>
          </tr>
        </table>
        
        ${stackTrace ? `
          <h4 style="margin-bottom: 8px;">Stack Trace:</h4>
          <pre style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px; font-family: monospace;">${stackTrace}</pre>
        ` : ''}
        
        <p style="margin-top: 20px; font-size: 13px; color: #666;">
          This is an automated system notification. Log into the Books Library to retry or adjust scraping settings.
        </p>
      </div>
    `;

    console.log(`[Email Service Notification Alert]`);
    console.log(`To: ${ADMIN_EMAIL || 'Console/Logs Output'}`);
    console.log(`Subject: ${subject}`);
    console.log(`Error message: ${errorMessage}`);

    if (!this.transporter || !ADMIN_EMAIL) {
      console.log('SMTP configuration or ADMIN_EMAIL is missing. Email skipped (logged to console).');
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: SMTP_FROM,
        to: ADMIN_EMAIL,
        subject: subject,
        text: textContent,
        html: htmlContent,
      });
      console.log(`Alert email successfully sent to ${ADMIN_EMAIL}`);
      return true;
    } catch (err) {
      console.error('Failed to send failure alert email:', err);
      return false;
    }
  }

  static async sendEmail({
    to,
    subject,
    text,
    html,
  }: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<boolean> {
    if (!this.transporter || !to) {
      console.log('SMTP configuration or recipient is missing. Email skipped (logged to console).');
      console.log(`To: ${to}, Subject: ${subject}`);
      console.log(`Text: ${text || ''}`);
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: SMTP_FROM,
        to,
        subject,
        text,
        html,
      });
      console.log(`Email successfully sent to ${to}`);
      return true;
    } catch (err) {
      console.error('Failed to send email:', err);
      return false;
    }
  }
}
