import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ProcessedEmailEntity,
  ProcessedEmailReason,
} from '../schemas/processed-email.schema.js';

export type MarkProcessedData = {
  from: string;
  subject: string;
  status: string | null;
  matchedJobId: string | null;
  reason: ProcessedEmailReason;
};

@Injectable()
export class MongoProcessedEmailRepository {
  constructor(
    @InjectModel(ProcessedEmailEntity.name)
    private readonly model: Model<ProcessedEmailEntity>,
  ) {}

  async loadProcessedUids(userId: string): Promise<Set<string>> {
    const docs = await this.model
      .find({ uid: { $regex: `^${userId}:` } })
      .select({ uid: 1, _id: 0 })
      .lean<{ uid: string }[]>();
    return new Set(docs.map((d) => d.uid));
  }

  async markProcessed(uid: string, data: MarkProcessedData): Promise<void> {
    await this.model.findOneAndUpdate(
      { uid },
      { uid, processedAt: new Date(), ...data },
      { upsert: true },
    );
  }
}
