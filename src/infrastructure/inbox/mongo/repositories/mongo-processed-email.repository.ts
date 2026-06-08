import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProcessedEmailEntity, ProcessedEmailReason } from '../schemas/processed-email.schema.js';

export type MarkProcessedData = {
  from: string;
  subject: string;
  status: string | null;
  matchedJobId: string | null;
  reason: ProcessedEmailReason;
};

@Injectable()
export class MongoProcessedEmailRepository {
  private readonly logger = new Logger(MongoProcessedEmailRepository.name);

  constructor(
    @InjectModel(ProcessedEmailEntity.name)
    private readonly model: Model<ProcessedEmailEntity>,
  ) {}

  async loadProcessedUids(userId: string): Promise<Set<string>> {
    this.logger.log(`[loadProcessedUids] Loading cache for userId=${userId}`);
    const docs = await this.model
      .find({ uid: { $regex: `^${userId}:` } })
      .select({ uid: 1, _id: 0 })
      .lean<{ uid: string }[]>();
    const set = new Set(docs.map((d) => d.uid));
    this.logger.log(`[loadProcessedUids] Loaded ${set.size} processed UID(s) for userId=${userId}`);
    return set;
  }

  async markProcessed(uid: string, data: MarkProcessedData): Promise<void> {
    this.logger.log(`[markProcessed] uid=${uid} reason=${data.reason} status=${data.status ?? 'none'} matchedJobId=${data.matchedJobId ?? 'none'}`);
    await this.model.findOneAndUpdate(
      { uid },
      { uid, processedAt: new Date(), ...data },
      { upsert: true },
    );
  }
}
