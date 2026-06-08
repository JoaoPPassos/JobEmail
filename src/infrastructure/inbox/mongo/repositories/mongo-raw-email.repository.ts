import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RawEmailEntity } from '../schemas/raw-email.schema.js';
import { InboxEmail } from '../../../../domain/inbox/inbox.types.js';

@Injectable()
export class MongoRawEmailRepository {
  private readonly logger = new Logger(MongoRawEmailRepository.name);

  constructor(
    @InjectModel(RawEmailEntity.name)
    private readonly model: Model<RawEmailEntity>,
  ) {}

  async saveOne(userId: string, email: InboxEmail): Promise<void> {
    await this.model.create({
      userId,
      uid: `${userId}:INBOX:${email.uid}`,
      from: email.from,
      subject: email.subject,
      body: email.body,
      fetchedAt: new Date(),
    });
    this.logger.log(
      `[saveOne] Saved raw email UID=${email.uid} for userId=${userId}`,
    );
  }

  async saveAll(userId: string, emails: InboxEmail[]): Promise<void> {
    if (!emails.length) return;

    const docs = emails.map((email) => ({
      userId,
      uid: `${userId}:INBOX:${email.uid}`,
      from: email.from,
      subject: email.subject,
      body: email.body,
      fetchedAt: new Date(),
    }));

    await this.model.insertMany(docs, { ordered: false });
    this.logger.log(
      `[saveAll] Saved ${docs.length} raw email(s) for userId=${userId}`,
    );
  }
}
