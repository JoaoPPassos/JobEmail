import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserInboxEntity } from '../schemas/user-inbox.schema.js';
import { UserInbox, WatchedJob } from '../../../../domain/inbox/inbox.types.js';

@Injectable()
export class MongoUserInboxRepository {
  private readonly logger = new Logger(MongoUserInboxRepository.name);

  constructor(
    @InjectModel(UserInboxEntity.name)
    private readonly model: Model<UserInboxEntity>,
  ) {}

  async upsertCredentials(
    userId: string,
    email: string,
    encryptedPassword: string,
  ): Promise<void> {
    await this.model.findOneAndUpdate(
      { userId },
      { $set: { email, encryptedPassword } },
      { upsert: true, returnDocument: 'after' },
    );
  }

  async addJob(
    userId: string,
    job: Pick<WatchedJob, 'jobId' | 'company' | 'role'>,
  ): Promise<void> {
    const jobDoc = {
      jobId: job.jobId,
      company: job.company,
      role: job.role,
      status: 'applied',
      lastStatusChangedAt: new Date(),
    };
    const result = await this.model.findOneAndUpdate(
      { userId, 'jobs.jobId': { $ne: job.jobId } },
      { $push: { jobs: jobDoc } },
    );
    if (!result) {
      this.logger.warn(
        `[addJob] No document updated — userId=${userId} jobId=${job.jobId} may not exist or already present`,
      );
    }
  }

  async updateJobStatus(
    userId: string,
    jobId: string,
    status: string,
  ): Promise<void> {
    await this.model.updateOne(
      { userId, 'jobs.jobId': jobId },
      {
        $set: {
          'jobs.$.status': status,
          'jobs.$.lastStatusChangedAt': new Date(),
        },
      },
    );
  }

  async findStaleActiveJobs(
    olderThan: Date,
    conclusiveStatuses: string[],
  ): Promise<Array<{ userId: string; jobId: string }>> {
    const docs = await this.model
      .find({
        jobs: {
          $elemMatch: {
            status: { $nin: conclusiveStatuses },
            lastStatusChangedAt: { $exists: true, $lt: olderThan },
          },
        },
      })
      .lean<UserInboxEntity[]>();

    const result: Array<{ userId: string; jobId: string }> = [];
    for (const doc of docs) {
      for (const job of doc.jobs as Array<{
        jobId: string;
        status: string;
        lastStatusChangedAt?: Date;
      }>) {
        if (
          !conclusiveStatuses.includes(job.status) &&
          job.lastStatusChangedAt &&
          job.lastStatusChangedAt < olderThan
        ) {
          result.push({ userId: doc.userId, jobId: job.jobId });
        }
      }
    }
    return result;
  }

  async findAllWithCredentials(): Promise<UserInbox[]> {
    return this.model
      .find({ email: { $exists: true }, encryptedPassword: { $exists: true } })
      .lean<UserInbox[]>();
  }
}
