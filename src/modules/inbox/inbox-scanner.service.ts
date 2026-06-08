import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ImapInboxService } from '../../infrastructure/inbox/services/imap-inbox.service.js';
import { EmailKeywordClassifier } from '../../infrastructure/inbox/services/email-keyword-classifier.service.js';
import { EncryptionService } from '../../infrastructure/inbox/services/encryption.service.js';
import { MongoUserInboxRepository } from '../../infrastructure/inbox/mongo/repositories/mongo-user-inbox.repository.js';
import { MongoProcessedEmailRepository } from '../../infrastructure/inbox/mongo/repositories/mongo-processed-email.repository.js';
import { JobsHttpService } from '../../infrastructure/jobs/jobs-http.service.js';
import { UserInbox, WatchedJob } from '../../domain/inbox/inbox.types.js';
import { ApplicationStatus } from '../../domain/email/application-status.enum.js';

const CONCLUSIVE_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.rejected,
  ApplicationStatus.offer,
  ApplicationStatus.withdrawn,
  ApplicationStatus.no_response,
];

@Injectable()
export class InboxScannerService {
  private readonly logger = new Logger(InboxScannerService.name);
  private readonly lookbackMinutes: number;

  constructor(
    private readonly imapService: ImapInboxService,
    private readonly classifier: EmailKeywordClassifier,
    private readonly userInboxRepo: MongoUserInboxRepository,
    private readonly processedEmailRepo: MongoProcessedEmailRepository,
    private readonly encryptionService: EncryptionService,
    private readonly jobsHttpService: JobsHttpService,
    private readonly configService: ConfigService,
  ) {
    this.lookbackMinutes = this.configService.get<number>(
      'INBOX_LOOKBACK_MINUTES',
      15,
    );
  }

  @Cron(process.env.INBOX_SCAN_CRON ?? '*/5 * * * *')
  async scanInbox(): Promise<void> {
    this.logger.log('─── Inbox scan started ───');

    const users = await this.userInboxRepo.findAllWithCredentials();
    if (!users.length) {
      this.logger.warn(
        'No users with credentials in MongoDB — nothing to scan',
      );
      return;
    }

    for (const user of users) {
      await this.scanUserInbox(user);
    }

    this.logger.log('─── Inbox scan finished ───');
  }

  @Cron('0 0 * * *')
  async checkStaleJobs(): Promise<void> {
    this.logger.log('─── Stale job check started ───');
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const staleJobs = await this.userInboxRepo.findStaleActiveJobs(
      twoWeeksAgo,
      CONCLUSIVE_STATUSES,
    );

    if (!staleJobs.length) return;

    this.logger.log(
      `Found ${staleJobs.length} stale job(s) — marking as no_response`,
    );
    for (const { userId, jobId } of staleJobs) {
      await this.userInboxRepo.updateJobStatus(
        userId,
        jobId,
        ApplicationStatus.no_response,
      );
      try {
        await this.jobsHttpService.updateJobMetadata(jobId, {
          status: ApplicationStatus.no_response,
        });
      } catch {
        this.logger.error(`[stale] Failed jobs API update — jobId=${jobId}`);
      }
      this.logger.log(`[stale] userId=${userId} jobId=${jobId} → no_response`);
    }
  }

  private async scanUserInbox(user: UserInbox): Promise<void> {
    const activeJobs = user.jobs.filter(
      (j) => !CONCLUSIVE_STATUSES.includes(j.status),
    );
    if (!activeJobs.length) {
      this.logger.log(
        `[user=${user.userId}] All jobs are conclusive — skipping`,
      );
      return;
    }

    let password: string;
    try {
      password = this.encryptionService.decrypt(user.encryptedPassword);
    } catch {
      this.logger.error(
        `[user=${user.userId}] Failed to decrypt password — skipping`,
      );
      return;
    }

    let emails: Awaited<ReturnType<typeof this.imapService.fetchRecentEmails>>;
    try {
      emails = await this.imapService.fetchRecentEmails(
        user.email,
        password,
        this.lookbackMinutes,
      );
      this.logger.log(
        `[user=${user.userId}] Fetched ${emails.length} email(s) from inbox`,
      );
    } catch (err) {
      this.logger.error(`[user=${user.userId}] IMAP fetch failed`, err);
      return;
    }

    const processedUids = await this.processedEmailRepo.loadProcessedUids(
      user.userId,
    );

    let updated = 0;
    let skippedAlreadyDone = 0;
    let skippedNoKeyword = 0;
    let skippedNoJobMatch = 0;

    for (const email of emails) {
      const uid = `${user.userId}:INBOX:${email.uid}`;

      if (processedUids.has(uid)) {
        skippedAlreadyDone++;
        continue;
      }

      const status = this.classifier.classify(email.subject, email.body);

      if (!status) {
        skippedNoKeyword++;
        await this.processedEmailRepo.markProcessed(uid, {
          from: email.from,
          subject: email.subject,
          status: null,
          matchedJobId: null,
          reason: 'no_keyword',
        });
        processedUids.add(uid);
        continue;
      }

      const matchedJob = this.findMatchingJob(
        email.subject,
        email.body,
        email.from,
        activeJobs,
      );

      if (!matchedJob) {
        this.logger.warn(
          `[user=${user.userId}] No job matched UID=${email.uid} from="${email.from}" subject="${email.subject}" — active: [${activeJobs.map((j) => `${j.company}/${j.role}`).join(', ')}]`,
        );
        skippedNoJobMatch++;
        await this.processedEmailRepo.markProcessed(uid, {
          from: email.from,
          subject: email.subject,
          status,
          matchedJobId: null,
          reason: 'no_job_match',
        });
        processedUids.add(uid);
        continue;
      }

      this.logger.log(
        `[user=${user.userId}] Match — jobId=${matchedJob.jobId} company="${matchedJob.company}" role="${matchedJob.role}" → status="${status}"`,
      );
      await this.jobsHttpService.updateJobMetadata(matchedJob.jobId, {
        status,
      });
      await this.userInboxRepo.updateJobStatus(
        user.userId,
        matchedJob.jobId,
        status,
      );
      await this.processedEmailRepo.markProcessed(uid, {
        from: email.from,
        subject: email.subject,
        status,
        matchedJobId: matchedJob.jobId,
        reason: 'updated',
      });
      processedUids.add(uid);
      updated++;
    }

    this.logger.log(
      `[user=${user.userId}] Done — updated=${updated} alreadyProcessed=${skippedAlreadyDone} noKeyword=${skippedNoKeyword} noJobMatch=${skippedNoJobMatch}`,
    );
  }

  private findMatchingJob(
    subject: string,
    body: string,
    from: string,
    jobs: WatchedJob[],
  ): WatchedJob | null {
    const text = `${subject} ${body} ${from}`.toLowerCase();
    return (
      jobs.find(
        (job) =>
          text.includes(job.company.toLowerCase()) &&
          text.includes(job.role.toLowerCase()),
      ) ?? null
    );
  }
}
