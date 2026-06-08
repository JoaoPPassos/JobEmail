import { Injectable, Logger } from '@nestjs/common';
import { NodemailerService } from '../../../infrastructure/email/nodemailer.service.js';
import { JobsHttpService } from '../../../infrastructure/jobs/jobs-http.service.js';
import { JobStatusMessage, SendEmail } from '../../../domain/email/email.types.js';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly nodemailerService: NodemailerService,
    private readonly jobsHttpService: JobsHttpService,
  ) {}

  async sendEmail(payload: SendEmail): Promise<void> {
    await this.nodemailerService.send(payload);
  }

  async processJobStatusUpdate(message: JobStatusMessage): Promise<void> {
    const { jobId, status, email } = message;

    await this.nodemailerService.send({
      to: email,
      subject: `Job update: ${status}`,
      html: `<p>Your job <strong>${jobId}</strong> status changed to <strong>${status}</strong>.</p>`,
    });

    await this.jobsHttpService.updateJobMetadata(jobId, { status });

    this.logger.log(`Processed job status update for job ${jobId}`);
  }
}
